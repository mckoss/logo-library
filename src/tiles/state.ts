// Turtle Tiles' state: everything the page shows, in one object, and the
// changes a child's taps and drags make to it, as functions of it. No page
// needed, so the unit tests run them (tests/unit/tiles-state.test.ts);
// tiles.ts calls them from its event handlers, then render() brings the
// page in line with the state.
//
// Items are compared by identity throughout (the item picked, the open
// repeat, the tile playing, the one dragged): an item is the object in its
// program's list, and a change to it (a move's distance, a repeat's count)
// changes it in place.
import type { SpeedName } from '../engine/index.js';
import {
  MAX_COUNT, MAX_UNITS, NAMES, STEP, TILE, UNIT, clean, isName, normalize, plays, stepsOf,
} from './program.js';
import type {
  Item, MoveItem, PlainTileId, ProgramName, Programs, RepeatItem, Step, Tile, TurnItem,
} from './program.js';
import { FORMAT } from './share.js';
import type { IncomingPayload } from './share.js';

// The animals, picked for a speed (the turtle is the turtle), and how fast
// each goes.
export type AnimalId = 'snail' | 'turtle' | 'rabbit' | 'bolt';
export const SPEEDS: { id: AnimalId; label: string; speed: SpeedName }[] = [
  { id: 'snail', label: 'Snail: slowest', speed: 'crawl' },
  { id: 'turtle', label: 'Turtle', speed: 'slow' },
  { id: 'rabbit', label: 'Rabbit: fast', speed: 'fast' },
  { id: 'bolt', label: 'Lightning: at once', speed: 'instant' },
];
// How the turtle shows: the turtle; the turtle with its x, y and a dot in
// the pen's color; just an arrow in the pen's color.
export type LookId = 'turtle' | 'xy' | 'arrow';
export const LOOK_IDS: LookId[] = ['turtle', 'xy', 'arrow'];

// The pop-ups: the crayons, the notes, the turtle display choices, the
// programs to play, the speeds, and the spinner (`count`).
export type PopupId = 'crayons' | 'notes' | 'looks' | 'plays' | 'speeds' | 'count';
// What the spinner sets: how far Move and Back go (`size`), a repeat's
// count, or how far a move or a turn in the strip goes.
export type SpinTarget =
  | { kind: 'size' }
  | { kind: 'count'; item: RepeatItem }
  | { kind: 'move'; item: MoveItem }
  | { kind: 'turn'; item: TurnItem };
// The spinner's label, value, least and most; and the step it counts by,
// whether it skips 0, and how it shows the number.
export interface SpinRange {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  skipZero: boolean;
  format(n: number): string;
}
// Where a dragged item would land: in `list` (the program or a repeat's
// body), before `before` (null for the end).
export interface DropSpot {
  list: Item[];
  before: Item | null;
}
// A drag under way: the item it would drop (from the strip, `lifted`, or a
// new one from a source tile), where it would land, whether it's over the
// trash can, and where its ghost is (its top left, in the window).
export interface DragState {
  moving: Item;
  lifted: Item | null;
  drop: DropSpot | null;
  trashing: boolean;
  x: number;
  y: number;
}

export interface TilesState {
  // The programs, A to D (each list changed in place, or replaced when a
  // link brings new ones); `current` is the one the strip shows, `top` the
  // one Play and Step go through, which may play others: while it does,
  // the strip shows the one playing (follow).
  programs: Programs;
  current: ProgramName;
  top: ProgramName;
  // The playhead: the next tile Play or Step will play, as an index into
  // the steps of `top`.
  playhead: number;
  recording: boolean;
  playing: boolean;
  pausing: boolean;
  // The tile playing, lit up.
  active: Item | null;
  // The item picked by tapping it in the strip, if any: recording goes in
  // just after it, and the new tile is picked in its place, so taps go in
  // in order. A repeat picked by its count (`selectedInto`) takes recording
  // at the end of its body. With nothing picked, recording goes on the end
  // of the strip (or of the open repeat).
  selected: Item | null;
  selectedInto: boolean;
  // The repeat that tiles being recorded go into.
  openRepeat: RepeatItem | null;
  // The open pop-up, and what the spinner sets.
  popup: PopupId | null;
  spin: SpinTarget | null;
  // How many units Move and Back go, and the wheel's turn.
  distance: number;
  angle: number;
  // The speed (an animal) and how the turtle shows.
  pace: AnimalId;
  look: LookId;
  drag: DragState | null;
  // The trash can, tapped once, waiting for a second tap to empty the
  // strip.
  armed: boolean;
  // The grown-ups menu: open; its button being held; "Link copied".
  menu: boolean;
  holding: boolean;
  copied: boolean;
  // How many things wait in the turtle's queue (the page is busy while
  // any do).
  waiting: number;
  // The arrangement the layout picked, and the tile size, in pixels.
  layout: string;
  size: number;
  // Whether the programs (or the one shown) changed since they were last
  // saved in this browser.
  unsaved: boolean;
}

