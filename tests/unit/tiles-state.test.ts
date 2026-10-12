// Turtle Tiles' state (src/tiles/state.ts): what taps and drags do to it,
// without a page: recording and merging moves and turns, repeats, picking
// a tile and recording after it, throwing tiles away, the programs, the
// playhead, the spinner, and what's saved.
import { describe, expect, it } from 'vitest';
import { UNIT } from '../../src/tiles/program.js';
import type { Item, MoveItem, Programs, RepeatItem, TurnItem } from '../../src/tiles/program.js';
import {
  advance, blocked, changed, closePopup, createState, differs, dropDragged, edited, emptyProgram, emptyPrograms,
  goProgram, loadLook, loadPace, loadPrograms, next, nudgeAngle, openPrograms, openSpinner, penUpAtEnd, program,
  record, rewind, roomAround, saved, select, setAngle, setRecording, showing, sourceItem, spinBy, spinRange, steps,
  tapItem, tapRepeat, togglePopup,
} from '../../src/tiles/state.js';
import type { DragState, TilesState } from '../../src/tiles/state.js';

// A page's state, recording (as each e2e test starts).
function recordingState(programs: Programs = emptyPrograms()): TilesState {
  const s = createState(programs);
  setRecording(s, true);
  return s;
}
// Taps source tiles by id while recording (each recorded, then changed(),
// as tiles.ts does); `penUp` is whether the turtle's pen is up.
function tap(s: TilesState, ids: string[], penUp = false) {
  ids.forEach(id => {
    if (id === 'repeat') tapRepeat(s);
    else {
      record(s, sourceItem(s, id), penUp);
      changed(s);
    }
  });
}
// The strip as names, a repeat as its count and its tiles' names.
const names = (list: Item[]): string[] => list.map(i => {
  if (i.t === 'repeat') return `${i.n}[${names(i.body).join(' ')}]`;
  if (i.t === 'move') return (i.d > 0 ? 'fd ' : 'bk ') + Math.abs(i.d) / UNIT;
  if (i.t === 'turn') return (i.a > 0 ? 'rt ' : 'lt ') + Math.abs(i.a);
  if (i.t === 'call') return 'play ' + i.p;
  return i.t;
});
const strip = (s: TilesState) => names(program(s));
const drag = (moving: Item, lifted: Item | null, extra: Partial<DragState>): DragState =>
  ({ moving, lifted, drop: null, trashing: false, x: 0, y: 0, ...extra });

describe('what was saved', () => {
  it('loads the programs and the one shown', () => {
    const text = JSON.stringify({ current: 'B', programs: { A: [{ t: 'move', d: 50 }], B: [{ t: 'home' }] } });
    const { programs, current } = loadPrograms(text);
    expect(current).toBe('B');
    expect(programs).toEqual({ A: [{ t: 'move', d: 50 }], B: [{ t: 'home' }], C: [], D: [] });
  });

  it('loads a strip saved before there were programs as A, and anything else as nothing', () => {
    expect(loadPrograms(JSON.stringify([{ t: 'far' }])).programs.A).toEqual([{ t: 'move', d: 100 }]);
    for (const text of [null, '', 'not json', '42', '{}', JSON.stringify({ current: 'Q', programs: {} })]) {
      expect(loadPrograms(text)).toEqual({ programs: emptyPrograms(), current: 'A' });
    }
  });

  it('saves the programs and the one shown in the same JSON as before', () => {
    const s = createState(loadPrograms(JSON.stringify({ current: 'C', programs: { A: [{ t: 'red' }] } })).programs, 'C');
    expect(saved(s)).toBe('{"programs":{"A":[{"t":"red"}],"B":[],"C":[],"D":[]},"current":"C"}');
  });

  it('loads the turtle display choice (the old dot is an arrow) and the speed', () => {
    expect(['turtle', 'xy', 'arrow', 'dot', 'cat', null].map(loadLook)).toEqual(['turtle', 'xy', 'arrow', 'arrow',
      'turtle', 'turtle']);
    expect(['snail', 'bolt', 'cheetah', null].map(loadPace)).toEqual(['snail', 'bolt', 'turtle', 'turtle']);
  });

  it('keeps room around the turtle for its numbers, or the lightning', () => {
    const s = createState();
    expect(roomAround(s)).toBe(0);
    s.pace = 'bolt';
    expect(roomAround(s)).toBe(26);
    s.look = 'xy';
    expect(roomAround(s)).toBe(80);
  });
});

