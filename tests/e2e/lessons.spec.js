// The runnable examples and worksheets on the Logo lesson pages.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { instantDrawing, ink } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await instantDrawing(page);
});

test('Run draws an example that uses a word defined later on the page', async ({ page }) => {
  await page.goto('/logo/newwords/');
  const block = page.locator('.logo-code').nth(1);
  await expect(block.locator('code')).toHaveText('SQUARE');
  await block.getByRole('button', { name: 'Run' }).click();
  const canvas = page.locator('.logo-panel canvas').first();
  await expect.poll(() => ink(canvas)).toBeGreaterThan(100);
  await expect(block.getByRole('button', { name: 'Run' })).toBeVisible();
});

test('examples can be edited and reverted', async ({ page }) => {
  await page.goto('/logo/newwords/');
  const block = page.locator('.logo-code').first();
  const code = block.locator('code');
  const revert = block.getByRole('button', { name: 'Revert Code' });
  await expect(revert).toBeDisabled();
  await code.fill('REPEAT 3 [FD 100 RT 120]');
  await expect(revert).toBeEnabled();
  await code.fill('REPEAT 4 [FD 100 RT 90]');
  await expect(revert).toBeDisabled();
  await code.fill('REPEAT 3 [FD 100 RT 120]');
  await revert.click();
  await expect(code).toHaveText('REPEAT 4 [FD 100 RT 90]');
  await expect(revert).toBeDisabled();
});

test('the Then run command runs after the program', async ({ page }) => {
  await page.goto('/logo/wordnumbers/');
  const block = page.locator('.logo-code').first();
  const command = block.getByLabel('Command to run after the program');
  await expect(command).toHaveValue('SQUARE 100');
  await command.fill('PRINT [hello turtle]');
  await command.press('Enter');
  await expect(page.locator('.logo-output').first()).toHaveText('hello turtle');
});

test('errors are shown under the example', async ({ page }) => {
  await page.goto('/logo/turtle/');
  const block = page.locator('.logo-code').first();
  await block.locator('code').fill('FORWRD 100');
  await block.getByRole('button', { name: 'Run' }).click();
  const output = page.locator('.logo-output').first();
  await expect(output).toHaveClass(/logo-error/);
  await expect(output).toContainText('FORWRD');
});

test('Copy puts the example on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/logo/polygons/');
  const block = page.locator('.logo-code').first();
  await block.getByRole('button', { name: 'Copy' }).click();
  await expect(block.getByRole('button', { name: 'Copied' })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('REPEAT 3 [FD 100 RT 120]');
});

test('Open in Playground adds a complete program to My Programs', async ({ page }) => {
  await page.goto('/logo/newwords/');
  await page.locator('.logo-code').nth(3).getByRole('button', { name: 'Open in Playground' }).click();
  await expect(page).toHaveURL(/\/logo\/playground\/$/);
  await expect(page.locator('.pg-files button[aria-current]')).toHaveText('Make Your Own Words');
  const editor = page.locator('.pg-editor');
  await expect(editor).toHaveValue(/TO SQUARE/);
  await expect(editor).toHaveValue(/REPEAT 36 \[SQUARE RT 10\]/);
});

