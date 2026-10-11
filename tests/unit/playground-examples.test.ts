// The Playground's Examples folder and breakpoints (src/playground/model.ts):
// the lessons' examples made complete programs, without repeats and with
// their made-up names numbered again, and the procedures a program defines.
import { describe, expect, it } from 'vitest';
import { openable, procedureNames } from '../../src/playground/model.js';
import type { LessonData } from '../../src/playground/model.js';

const SQUARE = 'to square :size\n  repeat 4 [fd :size rt 90]\nend';

describe('openable', () => {
  it('keeps each lesson\'s title, page and examples, in order', () => {
    const data: LessonData[] = [
      { lesson: 'Turtle Basics', url: '/logo/turtle/', examples: [
        { name: 'A square', auto: false, code: 'repeat 4 [fd 100 rt 90]', run: '' },
        { name: 'A triangle', auto: false, code: 'repeat 3 [fd 100 rt 120]', run: null },
      ] },
      { lesson: 'Colors', url: '/logo/colors/', examples: [
        { name: 'Red', auto: false, code: 'setpc "red fd 100', run: null },
      ] },
    ];
    expect(openable(data)).toEqual([
      { lesson: 'Turtle Basics', url: '/logo/turtle/', examples: [
        { name: 'A square', auto: false, lesson: 'Turtle Basics', url: '/logo/turtle/', code: 'repeat 4 [fd 100 rt 90]' },
        { name: 'A triangle', auto: false, lesson: 'Turtle Basics', url: '/logo/turtle/', code: 'repeat 3 [fd 100 rt 120]' },
      ] },
      { lesson: 'Colors', url: '/logo/colors/', examples: [
        { name: 'Red', auto: false, lesson: 'Colors', url: '/logo/colors/', code: 'setpc "red fd 100' },
      ] },
    ]);
  });

  it('completes each example with the procedures it uses, and its run command', () => {
    const [lesson] = openable([{ lesson: 'Procedures', url: '/logo/procedures/', examples: [
      { name: 'Square', code: SQUARE, run: 'square 50' },
      { name: 'Squares', code: 'repeat 36 [square 100 rt 10]', run: null },
    ] }]);
    expect(lesson.examples.map(ex => ex.code)).toEqual([
      SQUARE + '\n\nsquare 50',
      SQUARE + '\n\nrepeat 36 [square 100 rt 10]',
    ]);
  });

  it('keeps only the first of examples that come out the same', () => {
    // The definition, then a use of it, which gets the definition: the
    // same program.
    const [lesson] = openable([{ lesson: 'Procedures', url: '/logo/procedures/', examples: [
      { name: 'Square', code: SQUARE, run: 'square 100' },
      { name: 'Using it', code: 'square 100', run: '' },
    ] }]);
    expect(lesson.examples.map(ex => ex.name)).toEqual(['Square']);
  });

  it('numbers made-up names again, after repeats are gone', () => {
    const [lesson] = openable([{ lesson: 'Procedures', url: '/logo/procedures/', examples: [
      { name: 'Example 1', auto: true, code: SQUARE, run: 'square 100' },
      { name: 'Example 2', auto: true, code: 'square 100', run: '' },
      { name: 'Big squares', auto: false, code: 'square 200', run: '' },
      { name: 'Example 3', auto: true, code: 'repeat 36 [square 100 rt 10]', run: '' },
    ] }]);
    expect(lesson.examples.map(ex => ex.name)).toEqual(['Example 1', 'Big squares', 'Example 2']);
  });

  it('names a lesson\'s only example, if its name was made up, after the lesson', () => {
    const lessons = openable([
      { lesson: 'Turtle Basics', url: '/logo/turtle/', examples: [{ name: 'Example 1', auto: true, code: 'fd 100', run: '' }] },
      { lesson: 'Colors', url: '/logo/colors/', examples: [{ name: 'Red', auto: false, code: 'setpc "red', run: '' }] },
    ]);
    expect(lessons.map(l => l.examples[0].name)).toEqual(['Turtle Basics', 'Red']);
  });

  it('has nothing for no lessons', () => {
    expect(openable([])).toEqual([]);
  });
});

describe('procedureNames', () => {
  it('finds each TO line\'s procedure, lowercase, once, in order', () => {
    const source = SQUARE + '\n\nTO Star :size\n  repeat 5 [fd :size rt 144]\nEND\n\n  to square\nend\nsquare 10';
    expect(procedureNames(source)).toEqual(['square', 'star']);
  });

  it('ignores words that only start like TO, and names cut short by brackets', () => {
    expect(procedureNames('toward 10\ntotal\nto tri[x]\nend')).toEqual(['tri']);
  });

  it('finds nothing in a program without procedures', () => {
    expect(procedureNames('repeat 4 [fd 100 rt 90]')).toEqual([]);
    expect(procedureNames('')).toEqual([]);
  });
});
