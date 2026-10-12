// Turtle Tiles: picture tiles that move the turtle, a recording strip
// played like a tape (Record, Play, Pause, Step, Rewind), Clear and Home
// for the drawing, the step ruler and the turn wheel, and a layout that
// shows every control on tablets and phones, with the colors and notes in
// pop-ups.
const { test, expect } = require('@playwright/test');
const { ink } = require('./helpers');

test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

// Each test starts recording (a page opens with Record off).
test.beforeEach(async ({ page }) => {
  await page.goto('/logo/tiles/');
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

// Source tiles are buttons; tiles in the strip are list items.
const tile = (page, name) => page.getByRole('button', { name, exact: true });
const button = tile;
const items = page => page.locator('.tt-strip > .tt-item');
const names = page => items(page).evaluateAll(els => els.map(e => e.getAttribute('aria-label') ||
  'Repeat: ' + [...e.querySelectorAll('.tt-repeat-body > .tt-item')].map(c => c.getAttribute('aria-label')).join(', ')));
const canvas = page => page.locator('.tt-stage canvas.logo-sandbox');
// Sets how many units Move and Back go (Small, Medium and Large are 1, 2
// and 3, or give a number), with the Step size spinner.
async function step(page, size) {
  const n = typeof size === 'number' ? size : { Small: 1, Medium: 2, Large: 3 }[size];
  await page.getByRole('button', { name: 'Step size', exact: true }).click();
  const pop = page.getByRole('dialog', { name: 'Step size' });
  let now = Number(await pop.locator('.tt-count-num').textContent());
  for (; now < n; now++) await pop.getByRole('button', { name: 'More times' }).click();
  for (; now > n; now--) await pop.getByRole('button', { name: 'Fewer times' }).click();
  await page.locator('.tt-stage-area').click({ position: { x: 30, y: 20 } });
  await expect(pop).toBeHidden();
}
// The label of the tile at the playhead.
const next = page => page.locator('.tt-strip .tt-next').getAttribute('aria-label');

// Waits until the turtle has finished everything it was asked to do.
async function settle(page) {
  await expect(button(page, 'Play')).toBeVisible();
  await expect(page.locator('.turtle-tiles.tt-busy')).toHaveCount(0);
  let last = null;
  await expect.poll(async () => {
    const now = await canvas(page).evaluate(c => c.toDataURL());
    const same = now === last;
    last = now;
    return same;
  }, { intervals: [150, 250, 400] }).toBe(true);
}

// Picks a color or a note from its pop-up, opening it if need be.
async function pick(page, name) {
  const popup = name.startsWith('Note ') ? 'Music' : 'Colors';
  const dialog = page.getByRole('dialog', { name: popup });
  if (!await dialog.isVisible()) await button(page, popup).click();
  await dialog.getByRole('button', { name, exact: true }).click();
}

// Records a repeat around `tiles` (tapped by name): Repeat, the tiles,
// Repeat again.
async function group(page, ...tiles) {
  await tile(page, 'Repeat').tap();
  for (const name of tiles) await tile(page, name).tap();
  await tile(page, 'Repeat').tap();
}

// Sets a repeat's count with its pop-up's arrows (the first repeat, unless
// a head is given), then closes the pop-up.
async function setCount(page, n, head = page.locator('.tt-repeat-head').first()) {
  await head.tap();
  const pop = page.getByRole('dialog', { name: 'Repeat count' });
  await expect(pop).toBeVisible();
  let now = Number(await pop.locator('.tt-count-num').textContent());
  for (; now < n; now++) await pop.getByRole('button', { name: 'More times' }).click();
  for (; now > n; now--) await pop.getByRole('button', { name: 'Fewer times' }).click();
  await expect(pop.locator('.tt-count-num')).toHaveText(String(n));
  await page.locator('.tt-stage-area').click({ position: { x: 30, y: 20 } });
  await expect(pop).toBeHidden();
}

// Drags with the mouse from the middle of one element to a point in
// another (fractions of its width and height).
async function drag(page, from, to, fx = 0.5, fy = 0.5) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy, { steps: 6 });
  await page.mouse.up();
}

// Taps the turn wheel's ring at `angle` degrees from straight up on the
// screen.
async function tapRing(page, angle) {
  const b = await page.locator('.tt-wheel-ring').boundingBox();
  const r = b.width * 0.38;
  const a = angle * Math.PI / 180;
  await page.mouse.click(b.x + b.width / 2 + r * Math.sin(a), b.y + b.height / 2 - r * Math.cos(a));
}

// Sets the wheel to turn `angle` degrees from the way the turtle faces
// (the dial turns with the turtle).
async function aim(page, angle) {
  await settle(page);  // the dial turns while the turtle does
  const heading = Number(await page.locator('.tt-wheel').getAttribute('data-heading'));
  await tapRing(page, angle + heading);
}

// The strip as Logo, from the grown-ups menu's Open in Playground.
async function logo(page) {
  await button(page, 'Grown-ups (hold)').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'Grown-ups' }).getByRole('button', { name: 'Open in Playground' }).click();
  await expect(page).toHaveURL(/\/logo\/playground\/$/);
  return (await page.locator('.pg-editor').inputValue()).split('\n').slice(2).join('\n');
}

// Whether the drawing has ink at (x, y), in steps from home (up and right
// are positive), at the starting zoom.
const inkAt = (page, x, y) => canvas(page).evaluate((c, [x, y]) => {
  const ctx = c.getContext('2d');
  const s = Math.min(c.width, c.height) / 240;
  const d = ctx.getImageData(Math.round(c.width / 2 + x * s) - 2, Math.round(c.height / 2 - y * s) - 2, 5, 5).data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 50 && d[i] < 180) return true;  // thin lines are faint
  return false;
}, [x, y]);

// Whether the drawing has ink `y` steps straight up from home (the middle
// of the stage, at the starting zoom of 240 steps across the short side).
const inkAbove = (page, y) => canvas(page).evaluate((c, y) => {
  const ctx = c.getContext('2d');
  const s = Math.min(c.width, c.height) / 240;
  const d = ctx.getImageData(Math.round(c.width / 2) - 3, Math.round(c.height / 2 - y * s), 7, 1).data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 50 && d[i] < 180) return true;  // thin lines are faint
  return false;
}, y);

test('tapping tiles makes the turtle draw and records them in the strip', async ({ page }) => {
  await expect(button(page, 'Record')).toHaveAttribute('aria-pressed', 'true');
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await step(page, 'Large');
  await tile(page, 'Move 3').tap();
  expect(await names(page)).toEqual(['Move 2', 'Turn right 90', 'Move 3']);
  await expect.poll(() => ink(canvas(page))).toBeGreaterThan(1000);
});

test('with Record off, tiles move the turtle without recording', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await button(page, 'Record').click();
  await expect(button(page, 'Record')).toHaveAttribute('aria-pressed', 'false');
  await tile(page, 'Turn right 90').tap();
  await tile(page, 'Move 2').tap();
  // Repeat has nothing to wrap while not recording.
  await tile(page, 'Repeat').tap();
  expect(await names(page)).toEqual(['Move 2']);
  await settle(page);
  expect(await ink(canvas(page))).toBeGreaterThan(800);  // both lines are drawn
  await button(page, 'Record').click();
  await pick(page, 'Note do');
  expect(await names(page)).toEqual(['Move 2', 'Note do']);
});

test('Step size sets how many units Move goes, 1 to 99', async ({ page }) => {
  await expect(tile(page, 'Move 2')).toBeVisible();
  await step(page, 'Small');
  await tile(page, 'Move 1').tap();
  await tile(page, 'Turn right 90').tap();
  await step(page, 12);
  await tile(page, 'Move 12').tap();
  // The spinner stops at 1.
  await step(page, 1);
  await button(page, 'Step size').click();
  const pop = page.getByRole('dialog', { name: 'Step size' });
  await pop.getByRole('button', { name: 'Fewer times' }).click();
  await expect(pop.locator('.tt-count-num')).toHaveText('1');
  expect(await logo(page)).toBe('fd 25\nrt 90\nfd 300');
});

