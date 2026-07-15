import { test, expect } from '@playwright/test';
import { uniq, login, createBoard, addList, addCard, getColumn, dragCardToColumn, openCard } from './helpers';

test('build a board, drag a card, edit its detail, comment, and receive a notification', async ({ page, browser }) => {
  const boardName = uniq('Journey');
  const cardTitle = uniq('Design homepage');

  await login(page);
  await createBoard(page, { name: boardName });

  await addList(page, 'To Do');
  await addList(page, 'Doing');
  await addCard(page, 'To Do', cardTitle);
  await addCard(page, 'To Do', uniq('Write copy'));

  await dragCardToColumn(page, cardTitle, 'Doing');
  await expect(getColumn(page, 'Doing').getByText(cardTitle)).toBeVisible();

  const { cardId } = await openCard(page, cardTitle);
  const dialog = page.getByRole('dialog');
  const me = await (await page.request.get('/api/auth/me')).json();

  const field = (name: string) =>
    dialog.locator('section').filter({ has: page.getByRole('heading', { name, exact: true }) });

  await field('Labels').getByRole('checkbox').first().check();
  await field('Assignees').getByRole('checkbox').first().check();
  await dialog.locator('input[type="date"]').fill('2026-12-31');

  const checkInput = dialog.getByPlaceholder('Add an item');
  await checkInput.fill('Write tests');
  await checkInput.press('Enter');

  const commentInput = dialog.getByPlaceholder(/write a comment/i);
  await commentInput.fill('Looks good to me');
  await dialog.getByRole('button', { name: /comment|post|send/i }).first().click();
  await expect(dialog.getByText('Looks good to me')).toBeVisible();

  await expect
    .poll(async () => {
      const card = await (await page.request.get(`/api/cards/${cardId}`)).json();
      return {
        labels: card.labelIds.length,
        due: card.dueDate,
        assigned: card.assigneeIds.includes(me.id),
        checklist: card.checklist.length,
        comments: card.comments.length,
      };
    })
    .toEqual({ labels: 1, due: '2026-12-31', assigned: true, checklist: 1, comments: 1 });

  const bobEmail = `${uniq('bob')}@example.com`;
  const invite = await page.request.post('/api/admin/invites', { data: { email: bobEmail } });
  expect(invite.ok()).toBeTruthy();
  const token = (await invite.json()).link.match(/\/invite\/([^/?#]+)/)![1];

  const bob = await browser.newContext();
  const accepted = await bob.request.post('/api/auth/accept-invite', {
    data: { token, name: 'Bob', password: 'bob-password-123' },
  });
  expect(accepted.ok()).toBeTruthy();
  const bobComment = await bob.request.post(`/api/cards/${cardId}/comments`, {
    data: { body: 'Nice work from Bob' },
  });
  expect(bobComment.ok()).toBeTruthy();
  await bob.close();

  await expect
    .poll(async () => {
      const list = await (await page.request.get('/api/notifications')).json();
      return list.some((n: { cardId: string }) => n.cardId === cardId);
    })
    .toBe(true);

  await page.goto('/');
  await page.getByRole('button', { name: /notifications/i }).click();
  await expect(page.getByText(cardTitle)).toBeVisible();
});