export const emptyPrograms = (): Programs => ({ A: [], B: [], C: [], D: [] });

// The programs and the one shown, from what was saved in this browser (as
// SavedTiles describes, but unchecked: clean() makes sense of it, as of a
// link's). A strip saved before there were programs becomes A.
export function loadPrograms(text: string | null): { programs: Programs; current: ProgramName } {
  const programs = emptyPrograms();
  let current: ProgramName = 'A';
  try {
    const saved = JSON.parse(text as string) as IncomingPayload | unknown[] | null;
    if (Array.isArray(saved)) programs.A = clean(saved);
    else if (saved && saved.programs) {
      NAMES.forEach(n => { programs[n] = clean(saved.programs![n]); });
      if (isName(saved.current)) current = saved.current;
    }
  } catch (e) { /* none saved */ }
  return { programs, current };
}
// The turtle display choice saved (one saved as the dot, before 1.8.4, is
// an arrow), and the speed.
export function loadLook(text: string | null): LookId {
  const look = text === 'dot' ? 'arrow' : text;
  return LOOK_IDS.includes(look as LookId) ? look as LookId : 'turtle';
}
export function loadPace(text: string | null): AnimalId {
  return SPEEDS.some(v => v.id === text) ? text as AnimalId : 'turtle';
}

export function createState(programs: Programs = emptyPrograms(), current: ProgramName = 'A',
  look: LookId = 'turtle', pace: AnimalId = 'turtle'): TilesState {
  return {
    programs, current, top: current, playhead: 0, recording: false, playing: false, pausing: false,
    active: null, selected: null, selectedInto: false, openRepeat: null, popup: null, spin: null,
    distance: 2, angle: 90, pace, look, drag: null, armed: false, menu: false, holding: false, copied: false,
    waiting: 0, layout: '', size: 0, unsaved: false,
  };
}

// What's saved in this browser: the programs and the one shown.
export const saved = (s: TilesState): string => JSON.stringify({ v: FORMAT, programs: s.programs, current: s.current });

// The program the strip shows.
export const program = (s: TilesState): Item[] => s.programs[s.current];
// The tiles Play goes through, one at a time.
export const steps = (s: TilesState): Step[] => stepsOf(s.programs, s.programs[s.top], s.top);
// The step at the playhead, if it's in the program the strip shows.
export function next(s: TilesState): Step | null {
  const step = steps(s)[s.playhead];
  return step && step.prog === s.current ? step : null;
}
// The program the strip should show: part way through, the one playing;
// at the start, the one Play plays.
export function showing(s: TilesState): ProgramName {
  const step = steps(s)[s.playhead];
  return s.playhead > 0 && step ? step.prog : s.top;
}
export const speedOf = (s: TilesState): SpeedName => SPEEDS.find(v => v.id === s.pace)!.speed;
// Room the view keeps around the turtle, in CSS pixels: for its numbers,
// or for the lightning, which reaches up from its point.
export const roomAround = (s: TilesState): number => (s.look === 'xy' ? 80 : s.pace === 'bolt' ? 26 : 0);
// Whether a tile that plays `p` would play the program it goes in (itself,
// or by way of another): it's faded and does nothing.
export const blocked = (s: TilesState, p: ProgramName): boolean => p === s.current || plays(s.programs, p, s.current);

// The list `item` is in (the strip, or a repeat's body), and where.
export function placeOf(s: TilesState, item: Item): { list: Item[]; index: number; repeat: RepeatItem | null } | null {
  const list = program(s);
  let i = list.indexOf(item);
  if (i >= 0) return { list, index: i, repeat: null };
  for (const r of list) {
    if (r.t === 'repeat' && (i = r.body.indexOf(item as Tile)) >= 0) return { list: r.body, index: i, repeat: r };
  }
  return null;
}
// Where a recorded tile goes: into `list` at `at`.
export function insertionPoint(s: TilesState): { list: Item[]; at: number; repeat: RepeatItem | null } {
  const place = s.selected && placeOf(s, s.selected);
  if (place && s.selectedInto) {
    const into = s.selected as RepeatItem;  // (only a repeat is selectedInto)
    return { list: into.body, at: into.body.length, repeat: into };
  }
  if (place) return { list: place.list, at: place.index + 1, repeat: place.repeat };
  if (s.openRepeat) return { list: s.openRepeat.body, at: s.openRepeat.body.length, repeat: s.openRepeat };
  const list = program(s);
  return { list, at: list.length, repeat: null };
}