test('Snapshot saves the drawing as a PNG named for the lesson and example', async ({ page }) => {
  await page.goto('/logo/turtle/');
  await page.locator('.logo-code').first().getByRole('button', { name: 'Run' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Snapshot' }).click();
  expect((await downloading).suggestedFilename())
    .toMatch(/^Turtle Basics - Example 1 \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.png$/);
});

test('Make Recording saves a video of the whole run', async ({ page }) => {
  await page.goto('/logo/funprog/');
  const block = page.locator('.logo-code').first();
  await block.getByRole('button', { name: 'Run' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Make Recording' }).click();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await expect(block.getByRole('button', { name: 'Stop' })).toBeVisible();
  expect((await downloading).suggestedFilename()).toMatch(/^Fun Programs - Pumpkin \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.(mp4|webm)$/);
  await expect(page.getByRole('button', { name: 'Make Recording' })).toBeVisible();
  await expect(block.getByRole('button', { name: 'Run' })).toBeVisible();
});

test('Make Recording puts the music on the sound track', async ({ page }) => {
  await page.goto('/logo/logomusic/');
  const block = page.locator('.logo-code').first();
  await block.getByRole('button', { name: 'Run' }).click();
  await block.getByRole('button', { name: 'Stop' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Make Recording' }).click();
  const video = fs.readFileSync(await (await downloading).path());
  // An Opus (WebM) or AAC (MP4) audio track.
  expect(video.includes('OpusHead') || video.includes('mp4a')).toBe(true);
});

test('the speed setting is shared by every example and remembered', async ({ page }) => {
  await page.goto('/logo/newwords/');
  const speeds = page.getByLabel('Drawing speed');
  await speeds.first().selectOption('crawl');
  for (const select of await speeds.all()) await expect(select).toHaveValue('crawl');
  await page.reload();
  await expect(speeds.last()).toHaveValue('crawl');
});

test('Stop ends a long run', async ({ page }) => {
  await page.goto('/logo/repeat/');
  const block = page.locator('.logo-code').first();
  await block.locator('code').fill('REPEAT 100000 [FD 1 RT 1 WAIT 1]');
  await block.getByRole('button', { name: 'Run' }).click();
  const stop = block.getByRole('button', { name: 'Stop' });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(block.getByRole('button', { name: 'Run' })).toBeVisible();
});

test('worksheet Check draws the answer in the box', async ({ page }) => {
  await page.goto('/logo/logows2/');
  await page.getByRole('button', { name: 'Check' }).nth(1).click();
  const canvas = page.locator('.logo-box').nth(1).locator('canvas').first();
  await expect.poll(() => ink(canvas)).toBeGreaterThan(100);
});

test('every Run starts from a fresh screen, pen and turtle', async ({ page }) => {
  await page.goto('/logo/funprog/');
  const block = page.locator('.logo-code').first();
  await block.getByLabel('Command to run after the program').fill('pumpkins');
  const sandbox = page.locator('.logo-panel canvas.logo-sandbox').first();
  const pixels = () => sandbox.evaluate(c => c.toDataURL());
  // Run, wait for the run to end, fit the drawing in view (auto-fit only
  // zooms out, and how far depends on when it looked, so compare the
  // drawings at the view that fits them), then wait for it to settle.
  const fit = page.locator('.logo-panel').first().getByRole('button', { name: 'Fit the drawing in view' });
  const runAndSettle = async () => {
    await block.getByRole('button', { name: 'Run' }).click();
    await expect(block.locator('.logo-running')).toHaveCount(0);
    await page.waitForTimeout(500);  // (any glide ends)
    await fit.click({ force: true });
    let last = null;
    await expect.poll(async () => {
      const now = await pixels();
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [100, 200, 300] }).toBe(true);
    return last;
  };
  const first = await runAndSettle();
  expect(await runAndSettle()).toBe(first);
});

test('changing the Then run command enables Revert Code', async ({ page }) => {
  await page.goto('/logo/funprog/');
  const block = page.locator('.logo-code').first();
  const revert = block.getByRole('button', { name: 'Revert Code' });
  await expect(revert).toBeDisabled();
  const command = block.getByLabel('Command to run after the program');
  await command.fill('pumpkins');
  await expect(revert).toBeEnabled();
  await command.fill('pumpkin 200');
  await expect(revert).toBeDisabled();
  await command.fill('pumpkins');
  await revert.click();
  await expect(command).toHaveValue('pumpkin 200');
});

test('the Music Player example plays a scale when run', async ({ page }) => {
  await page.goto('/logo/player/');
  const block = page.locator('.logo-code').first();
  await expect(block.getByLabel('Command to run after the program')).toHaveValue('do re mi fa sol la ti high do');
});