test('while recording, moves and turns merge into the tile before', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await tile(page, 'Move 2').tap();
  expect(await names(page)).toEqual(['Move 4']);
  await tile(page, 'Back 2').tap();  // the other way: a new tile
  expect(await names(page)).toEqual(['Move 4', 'Back 2']);
  await aim(page, 45);
  await tile(page, 'Turn right 45').tap();
  await tile(page, 'Turn right 45').tap();
  expect(await names(page)).toEqual(['Move 4', 'Back 2', 'Turn right 90']);
  await expect(items(page).last().locator('text')).toHaveText('+90');
  await aim(page, -15);
  await tile(page, 'Turn left 15').tap();
  await expect(items(page).last().locator('text')).toHaveText('+75');  // +90 and -15
  await expect(items(page).last()).toHaveAttribute('aria-label', 'Turn right 75');
  // Turns that make a whole turn take the tile away.
  await aim(page, -75);
  await tile(page, 'Turn left 75').tap();
  expect(await names(page)).toEqual(['Move 4', 'Back 2']);
  // A left turn shows - degrees.
  await aim(page, -15);
  await tile(page, 'Turn left 15').tap();
  await expect(items(page).last().locator('text')).toHaveText('\u221215');
  await settle(page);
  expect(await logo(page)).toBe('fd 100\nbk 50\nlt 15');
});

test('the Invisible crayon lifts the pen; another color puts it down again', async ({ page }) => {
  await pick(page, 'Invisible');
  await tile(page, 'Move 2').tap();
  await settle(page);
  expect(await ink(canvas(page))).toBeLessThan(400);  // just the turtle
  await pick(page, 'Black');
  await tile(page, 'Move 2').tap();
  await expect.poll(() => ink(canvas(page))).toBeGreaterThan(150);
  expect(await logo(page)).toBe('pu\nfd 50\npd setpencolor "black\nfd 50');
});

test('Next color goes round the rainbow, starting from red', async ({ page }) => {
  const colors = button(page, 'Colors');
  const seen = [];
  for (let i = 0; i < 7; i++) {
    await pick(page, 'Next color');
    await settle(page);
    seen.push(await colors.getAttribute('data-color'));
  }
  expect(seen).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'red']);
  // After Invisible, it puts the pen down with the next color.
  await pick(page, 'Invisible');
  await pick(page, 'Next color');
  await settle(page);
  await expect(colors).toHaveAttribute('data-color', 'orange');
  await expect(colors.locator('rect').first()).toHaveAttribute('fill', 'orange');
  expect((await logo(page)).split('\n').filter(l => l === 'pd setpencolor "rainbow')).toHaveLength(8);
});

test('color swatches change the pen and notes join the strip', async ({ page }) => {
  await pick(page, 'Blue');
  await tile(page, 'Move 2').tap();
  await pick(page, 'Note do');
  expect(await names(page)).toEqual(['Blue', 'Move 2', 'Note do']);
  await expect.poll(() => canvas(page).evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let blue = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 180 && d[i] < 80) blue++;
    return blue;
  })).toBeGreaterThan(100);
});

test('Repeat groups the tiles tapped between two taps, going round once', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await tile(page, 'Repeat').tap();
  // Open: the button pulses and the next tiles go inside.
  await expect(tile(page, 'Repeat')).toHaveAttribute('aria-pressed', 'true');
  await step(page, 'Large');
  await tile(page, 'Move 3').tap();
  await tile(page, 'Turn right 90').tap();
  expect(await names(page)).toEqual(['Move 2', 'Repeat: Move 3, Turn right 90']);
  await tile(page, 'Repeat').tap();
  await expect(tile(page, 'Repeat')).toHaveAttribute('aria-pressed', 'false');
  // Closed: the next tile goes after it.
  await tile(page, 'Move 3').tap();
  expect(await names(page)).toEqual(['Move 2', 'Repeat: Move 3, Turn right 90', 'Move 3']);
  const head = page.locator('.tt-repeat-head');
  await expect(head).toHaveAttribute('aria-label', 'Repeat 1 time');
  await expect(head.locator('text')).toHaveText('1');
  expect(await logo(page)).toBe('fd 50\nrepeat 1 [fd 75 rt 90]\nfd 75');
});

test('a second repeat is its own group', async ({ page }) => {
  await group(page, 'Move 2', 'Turn right 90');
  await tile(page, 'Move 2').tap();
  await group(page, 'Turn right 90', 'Move 2');
  expect(await names(page)).toEqual(['Repeat: Move 2, Turn right 90', 'Move 2',
    'Repeat: Turn right 90, Move 2']);
});

test('a repeat with nothing in it goes away when closed; stopping recording closes one', async ({ page }) => {
  await tile(page, 'Repeat').tap();
  await expect(items(page)).toHaveCount(1);
  await tile(page, 'Repeat').tap();
  await expect(items(page)).toHaveCount(0);
  await tile(page, 'Repeat').tap();
  await tile(page, 'Move 2').tap();
  await button(page, 'Record').click();
  await expect(tile(page, 'Repeat')).toHaveAttribute('aria-pressed', 'false');
  await button(page, 'Record').click();
  await step(page, 'Small');
  await tile(page, 'Move 1').tap();
  expect(await names(page)).toEqual(['Repeat: Move 2', 'Move 1']);
});

test('a repeat\'s count is set in a pop-up, without drawing until it plays', async ({ page }) => {
  await group(page, 'Move 2', 'Turn right 90');
  await settle(page);
  const drawn = await ink(canvas(page));
  await setCount(page, 4);
  await expect(page.locator('.tt-repeat-head')).toHaveAttribute('aria-label', 'Repeat 4 times');
  await expect(page.locator('.tt-repeat-head .tt-dot')).toHaveCount(4);
  await settle(page);
  expect(await ink(canvas(page))).toBe(drawn);  // the stage waits for Play
  expect(await logo(page)).toBe('repeat 4 [fd 50 rt 90]');
});

test('the count stops at 0 and 99; holding an arrow counts fast; big counts show a bar', async ({ page }) => {
  await group(page, 'Turn right 90');
  await page.locator('.tt-repeat-head').tap();
  const pop = page.getByRole('dialog', { name: 'Repeat count' });
  const num = pop.locator('.tt-count-num');
  await pop.getByRole('button', { name: 'Fewer times' }).click();
  await pop.getByRole('button', { name: 'Fewer times' }).click();
  await expect(num).toHaveText('0');
  // Hold the up arrow.
  const up = await pop.getByRole('button', { name: 'More times' }).boundingBox();
  await page.mouse.move(up.x + up.width / 2, up.y + up.height / 2);
  await page.mouse.down();
  await expect.poll(async () => Number(await num.textContent()), { timeout: 15000 }).toBe(99);
  await page.mouse.up();
  await expect(num).toHaveText('99');
  const head = page.locator('.tt-repeat-head');
  await expect(head.locator('.tt-dot')).toHaveCount(0);
  await expect(head.locator('.tt-progress')).toHaveCount(1);
  // Stepping fills the bar a bit at a time.
  await page.locator('.tt-stage-area').click({ position: { x: 30, y: 20 } });
  await setCount(page, 24);
  await button(page, 'Step').click();
  await button(page, 'Step').click();
  await settle(page);
  const width = await head.locator('.tt-progress-fill').evaluate(f => parseFloat(f.style.width));
  expect(width).toBeGreaterThan(10);
  expect(width).toBeLessThan(15);  // the third time round, of 24
});

test('a repeat dragged to the trash lets go of its tiles, which stay', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await group(page, 'Turn right 90', 'Move 2');
  await tile(page, 'Move 2').tap();
  await drag(page, page.locator('.tt-repeat-head'), button(page, 'Trash'));
  expect(await names(page)).toEqual(['Move 2', 'Turn right 90', 'Move 2', 'Move 2']);
});

test('Clear erases the drawing and sends the turtle home; Home brings it back without drawing', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await settle(page);
  expect(await inkAbove(page, 25)).toBe(true);
  await button(page, 'Clear drawing').click();
  await settle(page);
  expect(await ink(canvas(page))).toBeLessThan(400);  // just the turtle
  // The turtle is home again: the next line starts there.
  await step(page, 'Small');
  await tile(page, 'Move 1').tap();
  await settle(page);
  expect(await inkAbove(page, 12)).toBe(true);
  expect(await inkAbove(page, 37)).toBe(false);
  // Up and across, Home comes straight back without drawing.
  await button(page, 'Clear drawing').click();
  await tile(page, 'Move 1').tap();
  await tile(page, 'Turn right 90').tap();
  await tile(page, 'Move 1').tap();
  await settle(page);
  await button(page, 'Home').click();
  await settle(page);
  expect(await inkAt(page, 12, 25)).toBe(true);   // the line across the top
  expect(await inkAt(page, 12, 12)).toBe(false);  // nothing on the way home
});