// Picks `item` (or nothing); `into` a repeat, recording goes at the end of
// its body.
export function select(s: TilesState, item: Item | null | undefined, into = false): void {
  s.selected = item || null;
  s.selectedInto = Boolean(s.selected && into && s.selected.t === 'repeat');
}

// After the recording changes: a repeat or a pick no longer in it is let
// go, and the playhead goes back to the start (and they want saving).
export function changed(s: TilesState): void {
  if (s.openRepeat && !program(s).includes(s.openRepeat)) closeRepeat(s, true);
  if (s.selected && !placeOf(s, s.selected)) select(s, null);
  s.playhead = 0;
  s.top = s.current;
  s.unsaved = true;
}

// Closes the open repeat (dropping it if nothing went in), unless it's
// already `gone` from the strip.
export function closeRepeat(s: TilesState, gone?: boolean): void {
  const item = s.openRepeat;
  if (!item) return;
  s.openRepeat = null;
  if (gone) return;
  const list = program(s);
  const at = list.indexOf(item);
  const picked = s.selected === item || item.body.includes(s.selected as Tile);
  if (!item.body.length) list.splice(at, 1);
  // Recording into it went after a picked tile: what comes next goes
  // after the repeat.
  if (picked) select(s, item.body.length ? item : list[at - 1]);
  changed(s);
}

// Record on or off; off closes the open repeat.
export function setRecording(s: TilesState, on: boolean): void {
  if (!on && s.openRepeat) closeRepeat(s);
  s.recording = on;
}

// Shows program `p` in the strip. Showing another program stops recording,
// so tiles never go into a program by surprise: Record has to be tapped
// again for it. A pick in the program left is let go.
export function showProgram(s: TilesState, p: ProgramName): void {
  if (p !== s.current && s.recording) setRecording(s, false);
  s.current = p;
  if (s.selected && !placeOf(s, s.selected)) select(s, null);
}
// The strip follows the playhead into a program it plays, and back.
export function follow(s: TilesState): void {
  for (let i = 0; i < NAMES.length && showing(s) !== s.current; i++) showProgram(s, showing(s));
}
// Goes up (`by` -1) or down (1) through A to D, if there's a program
// there. Returns whether it went.
export function goProgram(s: TilesState, by: number): boolean {
  const p = NAMES[NAMES.indexOf(s.current) + by];
  if (!p) return false;
  if (s.openRepeat) closeRepeat(s);
  s.top = p;
  s.playhead = 0;
  showProgram(s, p);
  follow(s);
  s.unsaved = true;
  return true;
}

// The playhead back to the start, letting go of any pick (Rewind, and
// Clear).
export function rewind(s: TilesState): void {
  select(s, null);
  s.playhead = 0;
  follow(s);
}
// After the tile at the playhead plays: on to the next (back to the start
// after the last of `count`).
export function advance(s: TilesState, count: number): void {
  s.playhead = (s.playhead + 1) % count;
  follow(s);
}
// After a change in place in the strip (a count, a distance, a turn): keep
// the playhead on it.
export function edited(s: TilesState): void {
  if (s.playhead >= steps(s).length) s.playhead = 0;
  follow(s);
  s.unsaved = true;
}

// Tapping a tile in the strip: picks it and moves the playhead to it; a
// move sets how far Move and Back go, and a turn sets the wheel, and either
// opens the spinner to change it. A repeat (by its count) is picked to
// record into and opens its count.
export function tapItem(s: TilesState, item: Item): void {
  if (item.t === 'repeat') {
    select(s, item, true);
    openSpinner(s, { kind: 'count', item });
    return;
  }
  select(s, item);
  s.top = s.current;
  s.playhead = Math.max(0, steps(s).findIndex(st => st.item === item));
  follow(s);
  if (item.t === 'turn') {
    setAngle(s, item.a);
    openSpinner(s, { kind: 'turn', item });
  }
  if (item.t === 'move') {
    s.distance = Math.abs(item.d) / UNIT;
    openSpinner(s, { kind: 'move', item });
  }
}

