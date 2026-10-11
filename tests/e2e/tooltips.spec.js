// Tooltips for the words in Logo programs, and the playground's reference.
const { test, expect } = require('@playwright/test');
const { instantDrawing } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await instantDrawing(page);
});

const tip = page => page.locator('.logo-tip');

// Hovers the first occurrence of `word` inside an element's text.
async function hoverText(page, locator, word) {
  const point = await locator.evaluate((el, word) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent.indexOf(word);
      if (i < 0) continue;
      const range = document.createRange();
      range.setStart(n, i);
      range.setEnd(n, i + word.length);
      window.scrollBy(0, range.getBoundingClientRect().top - innerHeight / 2);
      const r = range.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return null;
  }, word);
  await page.mouse.move(point.x, point.y);
}

// Hovers `word` on line `row` (0-based) of the playground's editor.
async function hoverEditor(page, row, word) {
  const editor = page.locator('.pg-editor');
  await editor.scrollIntoViewIfNeeded();
  const point = await editor.evaluate((ta, [row, word]) => {
    const style = getComputedStyle(ta);
    const rect = ta.getBoundingClientRect();
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = style.font;
    const col = ta.value.split('\n')[row].indexOf(word) + word.length / 2;
    return {
      x: rect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft) + col * ctx.measureText('M').width,
      y: rect.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop) + (row + 0.5) * parseFloat(style.lineHeight),
    };
  }, [row, word]);
  await page.mouse.move(point.x, point.y);
}

test('hovering a command in a lesson shows its usage and inputs', async ({ page }) => {
  await page.goto('/logo/newwords/');
  await hoverText(page, page.locator('.logo-code code').first(), 'REPEAT');
  await expect(tip(page)).toBeVisible();
  await expect(tip(page)).toContainText('repeat expr [ statements ... ]');
});

test('hovering a procedure shows how it was defined', async ({ page }) => {
  await page.goto('/logo/newwords/');
  await hoverText(page, page.locator('.logo-code code').nth(3), 'SQUARE');
  await expect(tip(page)).toContainText('SQUARE');
  await expect(tip(page)).toContainText('A procedure defined in this program.');
});

test('procedures show the comment above them; inputs name their procedure', async ({ page }) => {
  await page.goto('/logo/funprog/');
  const pumpkin = page.locator('.logo-code code').first();
  await hoverText(page, pumpkin, 'fillpoly');
  await expect(tip(page)).toContainText('fillpoly :sides :size :color');
  await expect(tip(page)).toContainText('Draws a polygon filled in with a color');
  await page.mouse.move(0, 0);
  await expect(tip(page)).toBeHidden();
  await hoverText(page, pumpkin, ':color');
  await expect(tip(page)).toContainText('An input to fillpoly :sides :size :color');
});

test('the playground editor shows tooltips too', async ({ page }) => {
  await page.goto('/logo/playground/');
  await hoverEditor(page, 3, 'repeat');
  await expect(tip(page)).toContainText('repeat expr [ statements ... ]');
  await page.mouse.move(0, 0);
  await hoverEditor(page, 6, 'square');
  await expect(tip(page)).toContainText('square :size');
  await page.mouse.move(0, 0);
  await hoverEditor(page, 0, 'Click');
  await page.waitForTimeout(500);
  await expect(tip(page)).toBeHidden();
});

test('music words are in the reference and tooltips', async ({ page }) => {
  await page.goto('/logo/logomusic/');
  await hoverText(page, page.locator('.logo-code code').first(), 'sol');
  await expect(tip(page)).toContainText('Play a note of the scale.');
});

test('the reference covers every name jslogo accepts for a command, short ones too', async ({ page }) => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '../../vendor/jslogo/logo.js'), 'utf8');
  // Commands with more than one name: def(["setpencolor", "setpc", ...], ...).
  const names = [...source.matchAll(/def\(\[([^\]]+)\]/g)]
    .map(m => [...m[1].matchAll(/"([^"]+)"/g)].map(n => n[1]))
    .filter(group => group.length > 1)
    .flat();
  expect(names).toContain('setpc');
  await page.goto('/logo/playground/');
  const missing = await page.evaluate(names => names.filter(n => !window.LogoReference.lookup(n)), names);
  expect(missing).toEqual([]);
  // The short names show up in the reference itself, by their long ones.
  await page.locator('.pg-reference-search').fill('setpc');
  await expect(page.locator('.pg-reference-body')).toContainText('setpc logocolor');
});

test('searching the reference matches the start of command names; an exact name shows just it', async ({ page }) => {
  await page.goto('/logo/playground/');
  const search = page.locator('.pg-reference-search');
  const shown = () => page.locator('.pg-reference-body .pg-ref-entry:not([hidden]) dt').evaluateAll(dts =>
    dts.filter(dt => dt.offsetParent).map(dt => dt.textContent.trim().split(/\s+/)[0]));
  // An exact name: just that command, with its other names.
  await search.fill('rt');
  expect(await shown()).toEqual(['right', 'rt']);
  // Otherwise, names that start with what's typed (not ones that only
  // contain it).
  await search.fill('setp');
  const names = await shown();
  expect(names).toContain('setpencolor');
  expect(names).toContain('setpos');
  const entries = await page.locator('.pg-reference-body .pg-ref-entry:not([hidden])').evaluateAll(es =>
    es.filter(e => e.offsetParent).map(e => [...e.querySelectorAll('dt')].map(dt => dt.textContent.trim().split(/\s+/)[0])));
  expect(entries.every(names => names.some(n => n.startsWith('setp')))).toBe(true);
  expect(entries.flat()).not.toContain('pos');
  await search.fill('');
  expect((await shown()).length).toBeGreaterThan(200);
});

test('the reference has a page of its own, without the playground', async ({ page }) => {
  await page.goto('/logo/reference/');
  await expect(page.locator('.logo-playground')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.LogoInterpreter)).toBe('undefined');
  await page.locator('.pg-reference-search').fill('repeat');
  await expect(page.locator('.pg-reference-body .pg-ref-entry:not([hidden])').first()).toContainText('repeat');
  // The Logo page links to it.
  await page.goto('/logo/');
  await page.getByRole('link', { name: 'Logo Language Reference' }).first().click();
  await expect(page).toHaveURL(/\/logo\/reference\/$/);
});