test('Home records like a tile, so a strip can start from home', async ({ page }) => {
  await tile(page, 'Home').tap();
  await step(page, 'Small');
  await tile(page, 'Move 1').tap();
  expect(await names(page)).toEqual(['Home', 'Move 1']);
  await settle(page);
  // Away from home and off the line, Play goes home first, then draws
  // the same line again.
  await button(page, 'Clear drawing').click();
  await tile(page, 'Turn right 90').tap();
  await step(page, 'Large');
  await tile(page, 'Move 3').tap();
  await settle(page);
  await button(page, 'Record').click();
  await button(page, 'Clear drawing').click();
  await button(page, 'Rewind').click();
  await button(page, 'Play').click();
  await settle(page);
  expect(await inkAbove(page, 12)).toBe(true);
  expect(await logo(page)).toBe('ifelse pendownp [pu home pd] [home]\nfd 25\nrt 90\nfd 75');
});

test('Play plays the strip from where the turtle is, without clearing', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await settle(page);
  const one = await ink(canvas(page));
  await button(page, 'Play').click();
  await expect(button(page, 'Pause')).toBeVisible();
  await settle(page);
  // The first line is still there, and a second one joins it.
  expect(await ink(canvas(page))).toBeGreaterThan(one * 1.6);
  // After the last tile, the playhead is back at the start.
  expect(await next(page)).toBe('Move 2');
});

test('Pause stops after the tile that is playing; Play carries on from there', async ({ page }) => {
  for (let i = 0; i < 4; i++) {
    await tile(page, 'Move 2').tap();
    await tile(page, 'Turn right 90').tap();
  }
  await settle(page);
  await button(page, 'Play').click();
  await expect(page.locator('.tt-strip .tt-active')).toHaveCount(1);
  await button(page, 'Pause').click();
  await settle(page);
  const at = await page.locator('.tt-strip > .tt-item').evaluateAll(els => els.findIndex(e => e.matches('.tt-next')));
  expect(at).toBeGreaterThan(0);
  await button(page, 'Play').click();
  await settle(page);
  expect(await next(page)).toBe('Move 2');
});

test('Step plays one tile, tapping a tile moves the playhead, and Rewind goes back to the start', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await pick(page, 'Note do');
  await settle(page);
  expect(await next(page)).toBe('Move 2');
  await button(page, 'Step').click();
  await settle(page);
  expect(await next(page)).toBe('Turn right 90');
  await items(page).last().tap();
  expect(await next(page)).toBe('Note do');
  await button(page, 'Rewind').click();
  expect(await next(page)).toBe('Move 2');
});

test('tapping the trash twice empties the strip, not the drawing', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await settle(page);
  const drawn = await ink(canvas(page));
  const trash = page.locator('.tt-trash');
  // One tap only asks; a tap elsewhere calls it off.
  await trash.click();
  await expect(trash).toHaveClass(/tt-armed/);
  await expect(items(page)).toHaveCount(2);
  await page.locator('.tt-stage-area').click({ position: { x: 30, y: 20 } });
  await expect(trash).not.toHaveClass(/tt-armed/);
  await trash.click();
  await expect(items(page)).toHaveCount(2);
  // The second tap empties it.
  await trash.click();
  await expect(items(page)).toHaveCount(0);
  await expect(trash).not.toHaveClass(/tt-armed/);
  await settle(page);
  expect(await ink(canvas(page))).toBe(drawn);
});

test('a dragged tile stays under the finger, even just after a tap', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  const move = await tile(page, 'Move 2').boundingBox();
  await page.mouse.move(move.x + move.width / 2, move.y + move.height / 2);
  await page.mouse.down();
  await page.mouse.move(move.x + move.width / 2 + 30, move.y + move.height / 2 - 30, { steps: 4 });
  const ghost = await page.locator('.tt-ghost').boundingBox();
  expect(Math.abs(ghost.x - (move.x + 30))).toBeLessThan(8);
  expect(Math.abs(ghost.y - (move.y - 30))).toBeLessThan(8);
  await page.mouse.up();
});

test('the grown-ups menu opens only after holding its button', async ({ page }) => {
  const gear = button(page, 'Grown-ups (hold)');
  const menu = page.getByRole('dialog', { name: 'Grown-ups' });
  await gear.tap();
  await expect(menu).toBeHidden();
  const box = await gear.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Close' }).click();
  await expect(menu).toBeHidden();
});

test('tiles can be dragged into the strip, moved, and dragged onto the trash to throw away', async ({ page }) => {
  await step(page, 'Large');
  await tile(page, 'Move 3').tap();
  await step(page, 'Medium');
  await tile(page, 'Back 2').tap();
  // The wheel's turtle, from the wheel to the front of the strip.
  await aim(page, -90);
  await drag(page, tile(page, 'Turn left 90'), items(page).first(), 0.1);
  expect(await names(page)).toEqual(['Turn left 90', 'Move 3', 'Back 2']);
  // Within the strip: the last tile to the front.
  await drag(page, items(page).last(), items(page).first(), 0.1);
  expect(await names(page)).toEqual(['Back 2', 'Turn left 90', 'Move 3']);
  // Out of the strip, onto the drawing: it goes back.
  await drag(page, items(page).nth(1), page.locator('.tt-stage-area'));
  expect(await names(page)).toEqual(['Back 2', 'Turn left 90', 'Move 3']);
  // Onto the trash can: thrown away.
  await drag(page, items(page).nth(1), button(page, 'Trash'));
  expect(await names(page)).toEqual(['Back 2', 'Move 3']);
  // Into a repeat's body.
  await drag(page, tile(page, 'Repeat'), items(page).last(), 0.9);
  await aim(page, 90);
  await drag(page, tile(page, 'Turn right 90'), page.locator('.tt-repeat-body'));
  expect(await names(page)).toEqual(['Back 2', 'Move 3', 'Repeat: Turn right 90']);
});

test('the strip is kept for next time, ready to play', async ({ page }) => {
  await step(page, 'Large');
  await group(page, 'Move 3', 'Turn right 90');
  await setCount(page, 4);
  await page.reload();
  expect(await names(page)).toEqual(['Repeat: Move 3, Turn right 90']);
  await button(page, 'Play').click();
  await settle(page);
  await expect.poll(() => ink(canvas(page))).toBeGreaterThan(1000);
});

test('the turn wheel sets the angle by tapping, dragging or the arrow keys', async ({ page }) => {
  const ring = page.getByRole('slider', { name: 'Turn angle' });
  await expect(ring).toHaveAttribute('aria-valuetext', 'Turn right 90');
  await aim(page, -45);
  await expect(ring).toHaveAttribute('aria-valuetext', 'Turn left 45');
  // Taps snap to the nearest 15 degrees.
  await aim(page, 118);
  await expect(ring).toHaveAttribute('aria-valuetext', 'Turn right 120');
  await aim(page, 180);
  await expect(ring).toHaveAttribute('aria-valuetext', 'Turn around');
  // Dragging the arm round.
  const b = await ring.boundingBox();
  const at = deg => [b.x + b.width / 2 + b.width * 0.38 * Math.sin(deg * Math.PI / 180),
    b.y + b.height / 2 - b.width * 0.38 * Math.cos(deg * Math.PI / 180)];
  await page.mouse.move(...at(30));
  await page.mouse.down();
  for (const deg of [40, 50, 60]) await page.mouse.move(...at(deg));
  await page.mouse.up();
  await expect(ring).toHaveAttribute('aria-valuetext', 'Turn right 60');
  // Arrow keys step by 15, skipping straight ahead.
  await ring.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await expect(ring).toHaveAttribute('aria-valuetext', 'Turn left 15');
});

