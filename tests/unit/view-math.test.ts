// LogoView's arithmetic (src/engine/view-math.ts): transforms, margins, the
// box of what must stay in view, and the view that shows it.
import { describe, expect, it } from 'vitest';
import {
  IDENTITY, MARGIN, MARGIN_SHARE, NOTHING, SLACK,
  apply, canonical, fits, include, isIdentity, margin, multiply,
} from '../../src/engine/view-math.js';
import type { Box, Matrix, ViewPoint } from '../../src/engine/view-math.js';

// A 600 x 360 world on a canvas at twice its size, as on a 2x screen.
const W = 1200, H = 720;
const home: ViewPoint = { s: 2, cx: 300, cy: 180 };

describe('matrices', () => {
  it('multiplies like the canvas composes transforms', () => {
    const translate: Matrix = [1, 0, 0, 1, 10, 20];
    const scale: Matrix = [2, 0, 0, 3, 0, 0];
    // Translate, then scale: points scale first.
    expect(apply(multiply(translate, scale), 1, 1)).toEqual([12, 23]);
    expect(apply(multiply(scale, translate), 1, 1)).toEqual([22, 63]);
  });

  it('has an identity', () => {
    const m: Matrix = [0.5, 1, -1, 0.5, 7, 9];
    expect(multiply(IDENTITY, m)).toEqual(m);
    expect(multiply(m, IDENTITY)).toEqual(m);
    expect(isIdentity(IDENTITY)).toBe(true);
    expect(isIdentity([1, 0, 0, 1, 0, 0])).toBe(true);
    expect(isIdentity(m)).toBe(false);
  });

  it('rotates a point', () => {
    const [x, y] = apply([0, 1, -1, 0, 0, 0], 1, 0);  // a quarter turn
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });
});

describe('margin', () => {
  it('is a fixed margin plus a share of the size', () => {
    expect(margin(0)).toBe(MARGIN);
    expect(margin(600)).toBeCloseTo(MARGIN + MARGIN_SHARE * 600);
    expect(margin(600)).toBeCloseTo(42);
  });
});

