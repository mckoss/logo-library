// Turtle Tiles' pictures: the tiles', the buttons' and the animals', as SVG
// markup, and how a program item looks (lookOf). Strings only, no page;
// tiles.ts puts them on the page.
import { CRAYONS, NOTES, TILES, UNIT, tileFor } from './program.js';
import type { Item, ProgramName, TileInfo } from './program.js';
import type { AnimalId, LookId } from './state.js';

// Each program's color (PROGRAM_COLORS, pastel), and a deeper shade of it
// for its letter.
export const PROGRAM_INK: Record<ProgramName, string> = { A: '#c62828', B: '#2e7d32', C: '#1565c0', D: '#5d4037' };
// The colors Next color goes round: setpencolor "rainbow (see
// runtime.js) picks the next one.
const RAINBOW = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
// The animals, side on and facing right, in a 64 x 64 box.
const ANIMALS: Record<AnimalId, string> = {
  snail: '<path d="M5 51 C5 46 9 45 14 45 H44 C50 45 52 41 53 36 L54 31 C55 27 60 27 61 31 C62 35 60 38 59 42 ' +
    'L58 46 C56 52 51 54 44 54 H9 C6 54 5 53 5 51 Z" fill="#f7c97e" stroke="#d99a4e" stroke-width="1.2"/>' +
    '<path d="M53 31 L50 18 M58 30 L60 17" stroke="#d99a4e" stroke-width="2.6" stroke-linecap="round"/>' +
    '<circle cx="50" cy="17" r="3.2" fill="#fff" stroke="#d99a4e" stroke-width="1.4"/>' +
    '<circle cx="50.8" cy="17.2" r="1.6" fill="#2b2a28"/>' +
    '<circle cx="60" cy="16" r="3.2" fill="#fff" stroke="#d99a4e" stroke-width="1.4"/>' +
    '<circle cx="60.8" cy="16.2" r="1.6" fill="#2b2a28"/>' +
    '<path d="M54.5 38.5 Q57 40.5 59.5 38" stroke="#9a5a1c" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
    '<circle cx="27" cy="31" r="16.5" fill="#c4782f"/>' +
    '<path d="M27 31 m-1 -3.5 a3.5 3.5 0 1 1 -2.5 4.5 a7.5 7.5 0 0 1 9 -8.5 a11.5 11.5 0 0 1 4.5 15 ' +
    'a12.5 12.5 0 0 1 -16 5" stroke="#8a4a15" stroke-width="3" fill="none" stroke-linecap="round"/>',
  turtle: '<ellipse cx="18" cy="48" rx="5.5" ry="6.5" fill="#8fd17f"/><ellipse cx="38" cy="48" rx="5.5" ry="6.5" fill="#8fd17f"/>' +
    '<path d="M8 41 L2 45 L10 45 Z" fill="#8fd17f" stroke="#8fd17f" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M6 43 C6 23 17 13 29 13 C41 13 51 23 51 43 Z" fill="#2e9d48"/>' +
    '<path d="M29 19 L37 24.5 L34.5 33 H23.5 L21 24.5 Z" fill="#4cbf63"/>' +
    '<path d="M17.5 27 L19.5 35 L13 39 H9.5 C10 33 12.5 29 17.5 27 Z M40.5 27 L38.5 35 L45 39 H48.5 ' +
    'C48 33 45.5 29 40.5 27 Z" fill="#4cbf63"/>' +
    '<path d="M23 36.5 H35 L37.5 40 H20.5 Z" fill="#4cbf63"/><rect x="4" y="40" width="49" height="6" rx="3" fill="#f6c945"/>' +
    '<circle cx="52" cy="31" r="9.5" fill="#8fd17f"/><circle cx="54.5" cy="28" r="3.3" fill="#fff"/>' +
    '<circle cx="55.4" cy="28.2" r="1.9" fill="#23301f"/><circle cx="56" cy="27.4" r=".7" fill="#fff"/>' +
    '<circle cx="50" cy="33" r="1.8" fill="#f49ab0" opacity=".85"/>' +
    '<path d="M51.5 35.2 Q55 38 58.5 34" stroke="#1f5f2c" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  rabbit: '<ellipse cx="22" cy="55" rx="7" ry="3.5" fill="#c9b9a0"/><ellipse cx="40" cy="55" rx="5" ry="3" fill="#c9b9a0"/>' +
    '<circle cx="10" cy="40" r="5.5" fill="#fff" stroke="#c9b9a0" stroke-width="1.5"/>' +
    '<ellipse cx="27" cy="43" rx="17" ry="12" fill="#e3d5c0" stroke="#c9b9a0" stroke-width="1.2"/>' +
    '<ellipse cx="41" cy="13" rx="4.5" ry="13" fill="#e3d5c0" stroke="#c9b9a0" stroke-width="1.2" transform="rotate(-14 41 13)"/>' +
    '<ellipse cx="41" cy="14" rx="2" ry="9" fill="#f6b3c4" transform="rotate(-14 41 14)"/>' +
    '<ellipse cx="50" cy="14" rx="4.5" ry="13" fill="#d8c8b0" stroke="#c9b9a0" stroke-width="1.2" transform="rotate(12 50 14)"/>' +
    '<circle cx="47" cy="31" r="11" fill="#e3d5c0" stroke="#c9b9a0" stroke-width="1.2"/>' +
    '<circle cx="51" cy="28" r="2.4" fill="#2b2a28"/><circle cx="51.8" cy="27.2" r=".8" fill="#fff"/>' +
    '<circle cx="57.3" cy="32.3" r="1.8" fill="#f28fa8"/><circle cx="47" cy="34" r="2" fill="#f6b3c4" opacity=".8"/>' +
    '<path d="M52.5 36 Q55 38 57.5 35.5" stroke="#8a7f70" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  // Lightning: taller than wide, from a broad top at the upper right to
  // a point at the lower left (BOLT_TIP).
  bolt: '<path d="M27 3 H52 L39 27 H48 L19 61 L27 35 H17 Z" fill="#ffd23f" stroke="#f08c00" stroke-width="3" ' +
    'stroke-linejoin="round"/>',
};
export const animal = (id: AnimalId) => `<svg viewBox="0 0 64 64" aria-hidden="true">${ANIMALS[id]}</svg>`;
// On the stage, the animals are seen from above, facing up (the way the
// turtle goes), so they only ever turn, never flip.
export const ABOVE: Partial<Record<AnimalId, string>> = {
  snail: '<ellipse cx="32" cy="36" rx="8" ry="25" fill="#f7c97e" stroke="#d99a4e" stroke-width="1.5"/>' +
    '<path d="M29 10 L24 2.5 M35 10 L40 2.5" stroke="#d99a4e" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="24" cy="3" r="2.8" fill="#fff" stroke="#d99a4e" stroke-width="1.2"/><circle cx="24" cy="2.6" r="1.4" fill="#2b2a28"/>' +
    '<circle cx="40" cy="3" r="2.8" fill="#fff" stroke="#d99a4e" stroke-width="1.2"/><circle cx="40" cy="2.6" r="1.4" fill="#2b2a28"/>' +
    '<circle cx="32" cy="39" r="15" fill="#c4782f"/>' +
    '<circle cx="32" cy="39" r="10.5" fill="none" stroke="#8a4a15" stroke-width="2.6"/>' +
    '<circle cx="32" cy="39" r="5.5" fill="none" stroke="#8a4a15" stroke-width="2.6"/>' +
    '<circle cx="32" cy="39" r="1.8" fill="#8a4a15"/>',
  rabbit: '<circle cx="32" cy="57" r="5" fill="#fff" stroke="#c9b9a0" stroke-width="1.5"/>' +
    '<ellipse cx="20" cy="50" rx="4.5" ry="7.5" fill="#d8c8b0" stroke="#c9b9a0" stroke-width="1.2"/>' +
    '<ellipse cx="44" cy="50" rx="4.5" ry="7.5" fill="#d8c8b0" stroke="#c9b9a0" stroke-width="1.2"/>' +
    '<ellipse cx="32" cy="40" rx="13" ry="15" fill="#e3d5c0" stroke="#c9b9a0" stroke-width="1.2"/>' +
    '<ellipse cx="24.5" cy="27" rx="3" ry="4.5" fill="#d8c8b0" stroke="#c9b9a0" stroke-width="1.2"/>' +
    '<ellipse cx="39.5" cy="27" rx="3" ry="4.5" fill="#d8c8b0" stroke="#c9b9a0" stroke-width="1.2"/>' +
    '<circle cx="32" cy="20" r="9.5" fill="#e3d5c0" stroke="#c9b9a0" stroke-width="1.2"/>' +
    '<ellipse cx="27.5" cy="32" rx="3.6" ry="10" fill="#e3d5c0" stroke="#c9b9a0" stroke-width="1.2" transform="rotate(10 27.5 32)"/>' +
    '<ellipse cx="27.5" cy="33" rx="1.6" ry="7" fill="#f6b3c4" transform="rotate(10 27.5 33)"/>' +
    '<ellipse cx="36.5" cy="32" rx="3.6" ry="10" fill="#e3d5c0" stroke="#c9b9a0" stroke-width="1.2" transform="rotate(-10 36.5 32)"/>' +
    '<ellipse cx="36.5" cy="33" rx="1.6" ry="7" fill="#f6b3c4" transform="rotate(-10 36.5 33)"/>' +
    '<circle cx="26.5" cy="18.5" r="2" fill="#2b2a28"/><circle cx="37.5" cy="18.5" r="2" fill="#2b2a28"/>' +
    '<circle cx="32" cy="11.5" r="1.8" fill="#f28fa8"/>',
  bolt: ANIMALS.bolt,
};
export const BOLT_TIP: [number, number] = [19, 61];  // where the lightning strikes: the turtle's place

