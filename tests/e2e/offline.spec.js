// @ts-check
// Once a page has loaded an entry's files, the controls make no network
// requests (CONTRACT.md, "Offline"): a host can cache those files and run
// the page offline. Each test loads a page, cuts the network, uses the
// control, and checks it asked for nothing.
const { test, expect } = require('@playwright/test');
const { ink, instantDrawing } = require('./helpers');

// Cuts the network and records every request from then on (data: and
// blob: URLs aren't requests to the network).
async function offline(page, context) {
  const requests = [];
  page.on('request', request => {
    if (!/^(data|blob):/.test(request.url())) requests.push(request.url());
  });
  await context.setOffline(true);
  return requests;
}

test('Turtle Tiles records, plays, saves and shares a link with no network', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto('/logo/tiles/');
  const button = name => page.getByRole('button', { name, exact: true });
  await expect(button('Record')).toBeVisible();
  const requests = await offline(page, context);

  await button('Record').click();
  await button('Move 2').click();
  await button('Turn right 90').click();
  await button('Move 2').click();
  await expect(page.locator('.tt-strip > .tt-item')).toHaveCount(3);
  await button('Record').click();
  await button('Rewind').click();
  await button('Play').click();
  await expect.poll(() => ink(page.locator('.tt-stage canvas.logo-sandbox'))).toBeGreaterThan(100);
  const saved = await page.evaluate(() => localStorage.getItem('mckoss.logo.tiles'));
  expect(saved).toContain('"move"');
  await button('Grown-ups (hold)').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Share a link' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();

  expect(requests).toEqual([]);
});

test('a lesson example runs, and the Playground runs and searches its reference, with no network', async ({ page, context }) => {
  await instantDrawing(page);
  await page.goto('/logo/newwords/');
  const square = page.locator('logo-example').nth(1);
  await expect(square.getByRole('button', { name: 'Run' })).toBeVisible();
  let requests = await offline(page, context);
  await square.getByRole('button', { name: 'Run' }).click();
  await expect.poll(() => ink(page.locator('.logo-panel canvas').first())).toBeGreaterThan(100);
  expect(requests).toEqual([]);

  await context.setOffline(false);
  await page.goto('/logo/playground/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  requests = await offline(page, context);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => ink(page.locator('.pg-stage canvas').first())).toBeGreaterThan(100);
  await page.locator('.pg-reference-search').fill('repeat');
  await expect(page.locator('.pg-reference-body .pg-ref-entry:not([hidden])').first()).toContainText('repeat');
  expect(requests).toEqual([]);
});
