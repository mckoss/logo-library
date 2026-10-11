// @ts-check
// The demo hosts built to be served under /logo-library/ (SITE_BASE, as on
// GitHub Pages): pages, assets and the controls' links all stay under it.
const { test, expect } = require('@playwright/test');

const BASE = '/logo-library';

test('under a base path, a lesson runs and Open in Playground stays under it', async ({ page, baseURL }) => {
  const outside = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === new URL(baseURL || '').origin && !url.pathname.startsWith(BASE + '/')) {
      outside.push(url.pathname);
    }
  });
  await page.goto(`${BASE}/logo/newwords/`);
  const square = page.locator('.logo-code').nth(1);
  await square.getByRole('button', { name: 'Run' }).click();
  await expect(square.getByRole('button', { name: 'Run' })).toBeVisible();
  await page.locator('.logo-code').nth(3).getByRole('button', { name: 'Open in Playground' }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/logo/playground/$`));
  await expect(page.locator('.pg-files button[aria-current]')).toHaveText('Make Your Own Words');
  expect(outside).toEqual([]);
});

test('under a base path, the reference links to the music player under it', async ({ page }) => {
  await page.goto(`${BASE}/logo/reference/`);
  const link = page.getByRole('link', { name: 'music player' });
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/logo/player/$`));
});

test('under a base path, the Playground examples and Turtle Tiles link under it', async ({ page }) => {
  await page.goto(`${BASE}/logo/playground/`);
  const data = await page.locator('script.pg-examples-data').textContent();
  for (const lesson of JSON.parse(data || '[]')) expect(lesson.url.startsWith(`${BASE}/logo/`)).toBe(true);
  await page.goto(`${BASE}/logo/tiles/`);
  await expect(page.locator('turtle-tiles a').filter({ hasText: /lessons/i }).first())
    .toHaveAttribute('href', `${BASE}/logo/`);
});
