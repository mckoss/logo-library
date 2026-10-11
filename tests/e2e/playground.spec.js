// The Logo Playground: running programs, the command line, and the file
// manager's programs saved in localStorage.
const { test, expect } = require('@playwright/test');
const { instantDrawing, ink } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await instantDrawing(page);
  await page.goto('/logo/playground/');
});

const files = page => page.locator('.pg-files button');
const current = page => page.locator('.pg-files button[aria-current]');
const editor = page => page.locator('.pg-editor');

// Accepts the next prompt() or confirm(), answering a prompt with `answer`
// or, by default, the value it suggests.
function answerDialog(page, answer) {
  page.once('dialog', dialog => dialog.accept(answer ?? dialog.defaultValue()));
}

test('starts with a program that draws when run', async ({ page }) => {
  await expect(current(page)).toHaveText('My First Program');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => ink(page.locator('.pg-stage canvas').first())).toBeGreaterThan(1000);
});

test('Reset erases the drawing', async ({ page }) => {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const canvas = page.locator('.pg-stage canvas.logo-sandbox');
  await expect.poll(() => ink(canvas)).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect.poll(() => ink(canvas)).toBe(0);
});

test('while a program runs, Play is Pause, which shows the step panel; then Play carries on; Reset stops it', async ({ page }) => {
  await editor(page).fill('repeat 100000 [fd 1 rt 1 wait 1]');
  const run = page.locator('.pg-run');
  const panel = page.locator('.pg-debug');
  await run.click();
  await expect(run).toHaveText('Pause');
  await run.click();
  await expect(panel).toBeVisible();
  await expect(run).toHaveText('Play');  // carries on from here
  await run.click();
  await expect(panel).toBeHidden();
  await expect(run).toHaveText('Pause');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(run).toHaveText('Play');
  await expect.poll(() => ink(page.locator('.pg-stage canvas.logo-sandbox'))).toBe(0);
});

test('the command line runs one line at a time', async ({ page }) => {
  const command = page.getByLabel('Command', { exact: true });
  await command.fill('print 2 + 3');
  await command.press('Enter');
  await expect(page.locator('.logo-output')).toHaveText('5');
  await command.fill('print sum 1 1');
  await command.press('Enter');
  await expect(page.locator('.logo-output')).toHaveText('5\n2');
  await command.press('ArrowUp');
  await expect(command).toHaveValue('print sum 1 1');
});

test('reports errors in the output', async ({ page }) => {
  await editor(page).fill('fd');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.logo-output')).toHaveClass(/logo-error/);
});

test('new programs are saved in the browser', async ({ page }) => {
  answerDialog(page, 'Spiral');
  await page.getByRole('button', { name: 'New' }).click();
  await expect(current(page)).toHaveText('Spiral');
  await editor(page).fill('repeat 100 [fd repcount rt 90]');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(files(page)).toHaveText(['My First Program', 'Spiral']);
  await files(page).filter({ hasText: 'Spiral' }).click();
  await expect(editor(page)).toHaveValue('repeat 100 [fd repcount rt 90]');
});

test('copy, rename and delete', async ({ page }) => {
  answerDialog(page, 'Squares');
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(files(page)).toHaveText(['My First Program', 'Squares']);
  await expect(editor(page)).toHaveValue(/repeat 36/);

  answerDialog(page, 'More Squares');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(files(page)).toHaveText(['More Squares', 'My First Program']);

  answerDialog(page);
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(files(page)).toHaveText(['My First Program']);
});

test('names stay unique', async ({ page }) => {
  answerDialog(page, 'My First Program');
  await page.getByRole('button', { name: 'New' }).click();
  await expect(files(page)).toHaveText(['My First Program', 'My First Program 2']);
});

test('Download saves the program as a .lgo file', async ({ page }) => {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('My First Program.lgo');
  const text = require('fs').readFileSync(await download.path(), 'utf8');
  expect(text).toContain('to square :size');
});

test('Open file adds programs from the computer', async ({ page }) => {
  await page.locator('.pg-file-input').setInputFiles({
    name: 'star.lgo', mimeType: 'text/plain', buffer: Buffer.from('repeat 5 [fd 100 rt 144]\r\n'),
  });
  await expect(current(page)).toHaveText('star');
  await expect(editor(page)).toHaveValue('repeat 5 [fd 100 rt 144]\n');
});

