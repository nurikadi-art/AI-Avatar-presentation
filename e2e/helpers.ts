import { expect, type Page, type Locator } from '@playwright/test';

export const ADMIN = { email: 'admin@example.com', password: 'admin-password-123' };

/** Per-invocation unique suffix so specs never collide on a reused DB. */
export function uniq(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function login(page: Page, email = ADMIN.email, password = ADMIN.password): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname === '/');
}

async function openCreateBoardDialog(page: Page): Promise<void> {
  const firstBtn = page.getByRole('button', { name: /create your first board/i });
  const newTile = page.getByRole('button', { name: /\+ new board/i });
  await Promise.race([
    firstBtn.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
    newTile.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
  ]);
  if (await firstBtn.isVisible().catch(() => false)) await firstBtn.click();
  else await newTile.click();
  await page.getByLabel('Board name').waitFor({ state: 'visible' });
}

/** Creates a board via the Home create dialog and returns its id (from the URL). */
export async function createBoard(
  page: Page,
  opts: { name: string; visibility?: 'team' | 'private' },
): Promise<string> {
  await openCreateBoardDialog(page);
  await page.getByLabel('Board name').fill(opts.name);
  if (opts.visibility === 'private') {
    await page.getByRole('button', { name: 'private', exact: true }).click();
  }
  await page.getByRole('button', { name: /create board/i }).click();
  await page.waitForURL(/\/b\/[^/]+$/);
  return page.url().match(/\/b\/([^/?#]+)/)![1];
}

export function getColumn(page: Page, listName: string): Locator {
  return page
    .locator('div.w-72')
    .filter({ has: page.getByRole('button', { name: listName, exact: true }) });
}

export function getCard(page: Page, title: string): Locator {
  return page.getByText(title);
}

export async function addList(page: Page, name: string): Promise<void> {
  const composer = page.getByPlaceholder(/list name/i);
  if (!(await composer.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /add a list/i }).click();
  }
  await composer.fill(name);
  await composer.press('Enter');
  await page.getByRole('button', { name, exact: true }).waitFor({ state: 'visible' });
}

export async function addCard(page: Page, listName: string, title: string): Promise<void> {
  const column = getColumn(page, listName);
  const composer = column.getByPlaceholder(/card title/i);
  if (!(await composer.isVisible().catch(() => false))) {
    await column.getByRole('button', { name: /add a card/i }).click();
  }
  await composer.fill(title);
  await composer.press('Enter');
  await column.getByText(title).waitFor({ state: 'visible' });
}

export async function openCard(page: Page, title: string): Promise<{ boardId: string; cardId: string }> {
  await getCard(page, title).click();
  await page.waitForURL(/\/c\/[^/]+/);
  const m = page.url().match(/\/b\/([^/?#]+)\/c\/([^/?#]+)/)!;
  await expect(page.getByRole('dialog')).toBeVisible();
  return { boardId: m[1], cardId: m[2] };
}

/** Drags a card onto a target column with the incremental moves dnd-kit's PointerSensor needs. */
export async function dragCardToColumn(page: Page, cardTitle: string, targetListName: string): Promise<void> {
  const cardBox = await getCard(page, cardTitle).boundingBox();
  const targetBox = await getColumn(page, targetListName).boundingBox();
  if (!cardBox || !targetBox) throw new Error('drag source or target not found');
  const from = { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 };
  const to = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.move(to.x, to.y + 4, { steps: 5 });
  await page.mouse.up();
}

export async function renameList(page: Page, oldName: string, newName: string): Promise<void> {
  await getColumn(page, oldName).getByRole('button', { name: oldName, exact: true }).click();
  const input = page.locator('input:focus');
  await input.fill(newName);
  await input.press('Enter');
  await page.getByRole('button', { name: newName, exact: true }).waitFor({ state: 'visible' });
}