test('the wheel turns with the turtle, so tapping it again turns the same way again', async ({ page }) => {
  const wheel = page.locator('.tt-wheel');
  const turtle = page.locator('.tt-turn-go .tt-turtle-turn');
  await expect(wheel).toHaveAttribute('data-heading', '0');
  await aim(page, 60);
  await tile(page, 'Turn right 60').tap();
  await expect(wheel).toHaveAttribute('data-heading', '60');
  await expect(turtle).toHaveAttribute('transform', 'rotate(60)');
  // The arm still shows the same turn, from the way the turtle now faces.
  await tile(page, 'Turn right 60').tap();
  await expect(wheel).toHaveAttribute('data-heading', '120');
  // A tap on the ring counts from the turtle's heading: straight down on
  // the screen is now 60 to its right.
  await tapRing(page, 180);
  await expect(page.getByRole('slider', { name: 'Turn angle' })).toHaveAttribute('aria-valuetext', 'Turn right 60');
  await tapRing(page, 30);
  await expect(page.getByRole('slider', { name: 'Turn angle' })).toHaveAttribute('aria-valuetext', 'Turn left 90');
  await button(page, 'Home').click();
  await expect(wheel).toHaveAttribute('data-heading', '0');
});

test('the turtle on the wheel is drawn like the turtle on the stage', async ({ page }) => {
  // jslogo's outline: 18 points down one side, then 16 back up the other.
  const d = await page.locator('.tt-turn-go path').getAttribute('d');
  expect(d.startsWith('M0 -20 L2.5 -17 L3 -12')).toBe(true);
  expect(d.split('L').length).toBe(34);
});

test('tapping the turtle turns by the wheel\'s angle: a hexagon', async ({ page }) => {
  await aim(page, 60);
  await group(page, 'Move 2', 'Turn right 60');
  await setCount(page, 6);
  await expect(page.locator('.tt-repeat-head')).toHaveAttribute('aria-label', 'Repeat 6 times');
  expect(await logo(page)).toBe('repeat 6 [fd 50 rt 60]');
});

test('tapping a turn in the strip sets the wheel to it; a move opens a spinner to change it', async ({ page }) => {
  await aim(page, -120);
  await tile(page, 'Turn left 120').tap();
  await step(page, 'Small');
  await tile(page, 'Move 1').tap();
  await aim(page, 45);
  await step(page, 'Large');
  await items(page).first().tap();
  await expect(page.getByRole('slider', { name: 'Turn angle' })).toHaveAttribute('aria-valuetext', 'Turn left 120');
  await items(page).last().tap();
  await expect(tile(page, 'Move 1')).toBeVisible();  // Move goes 1 again
  const pop = page.getByRole('dialog', { name: 'How far' });
  await expect(pop.locator('.tt-count-num')).toHaveText('1');
  await pop.getByRole('button', { name: 'More times' }).click();
  await pop.getByRole('button', { name: 'More times' }).click();
  expect(await names(page)).toEqual(['Turn left 120', 'Move 3']);
  await expect(tile(page, 'Move 3')).toBeVisible();
  expect(await logo(page)).toBe('lt 120\nfd 75');
});

test('strips saved by earlier versions load with moves, turns and pens', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('mckoss.logo.tiles', JSON.stringify(
    [{ t: 'far' }, { t: 'hop' }, { t: 'repeat', n: 3, body: [{ t: 'walk' }, { t: 'left' }, { t: 'right' }] }])));
  await page.reload();
  expect(await names(page)).toEqual(['Move 4', 'Don\'t draw', 'Move 2', 'Draw',
    'Repeat: Move 2, Turn left 90, Turn right 90']);
});

test('after the view zooms out, Clear and Home draw from home under the turtle again', async ({ page }) => {
  await page.setViewportSize({ width: 673, height: 280 });
  await step(page, 'Large');
  for (let i = 0; i < 3; i++) await tile(page, 'Move 3').tap();
  const zoom = () => page.locator('.tt-stage .logo-stage').getAttribute('data-zoom').then(Number);
  await expect.poll(zoom).toBeLessThan(1);
  await button(page, 'Clear drawing').click();
  await button(page, 'Home').click();
  await step(page, 'Medium');
  await tile(page, 'Move 2').tap();
  await expect.poll(zoom).toBe(1);
  await settle(page);
  expect(await inkAbove(page, 10) && await inkAbove(page, 40) && !await inkAbove(page, -20)).toBe(true);
});

test('turning a phone reshapes the drawing to fill the screen, and keeps it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 750 });
  await step(page, 'Large');
  for (let i = 0; i < 4; i++) {
    await tile(page, 'Move 3').tap();
    await tile(page, 'Turn right 90').tap();
  }
  await settle(page);
  const drawn = await ink(canvas(page));
  expect(drawn).toBeGreaterThan(250);
  // The stage's shape, width over height (0 while it is being remade).
  const shape = async () => {
    const b = await page.locator('.tt-stage .logo-stage').boundingBox();
    return b ? b.width / b.height : 0;
  };
  await expect.poll(async () => { const s = await shape(); return s > 0 && s < 1; }).toBe(true);
  await page.setViewportSize({ width: 750, height: 390 });
  await expect.poll(shape).toBeGreaterThan(2);
  await expect.poll(() => ink(canvas(page))).toBeGreaterThan(250);
  expect(await names(page)).toHaveLength(8);
});

// Every control shows on every screen, none overlapping another or the
// drawing, and the drawing gets most of the room.
for (const [screen, width, height] of [
  ['a landscape tablet', 1180, 820], ['a portrait tablet', 820, 1180],
  ['a portrait phone', 390, 750], ['a landscape phone', 673, 280],
]) {
  test.describe(`on ${screen}`, () => {
    test.use({ viewport: { width, height } });

    test('every control is in view, and the drawing is biggest', async ({ page }) => {
      const boxes = await page.evaluate(() => {
        const box = el => {
          const r = el.getBoundingClientRect();
          return { name: el.getAttribute('aria-label') || el.className, x: r.left, y: r.top, w: r.width, h: r.height };
        };
        const controls = [...document.querySelectorAll('.tt-source:not(.tt-turn-go), .tt-stage-tools .tt-button, ' +
          '.tt-line .tt-button, .tt-pop, .tt-prog, .tt-wheel, .tt-strip-area')]
          .filter(el => !el.closest('.tt-popup') && el.isConnected && el.getClientRects().length).map(box);
        return { controls, stage: box(document.querySelector('.tt-stage .logo-stage')) };
      });
      // Home, Move, Back and Repeat; Clear; Record, Play, Step, Rewind and
      // the trash; Colors, Music, Turtle, Step size, the program, Play a
      // program and Speed; the wheel and the strip.
      expect(boxes.controls.length).toBe(4 + 1 + 5 + 7 + 2);
      const inside = b => b.x >= 0 && b.y >= 0 && b.x + b.w <= width + 0.5 && b.y + b.h <= height + 0.5;
      const overlap = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
      for (const c of boxes.controls) {
        expect(inside(c), `${c.name} is on screen`).toBe(true);
        expect(Math.min(c.w, c.h), `${c.name} is big enough to tap`).toBeGreaterThanOrEqual(26);
        expect(overlap(c, boxes.stage), `${c.name} is clear of the drawing`).toBe(false);
      }
      boxes.controls.forEach((a, i) => boxes.controls.slice(i + 1).forEach(b => {
        expect(overlap(a, b), `${a.name} and ${b.name} don't overlap`).toBe(false);
      }));
      expect(boxes.stage.w * boxes.stage.h).toBeGreaterThan(width * height * 0.4);
    });
  });
}