describe('recording', () => {
  it('records tapped tiles only while Record is on', () => {
    const s = createState();
    expect(s.recording).toBe(false);
    setRecording(s, true);
    tap(s, ['move', 'turn', 'do']);
    expect(strip(s)).toEqual(['fd 2', 'rt 90', 'do']);
  });

  it('makes moves and turns from Step size and the wheel', () => {
    const s = recordingState();
    s.distance = 3;
    setAngle(s, -45);
    tap(s, ['back', 'turn']);
    expect(program(s)).toEqual([{ t: 'move', d: -75 }, { t: 'turn', a: -45 }]);
    expect(sourceItem(s, 'call', 'B')).toEqual({ t: 'call', p: 'B' });
    expect(sourceItem(s, 'repeat')).toEqual({ t: 'repeat', n: 1, body: [] });
  });

  it('merges a move after a move the same way, up to 99 units', () => {
    const s = recordingState();
    tap(s, ['move', 'move']);
    expect(strip(s)).toEqual(['fd 4']);
    s.distance = 96;
    tap(s, ['move']);  // 100 units: too far for one tile
    expect(strip(s)).toEqual(['fd 4', 'fd 96']);
    s.distance = 2;
    tap(s, ['back', 'back']);
    expect(strip(s)).toEqual(['fd 4', 'fd 96', 'bk 4']);
  });

  it('with the pen down, keeps Back after Move apart (it draws back over the line)', () => {
    const s = recordingState();
    tap(s, ['move', 'back']);
    expect(strip(s)).toEqual(['fd 2', 'bk 2']);
  });

  it('with the pen up, merges Move and Back too, and takes away a move that comes to nothing', () => {
    const s = recordingState();
    tap(s, ['invisible', 'move']);
    s.distance = 1;
    tap(s, ['back']);
    expect(strip(s)).toEqual(['invisible', 'fd 1']);
    tap(s, ['back']);
    expect(strip(s)).toEqual(['invisible']);
    // A crayon puts the pen down again.
    tap(s, ['red', 'move', 'back']);
    expect(strip(s)).toEqual(['invisible', 'red', 'fd 1', 'bk 1']);
  });

  it('asks the turtle whether the pen is up when no tile in the strip says', () => {
    const s = recordingState();
    expect(penUpAtEnd(s, true)).toBe(true);
    tap(s, ['move']);
    tap(s, ['back'], true);
    expect(strip(s)).toEqual([]);
    tap(s, ['nextcolor']);
    expect(penUpAtEnd(s, true)).toBe(false);
    tap(s, ['penup']);
    expect(penUpAtEnd(s, false)).toBe(true);
  });

  it('merges a turn after a turn, either way, and takes away a whole turn', () => {
    const s = recordingState();
    setAngle(s, 45);
    tap(s, ['turn', 'turn']);
    expect(strip(s)).toEqual(['rt 90']);
    setAngle(s, -15);
    tap(s, ['turn']);
    expect(strip(s)).toEqual(['rt 75']);
    setAngle(s, 120);
    tap(s, ['turn']);  // 195: -165, to the left
    expect(strip(s)).toEqual(['lt 165']);
    setAngle(s, 165);
    tap(s, ['turn']);
    expect(strip(s)).toEqual([]);
  });

  it('sends the playhead back to the start after the recording changes', () => {
    const s = recordingState();
    tap(s, ['move', 'turn', 'do']);
    s.playhead = 2;
    tap(s, ['re']);
    expect(s.playhead).toBe(0);
    expect(s.unsaved).toBe(true);
  });
});

