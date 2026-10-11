// Turtle Tiles: Logo for children who can't read yet. Picture tiles make
// the turtle move, turn, change color and play notes.
//
// Tapping a tile makes the turtle do it right away. While Record is on, the
// tile is also added to the end of the recording, the strip of tiles. The
// strip works like a tape: Play plays it from the playhead (the tile with
// the dashed outline), Pause stops after the tile that's playing, Step
// plays one tile, and Rewind takes the playhead back to the start; tapping
// a tile in the strip moves the playhead to it. Playing never clears the
// drawing or moves the turtle home first: Clear (which also sends the
// turtle home and rewinds the strip) and Home do that, when the child
// wants. Home is a tile like the others, so it can be recorded too
// (to start each drawing from the middle); Clear is a button and isn't.
// Tiles can be dragged into the strip, moved around in it, or dragged out
// onto the trash can to throw them away (dropped anywhere else, they go
// back); tapping the trash can twice empties the whole strip. Repeat, while
// recording, opens a repeat in the strip; the tiles tapped next go into
// it, and tapping Repeat again (or stopping recording) closes it. Its big
// number is how many times it goes round: 1 at first, so it's just a
// group, and tapping it opens a pop-up to count up or down, 0 to 99. Dots
// (or for big counts a bar) under the number show how far round it has
// gone. Dragged to the trash, a repeat lets go of its tiles, which stay.
// The strip is saved in this browser.
//
// Moves and turns are set the same way: the Step size button opens a
// spinner that sets how many units (of 25 turtle steps, 1 to 99) the Move
// and Back buttons go, and the turn wheel sets how far the turtle in its
// middle turns. The wheel's arm shows where the turtle will face, and the wedge how far it
// turns: tap or drag around the ring to move the arm (in steps of 15
// degrees, with bigger dots at 45, 60, 90, 120 and 180), then tap the
// turtle to turn. The turtle in the middle is drawn as on the stage, and it
// and the dial turn with the turtle on the stage, so the arm always shows
// the turn from the way the turtle faces and tapping again turns the same
// way again. Move tiles show their units and turn tiles their degrees (-
// for left, + for right). Tapping a move in the strip opens the spinner to
// change it (and sets Move and Back to it); tapping a turn opens it too, in
// steps of 15 degrees (and sets the wheel to it). While recording, a move after a move the same way, or a turn after a
// turn, merges into the tile before (a whole turn disappears).
//
// Colors: the Colors button opens the crayons (swatches of the named Logo
// colors, which put the pen down, a white one that lifts it, and Next
// color, a rainbow, which goes round the rainbow). The Music button opens the notes (named do, re, mi...).
//
// The drawing gets all the room the controls leave. A gutter down the left
// has Home, Clear, Speed, Colors, Music and Turtle (how the turtle shows: as
// itself, with where it is and which way it faces, or as an arrow). Under the
// drawing, the strip has a row
// of its own, the whole width, growing to three lines before it scrolls;
// under that are the tape buttons (with Repeat), and the wheel in the
// corner with Move, Back and Step size beside it.
//
// Programs: there are four, A to D, each with its own strip; the button
// left of the strip shows which one the strip shows and picks another.
// The Play program button (by Move and Back) plays one, and while
// recording adds a tile that plays it (a Play button with its letter), so a
// program can be made of others. Play and Step go into a program played:
// the strip shows it while it plays, then comes back. A program can't play
// itself, even by way of another: those choices are faded. In the
// playground each program played is a Logo word (TO B ... END).
//
// A grown-ups button, opened by holding it down, has Snapshot, Make
// Recording and Open in Playground, which shows the strip as Logo.
//
// The <turtle-tiles> element (element.ts) calls init() on itself.
//
// What a program is, the tiles' names, colors and Logo, and a program as
// Logo are in program.ts; share links are in share.ts.
import type { SpeedName, Stage, TurtleAt } from '../engine/index.js';
import {
  BLUE, CRAYONS, HOME, MAX_COUNT, MAX_UNITS, NAMES, NOTES, PROGRAM_COLORS, STEP, TILE, TILES, UNIT,
  clean, codeFor, isName, moveLabel, namedLogo, normalize, plays, stepsOf, tileFor, toLogo, turnLabel, turnTint,
} from './program.js';
import type {
  Item, MoveItem, PlainTileId, ProgramName, Programs, RepeatItem, Step, Tile, TileGroup, TileInfo, TurnItem,
} from './program.js';
import { SHARE_PARAM, pack, unpack } from './share.js';
import type { IncomingPayload, SharePayload } from './share.js';

