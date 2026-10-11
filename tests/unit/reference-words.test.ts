// The reference's reading of Logo source and of its own text
// (src/reference/words.ts): usage lines' command names, a program's
// procedures, what a tooltip shows for a word, the search's matching, and
// the character at a line and column of a <textarea>.
import { describe, expect, it } from 'vitest';
import {
  describe as describeWord, leadingName, offsetAt, procedures, searchMatcher,
} from '../../src/reference/words.js';
import type { CommandInfo } from '../../src/reference/words.js';

// A small reference, as LogoReference.lookup would find it.
const REFERENCE: Record<string, CommandInfo> = {
  forward: { usages: ['forward expr', 'fd expr'], about: 'Moves the turtle forward.', example: 'fd 100' },
  fd: { usages: ['forward expr', 'fd expr'], about: 'Moves the turtle forward.', example: 'fd 100' },
  repeat: { usages: ['repeat expr [ statements ... ]'], about: 'Repeats statements.', example: '' },
};
const lookup = (name: string): CommandInfo | undefined => REFERENCE[name];
// What a tooltip shows for the word at `marker`'s place in `source` (the
// marker, '|', is taken out).
function at(marked: string, context?: string) {
  const offset = marked.indexOf('|');
  return describeWord(marked.replace('|', ''), offset, context, lookup);
}

describe('leadingName', () => {
  it('reads the command a usage line names, lowercase', () => {
    expect(leadingName('forward expr')).toBe('forward');
    expect(leadingName('  SetXY x y')).toBe('setxy');
    expect(leadingName('(sum expr expr ...)')).toBe('sum');
    expect(leadingName('emptyp? thing')).toBe('emptyp?');
    expect(leadingName('turtle.mode')).toBe('turtle.mode');
  });

  it('finds none in punctuation or a quoted word', () => {
    expect(leadingName(' ( ')).toBeNull();
    expect(leadingName('[ ')).toBeNull();
    expect(leadingName('+ ')).toBeNull();
    expect(leadingName('"word')).toBeNull();
    expect(leadingName('')).toBeNull();
  });
});

describe('procedures', () => {
  it('finds each TO line, with its inputs and the comments above it', () => {
    const procs = procedures([
      '; Draws a square',
      ';   of any size.',
      'to Square :size',
      '  repeat 4 [fd :size rt 90]',
      'end',
      '',
      'TO tri :a :b',
      'end',
    ].join('\n'));
    expect([...procs.keys()]).toEqual(['square', 'tri']);
    expect(procs.get('square')).toEqual({
      usage: 'Square :size', about: 'Draws a square of any size.', inputs: [':size'], line: 2,
    });
    expect(procs.get('tri')).toEqual({
      usage: 'tri :a :b', about: 'A procedure defined in this program.', inputs: [':a', ':b'], line: 6,
    });
  });

  it('stops at the first line above that is not a comment', () => {
    const procs = procedures('; not this\nfd 10\n;\n; this\nto box\nend');
    expect(procs.get('box')!.about).toBe('this');
  });

  it('ignores a TO that is not at the start of a line, and later ones win', () => {
    expect(procedures('print "to\nfd 10').size).toBe(0);
    expect(procedures('to a :x\nend\nto A :y\nend').get('a')!.usage).toBe('A :y');
  });
});