test.describe('on a phone held upright', () => {
  test.use({ viewport: { width: 390, height: 750 } });

  test('the strip runs the whole width, and the drawing all but the left gutter', async ({ page }) => {
    const stage = await page.locator('.tt-stage .logo-stage').boundingBox();
    const strip = await page.locator('.tt-strip-row').boundingBox();
    const home = await button(page, 'Home').boundingBox();
    expect(stage.x).toBeGreaterThan(home.x + home.width);
    expect(stage.width).toBeGreaterThan(280);
    expect(strip.width).toBeGreaterThan(350);
  });

  test('Colors opens a palette of swatches; picking one sets the pen and closes it', async ({ page }) => {
    const colors = button(page, 'Colors');
    const palette = page.getByRole('dialog', { name: 'Colors' });
    await expect(palette).toBeHidden();
    await colors.click();
    await expect(palette).toBeVisible();
    await expect(palette.getByRole('button')).toHaveCount(9);  // and Next color, then Invisible last
    expect(await palette.getByRole('button').evaluateAll(bs => bs.slice(-2).map(b => b.getAttribute('aria-label'))))
      .toEqual(['Next color', 'Invisible']);
    await palette.getByRole('button', { name: 'Blue', exact: true }).click();
    await expect(palette).toBeHidden();
    expect(await names(page)).toEqual(['Blue']);
    // The Colors button shows the pen's color.
    await expect(colors).toHaveAttribute('data-color', 'blue');
  });

  test('Music opens the notes, named do re mi, and stays open for a tune', async ({ page }) => {
    await button(page, 'Music').click();
    const notes = page.getByRole('dialog', { name: 'Music' });
    await expect(notes).toBeVisible();
    expect(await notes.locator('text').allTextContents()).toEqual(['do', 're', 'mi', 'fa', 'sol', 'la', 'ti', 'do']);
    await notes.getByRole('button', { name: 'Note do' }).click();
    await notes.getByRole('button', { name: 'Note mi' }).click();
    await expect(notes).toBeVisible();
    expect(await names(page)).toEqual(['Note do', 'Note mi']);
    // A tap elsewhere closes it.
    await page.locator('.tt-stage-area').click({ position: { x: 30, y: 20 } });
    await expect(notes).toBeHidden();
  });
});

test('turn tiles show a curved arrow to where the turn ends', async ({ page }) => {
  await tile(page, 'Turn right 90').tap();
  const paths = await items(page).first().locator('path').count();
  expect(paths).toBe(4);  // the wedge, straight ahead, the arc and its arrowhead
  // A 15 degree turn has no room for an arrowhead: just the arc.
  await tile(page, 'Move 2').tap();  // so the next turn doesn't merge
  await aim(page, 15);
  await tile(page, 'Turn right 15').tap();
  expect(await items(page).last().locator('path').count()).toBe(3);
  await expect(page.locator('.tt-wheel .tt-arc')).toHaveAttribute('d', /^M60 24 A36 36 0 0 1 /);
});

test('the Colors button shows the pen\'s color, or a white crayon when it draws nothing', async ({ page }) => {
  const colors = button(page, 'Colors');
  await pick(page, 'Blue');
  await expect(colors.locator('rect').first()).toHaveAttribute('fill', 'blue');
  await pick(page, 'Invisible');
  await expect(colors.locator('rect').first()).toHaveAttribute('fill', '#fff');
  // The Invisible swatch itself is a plain white tile.
  await expect(page.locator('.tt-popup [data-tile="invisible"] svg')).toHaveCount(0);
});

test('crayons put the pen down and set a color by name, as the Logo reference does', async ({ page }) => {
  await pick(page, 'Blue');
  await pick(page, 'Red');
  expect(await logo(page)).toBe('pd setpencolor "blue\npd setpencolor "red');
});

test('Home, Clear, Speed, Colors and Music head a gutter down the left; Move, Back and Step size sit together', async ({ page }) => {
  for (const viewport of [{ width: 1180, height: 820 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    // Let the page lay itself out again before measuring.
    await settle(page);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const box = name => page.getByRole('button', { name, exact: true }).boundingBox();
    const home = await box('Home');
    const speed = await page.locator('.tt-speed').boundingBox();
    const clear = await box('Clear drawing');
    const colors = await box('Colors');
    const music = await box('Music');
    const size = await box('Step size');
    const move = await page.locator('.tt-source[data-tile="back"]').boundingBox();
    const stage = await page.locator('.tt-stage .logo-stage').boundingBox();
    let y = home.y;
    for (const b of [home, clear, speed, colors, music]) {
      expect(Math.abs(b.x - home.x)).toBeLessThan(1);
      expect(b.x + b.width).toBeLessThan(stage.x + 1);
      expect(b.y).toBeGreaterThanOrEqual(y - 1);
      y = b.y + b.height;
    }
    expect(home.y).toBeLessThan(stage.y + 1);
    expect(size.y).toBeGreaterThan(stage.y + stage.height);
    const gap = Math.min(Math.abs(size.x - (move.x + move.width)), Math.abs(size.y - (move.y + move.height)));
    expect(gap).toBeLessThan(10);
  }
});

test('the tape buttons go Record, Repeat, Play, Step, Rewind, trash, under the strip', async ({ page }) => {
  const labels = await page.locator('.tt-line > *').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  expect(labels).toEqual(['Record', 'Repeat', 'Play', 'Step', 'Rewind', 'Trash']);
  const strip = await page.locator('.tt-strip-area').boundingBox();
  const record = await button(page, 'Record').boundingBox();
  expect(record.y).toBeGreaterThan(strip.y + strip.height - 1);
});

test('the step size waits in a pop-up and shows on the ruler; Move and Back stay plain arrows', async ({ page }) => {
  await expect(page.getByRole('dialog', { name: 'Step size' })).toBeHidden();
  await step(page, 'Large');
  await expect(tile(page, 'Move 3')).toBeVisible();
  await expect(tile(page, 'Back 3')).toBeVisible();
  await expect(button(page, 'Step size').locator('text')).toHaveText('3');
  await expect(tile(page, 'Move 3').locator('text')).toHaveCount(0);
  // In the strip, the units sit at the arrow's foot.
  await tile(page, 'Move 3').tap();
  await expect(items(page).first().locator('text')).toHaveText('3');
});

test('Back moves the turtle backwards as far as Step size says', async ({ page }) => {
  await step(page, 'Small');
  await tile(page, 'Back 1').tap();
  await settle(page);
  expect(await inkAbove(page, -12)).toBe(true);
  expect(await inkAbove(page, 12)).toBe(false);
  await step(page, 'Large');
  await tile(page, 'Back 3').tap();
  // Back after Back goes further: one tile.
  expect(await names(page)).toEqual(['Back 4']);
  expect(await logo(page)).toBe('bk 100');
});

test('the strip grows to three lines as it fills, then scrolls', async ({ page }) => {
  const area = page.locator('.tt-strip-area');
  const heightFor = async n => {
    await page.evaluate(n => localStorage.setItem('mckoss.logo.tiles',
      JSON.stringify(Array.from({ length: n }, () => ({ t: 'move', d: 25 })))), n);
    await page.reload();
    await expect(items(page)).toHaveCount(n);
    return area.evaluate(e => ({ h: e.clientHeight, scrolls: e.scrollHeight > e.clientHeight + 1 }));
  };
  const one = await heightFor(1);
  const two = await heightFor(30);
  const three = await heightFor(50);
  const many = await heightFor(120);
  expect(two.h).toBeGreaterThan(one.h * 1.5);
  expect(three.h).toBeGreaterThan(two.h * 1.3);
  expect(many.h).toBeLessThan(three.h + 2);
  expect([one.scrolls, two.scrolls, three.scrolls, many.scrolls]).toEqual([false, false, false, true]);
});

test('on a tablet too, the colors and notes wait in their pop-ups', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Note do' })).toBeHidden();
  await pick(page, 'Green');
  await expect(page.getByRole('dialog', { name: 'Colors' })).toBeHidden();
  await pick(page, 'Note re');
  expect(await names(page)).toEqual(['Green', 'Note re']);
});

test('the wheel\'s turtle shows the turn in degrees, right side up whichever way it faces', async ({ page }) => {
  const degrees = page.locator('.tt-turn-go .tt-turn-degrees');
  await expect(degrees).toHaveText('+90');
  await tile(page, 'Turn right 90').tap();
  await settle(page);
  // The turtle has turned; the number hasn't.
  await expect(page.locator('.tt-turn-go .tt-turtle-turn')).toHaveAttribute('transform', 'rotate(90)');
  expect(await degrees.evaluate(t => t.closest('.tt-turtle-turn'))).toBeNull();
  await aim(page, -45);
  await expect(degrees).toHaveText('−45');
});

test('turns are tinted like a boat\'s lights: red to the left, green to the right, none to turn around', async ({ page }) => {
  const tint = loc => loc.evaluate(e => getComputedStyle(e).getPropertyValue('--tile-color').trim());
  await tile(page, 'Turn right 90').tap();
  await tile(page, 'Move 2').tap();
  await aim(page, -45);
  await tile(page, 'Turn left 45').tap();
  await tile(page, 'Move 2').tap();
  await aim(page, 180);
  await tile(page, 'Turn around').tap();
  expect(await tint(items(page).nth(0))).toBe('#2e9a55');
  expect(await tint(items(page).nth(2))).toBe('#d64545');
  expect(await tint(items(page).nth(4))).toBe('#3d7fd9');
  // The turtle button's degrees too, signs and all.
  await aim(page, -45);
  const degrees = page.locator('.tt-turn-go .tt-turn-degrees');
  await expect(degrees).toHaveText('−45');
  expect(await degrees.evaluate(t => t.style.fill)).toBe('rgb(214, 69, 69)');
});

test('Clear rewinds the strip, so the next Play starts from the beginning', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await tile(page, 'Back 2').tap();
  await items(page).nth(1).tap();
  expect(await next(page)).toBe('Turn right 90');
  await button(page, 'Clear drawing').click();
  expect(await next(page)).toBe('Move 2');
});