export const svg = (body: string, box = 64) => `<svg viewBox="0 0 ${box} ${box}" aria-hidden="true">${body}</svg>`;

// A big number over a faint picture, as on Move, turn and repeat tiles.
const numbered = (picture: string, text: string) => svg(`<g opacity=".35">${picture}</g>` +
  `<text x="32" y="44" text-anchor="middle" font-family="Archivo, sans-serif" ` +
  `font-size="${text.length > 3 ? 22 : text.length > 2 ? 28 : 38}" font-weight="800" fill="#fff">${text}</text>`);
// Move and Back: a plain arrow, up or down, on the buttons; in the strip,
// a shorter arrow with how many units at its foot (below for Move,
// above for Back).
const ARROW = '<path d="M32 4 L52 26 H39 V60 H25 V26 H12 Z" fill="#fff"/>';
const SHORT_ARROW = '<path d="M32 3 L50 22 H38.5 V44 H25.5 V22 H14 Z" fill="#fff"/>';
const flip = (body: string) => `<g transform="rotate(180 32 32)">${body}</g>`;
export const arrowIcon = (d: number) => svg(d > 0 ? ARROW : flip(ARROW));
const moveIcon = (d: number) => svg((d > 0 ? SHORT_ARROW : flip(SHORT_ARROW)) +
  `<text x="32" y="${d > 0 ? 61 : 17}" text-anchor="middle" font-family="Archivo, sans-serif" ` +
  `font-size="17" font-weight="800" fill="#fff">${Math.abs(d) / UNIT}</text>`);
