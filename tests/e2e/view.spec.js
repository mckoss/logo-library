// Zoom and pan on the Logo stage: auto-fit, dragging, the view buttons and
// the home marker.
const { test, expect } = require('@playwright/test');
const { instantDrawing, ink } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await instantDrawing(page);
  await page.goto('/logo/playground/');
});

const stage = page => page.locator('.pg-stage .logo-stage');
const zoom = async page => Number(await stage(page).getAttribute('data-zoom'));

async function run(page, code) {
  await page.locator('.pg-editor').fill(code);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeDisabled();  // (it's over)
}

test('zooms out to keep a drawing in view instead of wrapping', async ({ page }) => {
  await run(page, 'fd 100');
  await expect.poll(() => zoom(page)).toBe(1);
  await run(page, 'fd 1000');
  await expect.poll(() => zoom(page)).toBeLessThan(0.5);
});

test('zooms out to keep the whole turtle in view, drawing or not', async ({ page }) => {
  // Pen up: nothing is drawn, but the turtle still may not leave.
  await run(page, 'pu fd 1000');
  await expect.poll(() => zoom(page)).toBeLessThan(0.5);
  // Just over the edge: a little zoom-out brings all of the turtle back.
  await run(page, 'pu rt 90 fd 290');
  await expect.poll(() => zoom(page)).toBeLessThan(1);
  await expect.poll(() => zoom(page)).toBeGreaterThan(0.5);
});

test('Run starts again from the starting view', async ({ page }) => {
  await run(page, 'fd 1000');
  await expect.poll(() => zoom(page)).toBeLessThan(0.5);
  await run(page, 'fd 50');
  await expect.poll(() => zoom(page)).toBe(1);
});

test('after zooming out, the next run draws from home at the starting view', async ({ page }) => {
  await run(page, 'fd 1000');
  await expect.poll(() => zoom(page)).toBeLessThan(0.5);
  await run(page, 'fd 50');
  await expect.poll(() => zoom(page)).toBe(1);
  // The line runs from home, in the middle, straight up 50 steps, where
  // the turtle is drawn (not where home was in the zoomed-out view).
  const inkAt = await stage(page).locator('canvas.logo-sandbox').evaluate(c => {
    const ctx = c.getContext('2d');
    const s = c.width / 600;  // the playground's view is 600 steps wide
    const dark = (x, y) => {
      const d = ctx.getImageData(Math.round(c.width / 2 + x * s) - 3, Math.round(c.height / 2 - y * s), 7, 1).data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100 && d[i] < 128) return true;
      return false;
    };
    return [dark(0, 25), dark(0, 75), dark(0, -25)];
  });
  expect(inkAt).toEqual([true, false, false]);
});

test('zoom buttons, Fit and Home', async ({ page }) => {
  await run(page, 'repeat 4 [fd 20 rt 90]');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => zoom(page)).toBeCloseTo(1.5);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => zoom(page)).toBeCloseTo(1 / 1.5);
  await page.getByRole('button', { name: 'Fit the drawing in view' }).click();
  await expect.poll(() => zoom(page)).toBeGreaterThan(3);  // with room for the turtle
  await page.getByRole('button', { name: 'Back to the starting view' }).click();
  await expect.poll(() => zoom(page)).toBe(1);
});

test('Ctrl+scroll zooms; plain scroll leaves the view alone', async ({ page }) => {
  await run(page, 'fd 50');
  await stage(page).scrollIntoViewIfNeeded();
  await stage(page).hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => zoom(page)).toBe(1);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(() => zoom(page)).toBeGreaterThan(1);
});

test('dragging moves the drawing and shows where home is', async ({ page }) => {
  await run(page, 'repeat 4 [fd 100 rt 90]');
  const canvas = stage(page).locator('canvas.logo-sandbox');
  const guides = stage(page).locator('canvas.logo-guides');
  await stage(page).scrollIntoViewIfNeeded();
  const box = await stage(page).boundingBox();
  const before = await canvas.screenshot();
  expect(await ink(guides)).toBe(0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 4 });
  expect(await ink(guides)).toBeGreaterThan(50);
  await page.mouse.up();
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await expect.poll(() => ink(guides), { timeout: 3000 }).toBe(0);
});

test('auto-fit never zooms back in or slides about until the screen is cleared', async ({ page }) => {
  await run(page, 'fd 400');
  await expect.poll(() => zoom(page)).toBeLessThan(1);
  await page.waitForTimeout(600);  // (the glide out ends)
  const out = await zoom(page);
  // Coming back home (from the command line, which keeps the drawing)
  // leaves the view as it is.
  const command = page.getByLabel('Command', { exact: true });
  await command.fill('pu bk 400 pd');
  await command.press('Enter');
  await page.waitForTimeout(600);
  expect(await zoom(page)).toBe(out);
  await command.fill('cs');
  await command.press('Enter');
  await expect.poll(() => zoom(page)).toBe(1);
});