test('the Turtle button shows the turtle, the turtle with where it is, or just an arrow', async ({ page }) => {
  const dot = page.locator('.tt-pos-dot');
  const sprite = page.locator('.tt-stage .logo-sprite');
  await expect(dot).toBeHidden();
  await button(page, 'Turtle').click();
  await page.getByRole('button', { name: 'Turtle, where it is, and the pen' }).click();
  await expect(dot).toBeVisible();
  await expect(page.locator('.tt-pos-xy')).toHaveText('0, 0');
  await expect(page.locator('.tt-pos-heading')).toHaveText('0\u00b0');
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await settle(page);
  await expect(page.locator('.tt-pos-xy')).toHaveText('0, 50');
  await expect(page.locator('.tt-pos-heading')).toHaveText('90\u00b0');
  // The dot is in the pen's color.
  expect(await page.locator('.tt-pos-dot').evaluate(d => d.style.background)).toBe('rgb(0, 0, 0)');
  await expect(sprite).toBeVisible();
  // Just an arrow: no turtle, no numbers, no dot; an arrow in the pen's
  // color, pointing the way the turtle faces, its shaft as wide as the
  // line on the screen.
  await button(page, 'Turtle').click();
  await page.getByRole('button', { name: 'Just an arrow' }).click();
  const arrow = page.locator('.tt-pos-arrow path');
  await expect(sprite).toBeHidden();
  await expect(page.locator('.tt-pos-arrow')).toBeVisible();
  await expect(page.locator('.tt-pos-dot')).toBeHidden();
  await expect(page.locator('.tt-pos-xy')).toBeHidden();
  await expect(arrow).toHaveAttribute('fill', '#000000');
  await expect(arrow).toHaveAttribute('transform', 'rotate(90)');
  // (The path starts at the shaft's left edge, half its width to the left.)
  const shaft = -2 * parseFloat((await arrow.getAttribute('d')).slice(1));
  expect(shaft).toBeGreaterThan(1);
  // The choice is kept for next time; one saved as the old dot is an arrow.
  await page.reload();
  await expect(page.locator('.tt-stage .logo-sprite')).toBeHidden();
  await expect(page.locator('.tt-pos-arrow')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('mckoss.logo.tiles.look', 'dot'));
  await page.reload();
  await expect(page.locator('.tt-pos-arrow')).toBeVisible();
});

test('with the pen up, Move and Back merge too, and cancel out', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await tile(page, 'Back 2').tap();  // pen down: it would draw back over the line
  expect(await names(page)).toEqual(['Move 2', 'Back 2']);
  await pick(page, 'Invisible');
  await tile(page, 'Move 2').tap();
  await step(page, 1);
  await tile(page, 'Back 1').tap();
  expect(await names(page)).toEqual(['Move 2', 'Back 2', 'Invisible', 'Move 1']);
  await tile(page, 'Back 1').tap();
  expect(await names(page)).toEqual(['Move 2', 'Back 2', 'Invisible']);
});

test('tapping a turn in the strip opens a spinner to change it by 15 degrees, skipping 0', async ({ page }) => {
  await tile(page, 'Turn right 90').tap();
  await items(page).first().tap();
  const pop = page.getByRole('dialog', { name: 'Turn' });
  await expect(pop.locator('.tt-count-num')).toHaveText('+90');
  for (let i = 0; i < 6; i++) await pop.getByRole('button', { name: 'Fewer times' }).click();
  await expect(pop.locator('.tt-count-num')).toHaveText('−15');  // past 0
  await expect(items(page).first()).toHaveAttribute('aria-label', 'Turn left 15');
  await expect(items(page).first().locator('text')).toHaveText('−15');
  // It's tinted for its new way, and the wheel follows.
  expect(await items(page).first().evaluate(e => getComputedStyle(e).getPropertyValue('--tile-color').trim())).toBe('#d64545');
  await expect(page.getByRole('slider', { name: 'Turn angle' })).toHaveAttribute('aria-valuetext', 'Turn left 15');
  // It stops at 180 going up.
  for (let i = 0; i < 20; i++) await pop.getByRole('button', { name: 'More times' }).click();
  await expect(pop.locator('.tt-count-num')).toHaveText('+180');
  expect(await logo(page)).toBe('rt 180');
});

// Shows program `p` in the strip, going up or down to it.
async function showProgram(page, p) {
  const prog = page.locator('.tt-prog');
  for (;;) {
    const now = (await prog.getAttribute('aria-label')).slice(-1);
    if (now === p) break;
    await button(page, p < now ? 'Previous program' : 'Next program').click();
    await expect(prog).not.toHaveAttribute('aria-label', 'Program ' + now);
  }
}
// Shows program `p` and starts recording into it (showing another program
// stops recording).
async function recordInto(page, p) {
  await showProgram(page, p);
  await expect(button(page, 'Record')).toHaveAttribute('aria-pressed', 'false');
  await button(page, 'Record').click();
}
// Taps the tile that plays program `p`.
async function playsProgram(page, p) {
  await button(page, 'Play a program').click();
  await page.getByRole('dialog', { name: 'Play a program' }).getByRole('button', { name: 'Play ' + p }).click();
}

test('there are four programs, A to D, each with its own strip, kept for next time', async ({ page }) => {
  await expect(page.locator('.tt-prog')).toHaveAttribute('aria-label', 'Program A');
  await tile(page, 'Move 2').tap();
  await recordInto(page, 'B');
  await expect(items(page)).toHaveCount(0);
  await tile(page, 'Back 2').tap();
  expect(await names(page)).toEqual(['Back 2']);
  await showProgram(page, 'A');
  expect(await names(page)).toEqual(['Move 2']);
  await showProgram(page, 'B');
  await page.reload();
  await expect(page.locator('.tt-prog')).toHaveAttribute('aria-label', 'Program B');
  expect(await names(page)).toEqual(['Back 2']);
});

test('a program can play another, in a repeat too, and goes to the playground as Logo words', async ({ page }) => {
  await recordInto(page, 'B');
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await recordInto(page, 'A');
  await tile(page, 'Repeat').tap();
  await playsProgram(page, 'B');
  await tile(page, 'Repeat').tap();
  expect(await names(page)).toEqual(['Repeat: Play B']);
  await setCount(page, 4);
  await button(page, 'Rewind').click();  // (setting the count picked the repeat)
  // An empty program can be played too (fill it in later).
  await playsProgram(page, 'C');
  expect(await names(page)).toEqual(['Repeat: Play B', 'Play C']);
  expect(await logo(page)).toBe('to B\n  fd 50\n  rt 90\nend\nto C\n\nend\nrepeat 4 [B]\nC');
});

test('no program can play itself, even by way of another', async ({ page }) => {
  await playsProgram(page, 'B');  // A plays B
  await button(page, 'Play a program').click();
  const pop = page.getByRole('dialog', { name: 'Play a program' });
  await expect(pop.getByRole('button', { name: 'Play A' })).toHaveAttribute('aria-disabled', 'true');
  await expect(pop.getByRole('button', { name: 'Play B' })).toHaveAttribute('aria-disabled', 'false');
  await page.locator('.tt-stage-area').click({ position: { x: 30, y: 20 } });
  await showProgram(page, 'B');
  await button(page, 'Play a program').click();
  // In B: not B itself, and not A, which plays B.
  await expect(pop.getByRole('button', { name: 'Play B' })).toHaveAttribute('aria-disabled', 'true');
  await expect(pop.getByRole('button', { name: 'Play A' })).toHaveAttribute('aria-disabled', 'true');
  await pop.getByRole('button', { name: 'Play A' }).click({ force: true });
  await expect(items(page)).toHaveCount(0);
});