// The pen tiles show what the turtle leaves behind: Draw, a thick wavy
// line (in the pen's color on the Draw button); Don't draw, the same wave
// as a thin, faint dashed line. A faint shadow keeps light colors visible
// on the white tile.
const WAVE = 'M8 40 C18 18 28 18 32 32 S46 46 56 24';
const penIcon = (down: boolean, color = '#3a3732') => svg(down
  ? `<path d="${WAVE}" stroke="#000" stroke-opacity=".18" stroke-width="12" fill="none" stroke-linecap="round"/>` +
    `<path d="${WAVE}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"/>`
  : `<path d="${WAVE}" stroke="#a49d90" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="1 7"/>`);
const ICONS: Record<string, string> = {
  penup: penIcon(false),
  pendown: penIcon(true),
  invisible: '',  // a plain white tile
  repeat: svg('<path d="M50 36 A18 18 0 1 1 44 18" stroke="#fff" stroke-width="7" fill="none" ' +
    'stroke-linecap="round"/><path d="M36 8 L54 14 L44 30 Z" fill="#fff"/>'),
  // A rainbow.
  nextcolor: svg(RAINBOW.map((c, i) => {
    const r = 27 - i * 4.5;
    return `<path d="M${32 - r} 48 A${r} ${r} 0 0 1 ${32 + r} 48" stroke="${c}" stroke-width="5" fill="none"/>`;
  }).join('')),
};
// The buttons' pictures.
export const BUTTONS = {
  record: svg('<circle cx="32" cy="32" r="15" fill="#e53935" stroke="#fff" stroke-width="4"/>'),
  play: svg('<path d="M22 14 L50 32 L22 50 Z" fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>'),
  pause: svg('<rect x="17" y="14" width="11" height="36" rx="3" fill="#fff"/><rect x="36" y="14" width="11" height="36" rx="3" fill="#fff"/>'),
  step: svg('<path d="M14 16 L40 32 L14 48 Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>' +
    '<rect x="43" y="16" width="8" height="32" rx="2" fill="#fff"/>'),
  rewind: svg('<rect x="12" y="16" width="7" height="32" rx="2" fill="#fff"/>' +
    '<path d="M36 16 L20 32 L36 48 Z M54 16 L38 32 L54 48 Z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>'),
  trash: svg('<path d="M16 20 H48 L45 56 H19 Z" fill="#fff"/><rect x="11" y="12" width="42" height="6" rx="3" ' +
    'fill="#fff"/><rect x="26" y="6" width="12" height="6" rx="2" fill="#fff"/>' +
    '<path d="M26 26 V50 M32 26 V50 M38 26 V50" stroke="#c0392b" stroke-width="3"/>'),
  clear: svg('<g transform="rotate(-35 32 32)"><rect x="14" y="20" width="36" height="22" rx="4" fill="#fff"/>' +
    '<rect x="14" y="20" width="13" height="22" rx="4" fill="#f4a9b8"/></g>' +
    '<path d="M8 56 H40" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 7"/>'),
  home: svg('<path d="M10 32 L32 12 L54 32" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" ' +
    'stroke-linejoin="round"/><path d="M18 30 V52 H46 V30" fill="#fff"/><rect x="28" y="38" width="8" height="14" ' +
    'fill="#2e9d48"/>'),
};
// A crayon; a white one (the pen up) gets an outline to show on white.
export const crayon = (color: string) => svg(
  `<g transform="rotate(35 32 32)"${color === '#fff' ? ' stroke="#b9b2a5" stroke-width="2"' : ''}>` +
  `<rect x="23" y="18" width="18" height="40" rx="4" fill="${color}"/>` +
  `<path d="M23 19 L32 3 L41 19 Z" fill="${color}"/><path d="M28.5 9 L32 3 L35.5 9 Z" fill="#333" opacity=".5"/>` +
  '<rect x="23" y="27" width="18" height="6" fill="#000" opacity=".2"/>' +
  '<rect x="23" y="46" width="18" height="6" fill="#000" opacity=".2"/></g>');