describe('describe', () => {
  it('describes a command from the reference, in any case', () => {
    expect(at('rep|eat 4 [fd 10]')).toEqual({
      title: 'repeat', usages: ['repeat expr [ statements ... ]'], about: 'Repeats statements.', example: '',
    });
    expect(at('FD| 10')).toEqual({
      title: 'FD', usages: ['forward expr', 'fd expr'], about: 'Moves the turtle forward.', example: 'fd 100',
    });
  });

  it('describes a procedure the program, or its context, defines', () => {
    const source = '; A box.\nto box :n\nend\nbo|x 5';
    expect(at(source)).toEqual({ title: 'box', usages: ['box :n'], about: 'A box.' });
    expect(at('star| 5', 'to star :size\nend')).toEqual({
      title: 'star', usages: ['star :size'], about: 'A procedure defined in this program.',
    });
  });

  it('prefers a procedure the program defines over the reference', () => {
    expect(at('to fd :x\nend\nf|d 3')).toEqual({
      title: 'fd', usages: ['fd :x'], about: 'A procedure defined in this program.',
    });
  });

  it('names the procedure an input belongs to', () => {
    expect(at('to sq :size\n  fd :si|ze\nend')).toEqual({ title: ':size', usages: [], about: 'An input to sq :size.' });
    expect(at('make "n 5\nprint :|n')).toEqual({
      title: ':n', usages: [], about: 'A variable: the value made with MAKE or LOCAL.',
    });
    // An input of a procedure defined below isn't its input.
    expect(at('print :|x\nto later :x\nend')!.about).toBe('A variable: the value made with MAKE or LOCAL.');
  });

  it('shows nothing for numbers, quoted words, comments, unknown words and spaces', () => {
    expect(at('fd 1|00')).toBeNull();
    expect(at('fd 1.|5')).toBeNull();
    expect(at('print "he|llo')).toBeNull();
    expect(at('fd 10 ; rep|eat')).toBeNull();
    expect(at('frob|nicate')).toBeNull();
    expect(at('fd 10 |  rt 90')).toBeNull();
  });

  it('takes the whole word around the offset, at either end', () => {
    expect(at('|repeat')!.title).toBe('repeat');
    expect(at('repeat|')!.title).toBe('repeat');
  });
});

describe('searchMatcher', () => {
  const all = [['forward', 'fd'], ['fill'], ['for'], ['repeat'], ['setpencolor', 'setpc', 'setcolor']];
  const shown = (q: string) => {
    const shows = searchMatcher(q, all);
    return all.filter(names => shows(names)).map(names => names[0]);
  };

  it('shows everything for an empty search', () => {
    expect(shown('')).toEqual(['forward', 'fill', 'for', 'repeat', 'setpencolor']);
  });

  it('shows the commands with a name that starts with the search', () => {
    expect(shown('f')).toEqual(['forward', 'fill', 'for']);
    expect(shown('setc')).toEqual(['setpencolor']);
    expect(shown('x')).toEqual([]);
  });

  it("shows just the command named, when the search is a command's name", () => {
    expect(shown('for')).toEqual(['for']);
    expect(shown('fd')).toEqual(['forward']);
    expect(shown('setpc')).toEqual(['setpencolor']);
  });
});

describe('offsetAt', () => {
  const text = 'fd 10\n\trt 90\nab';

  it('finds the character at a line and column', () => {
    expect(offsetAt(text, 0, 0, 8)).toBe(0);
    expect(offsetAt(text, 0, 3.9, 8)).toBe(3);
    expect(offsetAt(text, 2, 1.5, 8)).toBe(text.indexOf('ab') + 1);
  });

  it('counts a tab to the next tab stop', () => {
    // The tab fills columns 0-7; "rt" starts at column 8.
    expect(offsetAt(text, 1, 0, 8)).toBe(6);
    expect(offsetAt(text, 1, 7.9, 8)).toBe(6);
    expect(offsetAt(text, 1, 8, 8)).toBe(7);
    expect(offsetAt(text, 1, 4, 4)).toBe(7);
    expect(offsetAt('ab\tc', 0, 3.5, 4)).toBe(2);
    expect(offsetAt('ab\tc', 0, 4, 4)).toBe(3);
  });

  it('finds nothing past a line or the text', () => {
    expect(offsetAt(text, 0, 5, 8)).toBeNull();
    expect(offsetAt(text, 1, 20, 8)).toBeNull();
    expect(offsetAt(text, 3, 0, 8)).toBeNull();
    expect(offsetAt('', 0, 0, 8)).toBeNull();
  });
});