// The item a source tile makes: a tile by its id (Move and Back as far as
// Step size says, the wheel's turtle by the wheel's turn), or one that
// plays program `p`.
export function sourceItem(s: TilesState, id: string, p?: string): Item {
  if (id === 'repeat') return { t: id, n: 1, body: [] };
  if (id === 'turn') return { t: id, a: s.angle };
  if (id === 'move') return { t: id, d: s.distance * UNIT };
  if (id === 'back') return { t: 'move', d: -s.distance * UNIT };
  if (id === 'call') return { t: id, p: p as ProgramName };
  return { t: id as PlainTileId };  // (a fixed tile's id)
}

// Tapping Repeat: while recording, opens a repeat (going round once, so it
// starts as just a group) after the picked tile, or the repeat it's in, or
// at the end of the strip, taking what's recorded next; tapping it again
// closes it. Not recording, it does nothing (`refused`). Repeats don't go
// inside repeats.
export function tapRepeat(s: TilesState): 'refused' | 'opened' | 'closed' {
  if (!s.recording) return 'refused';
  if (s.openRepeat) {
    closeRepeat(s);
    return 'closed';
  }
  const repeat: RepeatItem = { t: 'repeat', n: 1, body: [] };
  const list = program(s);
  const place = s.selected && placeOf(s, s.selected);
  list.splice(place ? list.indexOf(place.repeat || s.selected!) + 1 : list.length, 0, repeat);
  s.openRepeat = repeat;
  if (place) select(s, repeat, true);
  changed(s);
  return 'opened';
}

// Whether the pen will be up at the end of the recording: the last tile in
// it that lifts or lowers the pen says, or else the turtle (`penUp`).
export function penUpAtEnd(s: TilesState, penUp: boolean): boolean {
  const flat = program(s).flatMap(i => (i.t === 'repeat' ? i.body : [i]));
  for (let i = flat.length - 1; i >= 0; i--) {
    const t = flat[i].t;
    if (t === 'invisible' || t === 'penup') return true;
    if (t === 'pendown' || t === 'nextcolor' || (TILE[t] && TILE[t].group === 'crayons')) return false;
  }
  return penUp;
}

// Adds a tapped tile to the recording (after the pick, or at the end of
// the strip or the open repeat), merging it into the tile before when it
// can: a move after a move the same way goes further, and so does Back
// after Move (or Move after Back) while the pen is up, when it comes to the
// same thing; a turn after a turn turns by both. A tile that comes to
// nothing (a whole turn, or back to where it began) goes away. `penUp` is
// whether the turtle's pen is up now. Returns the tile that shows it, or
// null if it went away. (Then changed().)
export function record(s: TilesState, item: Item, penUp = false): Item | null {
  const picking = Boolean(s.selected && placeOf(s, s.selected));
  const { list, at, repeat } = insertionPoint(s);
  const strip = program(s);
  const last = list[at - 1];
  // (Whether the pen is up is only known at the end of the recording.)
  const atEnd = at === list.length && (list === strip || repeat === strip[strip.length - 1]);
  // The tile before goes away: what was before it is picked.
  const gone = () => {
    list.splice(at - 1, 1);
    if (picking) select(s, list[at - 2] || repeat, !list[at - 2]);
    return null;
  };
  let shown: Item = item;
  if (last && item.t === 'move' && last.t === 'move' &&
      (Math.sign(last.d) === Math.sign(item.d) || (atEnd && penUpAtEnd(s, penUp))) &&
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
  if (picking) select(s, shown);
  return shown;
}

// Takes `item` out of the strip, or the repeat it's in.
export function removeItem(s: TilesState, item: Item): void {
  const strip = program(s);
  const lists: Item[][] = [strip, ...strip.filter(i => i.t === 'repeat').map(i => i.body)];
  lists.forEach(list => {
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1);
  });
}
// The end of a drag: the item lands where it was over, or (from the strip)
// in the trash: a repeat in the trash lets go of its tiles, which stay
// where it was. Dropped anywhere else, nothing changes. Returns whether
// anything did, and whether it went in the trash.
export function dropDragged(s: TilesState, drag: DragState): { done: boolean; trashed: boolean } {
  const { moving, lifted, drop, trashing } = drag;
  if (!drop && !trashing) return { done: false, trashed: false };
  if (trashing && lifted && lifted.t === 'repeat') {  // (only a tile from the strip is trashing)
    const strip = program(s);
    strip.splice(strip.indexOf(lifted), 1, ...lifted.body);
    changed(s);
    return { done: true, trashed: true };
  }
  if (lifted) removeItem(s, lifted);
  if (drop) {
    const i = drop.before ? drop.list.indexOf(drop.before) : -1;
    drop.list.splice(i >= 0 ? i : drop.list.length, 0, moving);
  }
  changed(s);
  return { done: true, trashed: !drop };
}
// The trash can tapped twice: the program the strip shows is emptied.
export function emptyProgram(s: TilesState): void {
  program(s).length = 0;
  changed(s);
}