// The Step size button: a ruler, with how many units Move and Back go.
export const rulerIcon = (n: number) => svg('<rect x="4" y="40" width="56" height="18" rx="3" fill="#3d7fd9"/>' +
  '<path d="M12 40 V49 M20 40 V46 M28 40 V49 M36 40 V46 M44 40 V49 M52 40 V46" stroke="#fff" stroke-width="3"/>' +
  `<text x="32" y="33" text-anchor="middle" font-family="Archivo, sans-serif" font-size="30" ` +
  `font-weight="800" fill="#3d7fd9">${n}</text>`);
// A note's name (do, re, mi...), sitting higher on the tile for a higher
// pitch; high do has a dot over it.
const syllable = (name: string, step: number, high: boolean) => svg(
  `<text x="32" y="${47 - step * 2.4}" text-anchor="middle" font-family="Archivo, sans-serif" ` +
  `font-size="${name.length > 2 ? 22 : 26}" font-weight="800" fill="#fff">${name}</text>` +
  (high ? `<circle cx="32" cy="${20 - step * 2.4}" r="3.5" fill="#fff"/>` : ''));
export const MUSIC = svg('<path d="M37 14 V44" stroke="#fff" stroke-width="5" fill="none"/>' +
  '<path d="M37 14 Q50 19 47 31" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>' +
  '<ellipse cx="29" cy="45" rx="10" ry="7.5" transform="rotate(-20 29 45)" fill="#fff"/>');