describe('include (the needed box)', () => {
  it('starts from nothing and only grows', () => {
    const needed: Box = { ...NOTHING };
    expect(needed.x1 >= needed.x0).toBe(false);  // empty
    include(needed, { x0: 10, y0: 20, x1: 30, y1: 40 });
    expect(needed).toEqual({ x0: 10, y0: 20, x1: 30, y1: 40 });
    include(needed, { x0: 15, y0: 0, x1: 25, y1: 50 });
    expect(needed).toEqual({ x0: 10, y0: 0, x1: 30, y1: 50 });
    // Something smaller, inside it, changes nothing.
    include(needed, { x0: 12, y0: 22, x1: 14, y1: 24 });
    expect(needed).toEqual({ x0: 10, y0: 0, x1: 30, y1: 50 });
  });

  it('returns the box it grew, and leaves NOTHING alone', () => {
    const needed: Box = { ...NOTHING };
    expect(include(needed, { x0: 1, y0: 2, x1: 3, y1: 4 })).toBe(needed);
    expect(NOTHING).toEqual({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  });

  it('ignores an empty box', () => {
    const needed: Box = { x0: 1, y0: 2, x1: 3, y1: 4 };
    include(needed, { ...NOTHING });
    expect(needed).toEqual({ x0: 1, y0: 2, x1: 3, y1: 4 });
  });
});

describe('fits', () => {
  // At home the canvas shows x 0..600 and y 0..360; the margins are
  // margin(600) = 42 across and margin(360) = 30 down.
  it('wants the margin clear on every side', () => {
    expect(fits({ x0: 42, y0: 30, x1: 558, y1: 330 }, home, W, H)).toBe(true);
    expect(fits({ x0: 41, y0: 30, x1: 558, y1: 330 }, home, W, H)).toBe(false);
    expect(fits({ x0: 42, y0: 29, x1: 558, y1: 330 }, home, W, H)).toBe(false);
    expect(fits({ x0: 42, y0: 30, x1: 559, y1: 330 }, home, W, H)).toBe(false);
    expect(fits({ x0: 42, y0: 30, x1: 558, y1: 331 }, home, W, H)).toBe(false);
  });

  it('follows the view\'s middle and zoom', () => {
    const box = { x0: 600, y0: 100, x1: 700, y1: 200 };
    expect(fits(box, home, W, H)).toBe(false);
    expect(fits(box, { s: 2, cx: 650, cy: 150 }, W, H)).toBe(true);
    // Zoomed out to half, the view is 1200 x 720 world units (x -300..900,
    // y -180..540), and the margins grow with it: margin(1200) = 72 across
    // and margin(720) = 48 down.
    const half = { s: 1, cx: 300, cy: 180 };
    expect(fits({ x0: -228, y0: -132, x1: 828, y1: 492 }, half, W, H)).toBe(true);
    expect(fits({ x0: -229, y0: -132, x1: 828, y1: 492 }, half, W, H)).toBe(false);
    expect(fits({ x0: -228, y0: -132, x1: 828, y1: 493 }, half, W, H)).toBe(false);
  });

  it('counts an empty box as fitting anywhere (callers check for one first)', () => {
    expect(fits({ ...NOTHING }, home, W, H)).toBe(true);
  });
});

describe('canonical', () => {
  const zooms = (s: number) => Math.log(s / home.s) / Math.log(SLACK);

  it('is the starting view when the box fits there', () => {
    const v = canonical({ x0: 100, y0: 100, x1: 200, y1: 150 }, home.s, home, W, H);
    expect(v).toEqual(home);
    expect(v).not.toBe(home);  // a copy
  });

  it('zooms out down the ladder, each step SLACK of the last, to fit', () => {
    const box = { x0: 100, y0: 100, x1: 700, y1: 150 };
    const v = canonical(box, home.s, home, W, H);
    expect(zooms(v.s)).toBeCloseTo(2);
    expect(v.s).toBeCloseTo(home.s * SLACK * SLACK);
    expect(fits(box, v, W, H)).toBe(true);
  });

  it('puts the middle on a grid of an eighth of the view', () => {
    const box = { x0: 100, y0: 100, x1: 700, y1: 150 };
    const v = canonical(box, home.s, home, W, H);
    const qx = W / 8 / v.s, qy = H / 8 / v.s;
    expect((v.cx - home.cx) / qx).toBeCloseTo(1);
    expect((v.cy - home.cy) / qy).toBeCloseTo(-1);
    expect(v.cx).toBeCloseTo(403.806, 3);
    expect(v.cy).toBeCloseTo(117.716, 3);
  });

  it('keeps home in view as a landmark', () => {
    // A box far to the left: the view stretches to take in home as well.
    const box = { x0: -900, y0: -50, x1: -800, y1: 50 };
    const v = canonical(box, home.s, home, W, H);
    expect(fits({ x0: -900, y0: -50, x1: home.cx, y1: home.cy }, v, W, H)).toBe(true);
  });

  it('never comes closer than the zoom `most`', () => {
    // It would fit at home, but the view is already zoomed out to 1.
    const box = { x0: 100, y0: 100, x1: 200, y1: 150 };
    const v = canonical(box, 1, home, W, H);
    expect(v.s).toBeLessThanOrEqual(1);
    expect(zooms(v.s)).toBeCloseTo(5);  // the first step at or below 1
    expect(fits(box, v, W, H)).toBe(true);
    // A big box needs further out than `most` anyway.
    const big = { x0: -900, y0: -50, x1: 100, y1: 900 };
    expect(canonical(big, 1, home, W, H)).toEqual(canonical(big, home.s, home, W, H));
    expect(zooms(canonical(big, 1, home, W, H).s)).toBeCloseTo(8);
  });

  it('only zooms out as the box grows', () => {
    let most = home.s;
    const box: Box = { x0: 250, y0: 150, x1: 350, y1: 210 };
    for (let i = 0; i < 20; i++) {
      include(box, { x0: box.x0 - 37, y0: box.y0 - 11, x1: box.x1 + 53, y1: box.y1 + 29 });
      const v = canonical(box, most, home, W, H);
      expect(v.s).toBeLessThanOrEqual(most);
      expect(fits(box, v, W, H)).toBe(true);
      most = v.s;
    }
  });

  it('gives up at home for a box too big for the ladder', () => {
    const v = canonical({ x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 }, home.s, home, W, H);
    expect(v).toEqual(home);
  });
});