describe('repeats', () => {
  it('opens a repeat going round once, records into it, and closes it', () => {
    const s = recordingState();
    tap(s, ['move', 'repeat', 'move', 'turn']);
    expect(s.openRepeat).toBe(program(s)[1]);
    expect(strip(s)).toEqual(['fd 2', '1[fd 2 rt 90]']);
    expect(tapRepeat(s)).toBe('closed');
    expect(s.openRepeat).toBeNull();
    tap(s, ['move']);
    expect(strip(s)).toEqual(['fd 2', '1[fd 2 rt 90]', 'fd 2']);
  });

  it('merges only within the repeat: the first tile in it is new', () => {
    const s = recordingState();
    tap(s, ['move', 'repeat', 'move', 'move']);
    expect(strip(s)).toEqual(['fd 2', '1[fd 4]']);
  });

  it('refuses a repeat while not recording, and never puts one inside another', () => {
    const s = createState();
    expect(tapRepeat(s)).toBe('refused');
    expect(strip(s)).toEqual([]);
    setRecording(s, true);
    expect(tapRepeat(s)).toBe('opened');
    expect(tapRepeat(s)).toBe('closed');  // (Repeat again closes it)
    // A repeat picked by a tile in it: a new one goes after it, not in it.
    tap(s, ['repeat', 'move', 'turn', 'repeat']);
    const outer = program(s)[0] as RepeatItem;
    select(s, outer.body[0]);
    tap(s, ['repeat', 'home']);
    expect(strip(s)).toEqual(['1[fd 2 rt 90]', '1[home]']);
  });

  it('drops a repeat with nothing in it when closed; stopping recording closes one', () => {
    const s = recordingState();
    tap(s, ['repeat', 'repeat']);
    expect(strip(s)).toEqual([]);
    tap(s, ['repeat', 'move']);
    setRecording(s, false);
    expect(s.openRepeat).toBeNull();
    setRecording(s, true);
    tap(s, ['move']);
    expect(strip(s)).toEqual(['1[fd 2]', 'fd 2']);
  });

  it('counts from 0 to 99 with the spinner, keeping the playhead in the steps', () => {
    const s = recordingState();
    tap(s, ['repeat', 'move', 'turn', 'repeat']);
    const repeat = program(s)[0] as RepeatItem;
    tapItem(s, repeat);
    expect(s.popup).toBe('count');
    expect(spinRange(s, s.spin!)).toMatchObject({ label: 'Repeat count', value: 1, min: 0, max: 99 });
    expect(spinBy(s, -1)).toBe(true);
    expect(spinBy(s, -1)).toBe(false);  // stops at 0
    expect(repeat.n).toBe(0);
    for (let i = 0; i < 120; i++) spinBy(s, 1);
    expect(repeat.n).toBe(99);
    expect(steps(s)).toHaveLength(198);
    s.playhead = 197;
    for (let i = 0; i < 95; i++) spinBy(s, -1);
    expect(repeat.n).toBe(4);
    expect(s.playhead).toBe(0);  // past the end: back to the start
  });

  it('a repeat picked by its count takes recording at its end', () => {
    const s = recordingState();
    tap(s, ['repeat', 'move', 'turn', 'repeat', 'home']);
    tapItem(s, program(s)[0]);
    expect(s.selectedInto).toBe(true);
    tap(s, ['back']);
    expect(strip(s)).toEqual(['1[fd 2 rt 90 bk 2]', 'home']);
  });

  it('shows which time round the playhead is in', () => {
    const s = recordingState();
    tap(s, ['repeat', 'move', 'turn', 'repeat']);
    (program(s)[0] as RepeatItem).n = 3;
    s.playhead = 2;  // the second time round's move
    expect(next(s)).toMatchObject({ item: { t: 'move' }, i: 1, repeat: program(s)[0] });
  });
});

describe('picking a tile in the strip', () => {
  it('moves the playhead to it, and recording goes in after it, in order', () => {
    const s = recordingState();
    tap(s, ['move', 'turn']);
    tapItem(s, program(s)[0]);
    expect(s.selected).toBe(program(s)[0]);
    expect(s.playhead).toBe(0);
    tap(s, ['home', 'home']);
    expect(strip(s)).toEqual(['fd 2', 'home', 'home', 'rt 90']);
    expect(s.selected).toBe(program(s)[2]);  // the last one in stays picked
    // A move after a picked move merges into it.
    closePopup(s);
    tapItem(s, program(s)[0]);
    tap(s, ['move']);
    expect(strip(s)).toEqual(['fd 4', 'home', 'home', 'rt 90']);
    // Rewind lets go: recording goes on the end again.
    rewind(s);
    expect(s.selected).toBeNull();
    tap(s, ['home']);
    expect(strip(s)).toEqual(['fd 4', 'home', 'home', 'rt 90', 'home']);
  });

  it('picks what was before a tile that merges away', () => {
    const s = recordingState();
    setAngle(s, 90);
    tap(s, ['move', 'turn', 'do']);
    tapItem(s, program(s)[1]);
    setAngle(s, -90);
    tap(s, ['turn']);
    expect(strip(s)).toEqual(['fd 2', 'do']);
    expect(s.selected).toBe(program(s)[0]);
  });

  it('a move sets Move and Back and opens the spinner to change it; a turn sets the wheel', () => {
    const s = recordingState();
    s.distance = 1;
    setAngle(s, -120);
    tap(s, ['turn', 'move']);
    s.distance = 3;
    setAngle(s, 45);
    tapItem(s, program(s)[0]);
    expect(s.angle).toBe(-120);
    expect(spinRange(s, s.spin!)).toMatchObject({ label: 'Turn', value: -120, step: 15, skipZero: true });
    tapItem(s, program(s)[1]);
    expect(s.distance).toBe(1);
    expect(spinRange(s, s.spin!)).toMatchObject({ label: 'How far', value: 1 });
    spinBy(s, 1);
    spinBy(s, 1);
    expect((program(s)[1] as MoveItem).d).toBe(75);
    expect(s.distance).toBe(3);
    // Tapping it again closes the spinner.
    tapItem(s, program(s)[1]);
    expect(s.popup).toBeNull();
  });

  it('turns in the spinner by 15 degrees, skipping 0, from -165 to 180', () => {
    const s = recordingState();
    tap(s, ['turn']);
    const turn = program(s)[0] as TurnItem;
    tapItem(s, turn);
    for (let i = 0; i < 6; i++) spinBy(s, -1);
    expect(turn.a).toBe(-15);
    expect(s.angle).toBe(-15);
    expect(spinRange(s, s.spin!).format(turn.a)).toBe('−15');
    for (let i = 0; i < 20; i++) spinBy(s, 1);
    expect(turn.a).toBe(180);
    for (let i = 0; i < 40; i++) spinBy(s, -1);
    expect(turn.a).toBe(-165);
  });
});

