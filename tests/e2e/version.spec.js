// The Logo programs share one version number, this package's (version in
// package.json), shown on the Logo page, the Playground and Turtle Tiles.
const { test, expect } = require('@playwright/test');
const { version } = require('../../package.json');

test('the Logo page, the Playground and Turtle Tiles show the same version', async ({ page }) => {
  const versions = [];
  for (const [url, selector] of [['/logo/', '.logo-version'], ['/logo/playground/', '.logo-version'],
    ['/logo/tiles/', '.tt-version'], ['/logo/tiles/', '.tt-menu-version']]) {
    await page.goto(url);
    const text = (await page.locator(selector).first().textContent()).trim();
    const semver = text.match(/v(\d+\.\d+\.\d+(?:-[\w.]+)?)$/);
    expect(semver, `${url} shows a version: "${text}"`).not.toBeNull();
    versions.push(semver[1]);
  }
  expect(new Set(versions).size).toBe(1);
  expect(versions[0]).toBe(version);
});
