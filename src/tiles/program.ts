// Turtle Tiles' programs, without the page: what a program is (its items,
// the programs A to D, the saved JSON), the tiles (what each is called, its
// color and its Logo), cleaning up programs that come from storage or a
// link, and a program as Logo and as the tiles Play goes through. Pure
// functions of their inputs (the programs are passed in), so the unit tests
// can check them; tiles.ts draws the tiles and runs them.

// The programs, A to D, each its own strip; a program can play another
// (as a Logo word), but never itself, even by way of another.
export type ProgramName = 'A' | 'B' | 'C' | 'D';
export const NAMES: ProgramName[] = ['A', 'B', 'C', 'D'];
// Whether `p` names a program.
export const isName = (p: unknown): p is ProgramName => NAMES.includes(p as ProgramName);
// Each program's color, pastel (the color of a tile that plays it).
export const PROGRAM_COLORS: Record<ProgramName, string> = { A: '#ef9a9a', B: '#a5d6a7', C: '#90caf9', D: '#bcaaa4' };

// The fixed tiles' ids: the crayons, the notes and the rest.
export type CrayonId = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'black';
export type NoteId = 'do' | 're' | 'mi' | 'fa' | 'sol' | 'la' | 'ti' | 'high-do';
export type PlainTileId = 'home' | 'pendown' | 'penup' | CrayonId | 'nextcolor' | 'invisible' | NoteId;
// The groups the tiles sit in: Moves (with Repeat), the drawing gutter,
// and the Colors and Music pop-ups.
export type TileGroup = 'core' | 'drawing' | 'crayons' | 'notes';

// A program's items (see SHARE-LINKS.md, whose JSON this is):
// a move, `d` turtle steps (a multiple of UNIT, negative goes back);
export interface MoveItem { t: 'move'; d: number }
// a turn, `a` degrees (a multiple of STEP, -165 to 180, never 0; + for right);
export interface TurnItem { t: 'turn'; a: number }
// playing another program;
export interface CallItem { t: 'call'; p: ProgramName }
// a fixed tile;
export interface PlainItem { t: PlainTileId }
// any of those: the tiles that can go in a repeat;
export type Tile = MoveItem | TurnItem | CallItem | PlainItem;
// or a repeat, going round `n` times (0 to MAX_COUNT), holding plain tiles.
export interface RepeatItem { t: 'repeat'; n: number; body: Tile[] }
export type Item = Tile | RepeatItem;
// A program: its strip of items.
export type Program = Item[];
export type Programs = Record<ProgramName, Program>;
// Saved in this browser (localStorage `mckoss.logo.tiles`): the programs
// and the one the strip shows; or, saved before there were programs, a
// strip (which loads as A).
export type SavedTiles = { programs: Programs; current: ProgramName } | Item[];

export const MAX_COUNT = 99;  // a repeat goes round 0 to 99 times
export const STEP = 15;
export const UNIT = 25;      // turtle steps in one unit of Move or Back
export const MAX_UNITS = 99;
// Moving the turtle home without drawing a line, whether its pen is up
// or down.
export const HOME = 'ifelse pendownp [pu home pd] [home]';

export const BLUE = '#3d7fd9';
// Turns are tinted like a boat's lights: red to the left (port), green
// to the right (starboard); turning around is neither, so it has none.
const PORT = '#d64545';
const STARBOARD = '#2e9a55';
export const turnTint = (angle: number): string | null => (angle === 180 ? null : angle > 0 ? STARBOARD : PORT);
const PEN_COLOR = '#fff';
const NOTE_COLOR = '#d81b60';

export const turnLabel = (angle: number): string =>
  (angle === 180 ? 'Turn around' : `Turn ${angle > 0 ? 'right' : 'left'} ${Math.abs(angle)}`);
