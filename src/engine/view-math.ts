// The arithmetic of LogoView (view.ts): canvas transforms, and which view
// shows a drawing. Pure functions of their inputs, so the unit tests can
// check them without a canvas.

// A box in world units: left, top, right, bottom (y grows downwards, as on
// the canvas). An empty box has x0 > x1 (see NOTHING).
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// A view of the world: its zoom `s` (canvas pixels per world unit) and the
// world point (cx, cy) in the canvas's middle.
export interface ViewPoint {
  s: number;
  cx: number;
  cy: number;
}

// A 2D transform, as the canvas's setTransform(a, b, c, d, e, f) takes it.
export type Matrix = [number, number, number, number, number, number];

export const MARGIN = 12;          // world units kept clear around a fitted drawing,
export const MARGIN_SHARE = 0.05;  // and this share of its size more, each way
export const SLACK = 0.85;         // extra zoom-out when auto-fitting, to refit less often

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
export const apply = (m: Matrix, x: number, y: number): [number, number] =>
  [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const isIdentity = (m: Matrix): boolean => m.every((v, i) => v === IDENTITY[i]);

// The box that holds nothing: anything grown into it replaces it.
export const NOTHING: Readonly<Box> = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };

// Grows `into` to take in `box` as well, and returns it.
export function include(into: Box, box: Box): Box {
  into.x0 = Math.min(into.x0, box.x0);
  into.y0 = Math.min(into.y0, box.y0);
  into.x1 = Math.max(into.x1, box.x1);
  into.y1 = Math.max(into.y1, box.y1);
  return into;
}

// The room to leave around something `size` units across.
export const margin = (size: number): number => MARGIN + MARGIN_SHARE * size;

// Whether `box` is in view at the view `v`, with room around it, on a
// canvas `width` x `height` pixels.
export function fits(box: Box, v: ViewPoint, width: number, height: number): boolean {
  const hw = width / 2 / v.s, hh = height / 2 / v.s;
  const mx = margin(2 * hw), my = margin(2 * hh);
  return box.x0 >= v.cx - hw + mx && box.x1 <= v.cx + hw - mx &&
    box.y0 >= v.cy - hh + my && box.y1 <= v.cy + hh - my;
}

// The view that shows `box` on a canvas `width` x `height` pixels: the
// starting view `home` if it fits there, else the closest of a fixed ladder
// of zooms (each SLACK of the last), with its middle on a coarse grid, but
// never closer than the zoom `most`.
export function canonical(box: Box, most: number, home: ViewPoint, width: number, height: number): ViewPoint {
  // Home stays in view too, as a landmark.
  box = {
    x0: Math.min(box.x0, home.cx), x1: Math.max(box.x1, home.cx),
    y0: Math.min(box.y0, home.cy), y1: Math.max(box.y1, home.cy),
  };
  if (most >= home.s && fits(box, home, width, height)) return { ...home };
  const bx = (box.x0 + box.x1) / 2, by = (box.y0 + box.y1) / 2;
  for (let k = 1; k < 80; k++) {
    const s = home.s * Math.pow(SLACK, k);
    if (s > most * (1 + 1e-9)) continue;
    const qx = width / 8 / s, qy = height / 8 / s;
    const v = {
      s,
      cx: home.cx + Math.round((bx - home.cx) / qx) * qx,
      cy: home.cy + Math.round((by - home.cy) / qy) * qy,
    };
    if (fits(box, v, width, height)) return v;
  }
  return { ...home };
}
