// @ts-check
// The library's own example pages (examples/), plain HTML with no site
// around them: built by demo/build-hosts.mjs into the site's root (/), and
// under /logo-library/ for GitHub Pages. They hold their own Playground and
// music player pages, which the controls link to (logo-library-root), and
// keep their saved programs under the logo-library-demo. prefix.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { ink } = require('./helpers');

const PAGES = ['', 'example/', 'worksheet/', 'playground/', 'reference/', 'player/', 'tiles/'];
const PREFIX = 'logo-library-demo.';

// Draw instantly (the examples keep their settings under PREFIX).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => {
    try {
      if (!localStorage.getItem(key)) localStorage.setItem(key, 'instant');
    } catch (e) { /* storage blocked */ }
  }, PREFIX + 'mckoss.logo.speed');
});

// Collects console errors, failed requests and error responses, and the
// paths of same-origin requests.
function watch(page, baseURL) {
  const problems = [];
  const paths = [];
  page.on('console', message => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
  page.on('pageerror', error => problems.push(`page error: ${error.message}`));
  page.on('requestfailed', request => problems.push(`failed: ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === new URL(baseURL || '').origin) paths.push(url.pathname);
  });
  return { problems, paths };
}

for (const base of ['/', '/logo-library/']) {
  for (const rel of PAGES) {
    test(`${base}${rel} loads with no errors and no requests outside ${base}`, async ({ page, baseURL }) => {
      const { problems, paths } = watch(page, baseURL);
      await page.goto(base + rel);
      await page.waitForLoadState('networkidle');
      const tag = { 'example/': 'logo-example', 'worksheet/': 'logo-worksheet', 'playground/': 'logo-playground',
        'reference/': 'logo-reference', 'player/': 'logo-example', 'tiles/': 'turtle-tiles' }[rel];
      if (tag) expect(await page.evaluate(name => !!customElements.get(name), tag)).toBe(true);
      expect(problems).toEqual([]);
      expect(paths.filter(p => !p.startsWith(base))).toEqual([]);
    });
  }
}

test('each page shows its markup exactly as written in its source', async ({ page }) => {
  for (const rel of PAGES) {
    const source = fs.readFileSync(path.join(__dirname, '../../examples', rel, 'index.html'), 'utf8');
    await page.goto('/' + rel);
    // (one block per element, separated by blank lines)
    for (const markup of await page.locator('pre.markup').allTextContents()) {
      for (const block of markup.split(/\n\n(?=<)/)) {
        expect(source, `${rel}: the markup it shows is in its source`).toContain(block);
      }
    }
  }
});

test('the index links to every example page, and its links resolve', async ({ page, baseURL }) => {
  for (const base of ['/', '/logo-library/']) {
    await page.goto(base);
    await expect(page.locator('.version')).toHaveText(`Version ${require('../../package.json').version}`);
    const hrefs = await page.locator('a').evaluateAll(links => links.map(a => /** @type {HTMLAnchorElement} */ (a).href));
    const local = hrefs.filter(href => href.startsWith(baseURL || ''));
    for (const rel of [...PAGES.slice(1), 'logo/']) expect(local).toContain(new URL(base + rel, baseURL).href);
    for (const href of local) expect((await page.request.get(href)).status(), href).toBe(200);
    // and every example page links back to the index
    for (const rel of PAGES.slice(1, -1)) {
      await page.goto(base + rel);
      await page.getByRole('link', { name: 'logo-library' }).click();
      await expect(page).toHaveURL(new URL(base, baseURL).href);
    }
  }
});

test('an example runs and draws', async ({ page }) => {
  await page.goto('/example/');
  const square = page.locator('logo-example').nth(1);
  await expect(square.getByLabel('Command to run after the program')).toHaveValue('square 100');
  await square.getByRole('button', { name: 'Run' }).click();
  await expect.poll(() => ink(page.locator('.logo-panel canvas').first())).toBeGreaterThan(100);
  await expect(square.getByRole('button', { name: 'Run' })).toBeVisible();
});

for (const base of ['/', '/logo-library/']) {
  test(`Open in Playground goes to the examples' Playground, under ${base}`, async ({ page }) => {
    await page.goto(`${base}example/`);
    await page.locator('logo-example').nth(2).getByRole('button', { name: 'Open in Playground' }).click();
    await expect(page).toHaveURL(new RegExp(`${base}playground/$`));
    await expect(page.locator('.pg-files button[aria-current]')).toHaveText('Flower');
    await expect(page.locator('.pg-editor')).toHaveValue(/to flower :size/);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain(PREFIX + 'mckoss.logo.files');
    expect(keys.filter(key => key.startsWith('mckoss.'))).toEqual([]);
  });
}

test('the worksheet\'s Check draws the answer in the box', async ({ page }) => {
  await page.goto('/worksheet/');
  await expect(page.locator('.logo-box')).toHaveCount(2);
  await page.getByRole('button', { name: 'Check' }).nth(1).click();
  await expect.poll(() => ink(page.locator('.logo-box').nth(1).locator('canvas').first())).toBeGreaterThan(100);
});

test('the Playground runs a program from its Examples folder, which links to the example pages', async ({ page }) => {
  await page.goto('/playground/');
  await expect(page.locator('.pg-examples summary')).toHaveText([/^Shapes/, /^Patterns/]);
  await page.locator('.pg-examples summary', { hasText: 'Shapes' }).click();
  await page.locator('.pg-examples button', { hasText: 'Square' }).click();
  await expect(page.locator('.pg-name')).toHaveText('Square');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => ink(page.locator('.pg-stage canvas').first())).toBeGreaterThan(1000);
  await page.locator('.pg-examples summary a').first().click();
  await expect(page).toHaveURL(/\/example\/$/);
});

test('the reference finds forward, and links to the music player page', async ({ page }) => {
  for (const base of ['/', '/logo-library/']) {
    await page.goto(`${base}reference/`);
    const reference = page.locator('logo-reference');
    await expect(reference.getByText('Type a few letters, like fo for forward.')).toBeVisible();
    await reference.getByLabel('Find a command').fill('forward');
    const found = reference.locator('.pg-ref-entry:visible');
    await expect(found.first()).toBeVisible();
    await expect(found.locator('dt', { hasText: /^forward\b/ }).first()).toBeVisible();
    await reference.getByLabel('Find a command').fill('');
    await reference.getByRole('link', { name: 'music player' }).click();
    await expect(page).toHaveURL(new RegExp(`${base}player/$`));
  }
});

test.describe('Turtle Tiles', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

  for (const base of ['/', '/logo-library/']) {
    test(`renders full screen, adds a tile, and links back to the index, under ${base}`, async ({ page }) => {
      await page.goto(`${base}tiles/`);
      const tiles = page.locator('turtle-tiles');
      await expect(tiles).toHaveAttribute('role', 'main');
      const box = await tiles.boundingBox();
      expect(box && Math.round(box.height)).toBe(820);
      await page.getByRole('button', { name: 'Record', exact: true }).click();
      await page.getByRole('button', { name: 'Move 2', exact: true }).tap();
      await expect(page.locator('.tt-strip > .tt-item')).toHaveCount(1);
      await expect.poll(() => ink(page.locator('.tt-stage canvas.logo-sandbox'))).toBeGreaterThan(100);
      await expect(page.locator('turtle-tiles a.tt-menu-link')).toHaveAttribute('href', base);
    });
  }
});
