// Turtle Tiles' programs (src/tiles/program.ts): cleaning up what comes from
// storage or a link, a program as Logo, the tiles Play goes through, and
// which programs play which.
import { describe, expect, it } from 'vitest';
import {
  HOME, MAX_COUNT, MAX_UNITS, NAMES, OLD, TILES, UNIT,
  clean, codeFor, isName, namedLogo, normalize, plays, stepsOf, tileFor, toLogo,
} from '../../src/tiles/program.js';
import type { Item, Programs } from '../../src/tiles/program.js';

const none = (): Programs => ({ A: [], B: [], C: [], D: [] });

// The programs of the frozen 1.8.11 share links (tests/e2e/tiles.spec.js):
// A plays B.
const linked = (): Programs => ({
  ...none(),
  A: [{ t: 'repeat', n: 4, body: [{ t: 'move', d: 50 }, { t: 'turn', a: 90 }] }, { t: 'call', p: 'B' }],
  B: [{ t: 'red' }, { t: 'move', d: -75 }, { t: 'turn', a: -45 }, { t: 'do' }, { t: 'home' }, { t: 'nextcolor' },
    { t: 'invisible' }],
});
const B_LOGO = 'pd setpencolor "red bk 75 lt 45 playnote 60 1 ' + HOME + ' pd setpencolor "rainbow pu';

describe('clean', () => {
  it('keeps a good program as it is', () => {
    const programs = linked();
    expect(clean(programs.A)).toEqual(programs.A);
    expect(clean(programs.B)).toEqual(programs.B);
  });

  it('keeps every fixed tile, by its id alone', () => {
    const plain = TILES.filter(t => t.id !== 'repeat').map(t => ({ t: t.id, extra: 1 }));
    expect(clean(plain)).toEqual(plain.map(({ t }) => ({ t })));
  });

  it('turns old tiles into the tiles they became', () => {
    expect(clean([{ t: 'walk' }, { t: 'far' }, { t: 'hop' }, { t: 'left' }, { t: 'right' }])).toEqual([
      { t: 'move', d: 50 },
      { t: 'move', d: 100 },
      { t: 'penup' }, { t: 'move', d: 50 }, { t: 'pendown' },
      { t: 'turn', a: -90 },
      { t: 'turn', a: 90 },
    ]);
  });

  it('hands out copies of the old tiles', () => {
    const [move] = clean([{ t: 'walk' }]) as [{ t: 'move'; d: number }];
    move.d = 999;
    expect(OLD.walk).toEqual([{ t: 'move', d: 50 }]);
  });

  it('rounds and clamps moves to whole units, 1 to 99, keeping the way they go', () => {
    const d = (value: unknown) => (clean([{ t: 'move', d: value }])[0] as { d: number }).d;
    expect(d(50)).toBe(50);
    expect(d(-75)).toBe(-75);
    expect(d(13)).toBe(UNIT);             // rounds to the nearest unit...
    expect(d(5)).toBe(UNIT);              // ...but never to nothing
    expect(d(-5)).toBe(-UNIT);
    expect(d(10000)).toBe(MAX_UNITS * UNIT);
    expect(d(-10000)).toBe(-MAX_UNITS * UNIT);
    expect(d('75')).toBe(75);             // a number in a string
    expect(d(0)).toBe(2 * UNIT);          // none (or nonsense): two units
    expect(d(undefined)).toBe(2 * UNIT);
    expect(d('far')).toBe(2 * UNIT);
  });

  it('rounds turns to 15 degrees, -165 to 180, and drops turns that come to nothing', () => {
    const a = (value: unknown) => clean([{ t: 'turn', a: value }]).map(i => (i as { a: number }).a);
    expect(a(90)).toEqual([90]);
    expect(a(100)).toEqual([105]);
    expect(a(-45)).toEqual([-45]);
    expect(a(180)).toEqual([180]);
    expect(a(-180)).toEqual([180]);
    expect(a(200)).toEqual([-165]);
    expect(a(450)).toEqual([90]);
    expect(a('30')).toEqual([30]);
    expect(a(360)).toEqual([]);
    expect(a(7)).toEqual([]);
    expect(a(0)).toEqual([]);
    expect(a(undefined)).toEqual([]);
  });

  it('counts a repeat 0 to 99 times, or once if its count makes no sense', () => {
    const n = (value: unknown) => (clean([{ t: 'repeat', n: value, body: [] }])[0] as { n: number }).n;
    expect(n(4)).toBe(4);
    expect(n(0)).toBe(0);
    expect(n(MAX_COUNT)).toBe(MAX_COUNT);
    expect(n(MAX_COUNT + 1)).toBe(1);
    expect(n(-1)).toBe(1);
    expect(n(2.5)).toBe(1);
    expect(n('3')).toBe(1);
    expect(n(undefined)).toBe(1);
  });

  it('cleans what a repeat holds, and drops repeats inside repeats', () => {
    expect(clean([{
      t: 'repeat', n: 3, body: [
        { t: 'left' },
        { t: 'repeat', n: 2, body: [{ t: 'move', d: 25 }] },
        { t: 'move', d: 30 },
        { t: 'nonsense' },
      ],
    }])).toEqual([{ t: 'repeat', n: 3, body: [{ t: 'turn', a: -90 }, { t: 'move', d: 25 }] }]);
    expect(clean([{ t: 'repeat', n: 2, body: 'not a list' }])).toEqual([{ t: 'repeat', n: 2, body: [] }]);
    expect(clean([{ t: 'repeat', n: 2 }], true)).toEqual([]);
  });

  it('keeps calls to programs A to D only', () => {
    expect(clean([{ t: 'call', p: 'D' }, { t: 'call', p: 'E' }, { t: 'call', p: 'a' }, { t: 'call' }]))
      .toEqual([{ t: 'call', p: 'D' }]);
  });

  it('drops tiles it doesn\'t know, keeping the rest', () => {
    expect(clean([null, undefined, 0, 'move', {}, { t: 'jump' }, { t: 'red' }, { t: 'repeatx' }, [], { t: 'do' }]))
      .toEqual([{ t: 'red' }, { t: 'do' }]);
  });

  it('drops tiles named after built-in object keys, keeping the rest', () => {
    expect(clean([{ t: 'constructor' }, { t: 'toString' }, { t: 'hasOwnProperty' }, { t: '__proto__' }, { t: 'penup' }]))
      .toEqual([{ t: 'penup' }]);
  });

  it('makes a program of anything', () => {
    expect(clean(undefined)).toEqual([]);
    expect(clean(null)).toEqual([]);
    expect(clean({ t: 'move' })).toEqual([]);
    expect(clean('[]')).toEqual([]);
  });
});

