// Music timing: notes play one after another, even on a page's first run,
// while the browser's audio is still starting up.
const { test, expect } = require('@playwright/test');

// In Google Chrome itself, with its autoplay policy on as real visitors have
// it (Playwright turns it off). Playwright's own headless browser never
// starts audio under that policy, so it can't show the bug.
test.use({
  channel: 'chrome',
  launchOptions: { ignoreDefaultArgs: ['--autoplay-policy=no-user-gesture-required'] },
});

test('the first notes on a page are spaced out, not played together', async ({ page }) => {
  await page.addInitScript(() => {
    window.__starts = [];
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when, ...rest) {
      window.__starts.push(when);
      return start.call(this, when, ...rest);
    };
  });
  await page.goto('/logo/logomusic/');
  await page.locator('.logo-code').first().getByRole('button', { name: 'Run' }).click();
  await expect.poll(() => page.evaluate(() => window.__starts.length), { timeout: 5000 }).toBeGreaterThan(4);
  const starts = await page.evaluate(() => window.__starts);
  // Quarter notes at 240 beats a minute: a quarter second apart.
  for (let i = 1; i < 5; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThan(0.2);
});
