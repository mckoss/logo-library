// The Playground's saved programs (src/playground/model.ts): reading
// `mckoss.logo.files` (a frozen format, see CONTRACT.md), what
// `mckoss.logo.import` must hold, and the names of programs.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FILES_KEY, IMPORT_KEY, STARTER, isImport, load, names, starterState, uniqueName,
} from '../../src/playground/model.js';
import type { Files } from '../../src/playground/model.js';

// A stand-in for localStorage holding `items`; or, with `blocked`, one
// whose every call throws, as when the browser blocks the page's storage.
function storage(items: Record<string, string>, blocked = false) {
  const check = () => { if (blocked) throw new DOMException('The operation is insecure.', 'SecurityError'); };
  return {
    getItem: (key: string) => { check(); return key in items ? items[key] : null; },
    setItem: (key: string, value: string) => { check(); items[key] = value; },
    removeItem: (key: string) => { check(); delete items[key]; },
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('the storage keys', () => {
  it('are the frozen ones', () => {
    expect(FILES_KEY).toBe('mckoss.logo.files');
    expect(IMPORT_KEY).toBe('mckoss.logo.import');
  });
});

describe('load', () => {
  it('reads what earlier versions saved, unchanged', () => {
    const saved = { files: { 'My First Program': 'repeat 4 [fd 100 rt 90]', Star: 'repeat 5 [fd 100 rt 144]' }, current: 'Star' };
    vi.stubGlobal('localStorage', storage({ [FILES_KEY]: JSON.stringify(saved) }));
    expect(load()).toEqual({ state: saved, stored: true });
  });

  it('reads a saved state with no program open', () => {
    const saved = { files: {}, current: null };
    vi.stubGlobal('localStorage', storage({ [FILES_KEY]: JSON.stringify(saved) }));
    expect(load()).toEqual({ state: saved, stored: true });
  });

  it('finds nothing when nothing is saved', () => {
    vi.stubGlobal('localStorage', storage({}));
    expect(load()).toEqual({ state: null, stored: true });
  });

  it('ignores what isn\'t saved programs', () => {
    for (const text of ['{not json', 'null', '42', '"files"', '{}', '{"files": "fd 100"}', '{"files": null}']) {
      vi.stubGlobal('localStorage', storage({ [FILES_KEY]: text }));
      expect(load(), text).toEqual({ state: null, stored: true });
    }
  });

  it('reports a browser that blocks storage', () => {
    vi.stubGlobal('localStorage', storage({}, true));
    expect(load()).toEqual({ state: null, stored: false });
  });
});

describe('starterState', () => {
  it('is the starter program, open', () => {
    expect(starterState()).toEqual({ files: { 'My First Program': STARTER.code }, current: 'My First Program' });
    expect(STARTER.code).toContain('to square :size');
  });

  it('is new each time', () => {
    const a = starterState();
    a.files.Other = '';
    expect(starterState().files).not.toHaveProperty('Other');
  });
});

describe('isImport', () => {
  it('wants code, as a string', () => {
    expect(isImport({ name: 'Squares', code: 'fd 100' })).toBe(true);
    expect(isImport({ code: '' })).toBe(true);
    expect(isImport({ name: 'Squares' })).toBe(false);
    expect(isImport({ name: 'Squares', code: 42 })).toBe(false);
    expect(isImport(null)).toBe(false);
    expect(isImport('fd 100')).toBe(false);
    expect(isImport(0)).toBe(false);
  });
});

describe('names', () => {
  it('sorts the programs\' names alphabetically, ignoring case', () => {
    const files: Files = { banana: '', Apple: '', cherry: '', apricot: '' };
    expect(names(files)).toEqual(['Apple', 'apricot', 'banana', 'cherry']);
  });

  it('has nothing for no programs', () => {
    expect(names({})).toEqual([]);
  });
});

describe('uniqueName', () => {
  const files: Files = { Untitled: '', 'Untitled 2': '', Star: '', 'Star copy': '' };

  it('keeps a name no program has', () => {
    expect(uniqueName(files, 'Spiral')).toBe('Spiral');
    expect(uniqueName({}, 'Star')).toBe('Star');
  });

  it('numbers a name that\'s taken, from 2', () => {
    expect(uniqueName(files, 'Star')).toBe('Star 2');
    expect(uniqueName(files, 'Star copy')).toBe('Star copy 2');
    expect(uniqueName(files, 'Untitled')).toBe('Untitled 3');
  });

  it('trims the name', () => {
    expect(uniqueName(files, '  Spiral  ')).toBe('Spiral');
    expect(uniqueName(files, ' Star ')).toBe('Star 2');
  });

  it('makes a blank or missing name "Untitled"', () => {
    expect(uniqueName({}, '')).toBe('Untitled');
    expect(uniqueName({}, '   ')).toBe('Untitled');
    expect(uniqueName({}, null)).toBe('Untitled');
    expect(uniqueName({})).toBe('Untitled');
    expect(uniqueName(files, undefined)).toBe('Untitled 3');
  });

  it('matches names exactly, case and all', () => {
    expect(uniqueName(files, 'star')).toBe('star');
  });
});
