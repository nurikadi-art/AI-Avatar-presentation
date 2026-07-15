import { test, expect } from '@playwright/test';

test('serves the built app shell', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /company trello/i })).toBeVisible();
});

test('health endpoint responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toEqual({ status: 'ok' });
});