// Programs from a link replace these; `p` is the one it shows.
export function openPrograms(s: TilesState, incoming: Programs, p: ProgramName): void {
  if (s.openRepeat) closeRepeat(s, true);
  NAMES.forEach(n => { s.programs[n] = incoming[n]; });
  select(s, null);
  s.top = p;
  s.playhead = 0;
  showProgram(s, p);
  follow(s);
  s.unsaved = true;
}
// Whether programs from a link would lose any of these.
export const differs = (s: TilesState, incoming: Programs): boolean =>
  NAMES.some(n => s.programs[n].length && JSON.stringify(s.programs[n]) !== JSON.stringify(incoming[n]));

// The wheel's turn, by 15 degrees, -165 (left) to 180 (around), never 0.
export function setAngle(s: TilesState, a: number): void {
  a = normalize(a);
  if (a) s.angle = a;
}
// The wheel's arm moved by the arrow keys: a step `by`, skipping straight
// ahead.
export const nudgeAngle = (s: TilesState, by: number): void =>
  setAngle(s, s.angle + by === 0 ? s.angle + 2 * by : s.angle + by);

// Opens pop-up `id`, or closes it if it's open.
export function togglePopup(s: TilesState, id: PopupId): void {
  s.popup = s.popup === id ? null : id;
  s.spin = null;
}
export function closePopup(s: TilesState): void {
  s.popup = null;
  s.spin = null;
}
const sameTarget = (a: SpinTarget | null, b: SpinTarget): boolean =>
  Boolean(a && a.kind === b.kind && (a.kind === 'size' || (b.kind !== 'size' && a.item === b.item)));
// Opens the spinner on `target`, or closes it if it's open there already.
export function openSpinner(s: TilesState, target: SpinTarget): void {
  const open = s.popup === 'count' && sameTarget(s.spin, target);
  s.popup = open ? null : 'count';
  s.spin = open ? null : target;
}
const plain = (n: number) => String(n);
// What the spinner shows and allows, for what it sets.
export function spinRange(s: TilesState, target: SpinTarget): SpinRange {
  const range = { step: 1, skipZero: false, format: plain };
  if (target.kind === 'size') return { ...range, label: 'Step size', value: s.distance, min: 1, max: MAX_UNITS };
  if (target.kind === 'count') return { ...range, label: 'Repeat count', value: target.item.n, min: 0, max: MAX_COUNT };
  if (target.kind === 'move') {
    return { ...range, label: 'How far', value: Math.abs(target.item.d) / UNIT, min: 1, max: MAX_UNITS };
  }
  return {
    label: 'Turn', value: target.item.a, min: -180 + STEP, max: 180, step: STEP, skipZero: true,
    format: a => (a > 0 ? '+' : '−') + Math.abs(a),
  };
}
// An arrow on the spinner: its number goes up (`delta` 1) or down (-1),
// within its range. A move or a turn in the strip changes the recording
// only (the stage shows it when the strip plays), and sets Move and Back,
// or the wheel, to it. Returns whether the strip changed.
export function spinBy(s: TilesState, delta: number): boolean {
  const target = s.spin;
  if (!target) return false;
  const range = spinRange(s, target);
  const by = delta * range.step;
  let n = range.value + by;
  if (range.skipZero && n === 0) n += by;
  n = Math.max(range.min, Math.min(range.max, n));
  if (n === range.value) return false;
  if (target.kind === 'size') {
    s.distance = n;
    return false;
  }
  if (target.kind === 'count') target.item.n = n;
  else if (target.kind === 'move') {
    target.item.d = Math.sign(target.item.d) * n * UNIT;
    s.distance = n;
  } else {
    target.item.a = n;
    setAngle(s, n);
  }
  edited(s);
  return true;
}