export const moveLabel = (d: number): string => (d > 0 ? 'Move ' : 'Back ') + Math.abs(d) / UNIT;
// Angles run from -165 (left) to 180 (around), never 0.
export function normalize(angle: number): number {
  let a = Math.round(angle / STEP) * STEP % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

// A tile: its id, group (none for tiles no longer offered), spoken name
// (for screen readers and tests; nothing is written on the tiles), color
// and Logo (Repeat has none: it holds tiles). tiles.ts adds its picture.
export interface TileInfo {
  id: string;
  group: TileGroup | null;
  label: string;
  code?: string;
  color: string;
}
export interface FixedTile extends TileInfo {
  id: PlainTileId | 'repeat';
}

// The crayons, named by their color, which is a color name, so the Logo
// reads like the lessons (setpencolor "red).
export const CRAYONS = [['red', 'Red'], ['orange', 'Orange'], ['yellow', 'Yellow'], ['green', 'Green'],
  ['blue', 'Blue'], ['purple', 'Purple'], ['black', 'Black']] as const satisfies readonly (readonly [CrayonId, string])[];
// Do re mi, and their MIDI notes.
export const NOTES = [['do', 60], ['re', 62], ['mi', 64], ['fa', 65], ['sol', 67], ['la', 69], ['ti', 71],
  ['high-do', 72]] as const satisfies readonly (readonly [NoteId, number])[];

// The fixed tiles: their group, their spoken name, their color and Logo.
// Moves and turns are made from the Step size and the wheel (tileFor).
export const TILES: FixedTile[] = [
  { id: 'repeat', group: 'core', label: 'Repeat', color: '#f08c00' },
  { id: 'home', group: 'drawing', label: 'Home', code: HOME, color: '#2e9d48' },
  // Strips saved before the Invisible crayon may still have these.
  { id: 'pendown', group: null, label: 'Draw', code: 'pd', color: PEN_COLOR },
  { id: 'penup', group: null, label: "Don't draw", code: 'pu', color: PEN_COLOR },
  // The crayons: swatches of their color.
  ...CRAYONS.map(([id, label]): FixedTile => ({ id, group: 'crayons', label, code: 'pd setpencolor "' + id, color: id })),
  // Next color goes round the rainbow. The white crayon (Invisible), last,
  // lifts the pen, so the turtle moves without leaving a line; the other
  // crayons (and Next color) put it down again.
  { id: 'nextcolor', group: 'crayons', label: 'Next color', code: 'pd setpencolor "rainbow', color: PEN_COLOR },
  { id: 'invisible', group: 'crayons', label: 'Invisible', code: 'pu', color: PEN_COLOR },
  // Do re mi, named on the tiles.
  ...NOTES.map(([id, midi]): FixedTile => ({
    id, group: 'notes', label: 'Note ' + id.replace('-', ' '), code: `playnote ${midi} 1`, color: NOTE_COLOR,
  })),
];
export const TILE: Record<string, FixedTile> = {};
TILES.forEach(t => {
  TILE[t.id] = t;
});

// What a program item is: its tile, or for a move, a turn or playing a
// program, one made for it.
export function tileFor(item: Item): TileInfo {
  if (item.t === 'move') {
    return { id: 'move', group: 'core', label: moveLabel(item.d), color: BLUE,
      code: item.d > 0 ? 'fd ' + item.d : 'bk ' + -item.d };
  }
  if (item.t === 'turn') {
    return { id: 'turn', group: 'core', label: turnLabel(item.a), color: turnTint(item.a) || BLUE,
      code: item.a > 0 ? 'rt ' + item.a : 'lt ' + -item.a };
  }
  if (item.t === 'call') {
    return { id: 'call', group: 'core', label: 'Play ' + item.p, color: PROGRAM_COLORS[item.p] };
  }
  return TILE[item.t];
}
// A tile's Logo, or nothing for a note when `silent`. Playing a program
// is its tiles' Logo, in place (`calls` are the programs on the way, so a
// loop, which shouldn't happen, stops).
export function codeFor(programs: Programs, item: Tile, silent?: boolean, calls: ProgramName[] = []): string {
  if (item.t === 'call') {
    return calls.includes(item.p) ? '' : toLogo(programs, programs[item.p] || [], { silent, calls: [...calls, item.p] });
  }
  // (Every tile but Repeat has Logo.)
  return silent && tileFor(item).group === 'notes' ? '' : tileFor(item).code as string;
}
// Whether program `from` plays program `to`, itself or by way of others.
export function plays(programs: Programs, from: ProgramName, to: ProgramName, seen: ProgramName[] = []): boolean {
  if (seen.includes(from)) return false;
  const items = (programs[from] || []).flatMap(i => (i.t === 'repeat' ? i.body : [i]));
  return items.some(i => i.t === 'call' && (i.p === to || plays(programs, i.p, to, [...seen, from])));
}

// The program: [{t: 'move', d: steps}, {t: 'turn', a: degrees, + for
// right}, {t: tile id}, or {t: 'repeat', n: count, body: [...]}]. Repeats
// hold only plain tiles. Strips saved by earlier versions load too: walk
// and far become moves, hop lifts the pen to move, and left and right
// become 90 degree turns.
export const OLD: Record<string, Tile[]> = {
  walk: [{ t: 'move', d: 50 }],
  far: [{ t: 'move', d: 100 }],
  hop: [{ t: 'penup' }, { t: 'move', d: 50 }, { t: 'pendown' }],
  left: [{ t: 'turn', a: -90 }],
  right: [{ t: 'turn', a: 90 }],
};
// An item as it comes from storage or a link: anything at all, read as
// the fields an item may have, every one of them checked below.
interface RawItem { t?: unknown; d?: unknown; a?: unknown; n?: unknown; p?: unknown; body?: unknown }
// A program from storage or a link, made sense of: tiles it doesn't know
// are dropped, numbers rounded and clamped into range, old tiles become
// the tiles they became, and a repeat `inside` a repeat is dropped. It
// never refuses a whole program over one tile (see SHARE-LINKS.md).
export function clean(list: unknown, inside: true): Tile[];
export function clean(list: unknown, inside?: boolean): Item[];
export function clean(list: unknown, inside?: boolean): Item[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((item: RawItem | null | undefined): Item[] => {
    if (!item) return [];
    // (The comparisons below coerce what they're given, as the JSON may
    // hold anything.)
    // (Own keys only: a tile named "constructor" is just unknown.)
    if (Object.hasOwn(OLD, item.t as string)) return OLD[item.t as string].map(i => ({ ...i }));
    if (item.t === 'move') {
      const n = Math.max(1, Math.min(MAX_UNITS, Math.round(Math.abs(Number(item.d) || UNIT * 2) / UNIT)));
      return [{ t: 'move', d: ((item.d as number) < 0 ? -1 : 1) * n * UNIT }];
    }
    if (item.t === 'turn') {
      const a = normalize(Number(item.a) || 0);
      return a ? [{ t: 'turn', a }] : [];
    }
    if (item.t === 'repeat') {
      const n = Number.isInteger(item.n) && (item.n as number) >= 0 && (item.n as number) <= MAX_COUNT ? item.n as number : 1;
      return inside ? [] : [{ t: 'repeat', n, body: clean(item.body, true) }];
    }
    if (item.t === 'call') return isName(item.p) ? [{ t: 'call', p: item.p }] : [];
    return Object.hasOwn(TILE, item.t as string) ? [{ t: item.t as PlainTileId }] : [];
  });
}

// How toLogo writes a program (see toLogo).
export interface LogoOptions {
  silent?: boolean;
  pretty?: boolean;
  named?: boolean;
  calls?: ProgramName[];
}
// The program as Logo: one line, or `pretty` with a line per tile.
// `silent` leaves out the notes. Playing another program is its Logo in
// place, or with `named`, its name (a word defined by namedLogo).
export function toLogo(programs: Programs, list: Item[],
  { silent = false, pretty = false, named = false, calls = [] }: LogoOptions = {}): string {
  const parts = list.map(item => {
    if (item.t === 'call' && named) return item.p;
    if (item.t !== 'repeat') return codeFor(programs, item, silent, calls);
    const body = toLogo(programs, item.body, { silent, named, calls });
    return body ? `repeat ${item.n} [${body}]` : '';
  }).filter(Boolean);
  return parts.join(pretty ? '\n' : ' ');
}
// A program as Logo for the playground: a word for each program it plays
// (TO A ... END, those it plays first), then its own tiles.
export function namedLogo(programs: Programs, name: ProgramName): string {
  const order: ProgramName[] = [];
  (function visit(p: ProgramName, seen: ProgramName[]) {
    (programs[p] || []).flatMap(i => (i.t === 'repeat' ? i.body : [i])).forEach(i => {
      if (i.t === 'call' && !seen.includes(i.p) && !order.includes(i.p)) {
        visit(i.p, [...seen, i.p]);
        order.push(i.p);
      }
    });
  }(name, [name]));
  const words = order.map(p => {
    const body = toLogo(programs, programs[p], { pretty: true, named: true });
    return `to ${p}\n${body.split('\n').filter(Boolean).map(l => '  ' + l).join('\n')}\nend`;
  });
  return [...words, toLogo(programs, programs[name], { pretty: true, named: true })].filter(Boolean).join('\n');
}

// A tile Play goes through: the tile (never one that plays a program:
// Play goes through that program's tiles instead), the program it's in,
// and any repeat it's in with which time round it is (from 0).
export interface Step {
  item: Exclude<Tile, CallItem>;
  prog: ProgramName;
  repeat?: RepeatItem;
  i?: number;
}
// The program as the tiles Play goes through, one at a time: each with
// the program it's in, any repeat it's in and which time round it is.
// Playing another program goes through that program's tiles.
export function stepsOf(programs: Programs, list: Item[], prog: ProgramName, calls: ProgramName[] = [prog]): Step[] {
  const out: Step[] = [];
  const add = (item: Tile, repeat?: RepeatItem, i?: number) => {
    if (item.t !== 'call') {
      out.push({ item, prog, repeat, i });
    } else if (!calls.includes(item.p)) {
      stepsOf(programs, programs[item.p] || [], item.p, [...calls, item.p]).forEach(s => out.push(s));
    }
  };
  list.forEach(item => {
    if (item.t !== 'repeat') add(item);
    else for (let i = 0; i < item.n; i++) item.body.forEach(child => add(child, item, i));
  });
  return out;
}