describe('the spinner and the pop-ups', () => {
  it('Step size sets how far Move and Back go, 1 to 99, without changing the strip', () => {
    const s = createState();
    openSpinner(s, { kind: 'size' });
    expect(s.popup).toBe('count');
    expect(spinBy(s, -1)).toBe(false);
    expect(s.distance).toBe(1);
    spinBy(s, -1);
    expect(s.distance).toBe(1);
    for (let i = 0; i < 200; i++) spinBy(s, 1);
    expect(s.distance).toBe(99);
    openSpinner(s, { kind: 'size' });  // tapped again: closed
    expect(s.popup).toBeNull();
    expect(spinBy(s, -1)).toBe(false);  // (closed: nothing to set)
  });

  it('opens one pop-up at a time, and closes it when tapped again', () => {
    const s = createState();
    togglePopup(s, 'crayons');
    togglePopup(s, 'notes');
    expect(s.popup).toBe('notes');
    togglePopup(s, 'notes');
    expect(s.popup).toBeNull();
  });

  it('turns the wheel by 15 degrees, never straight ahead', () => {
    const s = createState();
    setAngle(s, 118);
    expect(s.angle).toBe(120);
    setAngle(s, 3);  // rounds to 0: no turn, unchanged
    expect(s.angle).toBe(120);
    setAngle(s, 270);
    expect(s.angle).toBe(-90);
    setAngle(s, 15);
    nudgeAngle(s, -15);
    expect(s.angle).toBe(-15);
  });
});

describe('throwing tiles away and moving them', () => {
  it('throws a tile from the strip in the trash; dropped elsewhere it stays', () => {
    const s = recordingState();
    tap(s, ['move', 'turn', 'do']);
    const turn = program(s)[1];
    expect(dropDragged(s, drag(turn, turn, {}))).toEqual({ done: false, trashed: false });
    expect(strip(s)).toEqual(['fd 2', 'rt 90', 'do']);
    expect(dropDragged(s, drag(turn, turn, { trashing: true }))).toEqual({ done: true, trashed: true });
    expect(strip(s)).toEqual(['fd 2', 'do']);
  });

  it('a repeat in the trash lets go of its tiles, which stay where it was', () => {
    const s = recordingState();
    tap(s, ['move', 'repeat', 'turn', 'move', 'repeat', 'do']);
    const repeat = program(s)[1];
    dropDragged(s, drag(repeat, repeat, { trashing: true }));
    expect(strip(s)).toEqual(['fd 2', 'rt 90', 'fd 2', 'do']);
  });

  it('moves a tile within the strip, into a repeat, or in from a source tile', () => {
    const s = recordingState();
    tap(s, ['move', 'turn', 'repeat', 'home', 'repeat', 'do']);
    const list = program(s);
    const [move, , repeat, note] = list;
    dropDragged(s, drag(note, note, { drop: { list, before: move } }));
    expect(strip(s)).toEqual(['do', 'fd 2', 'rt 90', '1[home]']);
    dropDragged(s, drag(move, move, { drop: { list: (repeat as RepeatItem).body, before: null } }));
    expect(strip(s)).toEqual(['do', 'rt 90', '1[home fd 2]']);
    dropDragged(s, drag(sourceItem(s, 're'), null, { drop: { list, before: null } }));
    expect(strip(s)).toEqual(['do', 'rt 90', '1[home fd 2]', 're']);
  });

  it('lets go of a pick that was thrown away', () => {
    const s = recordingState();
    tap(s, ['move', 'turn']);
    tapItem(s, program(s)[1]);
    const turn = program(s)[1];
    dropDragged(s, drag(turn, turn, { trashing: true }));
    expect(s.selected).toBeNull();
  });

  it('the trash can empties the program the strip shows', () => {
    const s = recordingState();
    tap(s, ['move']);
    goProgram(s, 1);
    setRecording(s, true);
    tap(s, ['back']);
    emptyProgram(s);
    expect(s.programs.B).toEqual([]);
    expect(names(s.programs.A)).toEqual(['fd 2']);
  });
});

