import { test, expect } from '@playwright/test';
import { uniq, login, createBoard } from './helpers';

test('invite copy-link + accept, private-board isolation, and admin password reset', async ({ page, browser }) => {
  const memberEmail = `${uniq('member')}@example.com`;
  const secretName = uniq('Secret');
  const firstPassword = 'member-password-1';
  const newPassword = 'member-password-2';

  await login(page);
  const secretId = await createBoard(page, { name: secretName, visibility: 'private' });

  const invite = await page.request.post('/api/admin/invites', { data: { email: memberEmail } });
  expect(invite.ok()).toBeTruthy();
  const inviteLink = (await invite.json()).link as string;
  expect(inviteLink).toContain('/invite/');

  const memberCtx = await browser.newContext();
  const memberPage = await memberCtx.newPage();
  await memberPage.goto(inviteLink);
  await memberPage.getByLabel('Name').fill('Mel Member');
  await memberPage.getByLabel('Password').fill(firstPassword);
  await memberPage.getByRole('button', { name: /join/i }).click();
  await memberPage.waitForURL((url) => url.pathname === '/');
  const meNew = await (await memberPage.request.get('/api/auth/me')).json();
  expect(meNew.email).toBe(memberEmail);

  await expect(
    memberPage.getByRole('button', { name: /create your first board|\+ new board/i }),
  ).toBeVisible();
  await expect(memberPage.getByText(secretName)).toHaveCount(0);
  const denied = await memberPage.request.get(`/api/boards/${secretId}`);
  expect(denied.ok()).toBeFalsy();
  expect([403, 404]).toContain(denied.status());

  const membersBody = await (await page.request.get('/api/admin/members')).json();
  const roster = Array.isArray(membersBody) ? membersBody : membersBody.members;
  const memberRow = roster.find((m: { email: string }) => m.email === memberEmail);
  expect(memberRow).toBeTruthy();
  const reset = await page.request.post(`/api/admin/members/${memberRow.id}/reset-password`);
  expect(reset.ok()).toBeTruthy();
  const resetLink = (await reset.json()).link as string;
  expect(resetLink).toContain('/reset/');

  const resetCtx = await browser.newContext();
  const resetPage = await resetCtx.newPage();
  await resetPage.goto(resetLink);
  await resetPage.getByLabel('New password').fill(newPassword);
  await resetPage.getByRole('button', { name: /save password/i }).click();
  await resetPage.waitForURL((url) => url.pathname === '/');

  const verifyCtx = await browser.newContext();
  const verifyPage = await verifyCtx.newPage();
  await login(verifyPage, memberEmail, newPassword);
  await expect(verifyPage).toHaveURL(/\/$/);

  await memberCtx.close();
  await resetCtx.close();
  await verifyCtx.close();
});