const { LogoStage } = self;
const SAVE_KEY = 'mckoss.logo.tiles';
// Each program's color (PROGRAM_COLORS, pastel), and a deeper shade of it
// for its letter.
const PROGRAM_INK: Record<ProgramName, string> = { A: '#c62828', B: '#2e7d32', C: '#1565c0', D: '#5d4037' };
let programs: Programs = { A: [], B: [], C: [], D: [] };
const IMPORT_KEY = 'mckoss.logo.import';
const PLAYGROUND = '/logo/playground/';
const TITLE = 'Turtle Tiles';
const PRELUDE = 'setpensize 2';
// The colors Next color goes round: setpencolor "rainbow (see
// runtime.js) picks the next one.
const RAINBOW = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
// The animals, picked for a speed (the turtle is the turtle).
type AnimalId = 'snail' | 'turtle' | 'rabbit' | 'bolt';
// How fast the turtle goes, picked by animal. The stage's turtle takes
// the animal's shape (the turtle is the turtle).
const SPEEDS: { id: AnimalId; label: string; speed: SpeedName }[] = [
  { id: 'snail', label: 'Snail: slowest', speed: 'crawl' },
  { id: 'turtle', label: 'Turtle', speed: 'slow' },
  { id: 'rabbit', label: 'Rabbit: fast', speed: 'fast' },
  { id: 'bolt', label: 'Lightning: at once', speed: 'instant' },
];
const SPEED_KEY = 'mckoss.logo.tiles.speed';
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
const animal = (id: AnimalId) => `<svg viewBox="0 0 64 64" aria-hidden="true">${ANIMALS[id]}</svg>`;
// On the stage, the animals are seen from above, facing up (the way the
// turtle goes), so they only ever turn, never flip.
const ABOVE: Partial<Record<AnimalId, string>> = {
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
const BOLT_TIP: [number, number] = [19, 61];  // where the lightning strikes: the turtle's place
const DOTS_UP_TO = 8;  // its progress shows as dots up to here, else as a bar
const FRIENDLY = [45, 60, 90, 120, 180];
const SHORT_SIDE = 240;  // turtle steps across the stage's shorter side
const HOLD_MS = 800;
// Layout, in pixels: the page's padding, the gap between tiles, the
// largest and smallest tile, and the least of the height the drawing
// keeps.
const PAD = 8;
const GAP = 6;
const MAX_TILE = 76;
const MIN_TILE = 26;
const STAGE_SHARE = 0.6;

const svg = (body: string, box = 64) => `<svg viewBox="0 0 ${box} ${box}" aria-hidden="true">${body}</svg>`;

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
const arrowIcon = (d: number) => svg(d > 0 ? ARROW : flip(ARROW));
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
const BUTTONS = {
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
const crayon = (color: string) => svg(
  `<g transform="rotate(35 32 32)"${color === '#fff' ? ' stroke="#b9b2a5" stroke-width="2"' : ''}>` +
  `<rect x="23" y="18" width="18" height="40" rx="4" fill="${color}"/>` +
  `<path d="M23 19 L32 3 L41 19 Z" fill="${color}"/><path d="M28.5 9 L32 3 L35.5 9 Z" fill="#333" opacity=".5"/>` +
  '<rect x="23" y="27" width="18" height="6" fill="#000" opacity=".2"/>' +
  '<rect x="23" y="46" width="18" height="6" fill="#000" opacity=".2"/></g>');
// The Step size button: a ruler, with how many units Move and Back go.
const rulerIcon = (n: number) => svg('<rect x="4" y="40" width="56" height="18" rx="3" fill="#3d7fd9"/>' +
  '<path d="M12 40 V49 M20 40 V46 M28 40 V49 M36 40 V46 M44 40 V49 M52 40 V46" stroke="#fff" stroke-width="3"/>' +
  `<text x="32" y="33" text-anchor="middle" font-family="Archivo, sans-serif" font-size="30" ` +
  `font-weight="800" fill="#3d7fd9">${n}</text>`);
// A note's name (do, re, mi...), sitting higher on the tile for a higher
// pitch; high do has a dot over it.
const syllable = (name: string, step: number, high: boolean) => svg(
  `<text x="32" y="${47 - step * 2.4}" text-anchor="middle" font-family="Archivo, sans-serif" ` +
  `font-size="${name.length > 2 ? 22 : 26}" font-weight="800" fill="#fff">${name}</text>` +
  (high ? `<circle cx="32" cy="${20 - step * 2.4}" r="3.5" fill="#fff"/>` : ''));
const MUSIC = svg('<path d="M37 14 V44" stroke="#fff" stroke-width="5" fill="none"/>' +
  '<path d="M37 14 Q50 19 47 31" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>' +
  '<ellipse cx="29" cy="45" rx="10" ry="7.5" transform="rotate(-20 29 45)" fill="#fff"/>');
// A repeat in the strip: how many times, big, over a faint repeat arrow.
const repeatCount = (n: number) => numbered('<path d="M50 36 A18 18 0 1 1 44 18" stroke="#fff" ' +
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
const TURTLE = '<svg viewBox="-23 -23 46 46" aria-hidden="true"><g class="tt-turtle-turn">' +
  `<path d="M${TURTLE_OUTLINE.map(p => p.join(' ')).join(' L')} Z" fill="none" stroke="green" ` +
  'stroke-width="2" stroke-linejoin="round"/></g></svg>';

// The turtle display choices: the turtle; the turtle with its x, y and a
// dot in the pen's color; just an arrow in the pen's color.
const LOOK_TURTLE = `<path d="M${TURTLE_OUTLINE.map(p => p.join(' ')).join(' L')} Z" fill="none" ` +
  'stroke="green" stroke-width="2.5" stroke-linejoin="round"/>';
// The turtle display choices' ids.
type LookId = 'turtle' | 'xy' | 'arrow';
const LOOKS: { id: LookId; label: string; icon: string }[] = [
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
const LOOK_KEY = 'mckoss.logo.tiles.look';

// The pop-ups: the crayons, the notes, the turtle display choices, the
// programs to play, the speeds, and the spinner (`count`). Each opens from
// its button (the spinner's is whatever opened it: null until then).
type PopupId = 'crayons' | 'notes' | 'looks' | 'plays' | 'speeds' | 'count';
interface Popup {
  pop: HTMLDivElement;
  btn: HTMLElement | null;
}
// What the spinner sets: its label, value, least and most, and what to
// do with a new value; and optionally the step it counts by, whether it
// skips 0, and how it shows the number.
interface Spinner {
  label: string;
  value: number;
  min: number;
  max: number;
  set(n: number): void;
  step?: number;
  skipZero?: boolean;
  format?(n: number): string;
}
// Where a dragged item would land: in the strip or a repeat's body (the
// element, and the list it shows), before an item's element (null for the
// end).
interface DropTarget {
  container: Element;
  list: Item[];
  before: Element | null;
}
// A drag under way, as startDrag returns it: follows the pointer, then
// ends, dropping the item (or not, if `cancelled`).
interface Drag {
  move(ev: PointerEvent): void;
  end(cancelled: boolean): void;
}

// A point at `angle` degrees clockwise from straight up, `r` from (c, c).
function polar(c: number, r: number, angle: number): [number, number] {
  const rad = angle * Math.PI / 180;
  return [c + r * Math.sin(rad), c - r * Math.cos(rad)];
}
// The wedge from straight up round to `angle`.
function wedge(c: number, r: number, angle: number) {
  const [x, y] = polar(c, r, angle);
  return `M${c} ${c} L${c} ${c - r} A${r} ${r} 0 0 ${angle > 0 ? 1 : 0} ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}
// A curved arrow round (c, c) at radius r, from straight up round to
// `angle`: the arc, and an arrowhead `head` long ending at `angle`.
function arcArrow(c: number, r: number, angle: number, head: number) {
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
interface TileLook extends TileInfo {
  icon: string;
}
// The fixed tiles (TILES, in program.ts) with their pictures: ICONS, or
// for Home its button, for a crayon nothing (the tile is a swatch of its
// color), and for a note its name (do, re, mi...), sitting higher for a
// higher note.
const PICTURES: Record<string, string> = { ...ICONS, home: BUTTONS.home };
CRAYONS.forEach(([id]) => { PICTURES[id] = ''; });
NOTES.forEach(([id], step) => { PICTURES[id] = syllable(id === 'high-do' ? 'do' : id, step, id === 'high-do'); });
const PICTURED: Record<string, TileLook> = {};
TILES.forEach(t => {
  PICTURED[t.id] = { ...t, icon: PICTURES[t.id] };
});

// How a program item looks: its tile (tileFor), with its picture.
function lookOf(item: Item): TileLook {
  if (item.t === 'move') return { ...tileFor(item), icon: moveIcon(item.d) };
  if (item.t === 'turn') return { ...tileFor(item), icon: turnIcon(item.a) };
  if (item.t === 'call') return { ...tileFor(item), icon: callIcon(item.p) };
  return PICTURED[item.t];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string | null,
  parent?: Element | null): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

function iconButton(className: string, label: string, icon: string, parent?: Element) {
  const b = el('button', 'tt-button ' + className, parent);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = icon;
  return b;
}

function init(root: HTMLElement) {
  // The programs, kept in this browser (a strip saved before there were
  // programs becomes A). `program` is the one the strip shows, `current`
  // its name; `top` is the one Play and Step go through, which may play
  // others: while it does, the strip shows the one playing.
  programs = { A: [], B: [], C: [], D: [] };
  let current: ProgramName = 'A';
  try {
    // (What was saved, as SavedTiles describes, but unchecked: clean()
    // makes sense of it, as of a link's.)
    const saved: IncomingPayload | unknown[] | null = JSON.parse(localStorage.getItem(SAVE_KEY) as string);
    if (Array.isArray(saved)) programs.A = clean(saved);
    else if (saved && saved.programs) {
      NAMES.forEach(n => { programs[n] = clean(saved.programs![n]); });
      if (isName(saved.current)) current = saved.current;
    }
  } catch (e) { /* none saved */ }
  let program = programs[current];
  let top = current;

  // The page. The stylesheet's grid places each part, in one of two
  // arrangements (root.dataset.layout, chosen by layout()).
  const stageArea = el('div', 'tt-stage-area', root);
  const stageHost = el('div', 'tt-stage', stageArea);
  // The Logo programs' version (from the page), faint in a corner.
  const version = el('div', 'tt-version', stageArea);
  version.textContent = 'v' + (root.dataset.version || '');
  // A menu button: three lines.
  const grownUps = iconButton('tt-grownups', 'Grown-ups (hold)', svg(
    '<path d="M14 18 H50 M14 32 H50 M14 46 H50" stroke="#fff" stroke-width="7" stroke-linecap="round"/>'),
  stageArea);

  // The left gutter: Home and Clear for the drawing, then the Colors and
  // Music buttons.
  const left = el('div', 'tt-left', root);
  const stageTools = el('div', 'tt-stage-tools', left);
  stageTools.setAttribute('role', 'group');
  stageTools.setAttribute('aria-label', 'Drawing');
  const clearBtn = iconButton('tt-clear', 'Clear drawing', BUTTONS.clear, stageTools);

  // The strip, on its own row, then the tape buttons: Record, (Repeat,)
  // Play, Step, Rewind and the trash.
  // The strip's row: the program it shows (its letter, with arrows to
  // go up and down through A to D), then the strip.
  const stripRow = el('div', 'tt-strip-row', root);
  const progBtn = el('div', 'tt-button tt-prog', stripRow);
  progBtn.setAttribute('role', 'group');
  const progLetter = el('div', 'tt-prog-letter', progBtn);
  const progArrow = (className: string, label: string, d: string) => {
    const b = el('button', 'tt-prog-step ' + className, progBtn);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = svg(`<path d="${d}"/>`);
    return b;
  };
  const progUp = progArrow('tt-prog-up', 'Previous program', 'M32 4 L44 14 H20 Z');
  const progDown = progArrow('tt-prog-down', 'Next program', 'M32 60 L44 50 H20 Z');
  const stripArea = el('div', 'tt-strip-area', stripRow);
  const strip = el('div', 'tt-strip', stripArea);
  strip.setAttribute('aria-label', 'Program');
  strip.setAttribute('role', 'list');
  const line = el('div', 'tt-line', root);
  line.setAttribute('role', 'group');
  line.setAttribute('aria-label', 'Recording');
  const recordBtn = iconButton('tt-record', 'Record', BUTTONS.record, line);
  const playBtn = iconButton('tt-play', 'Play', BUTTONS.play, line);
  const stepBtn = iconButton('tt-step', 'Step', BUTTONS.step, line);
  const rewindBtn = iconButton('tt-rewind', 'Rewind', BUTTONS.rewind, line);
  const speedBtn = iconButton('tt-pop tt-speed', 'Speed', '');
  const trashBtn = iconButton('tt-trash', 'Trash', BUTTONS.trash, line);

  const wheel = el('div', 'tt-wheel', root);
  const tiles = el('div', 'tt-tiles', root);

  const groupEls = { drawing: stageTools } as Record<TileGroup, HTMLDivElement>;  // (the rest made here)
  ([['core', 'Moves'], ['crayons', 'Crayons'], ['notes', 'Music']] as const).forEach(([id, label]) => {
    const g = el('div', 'tt-group tt-' + id);
    g.setAttribute('role', 'toolbar');
    g.setAttribute('aria-label', label);
    groupEls[id] = g;
  });

  // The crayons and the notes wait in pop-ups, opened by the
  // Colors button (a crayon in the pen's color) and the Music button.
  const popButtons = el('div', 'tt-pop-buttons', left);
  const colorsBtn = iconButton('tt-pop tt-colors', 'Colors', crayon('#282828'), popButtons);
  const musicBtn = iconButton('tt-pop tt-music', 'Music', MUSIC, popButtons);
  // How the turtle shows: a pop-up of choices, from the Turtle button.
  const lookBtn = iconButton('tt-pop tt-look', 'Turtle', LOOKS[0].icon, popButtons);
  // Playing a program: a pop-up of A to D, from the Play program button,
  // a round Play button in the programs' four colors.
  const playsBtn = iconButton('tt-pop tt-plays', 'Play a program', svg(
    NAMES.map((p, i) => {
      const a0 = i * Math.PI / 2 - Math.PI / 2, a1 = a0 + Math.PI / 2;
      const pt = (a: number) => `${(32 + 26 * Math.cos(a)).toFixed(2)} ${(32 + 26 * Math.sin(a)).toFixed(2)}`;
      return `<path d="M32 32 L${pt(a0)} A26 26 0 0 1 ${pt(a1)} Z" fill="${PROGRAM_COLORS[p]}"/>`;
    }).join('') +
    '<path d="M25 18 L45 32 L25 46 Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>'));
  // How far Move and Back go: the Step size button opens a spinner.
  const sizeBtn = iconButton('tt-pop tt-size', 'Step size', rulerIcon(2));
  const popups = {} as Record<PopupId, Popup>;  // (each made below)
  let openPopup: PopupId | null = null;
  ([['crayons', colorsBtn, 'Colors'], ['notes', musicBtn, 'Music'], ['looks', lookBtn, 'Turtle'],
    ['plays', playsBtn, 'Play a program'], ['speeds', speedBtn, 'Speed']] as const)
    .forEach(([id, btn, label]) => {
    const pop = el('div', 'tt-popup', root);
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => togglePopup(id));
    popups[id] = { pop, btn };
  });
  const lookChoices = el('div', 'tt-group tt-looks', popups.looks.pop);
  let look: LookId = 'turtle';
  // (Checked just below.)
  try { look = (localStorage.getItem(LOOK_KEY) || look) as LookId; } catch (e) { /* storage blocked */ }
  if ((look as string) === 'dot') look = 'arrow';  // (it was a dot before 1.8.4)
  if (!LOOKS.some(l => l.id === look)) look = 'turtle';
  const lookButtons = LOOKS.map(l => {
    const b = iconButton('tt-look-choice', l.label, l.icon, lookChoices);
    b.addEventListener('click', () => {
      setLook(l.id);
      closePopup();
    });
    return b;
  });
  function setLook(id: LookId, starting?: boolean) {
    look = id;
    try { localStorage.setItem(LOOK_KEY, id); } catch (e) { /* storage blocked */ }
    LOOKS.forEach((l, i) => lookButtons[i].setAttribute('aria-pressed', String(l.id === id)));
    lookBtn.innerHTML = LOOKS.find(l => l.id === id)!.icon;
    root.dataset.look = id;
    // Its numbers stay on the stage: the view zooms out to fit them.
    if (!starting) stage!.view.setTurtlePad(roomAround());  // (the stage sets it when made)
  }
  setLook(look, true);
  // The speed, picked from the animals.
  const speedChoices = el('div', 'tt-group tt-speeds', popups.speeds.pop);
  let pace: AnimalId = 'turtle';
  // (Checked just below.)
  try { pace = (localStorage.getItem(SPEED_KEY) || pace) as AnimalId; } catch (e) { /* storage blocked */ }
  if (!SPEEDS.some(v => v.id === pace)) pace = 'turtle';
  const speedButtons = SPEEDS.map(v => {
    const b = iconButton('tt-speed-choice', v.label, animal(v.id), speedChoices);
    b.dataset.speed = v.id;
    b.addEventListener('click', () => {
      setPace(v.id);
      closePopup();
    });
    return b;
  });
  const speedOf = () => SPEEDS.find(v => v.id === pace)!.speed;
  // Room the view keeps around the turtle, in CSS pixels: for its
  // numbers, or for the lightning, which reaches up from its point.
  const roomAround = () => (look === 'xy' ? 80 : pace === 'bolt' ? 26 : 0);
  function setPace(id: AnimalId) {
    pace = id;
    try { localStorage.setItem(SPEED_KEY, id); } catch (e) { /* storage blocked */ }
    speedButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.speed === id)));
    speedBtn.innerHTML = animal(id);
    speedBtn.setAttribute('aria-label', 'Speed: ' + SPEEDS.find(v => v.id === id)!.label);
    root.dataset.animal = id;
    if (stage) stage.view.setTurtlePad(roomAround());
    if (!replaying) stageOptions.speed = speedOf();  // (a replay goes at once, then takes it)
  }
  // Going up and down through the programs, A at the top, D at the
  // bottom.
  const progIcon = (p: ProgramName) => svg(`<text x="32" y="45" text-anchor="middle" font-family="Archivo, sans-serif" ` +
    `font-size="34" font-weight="800" fill="${PROGRAM_INK[p]}">${p}</text>`);
  ([[progUp, -1], [progDown, 1]] as const).forEach(([b, by]) => b.addEventListener('click', () => {
    const p = NAMES[NAMES.indexOf(current) + by];
    if (!p) return;
    if (openRepeat) closeRepeat();
    top = p;
    playhead = 0;
    showProgram(p);
    save();
  }));
  let scrolls = false;  // (not the first time)
  function showProgram(p: ProgramName) {
    // Showing another program stops recording, so tiles never go into
    // a program by surprise: Record has to be tapped again for it.
    if (p !== current && recording) setRecording(false);
    const by = Math.sign(NAMES.indexOf(p) - NAMES.indexOf(current));
    const before = scrolls && by ? [snapshot(progLetter), snapshot(strip, 'tt-strip-ghost')] : null;
    current = p;
    program = programs[p];
    progLetter.innerHTML = progIcon(p);
    progBtn.dataset.program = p;
    progBtn.style.setProperty('--tile-color', PROGRAM_COLORS[p]);
    progBtn.setAttribute('aria-label', 'Program ' + p);
    progUp.hidden = p === NAMES[0];
    progDown.hidden = p === NAMES[NAMES.length - 1];
    render();
    scrolls = true;
    if (before) {
      scroll(progLetter, before[0], by);
      scroll(strip, before[1], by);
    }
  }
  // A copy of `node` as it looks now, laid over it, for scroll() to move
  // away. (A copy of the strip is renamed, so it isn't taken for the
  // strip, and hidden from screen readers.)
  function snapshot(node: HTMLElement, className?: string) {
    const copy = node.cloneNode(true) as HTMLElement;
    if (className) copy.className = node.className.replace(/\btt-strip\b/, className);
    copy.removeAttribute('role');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    return copy;
  }
  // Scrolls `node`'s new look in as its old one (`copy`) goes: up when
  // going down to a later program, `by` 1, and down when going up.
  const still = self.matchMedia && self.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function scroll(node: HTMLElement, copy: HTMLElement, by: number) {
    const box = node.parentNode as HTMLElement;
    if (still || !node.animate) return;
    Object.assign(copy.style, {
      position: 'absolute', left: node.offsetLeft + 'px', top: node.offsetTop + 'px',
      width: node.offsetWidth + 'px', margin: 0,
    });
    box.classList.add('tt-scrolling');
    box.appendChild(copy);
    const far = box.clientHeight;
    const timing = { duration: 280, easing: 'ease-in-out' };
    node.animate([{ transform: `translateY(${by * far}px)` }, { transform: 'none' }], timing);
    copy.animate([{ transform: 'none' }, { transform: `translateY(${-by * far}px)` }], timing).onfinish = () => {
      copy.remove();
      if (!box.querySelector('[aria-hidden="true"][inert]')) box.classList.remove('tt-scrolling');
    };
  }
  // The tiles that play a program. One that would play the program it
  // goes in (itself, or by way of another) is faded and does nothing.
  const callChoices = el('div', 'tt-group tt-calls', popups.plays.pop);
  const blocked = (p: ProgramName) => p === current || plays(programs, p, current);
  NAMES.forEach(p => {
    const t = tileElement(lookOf({ t: 'call', p }), 'tt-source');
    t.dataset.p = p;
    callChoices.appendChild(t);
  });
  playsBtn.addEventListener('click', () => {
    callChoices.querySelectorAll<HTMLElement>('[data-tile="call"]').forEach(t => {
      t.classList.toggle('tt-blocked', blocked(t.dataset.p as ProgramName));
      t.setAttribute('aria-disabled', String(blocked(t.dataset.p as ProgramName)));
    });
  });
  popups.crayons.pop.appendChild(groupEls.crayons);
  popups.notes.pop.appendChild(groupEls.notes);
  function closePopup() {
    if (!openPopup) return;
    const { pop, btn } = popups[openPopup];
    pop.hidden = true;
    btn!.setAttribute('aria-expanded', 'false');
    openPopup = null;
  }
  // Opens a pop-up just above its button, kept on the screen.
  function togglePopup(id: PopupId) {
    const wasOpen = openPopup === id;
    closePopup();
    if (wasOpen) return;
    const { pop } = popups[id];
    const btn = popups[id].btn!;
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openPopup = id;
    // Above its button, or beside it for the buttons in the left gutter.
    const b = btn.getBoundingClientRect();
    const r = pop.getBoundingClientRect();
    const clamp = (v: number, size: number, room: number) => Math.max(PAD, Math.min(room - size - PAD, v));
    if (left.contains(btn)) {
      pop.style.left = clamp(b.right + GAP, r.width, self.innerWidth) + 'px';
      pop.style.top = clamp(b.top, r.height, self.innerHeight) + 'px';
    } else {
      pop.style.left = clamp(b.left + b.width / 2 - r.width / 2, r.width, self.innerWidth) + 'px';
      pop.style.top = Math.max(PAD, b.top - r.height - GAP) + 'px';
    }
  }
  // A press anywhere but the open pop-up and its button closes it.
  document.addEventListener('pointerdown', e => {
    if (!openPopup) return;
    const { pop, btn } = popups[openPopup];
    if (!pop.contains(e.target as Node) && !btn!.contains(e.target as Node)) closePopup();
  }, true);

  const menu = el('div', 'tt-menu', root);
  menu.hidden = true;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Grown-ups');
  menu.innerHTML = '<h2>Grown-ups <small class="tt-menu-version"></small></h2><p>Tap the picture tiles to make the turtle move, draw and ' +
    'play notes; the rainbow changes to the next color, and the white one draws nothing. The step size button sets how far the arrow moves; to turn, move the wheel\'s arm to where ' +
    'the turtle should face, then tap the turtle. While the red Record button is on, each tile ' +
    'tapped is added to the strip (after the tile you last tapped in the strip, if any: Rewind lets go of it); ' +
    'tap it again to stop recording. Play plays the strip from the ' +
    'dashed tile, Step plays one tile, and Rewind goes back to the start. Playing doesn\'t clear ' +
    'the drawing or send the turtle home: use the eraser (which does both) and the house for that (the house can be ' +
    'recorded too, to start from the middle each time). Drag tiles to ' +
    'move them, or onto the trash can to throw them away; tap the trash can twice to empty the program it shows. While recording, ' +
    'Repeat starts a group and the tiles tapped next go in it; tap Repeat again to close it. Tap a ' +
    'group\'s number to set how many times it goes round (0 to 99) and to record on the end of it; drag the number to the trash ' +
    'to undo the group and keep its tiles. There are four programs, A to D: the arrows on the letter by the strip go up ' +
    'and down through them (showing another stops recording), and the Play program button plays one (and records it), so programs can be made ' +
    'of other programs. Share a link sends all four programs: opening it loads them here.</p>';
  menu.querySelector('.tt-menu-version')!.textContent = 'Turtle Tiles v' + (root.dataset.version || '');
  const menuTools = el('div', 'tt-menu-tools', menu);
  const textButton = (label: string, onClick: () => unknown) => {
    const b = el('button', 'logo-btn', menuTools);
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  const lessons = el('a', 'tt-menu-link', menu);
  lessons.href = '/logo/';
  lessons.textContent = 'Logo lessons';

  // Tiles ---------------------------------------------------------------

  const itemOf = new WeakMap<Element, Item>();  // strip element -> program item
  const elementOf = new Map<Item, HTMLElement>();   // program item -> strip element
  const bodyOf = new WeakMap<Element, RepeatItem>();  // repeat body element -> repeat item

  function tileElement(def: Pick<TileLook, 'id' | 'label' | 'icon' | 'color'>, className?: string) {
    const t = el('div', 'tt-tile ' + (className || ''));
    t.dataset.tile = def.id;
    t.style.setProperty('--tile-color', def.color);
    t.setAttribute('role', 'button');
    t.setAttribute('aria-label', def.label);
    t.tabIndex = 0;
    t.innerHTML = def.icon;
    return t;
  }

  // How far a repeat has gone round: a dot for each time, or for big
  // counts a bar.
  function progress(item: RepeatItem) {
    if (item.n > DOTS_UP_TO) {
      const bar = el('span', 'tt-progress');
      el('span', 'tt-progress-fill', bar);
      return bar;
    }
    const d = el('span', 'tt-dots');
    for (let i = 0; i < item.n; i++) el('span', 'tt-dot', d);
    return d;
  }
  // Shows a repeat's count on its head.
  function showCount(item: RepeatItem, head: HTMLElement) {
    head.innerHTML = repeatCount(item.n);
    head.setAttribute('aria-label', 'Repeat ' + item.n + (item.n === 1 ? ' time' : ' times'));
    head.appendChild(progress(item));
  }

  function itemElement(item: Item): HTMLElement {
    let node;
    if (item.t === 'repeat') {
      node = el('div', 'tt-item tt-repeat');
      node.classList.toggle('tt-open', item === openRepeat);
      const head = tileElement(PICTURED.repeat, 'tt-repeat-head');
      showCount(item, head);
      node.appendChild(head);
      const body = el('div', 'tt-repeat-body', node);
      bodyOf.set(body, item);
      item.body.forEach(child => body.appendChild(itemElement(child)));
    } else if (TILE[item.t] && TILE[item.t].group === 'crayons' && item.t !== 'nextcolor') {
      // In the strip, a crayon is a colored pencil on a white tile, like
      // the Colors button (the white one, Invisible, a white pencil).
      const def = TILE[item.t];
      node = tileElement({ ...def, color: '#fff', icon: crayon(item.t === 'invisible' ? '#fff' : def.color) },
        'tt-item tt-crayon-item');
    } else {
      node = tileElement(lookOf(item), 'tt-item');
    }
    node.setAttribute('role', 'listitem');
    itemOf.set(node, item);
    elementOf.set(item, node);
    return node;
  }

  // The playhead: the next tile Play or Step will play, as an index
  // into the steps of the program Play plays (`top`).
  let playhead = 0;

  // The tile picked by tapping it in the strip, if any: recording goes
  // in just after it, and the new tile is picked in its place, so taps go
  // in in order. A repeat picked by its count (`selectedInto`) takes
  // recording at the end of its body. With nothing picked, recording goes
  // on the end of the strip (or of the open repeat).
  let selected: Item | null = null;
  let selectedInto = false;
  function select(item: Item | null | undefined, into = false) {
    selected = item || null;
    selectedInto = Boolean(selected && into && selected.t === 'repeat');
    root.querySelectorAll('.tt-selected').forEach(n => n.classList.remove('tt-selected'));
    const node = selected && elementOf.get(selected);
    if (node) node.classList.add('tt-selected');
  }
  // The list `item` is in (the strip, or a repeat's body), and where.
  function placeOf(item: Item): { list: Item[]; index: number; repeat: RepeatItem | null } | null {
    let i = program.indexOf(item);
    if (i >= 0) return { list: program, index: i, repeat: null };
    for (const r of program) {
      if (r.t === 'repeat' && (i = r.body.indexOf(item as Tile)) >= 0) return { list: r.body, index: i, repeat: r };
    }
    return null;
  }
  // Where a recorded tile goes: into `list` at `at`.
  function insertionPoint(): { list: Item[]; at: number; repeat: RepeatItem | null } {
    const place = selected && placeOf(selected);
    if (place && selectedInto) {
      const into = selected as RepeatItem;  // (only a repeat is selectedInto)
      return { list: into.body, at: into.body.length, repeat: into };
    }
    if (place) return { list: place.list, at: place.index + 1, repeat: place.repeat };
    if (openRepeat) return { list: openRepeat.body, at: openRepeat.body.length, repeat: openRepeat };
    return { list: program, at: program.length, repeat: null };
  }
  let openRepeat: RepeatItem | null = null;  // the repeat that tiles being recorded go into
  const steps = () => stepsOf(programs, programs[top], top);
  function showPlayhead() {
    root.querySelectorAll('.tt-next, .tt-dot.tt-on').forEach(n => n.classList.remove('tt-next', 'tt-on'));
    root.querySelectorAll<HTMLElement>('.tt-progress-fill').forEach(f => { f.style.width = '0'; });
    const step = steps()[playhead];
    // Part way through, the strip shows the program playing; at the
    // start, the one Play plays.
    const showing = playhead > 0 && step ? step.prog : top;
    if (showing !== current) {
      showProgram(showing);
      return;
    }
    // (At the start, the first tile to play may be in a program the
    // first one plays, which the strip doesn't show.)
    if (!step || step.prog !== current) return;
    const node = elementOf.get(step.item);
    if (node) node.classList.add('tt-next');
    if (step.repeat && elementOf.has(step.repeat)) {
      const node = elementOf.get(step.repeat)!;
      const i = step.i!;  // (which time round: set with the repeat)
      const dotEls = node.querySelectorAll('.tt-dot');
      if (dotEls[i]) dotEls[i].classList.add('tt-on');
      const fill = node.querySelector<HTMLElement>('.tt-progress-fill');
      if (fill) fill.style.width = (100 * (i + 1) / step.repeat.n) + '%';
    }
  }

  function render() {
    elementOf.clear();
    strip.textContent = '';
    program.forEach(item => strip.appendChild(itemElement(item)));
    strip.classList.toggle('tt-empty', !program.length);
    select(selected && placeOf(selected) ? selected : null, selectedInto);
    showPlayhead();
  }

  // The Move and Back buttons go as far as Step size says.
  const moveBtn = tileElement({ id: 'move', label: '', icon: '', color: BLUE }, 'tt-source');
  const backBtn = tileElement({ id: 'back', label: '', icon: '', color: BLUE }, 'tt-source');
  groupEls.core.append(moveBtn, backBtn);
  TILES.forEach(t => t.group && groupEls[t.group].appendChild(tileElement(PICTURED[t.id], 'tt-source')));
  stageTools.append(clearBtn, speedBtn);  // Home first, then Clear and Speed
  tiles.append(groupEls.core);
  backBtn.after(sizeBtn);
  sizeBtn.after(playsBtn);
  // Repeat works on the recording, so it sits with the tape buttons.
  const repeatBtn = groupEls.core.querySelector<HTMLElement>('[data-tile="repeat"]')!;
  line.insertBefore(repeatBtn, playBtn);

  // Closes the open repeat (dropping it if nothing went in), unless it's
  // already `gone` from the strip.
  function closeRepeat(gone?: boolean) {
    const item = openRepeat!;  // (called only with one open)
    openRepeat = null;
    repeatBtn.classList.remove('tt-open');
    repeatBtn.setAttribute('aria-pressed', 'false');
    if (gone) return;
    const at = program.indexOf(item);
    const picked = selected === item || item.body.includes(selected as Tile);
    if (!item.body.length) program.splice(at, 1);
    // Recording into it went after a picked tile: what comes next goes
    // after the repeat.
    if (picked) select(item.body.length ? item : program[at - 1]);
    changed();
  }

  // The spinner: a pop-up with up and down arrows (hold one to count
  // fast) around a number. It sets a repeat's count (0 to 99, over its
  // head), how far Move and Back go (1 to 99 units, over the Step size
  // button) and how far a move in the strip goes. Changing the strip
  // changes the recording only; the stage shows it when the strip plays.
  const countPop = el('div', 'tt-popup tt-count-pop', root);
  countPop.hidden = true;
  countPop.setAttribute('role', 'dialog');
  const arrowButton = (label: string, d: string) => {
    const b = iconButton('tt-count-step', label, svg(`<path d="${d}" fill="#fff"/>`), countPop);
    b.style.setProperty('--tile-color', '#f08c00');
    return b;
  };
  const upBtn = arrowButton('More times', 'M32 14 L54 46 H10 Z');
  const countNum = el('div', 'tt-count-num', countPop);
  countNum.setAttribute('aria-live', 'polite');
  const downBtn = arrowButton('Fewer times', 'M32 50 L54 18 H10 Z');
  popups.count = { pop: countPop, btn: null };
  // What the spinner sets: {label, value, min, max, set(n)}, and
  // optionally the step it counts by, whether it skips 0, and how it
  // shows the number.
  let spin: Spinner | null = null;
  const shown = (n: number) => (spin!.format ? spin!.format(n) : String(n));
  function openSpinner(anchor: HTMLElement, what: Spinner) {
    if (openPopup === 'count' && popups.count.btn !== anchor) closePopup();
    spin = what;
    countPop.setAttribute('aria-label', what.label);
    countNum.textContent = shown(what.value);
    popups.count.btn = anchor;
    togglePopup('count');
  }
  function stepCount(delta: number) {
    if (!spin) return;  // (it never opened)
    const by = delta * (spin.step || 1);
    let n = spin.value + by;
    if (spin.skipZero && n === 0) n += by;
    n = Math.max(spin.min, Math.min(spin.max, n));
    if (n === spin.value) return;
    spin.value = n;
    countNum.textContent = shown(n);
    spin.set(n);
  }
  // A repeat's count.
  function openCount(item: RepeatItem, head: HTMLElement) {
    openSpinner(head, {
      label: 'Repeat count', value: item.n, min: 0, max: MAX_COUNT,
      set(n) {
        item.n = n;
        const node = elementOf.get(item)!.querySelector<HTMLElement>('.tt-repeat-head')!;
        showCount(item, node);
        popups.count.btn = node;
        edited();
      },
    });
  }
  // How far a move in the strip goes.
  function openMove(item: MoveItem, node: HTMLElement) {
    openSpinner(node, {
      label: 'How far', value: Math.abs(item.d) / UNIT, min: 1, max: MAX_UNITS,
      set(n) {
        item.d = Math.sign(item.d) * n * UNIT;
        const def = lookOf(item);
        node.innerHTML = def.icon;
        node.setAttribute('aria-label', def.label);
        setDistance(n);
        edited();
      },
    });
  }
  // How far a turn in the strip turns, by 15 degrees, -165 (left) to 180,
  // never 0.
  function openTurn(item: TurnItem, node: HTMLElement) {
    openSpinner(node, {
      label: 'Turn', value: item.a, min: -180 + STEP, max: 180, step: STEP, skipZero: true,
      format: a => (a > 0 ? '+' : '\u2212') + Math.abs(a),
      set(a) {
        item.a = a;
        const def = lookOf(item);
        node.innerHTML = def.icon;
        node.setAttribute('aria-label', def.label);
        node.style.setProperty('--tile-color', def.color);
        setAngle(a);
        edited();
      },
    });
  }
  // After a change in place in the strip: save it, and keep the playhead
  // on it.
  function edited() {
    save();
    if (playhead >= steps().length) playhead = 0;
    showPlayhead();
  }
  ([[upBtn, 1], [downBtn, -1]] as const).forEach(([b, delta]) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => clearTimeout(timer);
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      stepCount(delta);
      timer = setTimeout(function again() {
        stepCount(delta);
        timer = setTimeout(again, 90);
      }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => b.addEventListener(type, stop));
    b.addEventListener('click', e => { if (e.detail === 0) stepCount(delta); });  // the keyboard
  });

  // Move, Back and the wheel ------------------------------------------------

  let distance = 2;  // units
  function setDistance(n: number) {
    distance = n;
    ([[moveBtn, n * UNIT], [backBtn, -n * UNIT]] as [HTMLElement, number][]).forEach(([btn, d]) => {
      btn.dataset.d = String(n * UNIT);
      btn.innerHTML = arrowIcon(d);
      btn.setAttribute('aria-label', moveLabel(d));
      btn.title = moveLabel(d);
    });
    sizeBtn.innerHTML = rulerIcon(n);
  }
  sizeBtn.addEventListener('click', () => openSpinner(sizeBtn, {
    label: 'Step size', value: distance, min: 1, max: MAX_UNITS, set: setDistance,
  }));
  setDistance(distance);

  let angle = 90;
  const C = 60;      // the wheel's center, in its 120 x 120 drawing
  const RING = 46;
  wheel.innerHTML = `<svg class="tt-wheel-ring" viewBox="0 0 120 120" role="slider" tabindex="0"
    aria-label="Turn angle" aria-valuemin="-165" aria-valuemax="180">
    <circle cx="${C}" cy="${C}" r="${RING + 12}" fill="#dbe8f8"/>
    <g class="tt-dial">
    <path class="tt-wedge" fill="${BLUE}" opacity=".35"/>
    <path d="M${C} ${C} V${C - RING}" stroke="${BLUE}" stroke-width="2.5" stroke-dasharray="4 4"/>
    ${Array.from({ length: 24 }, (_, i) => {
      const a = normalize(i * STEP);
      const [x, y] = polar(C, RING, a);
      const big = FRIENDLY.includes(Math.abs(a));
      return a ? `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${big ? 4.5 : 2}" fill="${BLUE}"
        opacity="${big ? 0.9 : 0.5}"/>` : '';
    }).join('')}
    <path class="tt-arc" stroke="${BLUE}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path class="tt-arrowhead" fill="${BLUE}" stroke="${BLUE}" stroke-width="2" stroke-linejoin="round"/>
    <path class="tt-arm" stroke="${BLUE}" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    <circle class="tt-knob" r="9" fill="${BLUE}" stroke="#fff" stroke-width="3"/>
    </g>
  </svg>`;
  const ring = wheel.querySelector<SVGSVGElement>('.tt-wheel-ring')!;
  const go = tileElement({ id: 'turn', label: '', icon: TURTLE, color: '#fff' }, 'tt-source tt-turn-go');
  wheel.appendChild(go);

  // The dial and the turtle in its middle turn with the turtle on the
  // stage, every frame (and the Colors button shows the pen's color, or a
  // white crayon while the pen is up):
  // straight up on the dial is the way the turtle
  // faces, so the arm always shows the same turn from there, and tapping
  // the turtle again turns it the same way again.
  let heading = 0;
  let penColor: string | null = null;
  wheel.dataset.heading = '0';
  const dial = ring.querySelector('.tt-dial')!;
  const turtleTurn = go.querySelector('.tt-turtle-turn')!;
  // The turn, in degrees, over the turtle (and spilling past it):
  // outside the part that turns with it, so it always reads right side up.
  const goText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  goText.setAttribute('class', 'tt-turn-degrees');
  goText.setAttribute('y', '10');
  goText.setAttribute('text-anchor', 'middle');
  go.querySelector('svg')!.appendChild(goText);
  requestAnimationFrame(function follow() {
    const turtle = stage && stage.logo.turtle;
    if (turtle) {
      const h = Math.round((90 - turtle.r * 180 / Math.PI) * 100) / 100;
      if (h !== heading) {
        heading = h;
        dial.setAttribute('transform', `rotate(${h} ${C} ${C})`);
        turtleTurn.setAttribute('transform', `rotate(${h})`);
        wheel.dataset.heading = String(Math.round(((h % 360) + 360) % 360));
      }
      const at = (look !== 'turtle' || pace !== 'turtle') && stage!.view.turtleAt && stage!.view.turtleAt();
      if (at) {
        posMarker.style.transform = `translate(${at.x}px, ${at.y}px)`;
        markerDot.style.background = turtle.pendown ? turtle.color : '#fff';
        if (look === 'arrow') pointArrow(turtle, at);
        else if (pace !== 'turtle') showAnimal(turtle, at);
        markerText.textContent = Math.round(turtle.x) + ', ' + Math.round(turtle.y);
        // The heading, just past the turtle's nose (20 steps ahead), with
        // room between, whichever way it faces.
        const heading = ((Math.round(90 - turtle.r * 180 / Math.PI) % 360) + 360) % 360;
        const rad = heading * Math.PI / 180;
        markerHeading.textContent = heading + '\u00b0';
        const ahead = 20 * at.scale + 6 + Math.abs(Math.sin(rad)) * markerHeading.offsetWidth / 2 +
          Math.abs(Math.cos(rad)) * markerHeading.offsetHeight / 2;
        // The coordinates go beside the dot on a side the turtle isn't
        // facing, so they keep clear of the heading: right if they can,
        // else below, left or above.
        const way = [Math.sin(rad), -Math.cos(rad)];
        const side = XY_SIDES.find(([dx, dy]) => dx * way[0] + dy * way[1] < 0.25) || XY_SIDES[0];
        markerText.style.transform = side[2];
        markerHeading.style.transform =
          `translate(calc(${Math.sin(rad) * ahead}px - 50%), calc(${-Math.cos(rad) * ahead}px - 50%))`;
      }
      const pen = turtle.pendown ? turtle.color : 'up';
      if (pen !== penColor) {
        penColor = pen;
        colorsBtn.innerHTML = crayon(turtle.pendown ? turtle.color : '#fff');
        colorsBtn.dataset.color = turtle.color;
      }
    }
    requestAnimationFrame(follow);
  });

  function setAngle(a: number) {
    a = normalize(a);
    if (!a) return;
    angle = a;
    const [x, y] = polar(C, RING, a);
    ring.querySelector('.tt-wedge')!.setAttribute('d', wedge(C, RING, a));
    ring.querySelector('.tt-arm')!.setAttribute('d', `M${C} ${C} L${x} ${y}`);
    const { arc, head } = arcArrow(C, RING - 10, a, 14);
    ring.querySelector('.tt-arc')!.setAttribute('d', arc);
    ring.querySelector('.tt-arrowhead')!.setAttribute('d', head);
    const knob = ring.querySelector('.tt-knob')!;
    knob.setAttribute('cx', String(x));
    knob.setAttribute('cy', String(y));
    ring.setAttribute('aria-valuenow', String(a));
    ring.setAttribute('aria-valuetext', turnLabel(a));
    go.dataset.angle = String(a);
    goText.textContent = (a > 0 ? '+' : '\u2212') + Math.abs(a);
    goText.style.fontSize = goText.textContent.length > 3 ? '24px' : '30px';
    goText.style.fill = turnTint(a) || '';
    go.setAttribute('aria-label', turnLabel(a));
    go.title = turnLabel(a);
  }
  setAngle(angle);

  // Tapping or dragging on the ring moves the arm to the nearest step,
  // measured from the way the turtle faces.
  function aim(e: PointerEvent) {
    const r = ring.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return;
    setAngle(Math.atan2(dx, -dy) * 180 / Math.PI - heading);
  }
  ring.addEventListener('pointerdown', e => {
    e.preventDefault();
    ring.setPointerCapture(e.pointerId);
    aim(e);
    const move = (ev: PointerEvent) => aim(ev);
    const up = () => {
      ring.removeEventListener('pointermove', move);
      ring.removeEventListener('pointerup', up);
      ring.removeEventListener('pointercancel', up);
    };
    ring.addEventListener('pointermove', move);
    ring.addEventListener('pointerup', up);
    ring.addEventListener('pointercancel', up);
  });
  ring.addEventListener('keydown', e => {
    const by = ({ ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP } as Record<string, number>)[e.key];
    if (!by) return;
    e.preventDefault();
    setAngle(angle + by === 0 ? angle + 2 * by : angle + by);
  });

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ programs, current })); } catch (e) { /* storage blocked */ }
  }


  // After the recording changes, the playhead goes back to the start.
  function changed() {
    if (openRepeat && !program.includes(openRepeat)) closeRepeat(true);
    if (selected && !placeOf(selected)) select(null);
    playhead = 0;
    top = current;
    save();
    render();
  }

  // Layout ------------------------------------------------------------------

  // Sizes the tiles and arranges them, as big as they can be while the
  // drawing keeps at least STAGE_SHARE of the height. The crayons and the
  // notes wait in pop-ups. There is always a left gutter, one tile wide,
  // with Home, Clear, Colors, Music and Turtle; under the drawing, the strip on
  // its own row, the whole width (one line of tiles, growing to three as
  // it fills, then scrolling); and under that the wheel in the corner,
  // with Move, Back and Step size (a spinner, in a pop-up) beside
  // it. 'wide' has the tape buttons (with Repeat) beside the top of the
  // wheel and those tiles in a row beside its bottom; 'tall' has the tape
  // buttons the whole width, then the wheel with the tiles in two rows
  // beside it.
  function plan(W: number, H: number) {
    const g = GAP;
    const fit = (units: number) => (W - units * g) / units;
    // The strip's height at its smallest, for tile size b.
    const STRIP = 0.76, STRIP_EXTRA = 16;
    const options = [
      {
        // Beside the wheel: the tape buttons and Repeat; and Move, Back
        // and Step size. Beside the drawing: Home, Speed, Clear, Colors,
        // Music and Turtle.
        layout: 'wide',
        limits: [fit(2 + 6), fit(2 + 4), (H - STRIP_EXTRA - 8 * g) / (8 + STRIP),
          ((1 - STAGE_SHARE) * H - STRIP_EXTRA - 3 * g) / (2 + STRIP)],
        stage: (b: number) => (W - b - g) * (H - (2 + STRIP) * b - STRIP_EXTRA - 3 * g),
      },
      {
        // The same, for a short screen: the gutter two buttons wide.
        layout: 'wide2',
        limits: [fit(2 + 6), fit(2 + 4), (H - STRIP_EXTRA - 5 * g) / (5 + STRIP),
          ((1 - STAGE_SHARE) * H - STRIP_EXTRA - 3 * g) / (2 + STRIP)],
        stage: (b: number) => (W - 2 * b - 2 * g) * (H - (2 + STRIP) * b - STRIP_EXTRA - 3 * g),
      },
      {
        // Beside the wheel, in two rows: Move and Back, Step size and
        // Play a program, then the tape buttons three by two. Six down
        // the gutter beside the drawing.
        layout: 'tall',
        limits: [fit(2 + 2 + 3), ((1 - STAGE_SHARE) * H - STRIP_EXTRA - 3 * g) / (2 + STRIP),
          (STAGE_SHARE * H - 6 * g) / 6],
        stage: (b: number) => (W - b - g) * (H - (2 + STRIP) * b - STRIP_EXTRA - 3 * g),
      },
    ];
    let best = null as (typeof options[number] & { size: number; area: number }) | null;
    options.forEach(o => {
      const size = Math.floor(Math.min(MAX_TILE, ...o.limits));
      const area = o.stage(size);
      if (!best || size > best.size || (size === best.size && area > best.area)) best = { ...o, size, area };
    });
    return best!;
  }

  let placed = '';
  function layout() {
    const best = plan(root.clientWidth - 2 * PAD, root.clientHeight - 2 * PAD);
    root.style.setProperty('--b', Math.max(MIN_TILE, best.size) + 'px');
    root.style.setProperty('--gap', GAP + 'px');
    root.style.setProperty('--pad', PAD + 'px');
    if (best.layout === placed) return;
    placed = best.layout;
    closePopup();
    root.dataset.layout = best.layout;
  }

  // The stage fills its area. Its view (in turtle steps) takes the area's
  // shape when the stage is made, and it is made again if the area's
  // shape changes a lot, as when a phone is turned; then everything the
  // turtle has done since the last fresh start is done again, at once
  // and silently, to bring the drawing and the turtle back.
  const stageOptions: { view: [number, number]; speed: SpeedName } = { view: [SHORT_SIDE, SHORT_SIDE], speed: 'slow' };
  let replaying = false;
  // (Made by makeStage, below, before anything runs: `stage!` from then on.)
  let stage = null as Stage | null;
  setPace(pace);
  let history: string[] = [];
  function fitStage() {
    const [vw, vh] = stageOptions.view;
    const w = stageArea.clientWidth;
    const h = stageArea.clientHeight;
    stageHost.style.width = Math.max(60, Math.min(w, h * vw / vh)) + 'px';
  }
  function makeStage() {
    const w = Math.max(1, stageArea.clientWidth);
    const h = Math.max(1, stageArea.clientHeight);
    stageOptions.view = w >= h
      ? [Math.round(SHORT_SIDE * w / h), SHORT_SIDE]
      : [SHORT_SIDE, Math.round(SHORT_SIDE * h / w)];
    stageHost.textContent = '';
    fitStage();
    stage = LogoStage.create(stageHost, stageOptions);
    stage.element.appendChild(posMarker);
    stage.view.setTurtlePad(roomAround());
  }
  // Where the turtle is, for the Turtle choices that show it: with the
  // turtle, a flashing dot in the pen's color (white when the pen is up),
  // its x, y and its heading on its nose; or just a flashing arrow. It's laid over
  // the stage, so snapshots never have it.
  const posMarker = el('div', 'tt-marker-pos');
  const markerDot = el('span', 'tt-pos-dot', posMarker);
  // Just an arrow: an arrowhead in the pen's color, pointing the way the
  // turtle faces, on a shaft as wide as the pen draws, so it carries on
  // from the line behind it. With the pen up, it's white.
  const markerArrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  markerArrow.setAttribute('class', 'tt-pos-arrow');
  markerArrow.setAttribute('aria-hidden', 'true');
  const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  markerArrow.appendChild(arrowPath);
  posMarker.appendChild(markerArrow);
  let arrowWas = '';
  function pointArrow(turtle: CanvasTurtle, at: TurtleAt) {
    const w = Math.max(1, turtle.penwidth * at.zoom);  // the shaft, as wide as the line
    const half = Math.max(7, w * 1.4);  // the head's half width
    const long = Math.max(13, w * 2.2);  // and its length
    const shaft = 8;
    const r = (n: number) => Math.round(n * 10) / 10;
    const d = `M${r(-w / 2)} 0 V${-shaft} H${r(-half)} L0 ${r(-shaft - long)} L${r(half)} ${-shaft} ` +
      `H${r(w / 2)} V0 Z`;
    const heading = 90 - turtle.r * 180 / Math.PI;
    const now = d + heading + turtle.pendown + turtle.color;
    if (now === arrowWas) return;
    arrowWas = now;
    arrowPath.setAttribute('d', d);
    arrowPath.setAttribute('fill', turtle.pendown ? turtle.color : '#fff');
    arrowPath.setAttribute('stroke', turtle.pendown ? 'none' : 'rgba(0, 0, 0, .45)');
    arrowPath.setAttribute('transform', `rotate(${r(heading)})`);
  }
  // At other speeds than the turtle's, the stage's turtle is the animal,
  // seen from above, the same size, facing the way the turtle does.
  const markerAnimal = el('div', 'tt-pos-animal', posMarker);
  let animalWas = '';
  function showAnimal(turtle: CanvasTurtle, at: TurtleAt) {
    const heading = ((90 - turtle.r * 180 / Math.PI) % 360 + 360) % 360;
    const size = Math.round(44 * at.scale);
    const now = pace + size + heading;
    if (now === animalWas) return;
    if (!animalWas.startsWith(pace)) markerAnimal.innerHTML = `<svg viewBox="0 0 64 64">${ABOVE[pace]}</svg>`;
    animalWas = now;
    markerAnimal.style.width = markerAnimal.style.height = size + 'px';
    // The animals turn about their middles; lightning turns about its
    // point, which stays on the turtle's place.
    const [ox, oy] = pace === 'bolt' ? BOLT_TIP.map(v => v / 64 * 100) : [50, 50];
    markerAnimal.style.transformOrigin = `${ox}% ${oy}%`;
    markerAnimal.style.transform = `translate(${-ox}%, ${-oy}%) rotate(${Math.round(heading * 10) / 10}deg)`;
  }
  const markerText = el('span', 'tt-pos-xy', posMarker);
  const XY_SIDES: [number, number, string][] = [
    [1, 0, 'translate(16px, -50%)'], [0, 1, 'translate(-50%, 14px)'],
    [-1, 0, 'translate(calc(-100% - 16px), -50%)'], [0, -1, 'translate(-50%, calc(-100% - 14px))'],
  ];
  const markerHeading = el('span', 'tt-pos-heading', posMarker);
  function reshaped() {
    const [vw, vh] = stageOptions.view;
    const ratio = (stageArea.clientWidth / Math.max(1, stageArea.clientHeight)) / (vw / vh);
    return Math.abs(Math.log(ratio)) > 0.25;
  }

  showProgram(current);
  layout();
  makeStage();

  // Running ---------------------------------------------------------------

  // Everything the turtle does goes through one queue, in order. Making
  // the stage again makes anything still waiting from before it skip.
  let queue: Promise<unknown> = stage!.fresh().then(() => stage!.run(PRELUDE));
  let generation = 0;
  let playing = false;
  let pausing = false;

  // The page is marked busy (tt-busy) while anything is waiting or
  // running, for tests to wait on.
  let waiting = 0;
  function schedule(fn: () => unknown) {
    const g = generation;
    const run = () => (g === generation ? fn() : null);
    waiting++;
    root.classList.add('tt-busy');
    queue = queue.then(run, run).catch(() => {}).then(() => {
      if (--waiting === 0) root.classList.remove('tt-busy');
    });
    return queue;
  }

  // Runs Logo on the stage, remembering it (silently) for remaking it.
  function perform(code: string, silentCode = code) {
    if (silentCode) history.push(silentCode);
    return stage!.run(code);
  }

  function relayout() {
    layout();
    if (!reshaped()) {
      fitStage();
      return;
    }
    generation++;
    stage!.stop();
    makeStage();
    schedule(replay);
  }
  // Starts the stage again and, at once, does everything in the history.
  async function replay() {
    stageOptions.speed = 'instant';
    replaying = true;
    try {
      await stage!.fresh();
      await stage!.run(PRELUDE + '\n' + history.join(' '));
    } finally {
      replaying = false;
      stageOptions.speed = speedOf();
    }
  }
  // The stage area changes size with the page, and also when the strip
  // grows or shrinks a line, which leaves the page the same size.
  if (self.ResizeObserver) {
    const observer = new ResizeObserver(relayout);
    observer.observe(root);
    observer.observe(stageArea);
  }
  else self.addEventListener('resize', relayout);

  function flash(node: HTMLElement | null | undefined) {
    if (!node) return;
    node.classList.remove('tt-bounce');
    void node.offsetWidth;  // restart the animation
    node.classList.add('tt-bounce');
    // Then let it go, or the bounce would play again whenever the tile
    // shows again (as when a pop-up opens).
    const done = (e: AnimationEvent) => {
      if (e.target !== node || e.animationName !== 'tt-bounce') return;
      node.classList.remove('tt-bounce');
      node.removeEventListener('animationend', done);
    };
    node.addEventListener('animationend', done);
  }

  let recording = false;
  function setRecording(on: boolean) {
    if (!on && openRepeat) closeRepeat();
    recording = on;
    root.classList.toggle('tt-recording', on);
    recordBtn.setAttribute('aria-pressed', String(on));
  }

  function setPlaying(on: boolean) {
    playing = on;
    root.classList.toggle('tt-playing', on);
    playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    playBtn.title = on ? 'Pause' : 'Play';
    playBtn.innerHTML = on ? BUTTONS.pause : BUTTONS.play;
    [stepBtn, rewindBtn, recordBtn].forEach(b => { b.disabled = on; });
  }

  // Plays the tile at the playhead, lit up, and moves the playhead on
  // (back to the start after the last tile).
  async function playStep(steps: Step[]) {
    const step = steps[playhead];
    const node = elementOf.get(step.item);
    if (node) {
      node.classList.remove('tt-next');
      node.classList.add('tt-active');
    }
    await perform(codeFor(programs, step.item), codeFor(programs, step.item, true));

    if (node) node.classList.remove('tt-active');
    playhead = (playhead + 1) % steps.length;
    showPlayhead();
  }

  function play() {
    if (playing) {
      pausing = true;
      return;
    }
    if (!steps().length) {
      flash(playBtn);
      return;
    }
    select(null);
    schedule(async () => {
      setPlaying(true);
      pausing = false;
      try {
        const list = steps();
        do {
          await playStep(list);
        } while (playhead !== 0 && !pausing);
      } finally {
        setPlaying(false);
      }
    });
  }

  function step() {
    if (playing) return;
    const list = steps();
    if (!list.length) {
      flash(stepBtn);
      return;
    }
    flash(stepBtn);
    select(null);
    schedule(() => playStep(list));
  }

  // The program item a source tile (Move, the wheel's turtle, or a fixed
  // tile) makes.
  function newItem(node: HTMLElement): Item {
    const t = node.dataset.tile;
    if (t === 'repeat') return { t, n: 1, body: [] };
    if (t === 'turn') return { t, a: Number(node.dataset.angle) };
    if (t === 'move') return { t, d: Number(node.dataset.d) };
    if (t === 'back') return { t: 'move', d: -Number(node.dataset.d) };
    if (t === 'call') return { t, p: node.dataset.p as ProgramName };
    return { t: t as PlainTileId };  // (a fixed tile's id)
  }

  // Tapping a source tile: the turtle does it now, and, while recording,
  // it joins the end of the strip, or the open repeat. Repeat, while
  // recording, opens a repeat at the end of the strip (going round once,
  // so it starts as just a group); tiles tapped then go into it, and
  // tapping Repeat again closes it. Repeats don't go inside repeats.
  function tapSource(node: HTMLElement) {
    // A crayon or a program picked closes its pop-up; the notes stay open
    // for a tune.
    if (openPopup && ['crayons', 'plays'].includes(openPopup) && popups[openPopup].pop.contains(node)) closePopup();
    if (node.dataset.tile === 'call' && blocked(node.dataset.p as ProgramName)) {
      flash(node);
      return;
    }
    if (node.dataset.tile === 'repeat') {
      if (!recording) {
        flash(node);
      } else if (openRepeat) {
        closeRepeat();
      } else {
        // After the picked tile (or the repeat it's in), if any, and
        // taking what's recorded next.
        openRepeat = { t: 'repeat', n: 1, body: [] };
        const place = selected && placeOf(selected);
        program.splice(place ? program.indexOf(place.repeat || selected!) + 1 : program.length, 0, openRepeat);
        if (place) select(openRepeat, true);
        repeatBtn.classList.add('tt-open');
        repeatBtn.setAttribute('aria-pressed', 'true');
        changed();
        elementOf.get(openRepeat)!.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      return;
    }
    const item = newItem(node);
    flash(node);
    let added: HTMLElement | null | undefined = null;
    if (recording) {
      const merged = record(item);
      changed();
      added = merged && elementOf.get(merged);
      if (added) added.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    schedule(async () => {
      if (added) added.classList.add('tt-active');
      await perform(codeFor(programs, item as Tile), codeFor(programs, item as Tile, true));  // (not a repeat)
      if (added) added.classList.remove('tt-active');
    });
  }

  // Whether the pen will be up at the end of the recording: the last
  // tile in it that lifts or lowers the pen says, or else the turtle.
  function penUpAtEnd() {
    const flat = program.flatMap(i => (i.t === 'repeat' ? i.body : [i]));
    for (let i = flat.length - 1; i >= 0; i--) {
      const t = flat[i].t;
      if (t === 'invisible' || t === 'penup') return true;
      if (t === 'pendown' || t === 'nextcolor' || (TILE[t] && TILE[t].group === 'crayons')) return false;
    }
    return Boolean(stage && !stage.logo.turtle.pendown);
  }

  // Adds a tapped tile to the end of the recording (or the open repeat),
  // merging it into the tile before when it can: a move after a move the
  // same way goes further, and so does Back after Move (or Move after
  // Back) while the pen is up, when it comes to the same thing; a turn
  // after a turn turns by both. A tile that comes to nothing (a whole
  // turn, or back to where it began) goes away. Returns the tile that
  // shows it, or null if it went away.
  function record(item: Item): Item | null {
    const picking = Boolean(selected && placeOf(selected));
    const { list, at, repeat } = insertionPoint();
    const last = list[at - 1];
    // (Whether the pen is up is only known at the end of the recording.)
    const atEnd = at === list.length && (list === program || repeat === program[program.length - 1]);
    // The tile before goes away: what was before it is picked.
    const gone = () => {
      list.splice(at - 1, 1);
      if (picking) select(list[at - 2] || repeat, !list[at - 2]);
      return null;
    };
    let shown: Item = item;
    if (last && item.t === 'move' && last.t === 'move' &&
        (Math.sign(last.d) === Math.sign(item.d) || (atEnd && penUpAtEnd())) &&
        Math.abs(last.d + item.d) <= MAX_UNITS * UNIT) {
      last.d += item.d;
      if (last.d === 0) return gone();
      shown = last;
    } else if (last && item.t === 'turn' && last.t === 'turn') {
      const a = normalize(last.a + item.a);
      if (a === 0) return gone();
      last.a = a;
      shown = last;
    } else {
      list.splice(at, 0, item);
    }
    if (picking) select(shown);
    return shown;
  }

  // Tapping in the strip: a repeat's head opens its count pop-up; another
  // tile moves the playhead to it; a move or a turn opens the spinner to
  // change it (and sets Move and Back, or the wheel, to it).
  function tapItem(node: HTMLElement) {
    const item = itemOf.get(node)!;
    if (item.t === 'repeat') {
      select(item, true);
      openCount(item, node.querySelector<HTMLElement>('.tt-repeat-head')!);
      return;
    }
    select(item);
    top = current;
    playhead = Math.max(0, steps().findIndex(s => s.item === item));
    showPlayhead();
    if (item.t === 'turn') {
      setAngle(item.a);
      flash(go);
      openTurn(item, node);
    }
    flash(node);
    if (item.t === 'move') {
      setDistance(Math.abs(item.d) / UNIT);
      openMove(item, node);
    }
  }

  // Dragging --------------------------------------------------------------

  // Where a dragged item would land at (x, y): the strip or a repeat's
  // body, and the item to go before (null for the end). Repeats can't go
  // inside repeats.
  function dropTarget(x: number, y: number, item: Item): DropTarget | null {
    const under = document.elementFromPoint(x, y);
    if (!under || !stripArea.contains(under)) return null;
    let container: Element = under.closest('.tt-repeat-body') || strip;
    if (item.t === 'repeat') container = strip;
    const list: Item[] = container === strip ? program : bodyOf.get(container)!.body;
    const kids = [...container.children].filter(c =>
      c.classList.contains('tt-item') && !c.classList.contains('tt-lifted'));
    let index = kids.length;
    let best = Infinity;
    kids.forEach((k, i) => {
      const r = k.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const distanceTo = Math.abs(y - (r.top + r.bottom) / 2) * 3 + Math.abs(x - cx);
      if (distanceTo < best) {
        best = distanceTo;
        index = x < cx ? i : i + 1;
      }
    });
    return { container, list, before: kids[index] || null };
  }

  let marker: HTMLDivElement | null = null;
  function showMarker(target: DropTarget | null) {
    if (!target) {
      if (marker) marker.remove();
      return;
    }
    marker = marker || el('div', 'tt-marker');
    target.container.insertBefore(marker, target.before);
  }

  function removeItem(item: Item) {
    const lists: Item[][] = [program, ...program.filter(i => i.t === 'repeat').map(i => i.body)];
    lists.forEach(list => {
      const i = list.indexOf(item);
      if (i >= 0) list.splice(i, 1);
    });
  }

  function startDrag(e: PointerEvent, node: HTMLElement, fromSource: boolean): Drag {
    const item = fromSource ? null : itemOf.get(node);
    const r = node.getBoundingClientRect();
    const ghost = node.cloneNode(true) as HTMLElement;
    // No bounce or highlight on the ghost: an animation would move it.
    const marks = ['tt-bounce', 'tt-active', 'tt-next'];
    [ghost, ...ghost.querySelectorAll('.tt-bounce, .tt-active, .tt-next')].forEach(n => n.classList.remove(...marks));
    ghost.classList.add('tt-ghost');
    ghost.style.width = r.width + 'px';
    ghost.style.height = r.height + 'px';
    ghost.style.transform = `translate(${r.left}px, ${r.top}px)`;
    document.body.appendChild(ghost);
    const offset = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!fromSource) node.classList.add('tt-lifted');
    if (openPopup && popups[openPopup].pop.contains(node)) closePopup();
    const moving = item || newItem(node);
    // Where it lands: a place in the strip, or (for a tile from the
    // strip) the trash can. Dropped anywhere else, it goes back.
    let target: DropTarget | null = null;
    let trashing = false;
    return {
      move(ev: PointerEvent) {
        ghost.style.transform = `translate(${ev.clientX - offset.x}px, ${ev.clientY - offset.y}px)`;
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        trashing = Boolean(item && under && trashBtn.contains(under));
        target = trashing ? null : dropTarget(ev.clientX, ev.clientY, moving);
        showMarker(target);
        trashBtn.classList.toggle('tt-drop', trashing);
        ghost.classList.toggle('tt-ghost-trash', trashing);
      },
      end(cancelled: boolean) {
        ghost.remove();
        showMarker(null);
        node.classList.remove('tt-lifted');
        trashBtn.classList.remove('tt-drop');
        if (cancelled || (!target && !trashing)) return;
        const before = target && target.before ? itemOf.get(target.before) : null;
        if (trashing && item && item.t === 'repeat') {  // (only a tile from the strip is trashing)
          // A repeat in the trash lets go of its tiles: they stay where
          // it was.
          program.splice(program.indexOf(item), 1, ...item.body);
          flash(trashBtn);
          changed();
          return;
        }
        if (item) removeItem(item);
        if (target) {
          const i = before ? target.list.indexOf(before) : -1;
          target.list.splice(i >= 0 ? i : target.list.length, 0, moving);
        } else flash(trashBtn);
        changed();
      },
    };
  }

  // A press on a tile is a tap, or a drag once it moves a little. While
  // the strip plays, the tiles rest.
  root.addEventListener('pointerdown', e => {
    self.LogoMusic.unlock();
    const tile = (e.target as Element).closest<HTMLElement>('.tt-tile');
    if (!tile || playing || e.button > 0) return;
    e.preventDefault();
    const fromSource = tile.classList.contains('tt-source');
    const node = fromSource ? tile : tile.closest<HTMLElement>('.tt-item')!;
    const start = { x: e.clientX, y: e.clientY };
    let drag: Drag | null = null;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const stuck = fromSource && tile.dataset.tile === 'call' && blocked(tile.dataset.p as ProgramName);
      if (!drag && !stuck && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        drag = startDrag(e, node, fromSource);
      }
      if (drag) drag.move(ev);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      self.removeEventListener('pointermove', move);
      self.removeEventListener('pointerup', end);
      self.removeEventListener('pointercancel', end);
      if (drag) drag.end(ev.type === 'pointercancel');
      else if (ev.type === 'pointerup') (fromSource ? tapSource : tapItem)(node);
    };
    self.addEventListener('pointermove', move);
    self.addEventListener('pointerup', end);
    self.addEventListener('pointercancel', end);
  });
  root.addEventListener('keydown', e => {
    const target = e.target as Element;
    const tile = target.closest && target.closest<HTMLElement>('.tt-tile');
    if (!tile || playing || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (tile.classList.contains('tt-source')) tapSource(tile);
    else tapItem(tile.closest<HTMLElement>('.tt-item')!);
  });
  root.addEventListener('contextmenu', e => e.preventDefault());

  // Buttons -----------------------------------------------------------------

  // Clear wipes the drawing, sends the turtle home and rewinds the strip,
  // so the next Play starts from the beginning.
  clearBtn.addEventListener('click', () => {
    flash(clearBtn);
    select(null);
    playhead = 0;
    showPlayhead();
    schedule(() => perform('clean ' + HOME));
  });
  recordBtn.addEventListener('click', () => setRecording(!recording));
  playBtn.addEventListener('click', play);
  stepBtn.addEventListener('click', step);
  rewindBtn.addEventListener('click', () => {
    flash(rewindBtn);
    select(null);
    playhead = 0;
    showPlayhead();
  });
  // The trash can: drag a tile from the strip onto it to throw the tile
  // away. Tapping it empties the whole strip, but only after a second tap
  // to confirm: the first makes it turn red and pulse for a few seconds.
  const CONFIRM_MS = 3000;
  let armed: ReturnType<typeof setTimeout> | undefined;
  function disarm() {
    clearTimeout(armed);
    armed = undefined;
    trashBtn.classList.remove('tt-armed');
    trashBtn.setAttribute('aria-label', 'Trash');
  }
  trashBtn.addEventListener('click', () => {
    if (!program.length || playing) {
      flash(trashBtn);
      return;
    }
    if (armed) {
      disarm();
      program.length = 0;
      changed();
      return;
    }
    trashBtn.classList.add('tt-armed');
    trashBtn.setAttribute('aria-label', 'Tap again to empty the strip');
    armed = setTimeout(disarm, CONFIRM_MS);
  });
  // A press anywhere else calls it off.
  document.addEventListener('pointerdown', e => {
    if (armed && !trashBtn.contains(e.target as Node)) disarm();
  }, true);

  // The grown-ups menu opens after holding its button down (or from the
  // keyboard), so small fingers don't open it by accident.
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  grownUps.addEventListener('pointerdown', () => {
    grownUps.classList.add('tt-holding');
    holdTimer = setTimeout(() => { menu.hidden = false; }, HOLD_MS);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => grownUps.addEventListener(type, () => {
    grownUps.classList.remove('tt-holding');
    clearTimeout(holdTimer);
  }));
  grownUps.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      menu.hidden = false;
    }
  });
  const closeMenu = () => { menu.hidden = true; };
  const pretty = () => '; Made with Turtle Tiles\n' + PRELUDE + '\n' + namedLogo(programs, current);
  textButton('Snapshot', () => stage!.download(TITLE));
  // A video of the whole recording, from a clean page with the turtle
  // at home; the drawing it leaves stays.
  const rec = textButton('Make Recording', () => {
    closeMenu();
    schedule(async () => {
      setPlaying(true);
      try {
        history = [toLogo(programs, program, { silent: true })];
        await stage!.runAndRecord(PRELUDE + '\n' + toLogo(programs, program), TITLE);
      } finally {
        setPlaying(false);
      }
    });
  });
  if (!LogoStage.canRecord()) {
    rec.disabled = true;
    rec.textContent = 'Video not supported';
  }
  textButton('Open in Playground', () => {
    try {
      localStorage.setItem(IMPORT_KEY, JSON.stringify({ name: TITLE, code: pretty() }));
    } catch (e) { /* storage blocked: open the playground anyway */ }
    location.href = PLAYGROUND + '?import';
  });
  // Share a link: a link to this page that carries all the programs (by
  // the phone's share sheet, or copied).
  const shareBtn = textButton('Share a link', async () => {
    const shared = NAMES.filter(n => programs[n].length);
    const data: SharePayload = { current, programs: Object.fromEntries(shared.map(n => [n, programs[n]])) };
    const url = location.origin + location.pathname + '?' + SHARE_PARAM + '=' + await pack(data);
    if (navigator.share) {
      try {
        await navigator.share({ title: TITLE, url });
        return;
      } catch (e) {
        if (e && (e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = 'Link copied';
      setTimeout(() => { shareBtn.textContent = 'Share a link'; }, 2000);
    } catch (e) {
      self.prompt('Copy this link:', url);
    }
  });
  textButton('Close', closeMenu);

  // Recording starts only when Record is tapped, so nothing is added
  // to a program by surprise.
  setRecording(false);
  setPlaying(false);
  openShared();

  // Opened from a shared link: its programs replace these (asking first
  // if that would lose some), then the address goes back to the plain
  // page, so reloading doesn't load them again.
  async function openShared() {
    const query = new URLSearchParams(location.search);
    const text = query.get(SHARE_PARAM);
    if (!text) return;
    try {
      // (Anything at all, parsed: clean() makes sense of its programs.)
      const data = await unpack(text) as IncomingPayload;
      const incoming = {} as Programs;  // (each set here)
      NAMES.forEach(n => { incoming[n] = clean(data.programs && data.programs[n]); });
      const differs = NAMES.some(n => programs[n].length && JSON.stringify(programs[n]) !== JSON.stringify(incoming[n]));
      if (!differs || self.confirm('Open the shared programs? They replace the programs here.')) {
        if (openRepeat) closeRepeat(true);
        NAMES.forEach(n => { programs[n] = incoming[n]; });
        const p = isName(data.current) ? data.current : 'A';
        select(null);
        top = p;
        playhead = 0;
        if (p === current) program = programs[p];
        showProgram(p);
        save();
      }
    } catch (e) {
      console.warn('Turtle Tiles: could not open the shared link.', e);
    }
    query.delete(SHARE_PARAM);
    const rest = query.toString();
    self.history.replaceState(self.history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }
}

export const LogoTiles = { init };
