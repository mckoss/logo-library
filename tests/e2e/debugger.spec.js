// The playground's debugger: stepping, PAUSE, procedure breakpoints.
const { test, expect } = require('@playwright/test');
const { instantDrawing } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await instantDrawing(page);
  await page.goto('/logo/playground/');
});

const panel = page => page.locator('.pg-debug');
const where = page => page.locator('.pg-debug-where');
const finished = page => expect(page.locator('.pg-run.logo-running')).toHaveCount(0);

test('Step runs a program one command at a time', async ({ page }) => {
  await page.locator('.pg-editor').fill('fd 10 rt 90 fd 20');
  await page.getByRole('button', { name: 'Step', exact: true }).first().click();
  await expect(where(page)).toHaveText('Next: fd 10');
  await expect(panel(page).locator('.pg-debug-turtle')).toContainText('heading0');
  const step = page.getByRole('button', { name: 'Step', exact: true });
  // The panel stays up while a step runs, so the page doesn't jump.
  await panel(page).evaluate(p => {
    window.panelHid = false;
    new MutationObserver(() => { if (p.hidden) window.panelHid = true; }).observe(p, { attributes: true });
  });
  await step.click();
  await expect(where(page)).toHaveText('Next: rt 90');
  await expect(panel(page).locator('.pg-debug-turtle')).toContainText('position0, 10');
  await step.click();
  await expect(where(page)).toHaveText('Next: fd 20');
  await expect(panel(page).locator('.pg-debug-turtle')).toContainText('heading90');
  expect(await page.evaluate(() => window.panelHid)).toBe(false);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(panel(page)).toBeHidden();
  await finished(page);
});

test('PAUSE stops a running program, showing its variables', async ({ page }) => {
  await page.locator('.pg-editor').fill('make "size 5\nfd 10\npause\nfd 20');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(where(page)).toHaveText('Paused by PAUSE');
  await expect(page.locator('.pg-debug-globals')).toContainText(':size5');
  await expect(page.getByLabel('Command', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await finished(page);
  await expect(page.getByLabel('Command', { exact: true })).toBeEnabled();
});

test('a breakpoint pauses when its procedure is called, with its inputs', async ({ page }) => {
  await page.locator('.pg-editor').fill('to sq :n\n  repeat 4 [fd :n rt 90]\nend\n\nto row\n  repeat 3 [sq 20 rt 120]\nend\n\nrow');
  const toggle = page.locator('.pg-break', { hasText: 'sq' });
  await expect(page.locator('.pg-break')).toHaveText(['sq', 'row']);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(where(page)).toHaveText('Breakpoint: sq 20');
  await expect(page.locator('.pg-debug-calls')).toHaveText('Inside: row');
  await expect(page.locator('.pg-debug-locals')).toContainText(':n (input to sq)20');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(where(page)).toHaveText('Breakpoint: sq 20');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(panel(page)).toBeHidden();
  await finished(page);
});

test('Step while running pauses the program', async ({ page }) => {
  await page.locator('.pg-editor').fill('repeat 100000 [fd 1 rt 1 wait 1]');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).first().click();
  await expect(panel(page)).toBeVisible();
  await expect(where(page)).toContainText('Next:');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await finished(page);
});