// A repeat in the strip: how many times, big, over a faint repeat arrow.
export const repeatCount = (n: number) => numbered('<path d="M50 36 A18 18 0 1 1 44 18" stroke="#fff" ' +
  'stroke-width="7" fill="none" stroke-linecap="round"/><path d="M36 8 L54 14 L44 30 Z" fill="#fff"/>', String(n));

// Playing a program: a round Play button in the program's color, with
// its letter on the triangle.
const callIcon = (p: ProgramName) => svg('<path d="M18 9 L54 32 L18 55 Z" fill="#fff" stroke="#fff" stroke-width="4" ' +
  `stroke-linejoin="round"/><text x="30" y="41" text-anchor="middle" font-family="Archivo, sans-serif" ` +
  `font-size="24" font-weight="800" fill="${PROGRAM_INK[p]}">${p}</text>`);

// The turtle as the stage draws it (jslogo's outline: one side, then the
// same points mirrored), facing up, centered on where it stands, and
// turned by the wheel to the turtle's heading.
const TURTLE_SIDE: [number, number][] = [[0, -20], [2.5, -17], [3, -12], [6, -10], [9, -13], [13, -12], [18, -4], [18, 0],
  [14, -1], [10, -7], [8, -6], [10, -2], [9, 3], [6, 10], [9, 13], [6, 15], [3, 12], [0, 13]];