describe('normalize', () => {
  it('rounds to 15 degrees in -165 to 180', () => {
    expect([0, 15, 22, 23, 180, 181, 190, -170, -180, 360, 720 + 45, -270].map(normalize))
      .toEqual([0, 15, 15, 30, 180, 180, -165, -165, 180, 0, 45, 90]);
  });
});

describe('isName', () => {
  it('knows the programs', () => {
    expect(NAMES.every(isName)).toBe(true);
    expect(['E', 'a', '', null, undefined, 1].some(isName)).toBe(false);
  });
});

describe('tiles', () => {
  it('make moves and turns from their distance and angle', () => {
    expect(tileFor({ t: 'move', d: 75 })).toMatchObject({ id: 'move', label: 'Move 3', code: 'fd 75' });
    expect(tileFor({ t: 'move', d: -50 })).toMatchObject({ id: 'move', label: 'Back 2', code: 'bk 50' });
    expect(tileFor({ t: 'turn', a: 90 })).toMatchObject({ id: 'turn', label: 'Turn right 90', code: 'rt 90' });
    expect(tileFor({ t: 'turn', a: -45 })).toMatchObject({ id: 'turn', label: 'Turn left 45', code: 'lt 45' });
    expect(tileFor({ t: 'turn', a: 180 })).toMatchObject({ label: 'Turn around', code: 'rt 180' });
    expect(tileFor({ t: 'call', p: 'C' })).toMatchObject({ id: 'call', label: 'Play C' });
  });

  it('give each fixed tile its Logo', () => {
    const code = (item: Item) => codeFor(none(), item as Exclude<Item, { t: 'repeat' }>);
    expect(code({ t: 'home' })).toBe(HOME);
    expect(code({ t: 'blue' })).toBe('pd setpencolor "blue');
    expect(code({ t: 'nextcolor' })).toBe('pd setpencolor "rainbow');
    expect(code({ t: 'invisible' })).toBe('pu');
    expect(code({ t: 'penup' })).toBe('pu');
    expect(code({ t: 'pendown' })).toBe('pd');
    expect(code({ t: 'do' })).toBe('playnote 60 1');
    expect(code({ t: 'high-do' })).toBe('playnote 72 1');
  });

  it('leave out the notes when silent', () => {
    expect(codeFor(none(), { t: 'sol' }, true)).toBe('');
    expect(codeFor(none(), { t: 'move', d: 25 }, true)).toBe('fd 25');
  });
});