describe('the programs', () => {
  it('goes up and down through A to D, stopping recording, and no further', () => {
    const s = recordingState();
    tap(s, ['move', 'repeat']);
    expect(goProgram(s, -1)).toBe(false);
    expect(goProgram(s, 1)).toBe(true);
    expect(s.current).toBe('B');
    expect(s.top).toBe('B');
    expect(s.recording).toBe(false);
    expect(names(s.programs.A)).toEqual(['fd 2']);  // the empty repeat closed, and went
    goProgram(s, 1);
    goProgram(s, 1);
    expect(goProgram(s, 1)).toBe(false);
    expect(s.current).toBe('D');
  });

  it('lets go of a pick in the program left', () => {
    const s = recordingState();
    tap(s, ['move']);
    tapItem(s, program(s)[0]);
    goProgram(s, 1);
    expect(s.selected).toBeNull();
  });

  it('refuses a program that would play itself, even by way of another', () => {
    const s = recordingState();
    expect(blocked(s, 'A')).toBe(true);
    expect(blocked(s, 'B')).toBe(false);
    tap(s, ['repeat']);
    record(s, sourceItem(s, 'call', 'B'));  // A plays B, in a repeat
    goProgram(s, 1);
    expect(blocked(s, 'B')).toBe(true);
    expect(blocked(s, 'A')).toBe(true);
    expect(blocked(s, 'C')).toBe(false);
  });

  it('Step goes into a program played, the strip showing it, then comes back', () => {
    const s = createState({ ...emptyPrograms(), A: [{ t: 'move', d: 25 }, { t: 'call', p: 'B' }, { t: 'home' }],
      B: [{ t: 'move', d: 50 }, { t: 'turn', a: 90 }] });
    expect(steps(s)).toHaveLength(4);
    advance(s, 4);
    // Next is B's first tile: the strip shows B.
    expect(showing(s)).toBe('B');
    expect(s.current).toBe('B');
    expect(s.top).toBe('A');
    expect(next(s)?.item).toEqual({ t: 'move', d: 50 });
    advance(s, 4);
    expect(s.current).toBe('B');
    advance(s, 4);
    expect(s.current).toBe('A');
    expect(next(s)?.item).toEqual({ t: 'home' });
    advance(s, 4);
    expect(s.playhead).toBe(0);
  });

  it('Rewind goes back to the start, and to the program Play plays', () => {
    const s = createState({ ...emptyPrograms(), A: [{ t: 'call', p: 'B' }, { t: 'home' }], B: [{ t: 'red' }, { t: 'do' }] });
    s.playhead = 1;
    advance(s, 3);
    expect(s.current).toBe('A');
    s.playhead = 1;
    edited(s);
    expect(s.current).toBe('B');
    rewind(s);
    expect([s.playhead, s.current, s.top]).toEqual([0, 'A', 'A']);
  });

  it('stepping into another program while recording stops recording', () => {
    const s = recordingState({ ...emptyPrograms(), A: [{ t: 'move', d: 25 }, { t: 'call', p: 'B' }],
      B: [{ t: 'home' }] });
    advance(s, 2);
    expect(s.current).toBe('B');
    expect(s.recording).toBe(false);
  });

  it('opens programs from a link, showing the one it says', () => {
    const s = recordingState();
    tap(s, ['move']);
    const incoming = { ...emptyPrograms(), B: [{ t: 'home' }] } as Programs;
    expect(differs(s, incoming)).toBe(true);
    expect(differs(s, { ...emptyPrograms(), A: [{ t: 'move', d: 50 }] })).toBe(false);
    openPrograms(s, incoming, 'B');
    expect([s.current, s.top, s.playhead, s.recording]).toEqual(['B', 'B', 0, false]);
    expect(s.programs.A).toEqual([]);
    expect(s.unsaved).toBe(true);
  });
});