const TURTLE_OUTLINE = TURTLE_SIDE.concat(TURTLE_SIDE.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
export const TURTLE = '<svg viewBox="-23 -23 46 46" aria-hidden="true"><g class="tt-turtle-turn">' +
  `<path d="M${TURTLE_OUTLINE.map(p => p.join(' ')).join(' L')} Z" fill="none" stroke="green" ` +
  'stroke-width="2" stroke-linejoin="round"/></g></svg>';

// The turtle display choices: the turtle; the turtle with its x, y and a
// dot in the pen's color; just an arrow in the pen's color.
const LOOK_TURTLE = `<path d="M${TURTLE_OUTLINE.map(p => p.join(' ')).join(' L')} Z" fill="none" ` +
  'stroke="green" stroke-width="2.5" stroke-linejoin="round"/>';
// The turtle display choices' ids.
export const LOOKS: { id: LookId; label: string; icon: string }[] = [
  { id: 'turtle', label: 'Turtle',
    icon: `<svg viewBox="-23 -23 46 46" aria-hidden="true">${LOOK_TURTLE}</svg>` },
  { id: 'xy', label: 'Turtle, where it is, and the pen',
    icon: `<svg viewBox="-23 -23 46 46" aria-hidden="true"><g opacity=".5">${LOOK_TURTLE}</g>` +
      '<circle r="5" fill="#d64545" stroke="#fff" stroke-width="2"/>' +
      '<text x="0" y="19" text-anchor="middle" font-family="Archivo, sans-serif" font-size="10" ' +
      'font-weight="800" fill="#3b3a36">10,20</text></svg>' },
  { id: 'arrow', label: 'Just an arrow',
    icon: '<svg viewBox="-23 -23 46 46" aria-hidden="true">' +
      '<path d="M-3 16 V-2 H-11 L0 -17 L11 -2 H3 V16 Z" fill="#d64545"/></svg>' },
];

// A point at `angle` degrees clockwise from straight up, `r` from (c, c).
export function polar(c: number, r: number, angle: number): [number, number] {
  const rad = angle * Math.PI / 180;
  return [c + r * Math.sin(rad), c - r * Math.cos(rad)];
}
// The wedge from straight up round to `angle`.
export function wedge(c: number, r: number, angle: number) {
  const [x, y] = polar(c, r, angle);
  return `M${c} ${c} L${c} ${c - r} A${r} ${r} 0 0 ${angle > 0 ? 1 : 0} ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}
// A curved arrow round (c, c) at radius r, from straight up round to
// `angle`: the arc, and an arrowhead `head` long ending at `angle`.
export function arcArrow(c: number, r: number, angle: number, head: number) {
  const sign = Math.sign(angle);
  const end = angle - sign * Math.min(Math.abs(angle) * 0.6, head / r * 180 / Math.PI);
  const [ex, ey] = polar(c, r, end);
  const [tx, ty] = polar(c, r, angle);
  const rad = end * Math.PI / 180;
  const w = head * 0.6;
  const [nx, ny] = [Math.sin(rad) * w, -Math.cos(rad) * w];  // outward, across the arc
  const f = (n: number) => n.toFixed(2);
  return {
    arc: `M${c} ${c - r} A${r} ${r} 0 0 ${sign > 0 ? 1 : 0} ${f(ex)} ${f(ey)}`,
    head: `M${f(tx)} ${f(ty)} L${f(ex + nx)} ${f(ey + ny)} L${f(ex - nx)} ${f(ey - ny)} Z`,
  };
}
// A turn tile: the wedge of the turn, filled, with a curved arrow along
// its edge to where the turn ends.
function turnArc(angle: number) {
  const { arc, head } = arcArrow(32, 25, angle, 15);
  return `<path d="${wedge(32, 25, angle)}" fill="#fff" opacity=".45"/>` +
    '<path d="M32 32 V7" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 3"/>' +
    `<path d="${arc}" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    // On a small turn the arrowhead would be a speck: just the arc.
    (Math.abs(angle) > 15 ? `<path d="${head}" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>` : '') +
    '<circle cx="32" cy="32" r="4" fill="#fff"/>';
}
// A turn tile: its degrees, - for left and + for right, over the arc.
const turnIcon = (angle: number) => numbered(turnArc(angle), (angle > 0 ? '+' : '\u2212') + Math.abs(angle));
// A tile as it shows: what it is (program.ts), and its picture.
export interface TileLook extends TileInfo {
  icon: string;
}
// The fixed tiles (TILES, in program.ts) with their pictures: ICONS, or
// for Home its button, for a crayon nothing (the tile is a swatch of its
// color), and for a note its name (do, re, mi...), sitting higher for a
// higher note.
const PICTURES: Record<string, string> = { ...ICONS, home: BUTTONS.home };
CRAYONS.forEach(([id]) => { PICTURES[id] = ''; });
NOTES.forEach(([id], step) => { PICTURES[id] = syllable(id === 'high-do' ? 'do' : id, step, id === 'high-do'); });
export const PICTURED: Record<string, TileLook> = {};
TILES.forEach(t => {
  PICTURED[t.id] = { ...t, icon: PICTURES[t.id] };
});

// How a program item looks: its tile (tileFor), with its picture.
export function lookOf(item: Item): TileLook {
  if (item.t === 'move') return { ...tileFor(item), icon: moveIcon(item.d) };
  if (item.t === 'turn') return { ...tileFor(item), icon: turnIcon(item.a) };
  if (item.t === 'call') return { ...tileFor(item), icon: callIcon(item.p) };
  return PICTURED[item.t];
}

// A program's letter, in its ink.
export const progIcon = (p: ProgramName) => svg(`<text x="32" y="45" text-anchor="middle" font-family="Archivo, sans-serif" ` +
  `font-size="34" font-weight="800" fill="${PROGRAM_INK[p]}">${p}</text>`);
// The Play a program button: a round Play button in the programs' four
// colors.
export const playsIcon = (colors: string[]) => svg(colors.map((color, i) => {
  const a0 = i * Math.PI / 2 - Math.PI / 2, a1 = a0 + Math.PI / 2;
  const pt = (a: number) => `${(32 + 26 * Math.cos(a)).toFixed(2)} ${(32 + 26 * Math.sin(a)).toFixed(2)}`;
  return `<path d="M32 32 L${pt(a0)} A26 26 0 0 1 ${pt(a1)} Z" fill="${color}"/>`;
}).join('') +
  '<path d="M25 18 L45 32 L25 46 Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>');
// A menu button: three lines.
export const MENU = svg('<path d="M14 18 H50 M14 32 H50 M14 46 H50" stroke="#fff" stroke-width="7" stroke-linecap="round"/>');