test('Step goes into a program it plays: the strip shows it, then comes back', async ({ page }) => {
  await recordInto(page, 'B');
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await recordInto(page, 'A');
  await step(page, 1);
  await tile(page, 'Move 1').tap();
  await playsProgram(page, 'B');
  await tile(page, 'Back 1').tap();
  await button(page, 'Record').click();
  await button(page, 'Rewind').click();
  const prog = page.locator('.tt-prog');
  await button(page, 'Step').click();
  await settle(page);
  // Next is B's first tile: the strip shows B.
  await expect(prog).toHaveAttribute('aria-label', 'Program B');
  expect(await next(page)).toBe('Move 2');
  await button(page, 'Step').click();
  await settle(page);
  expect(await next(page)).toBe('Turn right 90');
  await button(page, 'Step').click();
  await settle(page);
  // Back in A, after Play B.
  await expect(prog).toHaveAttribute('aria-label', 'Program A');
  expect(await next(page)).toBe('Back 1');
});

test('the trash empties only the program the strip shows; the program shown is kept for next time', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await recordInto(page, 'B');
  await tile(page, 'Back 2').tap();
  const trash = page.locator('.tt-trash');
  await trash.click();
  await trash.click();
  await expect(items(page)).toHaveCount(0);
  await showProgram(page, 'A');
  expect(await names(page)).toEqual(['Move 2']);
  await page.reload();
  expect(await names(page)).toEqual(['Move 2']);
  await showProgram(page, 'B');
  await expect(items(page)).toHaveCount(0);
});

test('a strip that starts by playing a program with a repeat in it loads and draws', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('mckoss.logo.tiles', JSON.stringify({
    current: 'A',
    programs: { A: [{ t: 'call', p: 'B' }], B: [{ t: 'repeat', n: 2, body: [{ t: 'move', d: 50 }] }], C: [], D: [] },
  })));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  expect(await names(page)).toEqual(['Play B']);
  await tile(page, 'Move 2').tap();
  await settle(page);
  expect(await ink(canvas(page))).toBeGreaterThan(50);
  expect(errors).toEqual([]);
});

test('showing another program stops recording', async ({ page }) => {
  const record = button(page, 'Record');
  await expect(record).toHaveAttribute('aria-pressed', 'true');
  await showProgram(page, 'B');
  await expect(record).toHaveAttribute('aria-pressed', 'false');
  await tile(page, 'Move 2').tap();
  await expect(items(page)).toHaveCount(0);
});

test('the program\'s letter goes up and down through A to D, scrolling the strip', async ({ page }) => {
  const prog = page.locator('.tt-prog');
  const up = button(page, 'Previous program');
  const down = button(page, 'Next program');
  await expect(prog).toHaveAttribute('aria-label', 'Program A');
  await expect(up).toBeHidden();
  await tile(page, 'Move 2').tap();
  await down.click();
  await expect(prog).toHaveAttribute('aria-label', 'Program B');
  await expect(up).toBeVisible();
  await expect(down).toBeVisible();
  // While it scrolls, the strip is only the new program's.
  await expect(items(page)).toHaveCount(0);
  await down.click();
  await down.click();
  await expect(prog).toHaveAttribute('aria-label', 'Program D');
  await expect(down).toBeHidden();
  await expect(page.locator('.tt-strip-ghost')).toHaveCount(0);
  // The letter's tile is in the program's color, as the tiles that play it are.
  const color = await prog.evaluate(e => getComputedStyle(e).backgroundColor);
  await button(page, 'Play a program').click();
  const playD = page.getByRole('dialog', { name: 'Play a program' }).getByRole('button', { name: 'Play D' });
  expect(await playD.evaluate(e => getComputedStyle(e).backgroundColor)).toBe(color);
  await page.locator('.tt-stage-area').click({ position: { x: 30, y: 20 } });
  await up.click();
  await up.click();
  await up.click();
  await expect(prog).toHaveAttribute('aria-label', 'Program A');
  expect(await names(page)).toEqual(['Move 2']);
});

// Taps an item in the strip, then closes any spinner it opened.
async function pickItem(page, item) {
  await item.tap();
  await page.locator('.tt-stage-area').click({ position: { x: 30, y: 20 } });
  await expect(page.locator('.tt-count-pop')).toBeHidden();
}

test('recording goes in after the tile picked in the strip, in order, until Rewind', async ({ page }) => {
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await pickItem(page, items(page).first());
  await expect(items(page).first()).toHaveClass(/tt-selected/);
  await tile(page, 'Home').tap();
  await tile(page, 'Home').tap();
  expect(await names(page)).toEqual(['Move 2', 'Home', 'Home', 'Turn right 90']);
  // The last tile in goes on being picked: a move after it merges into it.
  await expect(items(page).nth(2)).toHaveClass(/tt-selected/);
  await pickItem(page, items(page).first());
  await tile(page, 'Move 2').tap();
  expect(await names(page)).toEqual(['Move 4', 'Home', 'Home', 'Turn right 90']);
  // Rewind lets go: recording goes on the end again.
  await button(page, 'Rewind').click();
  await expect(page.locator('.tt-strip .tt-selected')).toHaveCount(0);
  await tile(page, 'Home').tap();
  expect(await names(page)).toEqual(['Move 4', 'Home', 'Home', 'Turn right 90', 'Home']);
});

test('a repeat picked by its count takes recording at its end; a tile in it, just after', async ({ page }) => {
  await group(page, 'Move 2', 'Turn right 90');
  await tile(page, 'Home').tap();
  await setCount(page, 3);
  await expect(page.locator('.tt-strip > .tt-repeat')).toHaveClass(/tt-selected/);
  await tile(page, 'Back 2').tap();
  expect(await names(page)).toEqual(['Repeat: Move 2, Turn right 90, Back 2', 'Home']);
  await pickItem(page, page.locator('.tt-repeat-body > .tt-item').first());
  await tile(page, 'Home').tap();
  expect(await names(page)).toEqual(['Repeat: Move 2, Home, Turn right 90, Back 2', 'Home']);
  // A new repeat goes after the repeat the picked tile is in; once it's
  // closed, recording goes after it.
  await tile(page, 'Repeat').tap();
  await tile(page, 'Move 2').tap();
  await tile(page, 'Repeat').tap();
  await tile(page, 'Turn right 90').tap();
  expect(await names(page)).toEqual(['Repeat: Move 2, Home, Turn right 90, Back 2', 'Repeat: Move 2',
    'Turn right 90', 'Home']);
});

test('Speed picks an animal: the stage\'s turtle becomes it, and the choice is kept', async ({ page }) => {
  const speed = page.locator('.tt-speed');
  const sprite = page.locator('.tt-stage .logo-sprite');
  const critter = page.locator('.tt-pos-animal');
  await expect(speed).toHaveAttribute('aria-label', 'Speed: Turtle');
  await expect(sprite).toBeVisible();
  await expect(critter).toBeHidden();
  await speed.click();
  const pop = page.getByRole('dialog', { name: 'Speed' });
  await expect(pop.getByRole('button')).toHaveCount(4);
  await pop.getByRole('button', { name: 'Snail: slowest' }).click();
  await expect(pop).toBeHidden();
  await expect(speed).toHaveAttribute('aria-label', 'Speed: Snail: slowest');
  await expect(sprite).toBeHidden();
  await expect(critter).toBeVisible();
  // Seen from above, it faces the way the turtle does: up at first, then
  // turned (never flipped).
  await expect(critter).toHaveAttribute('style', /rotate\(0deg\)/);
  await tile(page, 'Turn right 90').tap();
  await settle(page);
  await expect(critter).toHaveAttribute('style', /rotate\(90deg\)/);
  await expect(critter).not.toHaveAttribute('style', /scale/);
  // Lightning is at once: a long move is done straight away. It turns
  // too, about its point.
  await speed.click();
  await pop.getByRole('button', { name: 'Lightning: at once' }).click();
  await expect(critter).toHaveAttribute('style', /rotate\(90deg\)/);
  await step(page, 99);
  const t0 = Date.now();
  await tile(page, 'Move 99').tap();
  await settle(page);
  expect(Date.now() - t0).toBeLessThan(3000);
  await page.reload();
  await expect(page.locator('.tt-speed')).toHaveAttribute('aria-label', 'Speed: Lightning: at once');
  await expect(page.locator('.tt-pos-animal')).toBeVisible();
});