test('examples are read-only and can be copied', async ({ page }) => {
  await page.locator('.pg-examples summary', { hasText: 'Fun Programs' }).click();
  await page.locator('.pg-examples button', { hasText: 'Pumpkin' }).click();
  await expect(page.locator('.pg-name')).toHaveText('Pumpkin');
  await expect(editor(page)).not.toBeEditable();
  await expect(page.getByRole('button', { name: 'Rename' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => ink(page.locator('.pg-stage canvas').first())).toBeGreaterThan(1000);

  answerDialog(page);
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(current(page)).toHaveText('Pumpkin');
  await expect(editor(page)).toBeEditable();
  await expect(editor(page)).toHaveValue(/to pumpkin :size/);
});

test.describe('snapshot and recording names', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('Snapshot is named for the program and the time', async ({ page }) => {
    await page.clock.setFixedTime('2026-10-08T14:05:32-07:00');
    let downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Snapshot' }).click();
    expect((await downloading).suggestedFilename()).toBe('My First Program 2026-10-08 14.05.32.png');

    await page.clock.setFixedTime('2026-10-08T14:05:33-07:00');
    downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Snapshot' }).click();
    expect((await downloading).suggestedFilename()).toBe('My First Program 2026-10-08 14.05.33.png');
  });

  test('an example is named for its lesson and name', async ({ page }) => {
    await page.clock.setFixedTime('2026-10-08T09:00:00-07:00');
    await page.locator('.pg-examples summary', { hasText: 'Fun Programs' }).click();
    await page.locator('.pg-examples button', { hasText: 'Pumpkin' }).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Snapshot' }).click();
    expect((await downloading).suggestedFilename()).toBe('Fun Programs - Pumpkin 2026-10-08 09.00.00.png');
  });
});

test('Make Recording clears the stage and films the whole run', async ({ page }) => {
  const command = page.getByLabel('Command', { exact: true });
  await command.fill('print "leftover');
  await command.press('Enter');
  await expect(page.locator('.logo-output')).toHaveText('leftover\n');

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Make Recording' }).click();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await expect(page.locator('.pg-run')).toHaveText('Pause');
  expect((await downloading).suggestedFilename()).toMatch(/^My First Program \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.(mp4|webm)$/);
  await expect(page.getByRole('button', { name: 'Make Recording' })).toBeVisible();
  await expect(page.locator('.pg-run')).toHaveText('Play');
  await expect(page.locator('.logo-output')).toBeHidden();
  expect(await ink(page.locator('.pg-stage canvas').first())).toBeGreaterThan(1000);
});

test('Stop recording ends a long run and saves the video so far', async ({ page }) => {
  await editor(page).fill('repeat 100000 [fd 1 rt 1 wait 1]');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.pg-run')).toHaveText('Pause');
  // Make Recording during a run starts it over, recording.
  await page.getByRole('button', { name: 'Make Recording' }).click();
  const stop = page.getByRole('button', { name: 'Stop recording' });
  await expect(stop).toBeVisible();
  await page.waitForTimeout(800);
  const downloading = page.waitForEvent('download');
  await stop.click();
  expect((await downloading).suggestedFilename()).toMatch(/\.(mp4|webm)$/);
  await expect(page.locator('.pg-run')).toHaveText('Play');
});

test('Run starts fresh; the command line keeps state', async ({ page }) => {
  const editor = page.locator('.pg-editor');
  const output = page.locator('.logo-output');
  const run = async code => {
    await editor.fill(code);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.pg-run.logo-running')).toHaveCount(0);
  };
  await run('pu ht setpensize 9 make "x 5');
  const command = page.getByLabel('Command', { exact: true });
  await command.fill('print :x');
  await command.press('Enter');
  await expect(output).toHaveText('5');
  await run('print pendownp print shownp');
  await expect(output).toHaveText('1\n1');
  await run('print :x');
  await expect(output).toHaveClass(/logo-error/);
});

test('every Run starts at home, facing up, at the starting view', async ({ page }) => {
  const editor = page.locator('.pg-editor');
  const output = page.locator('.logo-output');
  const run = async code => {
    await editor.fill(code);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.pg-run.logo-running')).toHaveCount(0);
  };
  await run('fd 1000 rt 37 fd 50');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await run('show heading show pos');
  await expect(output).toHaveText('0\n[0 0]');
  await expect(page.locator('.pg-stage .logo-stage')).toHaveAttribute('data-zoom', '1.000');
});

test('the language reference lists commands, filters, and runs examples', async ({ page }) => {
  const reference = page.locator('.pg-reference');
  await expect(reference.getByRole('heading', { name: 'Logo Language Reference' })).toBeVisible();
  expect(await reference.locator('.pg-ref-entry').count()).toBeGreaterThan(200);
  await expect(reference.locator('dt', { hasText: 'playnote' })).toBeVisible();

  const search = reference.getByLabel('Find a command');
  await search.fill('setxy');
  await expect(reference.locator('.pg-ref-entry:visible')).toHaveCount(1);
  await expect(reference.locator('.pg-ref-entry:visible dt').first()).toContainText('setpos');
  await expect(reference.locator('h4:visible')).toHaveText(['6.1 Turtle Motion']);

  await search.fill('');
  expect(await reference.locator('.pg-ref-entry:visible').count()).toBeGreaterThan(200);

  await reference.locator('.example', { hasText: 'show 12.34' }).click();
  await expect(page.locator('.logo-output')).toHaveText('12.34');
});

test('examples that come out as the same program are listed once; each lesson links to its page', async ({ page }) => {
  const words = page.locator('.pg-examples details', { hasText: 'Make Your Own Words' });
  await words.locator('summary').click();
  // SQUARE, then its definition, would both open as the definition and SQUARE.
  await expect(words.locator('li')).toHaveText(['Example 1', 'Example 2', 'Example 3']);
  await words.getByRole('link', { name: 'Read the lesson: Make Your Own Words' }).click();
  await expect(page).toHaveURL(/\/logo\/newwords\/$/);
});

test('Stop ends a run but keeps the drawing; it is only enabled while a program runs', async ({ page }) => {
  const stop = page.getByRole('button', { name: 'Stop', exact: true });
  await expect(stop).toBeDisabled();
  await editor(page).fill('repeat 100000 [fd 1 rt 1 wait 1]');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(stop).toBeEnabled();
  const canvas = page.locator('.pg-stage canvas.logo-sandbox');
  await expect.poll(() => ink(canvas)).toBeGreaterThan(20);
  await stop.click();
  await expect(page.locator('.pg-run')).toHaveText('Play');
  await expect(stop).toBeDisabled();
  expect(await ink(canvas)).toBeGreaterThan(20);
});
