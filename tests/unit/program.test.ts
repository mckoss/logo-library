// Reading Logo source (src/engine/program.ts): the TO ... END definitions in
// it, and the complete program for a lesson's example, as "Run" and "Open in
// Playground" use it (LogoStage.definitions and LogoStage.program).
import { describe, expect, it } from 'vitest';
import { definitions, program } from '../../src/engine/program.js';
import type { Example } from '../../src/engine/program.js';

const SQUARE = 'to square :size\n  repeat 4 [fd :size rt 90]\nend';
const TRI = 'to tri :size\n  repeat 3 [fd :size rt 120]\nend';

describe('definitions', () => {
  it('finds each TO ... END, with its name lowercase and its text', () => {
    expect(definitions(SQUARE + '\n\nsquare 50\n' + TRI)).toEqual([
      { name: 'square', text: SQUARE },
      { name: 'tri', text: TRI },
    ]);
  });

  it('reads TO and END in any case, and indented', () => {
    const source = '  TO Star\n    repeat 5 [fd 100 rt 144]\n  END  ';
    expect(definitions(source)).toEqual([{ name: 'star', text: source }]);
  });

  it('finds nothing in plain commands', () => {
    expect(definitions('fd 100 rt 90\nprint "to')).toEqual([]);
  });

  it('leaves out a definition with no END', () => {
    expect(definitions(SQUARE + '\nto unfinished\n  fd 10')).toEqual([{ name: 'square', text: SQUARE }]);
  });

  it('ends a definition only at a line holding just END', () => {
    const source = 'to wiggle\n  print "end\n  fd 10 ; the end\nend';
    expect(definitions(source)).toEqual([{ name: 'wiggle', text: source }]);
  });

  it('takes the name up to the inputs or a bracket', () => {
    expect(definitions('to spiral:size\nend').map(d => d.name)).toEqual(['spiral']);
    expect(definitions('to box[\nend').map(d => d.name)).toEqual(['box']);
  });
});

describe('program', () => {
  const ex = (code: string, run: string | null = null): Example => ({ code, run });

  it('is the example itself when it needs nothing else', () => {
    expect(program([ex('fd 100')], 0)).toBe('fd 100');
    expect(program([ex(SQUARE, 'square 50')], 0)).toBe(SQUARE + '\n\nsquare 50');
  });

  it('adds the procedures it uses from examples above it', () => {
    const examples = [ex(SQUARE), ex(TRI), ex('square 100 tri 50')];
    expect(program(examples, 2)).toBe([SQUARE, TRI, 'square 100 tri 50'].join('\n\n'));
  });

  it('leaves out procedures it doesn\'t use', () => {
    const examples = [ex(SQUARE), ex(TRI), ex('tri 50')];
    expect(program(examples, 2)).toBe(TRI + '\n\ntri 50');
  });

  it('looks at the run command too', () => {
    const examples = [ex(SQUARE), ex('fd 10', 'square 20')];
    expect(program(examples, 1)).toBe(SQUARE + '\n\nfd 10\n\nsquare 20');
  });

  it('adds what those procedures use in turn', () => {
    const flower = 'to flower\n  repeat 12 [square 50 rt 30]\nend';
    const examples = [ex(SQUARE), ex(flower), ex('flower')];
    expect(program(examples, 2)).toBe([SQUARE, flower, 'flower'].join('\n\n'));
  });

  it('prefers the latest definition above it', () => {
    const big = 'to square :size\n  repeat 4 [fd :size * 2 rt 90]\nend';
    const examples = [ex(SQUARE), ex(big), ex('square 10')];
    expect(program(examples, 2)).toBe(big + '\n\nsquare 10');
  });

  it('uses a definition further down only as a last resort', () => {
    const later = 'to square :size\n  repeat 4 [fd :size lt 90]\nend';
    expect(program([ex('square 10'), ex(later)], 0)).toBe(later + '\n\nsquare 10');
    // One above wins over one below.
    expect(program([ex(SQUARE), ex('square 10'), ex(later)], 1)).toBe(SQUARE + '\n\nsquare 10');
  });

  it('uses its own definitions over everyone else\'s', () => {
    const own = 'to square :size\n  fd :size\nend\nsquare 10';
    expect(program([ex(SQUARE), ex(own)], 1)).toBe(own);
  });

  it('ignores words in comments, and matches names in any case', () => {
    expect(program([ex(SQUARE), ex('fd 10 ; not a square')], 1)).toBe('fd 10 ; not a square');
    expect(program([ex(SQUARE), ex('SQUARE 10')], 1)).toBe(SQUARE + '\n\nSQUARE 10');
  });

  it('keeps the definitions in page order', () => {
    const examples = [ex(TRI), ex(SQUARE), ex('square 10 tri 10')];
    expect(program(examples, 2)).toBe([TRI, SQUARE, 'square 10 tri 10'].join('\n\n'));
  });

  it('copes with procedures that call each other', () => {
    const ping = 'to ping :n\n  if :n > 0 [pong :n - 1]\nend';
    const pong = 'to pong :n\n  if :n > 0 [ping :n - 1]\nend';
    expect(program([ex(ping), ex(pong), ex('ping 3')], 2)).toBe([ping, pong, 'ping 3'].join('\n\n'));
  });

  it('leaves out an empty run command', () => {
    expect(program([ex('fd 10', '')], 0)).toBe('fd 10');
    expect(program([{ code: 'fd 10' }], 0)).toBe('fd 10');
  });
});
