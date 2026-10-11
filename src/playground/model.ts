// The Playground's data, apart from its page (playground.ts): the programs
// saved in this browser, their names, the Examples folder, and the
// procedures a program defines. Side-effect free, so the unit tests can
// check it without a page.
import { program } from '../engine/program.js';
import { storageKey } from '../engine/host.js';

// The localStorage keys the Playground uses. Their formats are frozen (see
// CONTRACT.md, "Saved in the browser"): newer versions must read what older
// ones wrote. (A page can prefix them: see storageKey.)
export const FILES_KEY = storageKey('mckoss.logo.files');
export const IMPORT_KEY = storageKey('mckoss.logo.import');

// The programs, by name: each one's code.
export type Files = Record<string, string>;

// What `mckoss.logo.files` holds: the programs, and the name of the open
// one (null when there are none), like
//   {"files": {"My First Program": "repeat 36 [...]"}, "current": "My First Program"}
export interface SavedFiles {
  files: Files;
  current: string | null;
}

// What `mckoss.logo.import` holds: a program a lesson's "Open in
// Playground" button hands over, like {"name": "Squares", "code": "..."}.
// Only `code` is checked; a missing name becomes "Untitled".
export interface ImportedProgram {
  name?: string | null;
  code: string;
}

// The program a new visitor starts with.
export const STARTER = {
  name: 'My First Program',
  code: [
    '; Click Run to try this program, then change it!',
    '',
    'to square :size',
    '  repeat 4 [fd :size rt 90]',
    'end',
    '',
    'repeat 36 [square 100 rt 10]',
  ].join('\n'),
};

// The saved programs, if any (`state`), and whether this browser lets the
// page use its storage (`stored`). Only `files` is checked, as it always
// was; `current` is checked when it's opened.
export function load(): { state: SavedFiles | null; stored: boolean } {
  try {
    // (Nothing saved reads as null, which parses as null.)
    const saved = JSON.parse(localStorage.getItem(FILES_KEY) ?? 'null') as Partial<SavedFiles> | null;
    if (saved && saved.files && typeof saved.files === 'object') return { state: saved as SavedFiles, stored: true };
  } catch (e) {
    try { localStorage.getItem(FILES_KEY); } catch (e2) { return { state: null, stored: false }; }
  }
  return { state: null, stored: true };
}

// The programs to start with when none are saved: just the starter.
export const starterState = (): SavedFiles => ({ files: { [STARTER.name]: STARTER.code }, current: STARTER.name });

// Whether what `mckoss.logo.import` held (parsed) is a program to open.
export function isImport(item: unknown): item is ImportedProgram {
  return Boolean(item) && typeof (item as { code?: unknown }).code === 'string';
}

// The programs' names, in alphabetical order (ignoring case).
export function names(files: Files): string[] {
  return Object.keys(files).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

// `base` (trimmed; "Untitled" if blank) if no program has that name yet,
// else the first of "base 2", "base 3"... that's free.
export function uniqueName(files: Files, base?: string | null): string {
  base = (base || 'Untitled').trim() || 'Untitled';
  if (!(base in files)) return base;
  for (let n = 2; ; n++) {
    const name = base + ' ' + n;
    if (!(name in files)) return name;
  }
}

// An example as the page lists it (in its <script class="pg-examples-data">):
// its name, whether that name was made up (`auto`), its code, and a command
// to run after it ("" or null for none).
export interface ExampleData {
  name: string;
  auto?: boolean;
  code: string;
  run?: string | null;
}

// A lesson in the Examples folder, as the page lists it: its title, its
// page and its examples, like
//   [{"lesson": "Turtle Basics", "url": "/logo/turtle/",
//     "examples": [{"name": "Example 1", "auto": true, "code": "fd 100", "run": ""}]}]
export interface LessonData {
  lesson: string;
  url: string;
  examples: ExampleData[];
}

// An example the Playground can open (read-only): its name, the lesson it's
// from, and its complete program (see openable).
export interface OpenExample {
  name: string;
  auto?: boolean;
  lesson: string;
  url: string;
  code: string;
}

// A lesson in the Examples folder, with its examples ready to open.
export interface Lesson {
  lesson: string;
  url: string;
  examples: OpenExample[];
}

// The lessons with their examples made complete programs (each with the
// procedures it uses from the lesson's other examples, and its run
// command; see LogoStage.program). Completing an example can make it the
// same program as one before it (a word's definition, then a use of it
// that gets the definition): only the first is kept, and the made-up names
// are numbered again.
export function openable(lessons: LessonData[]): Lesson[] {
  return lessons.map(lesson => {
    const seen = new Set<string>();
    const examples: OpenExample[] = lesson.examples.map((ex, i) => ({
      name: ex.name, auto: ex.auto, lesson: lesson.lesson, url: lesson.url,
      code: program(lesson.examples, i),
    })).filter(ex => !seen.has(ex.code) && seen.add(ex.code));
    const autos = examples.filter(ex => ex.auto);
    autos.forEach((ex, i) => {
      ex.name = examples.length === 1 ? lesson.lesson : 'Example ' + (i + 1);
    });
    return { ...lesson, examples };
  });
}

// The procedures a program defines (TO lines), lowercase, each once, in
// order: the ones the debugger offers breakpoints for.
export function procedureNames(source: string): string[] {
  return [...new Set((source.match(/^\s*to\s+[^\s\[\]():"]+/gim) || [])
    .map(line => line.trim().split(/\s+/)[1].toLowerCase()))];
}