describe('toLogo', () => {
  it('writes a program on one line, with repeats and the programs it plays in place', () => {
    const programs = linked();
    expect(toLogo(programs, programs.B)).toBe(B_LOGO);
    expect(toLogo(programs, programs.A)).toBe('repeat 4 [fd 50 rt 90] ' + B_LOGO);
  });

  it('leaves out the notes when silent', () => {
    const programs = linked();
    expect(toLogo(programs, programs.A, { silent: true })).toBe('repeat 4 [fd 50 rt 90] ' + B_LOGO.replace('playnote 60 1 ', ''));
    // A repeat of nothing but notes comes to nothing.
    expect(toLogo(none(), [{ t: 'repeat', n: 3, body: [{ t: 'do' }, { t: 're' }] }, { t: 'move', d: 25 }], { silent: true }))
      .toBe('fd 25');
  });

  it('writes a line per tile when pretty, and calls by name when named', () => {
    const programs = linked();
    expect(toLogo(programs, programs.A, { pretty: true, named: true })).toBe('repeat 4 [fd 50 rt 90]\nB');
  });

  it('plays a program that plays nothing as nothing', () => {
    expect(toLogo(none(), [{ t: 'call', p: 'C' }, { t: 'move', d: 25 }])).toBe('fd 25');
  });

  it('stops a loop of programs playing each other', () => {
    const programs = { ...none(), A: [{ t: 'move', d: 25 }, { t: 'call', p: 'B' }], B: [{ t: 'turn', a: 90 }, { t: 'call', p: 'A' }] } as Programs;
    // A plays B, which plays A, which would play B again: there it stops.
    expect(toLogo(programs, programs.A)).toBe('fd 25 rt 90 fd 25');
    expect(codeFor(programs, { t: 'call', p: 'B' })).toBe('rt 90 fd 25');
  });
});

describe('namedLogo', () => {
  it('defines each program played as a word, those it plays first', () => {
    const programs = linked();
    programs.C = [{ t: 'call', p: 'A' }, { t: 'repeat', n: 2, body: [{ t: 'call', p: 'B' }] }];
    expect(namedLogo(programs, 'C')).toBe([
      'to B',
      '  pd setpencolor "red', '  bk 75', '  lt 45', '  playnote 60 1', '  ' + HOME, '  pd setpencolor "rainbow', '  pu',
      'end',
      'to A',
      '  repeat 4 [fd 50 rt 90]', '  B',
      'end',
      'A',
      'repeat 2 [B]',
    ].join('\n'));
  });

  it('is just the tiles for a program that plays none', () => {
    expect(namedLogo(linked(), 'B').split('\n')).toHaveLength(7);
    expect(namedLogo(none(), 'D')).toBe('');
  });
});

describe('stepsOf', () => {
  it('goes through repeats time by time, and into the programs played', () => {
    const programs = linked();
    const steps = stepsOf(programs, programs.A, 'A');
    expect(steps).toHaveLength(4 * 2 + 7);
    const [repeat] = programs.A as [Extract<Item, { t: 'repeat' }>];
    expect(steps[0]).toEqual({ item: repeat.body[0], prog: 'A', repeat, i: 0 });
    expect(steps[7]).toEqual({ item: repeat.body[1], prog: 'A', repeat, i: 3 });
    expect(steps.slice(8).map(s => s.item)).toEqual(programs.B);
    expect(steps.slice(8).every(s => s.prog === 'B' && s.repeat === undefined)).toBe(true);
  });

  it('skips a repeat going round no times, and a program playing itself', () => {
    const programs = { ...none(), A: [{ t: 'repeat', n: 0, body: [{ t: 'do' }] }, { t: 'call', p: 'A' }, { t: 're' }] } as Programs;
    expect(stepsOf(programs, programs.A, 'A').map(s => s.item)).toEqual([{ t: 're' }]);
  });
});

describe('plays', () => {
  it('knows which programs play which, by way of others too', () => {
    const programs = linked();
    programs.C = [{ t: 'repeat', n: 2, body: [{ t: 'call', p: 'A' }] }];
    expect(plays(programs, 'A', 'B')).toBe(true);
    expect(plays(programs, 'C', 'A')).toBe(true);
    expect(plays(programs, 'C', 'B')).toBe(true);   // by way of A
    expect(plays(programs, 'B', 'A')).toBe(false);
    expect(plays(programs, 'A', 'C')).toBe(false);
    expect(plays(programs, 'A', 'A')).toBe(false);
    expect(plays(programs, 'D', 'A')).toBe(false);
  });

  it('finds a loop, and still stops', () => {
    const programs = { ...none(), A: [{ t: 'call', p: 'B' }], B: [{ t: 'call', p: 'C' }], C: [{ t: 'call', p: 'A' }] } as Programs;
    expect(plays(programs, 'A', 'A')).toBe(true);
    expect(plays(programs, 'B', 'B')).toBe(true);
    expect(plays(programs, 'A', 'D')).toBe(false);
  });
});