test('in the strip, a crayon is a colored pencil on a white tile; picked crayons don\'t bounce again', async ({ page }) => {
  await pick(page, 'Red');
  await pick(page, 'Invisible');
  const red = items(page).first();
  await expect(red).toHaveAttribute('aria-label', 'Red');
  expect(await red.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)');
  await expect(red.locator('svg rect').first()).toHaveAttribute('fill', 'red');
  await expect(items(page).nth(1).locator('svg')).toHaveCount(1);  // a white pencil
  // The bounce of a tapped tile ends, so opening the pop-up again doesn't
  // replay it on the crayons used before.
  await button(page, 'Colors').click();
  const palette = page.getByRole('dialog', { name: 'Colors' });
  await expect(palette.locator('.tt-bounce')).toHaveCount(0);
});

test('on a phone, Speed is under Home and Clear, and the tape buttons sit three by two beside the tiles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.turtle-tiles')).toHaveAttribute('data-layout', 'tall');
  await expect(page.locator('.tt-stage-tools > *').nth(2)).toHaveClass(/tt-speed/);
  const labels = await page.locator('.tt-line > *').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  expect(labels).toEqual(['Record', 'Repeat', 'Play', 'Step', 'Rewind', 'Trash']);
  const box = name => page.getByRole('button', { name, exact: true }).boundingBox();
  const [record, play, step, trash] = await Promise.all(['Record', 'Play', 'Step', 'Trash'].map(box));
  const wheel = await page.locator('.tt-wheel').boundingBox();
  expect(Math.abs(record.y - play.y)).toBeLessThan(1);  // a row of three,
  expect(step.y).toBeGreaterThan(record.y + record.height - 1);  // then another
  expect(Math.abs(trash.y - step.y)).toBeLessThan(1);
  // Two rows in all, the wheel's height.
  expect(step.y + step.height).toBeLessThan(wheel.y + wheel.height + 2);
  expect(record.y).toBeGreaterThan(wheel.y - 2);
});

test('Share a link carries the programs; opening it loads them and goes back to the plain page', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await tile(page, 'Move 2').tap();
  await tile(page, 'Turn right 90').tap();
  await recordInto(page, 'B');
  await tile(page, 'Back 2').tap();
  await button(page, 'Grown-ups (hold)').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Share a link' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/\/logo\/tiles\/\?p=[zj][A-Za-z0-9_-]+$/);
  expect(url.length).toBeLessThan(200);
  // Someone else opens it.
  const other = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const theirs = await other.newPage();
  await theirs.goto(url);
  await expect(theirs.locator('.tt-prog')).toHaveAttribute('aria-label', 'Program B');
  await expect(theirs).toHaveURL(/\/logo\/tiles\/$/);
  expect(await names(theirs)).toEqual(['Back 2']);
  await theirs.getByRole('button', { name: 'Previous program' }).click();
  await expect(theirs.locator('.tt-prog')).toHaveAttribute('aria-label', 'Program A');
  expect(await names(theirs)).toEqual(['Move 2', 'Turn right 90']);
  // Kept for next time.
  await theirs.reload();
  expect(await names(theirs)).toEqual(['Move 2', 'Turn right 90']);
  // Opening it over different programs asks first; declining keeps them.
  await theirs.getByRole('button', { name: 'Record', exact: true }).click();
  await theirs.getByRole('button', { name: 'Home', exact: true }).tap();
  theirs.once('dialog', d => d.dismiss());
  await theirs.goto(url);
  await expect(theirs).toHaveURL(/\/logo\/tiles\/$/);
  expect(await names(theirs)).toEqual(['Move 2', 'Turn right 90', 'Home']);
  await other.close();
});

test('a page opens with Record off: tiles move the turtle until Record is tapped', async ({ page }) => {
  await page.reload();
  const record = button(page, 'Record');
  await expect(record).toHaveAttribute('aria-pressed', 'false');
  await tile(page, 'Move 2').tap();
  await expect(items(page)).toHaveCount(0);
  await record.click();
  await tile(page, 'Move 2').tap();
  expect(await names(page)).toEqual(['Move 2']);
});

// Share links are out in the world: every version must still open the
// links earlier versions made. These were made by 1.8.11 (SHARE-LINKS.md
// has the format); never change them, add new ones instead.
const OLD_LINKS = {
  z: 'zZY3BCoMwEET_Zc4reFBKc6u_UTxEs7RCzMoapUXy78UW00KP-2Z23oZ-UeUQYdCAMKnc1I4zzIYLzHXDnihPbCMIAaYidOKeORtlZRAcTF0m-rC4aADBwpzL1B60t97vircqtYTmR-Bw1L6Dxan-XyyqDJ3kp7uMnI_Aj9iLF81kCOswD51npDalFw',
  j: 'jeyJjdXJyZW50IjoiQiIsInByb2dyYW1zIjp7IkEiOlt7InQiOiJyZXBlYXQiLCJuIjo0LCJib2R5IjpbeyJ0IjoibW92ZSIsImQiOjUwfSx7InQiOiJ0dXJuIiwiYSI6OTB9XX0seyJ0IjoiY2FsbCIsInAiOiJCIn1dLCJCIjpbeyJ0IjoicmVkIn0seyJ0IjoibW92ZSIsImQiOi03NX0seyJ0IjoidHVybiIsImEiOi00NX0seyJ0IjoiZG8ifSx7InQiOiJob21lIn0seyJ0IjoibmV4dGNvbG9yIn0seyJ0IjoiaW52aXNpYmxlIn1dfX0',
};
// The same programs as links 2.0.2 made, with the format they carry from
// then on (`"v": 1`). Never change them either.
const LINKS_2_0_2 = {
  z: 'zZY3BCsIwEET_Zc5bqFAR92Z_Q3pIm0ULaVK2aVFK_l2qNAoe983svBUL-EDoZlXxEYwahFHDTc0wgVdcwNcVW6IyiokgeHBFaIN95mwIi4Bgwccy0YfFWT0IBnwuU7PTzji3Kd6q1BDqH4HFXvsOFqfj_2JRZWhDfrqHQfLh5RG74IJm0vuln_rWCVKT0gs',
  j: 'jeyJ2IjoxLCJjdXJyZW50IjoiQiIsInByb2dyYW1zIjp7IkEiOlt7InQiOiJyZXBlYXQiLCJuIjo0LCJib2R5IjpbeyJ0IjoibW92ZSIsImQiOjUwfSx7InQiOiJ0dXJuIiwiYSI6OTB9XX0seyJ0IjoiY2FsbCIsInAiOiJCIn1dLCJCIjpbeyJ0IjoicmVkIn0seyJ0IjoibW92ZSIsImQiOi03NX0seyJ0IjoidHVybiIsImEiOi00NX0seyJ0IjoiZG8ifSx7InQiOiJob21lIn0seyJ0IjoibmV4dGNvbG9yIn0seyJ0IjoiaW52aXNpYmxlIn1dfX0',
};
for (const [kind, link] of [...Object.entries(OLD_LINKS).map(([k, l]) => ['1.8.11 ' + k, l]),
  ...Object.entries(LINKS_2_0_2).map(([k, l]) => ['2.0.2 ' + k, l])]) {
  test(`share links from ${kind.split(' ')[0]} still open (${kind.endsWith('z') ? 'compressed' : 'plain'})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto('/logo/tiles/?p=' + link);
    await expect(page.locator('.tt-prog')).toHaveAttribute('aria-label', 'Program B');
    await expect(page).toHaveURL(/\/logo\/tiles\/$/);
    expect(await names(page)).toEqual(['Red', 'Back 3', 'Turn left 45', 'Note do', 'Home', 'Next color', 'Invisible']);
    await page.getByRole('button', { name: 'Previous program' }).click();
    expect(await names(page)).toEqual(['Repeat: Move 2, Turn right 90', 'Play B']);
    await context.close();
  });
}

test('Turtle Tiles has its own favicon, the turtle', async ({ page }) => {
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/images/turtle-tiles-icon.svg');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/images/turtle-tiles-180.png');
  const ok = await page.evaluate(async () => (await fetch('/images/turtle-tiles-icon.svg')).ok);
  expect(ok).toBe(true);
});
