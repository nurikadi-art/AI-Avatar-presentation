import { test, expect } from '@playwright/test';
import { uniq, login, createBoard, addList, addCard, getColumn, dragCardToColumn, renameList } from './helpers';

test('two clients on one board see each other changes without reloading', async ({ browser }) => {
  const boardName = uniq('LiveSync');
  const cardTitle = uniq('Sync card');

  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await login(pageA);
  const boardId = await createBoard(pageA, { name: boardName });
  await addList(pageA, 'Alpha');
  await addList(pageA, 'Beta');

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await login(pageB);
  await pageB.goto(`/b/${boardId}`);
  await expect(getColumn(pageB, 'Alpha')).toBeVisible();

  await addCard(pageA, 'Alpha', cardTitle);
  await expect(getColumn(pageB, 'Alpha').getByText(cardTitle)).toBeVisible({ timeout: 3000 });

  await dragCardToColumn(pageA, cardTitle, 'Beta');
  await expect(getColumn(pageB, 'Beta').getByText(cardTitle)).toBeVisible({ timeout: 3000 });

  const renamed = uniq('Gamma');
  await renameList(pageB, 'Beta', renamed);
  await expect(pageA.getByRole('button', { name: renamed, exact: true })).toBeVisible({ timeout: 3000 });

  await ctxA.close();
  await ctxB.close();
});
