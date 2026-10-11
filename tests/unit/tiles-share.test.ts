// Turtle Tiles' share links (src/tiles/share.ts, SHARE-LINKS.md): packing
// programs into a link's payload and back, compressed ("z") and plain
// ("j"), and the links 1.8.11 handed out, which must keep opening.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pack, unpack, SHARE_PARAM } from '../../src/tiles/share.js';
import type { SharePayload } from '../../src/tiles/share.js';
import { NAMES, clean } from '../../src/tiles/program.js';
import type { Programs } from '../../src/tiles/program.js';

// The links frozen from 1.8.11 (OLD_LINKS in tests/e2e/tiles.spec.js; never
// change them): both carry these programs, showing B.
const OLD_LINKS = {
  z: 'zZY3BCoMwEET_Zc4reFBKc6u_UTxEs7RCzMoapUXy78UW00KP-2Z23oZ-UeUQYdCAMKnc1I4zzIYLzHXDnihPbCMIAaYidOKeORtlZRAcTF0m-rC4aADBwpzL1B60t97vircqtYTmR-Bw1L6Dxan-XyyqDJ3kp7uMnI_Aj9iLF81kCOswD51npDalFw',
  j: 'jeyJjdXJyZW50IjoiQiIsInByb2dyYW1zIjp7IkEiOlt7InQiOiJyZXBlYXQiLCJuIjo0LCJib2R5IjpbeyJ0IjoibW92ZSIsImQiOjUwfSx7InQiOiJ0dXJuIiwiYSI6OTB9XX0seyJ0IjoiY2FsbCIsInAiOiJCIn1dLCJCIjpbeyJ0IjoicmVkIn0seyJ0IjoibW92ZSIsImQiOi03NX0seyJ0IjoidHVybiIsImEiOi00NX0seyJ0IjoiZG8ifSx7InQiOiJob21lIn0seyJ0IjoibmV4dGNvbG9yIn0seyJ0IjoiaW52aXNpYmxlIn1dfX0',
};
const OLD_PROGRAMS: Programs = {
  A: [{ t: 'repeat', n: 4, body: [{ t: 'move', d: 50 }, { t: 'turn', a: 90 }] }, { t: 'call', p: 'B' }],
  B: [{ t: 'red' }, { t: 'move', d: -75 }, { t: 'turn', a: -45 }, { t: 'do' }, { t: 'home' }, { t: 'nextcolor' },
    { t: 'invisible' }],
  C: [],
  D: [],
};

// Every program in a link, as Turtle Tiles opens it.
const opened = (data: unknown) => {
  const { programs } = data as { programs?: Record<string, unknown> };
  return Object.fromEntries(NAMES.map(n => [n, clean(programs && programs[n])]));
};

const payload: SharePayload = {
  current: 'C',
  programs: {
    A: [{ t: 'repeat', n: 12, body: [{ t: 'move', d: 2475 }, { t: 'turn', a: -165 }, { t: 'high-do' }] }],
    C: [{ t: 'call', p: 'A' }, { t: 'purple' }, { t: 'move', d: -25 }, { t: 'pendown' }, { t: 'penup' }],
  },
};
const URL_SAFE = /^[A-Za-z0-9_-]*$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('share links', () => {
  it('go in ?p=', () => {
    expect(SHARE_PARAM).toBe('p');
  });

  it('compress the programs ("z"), in URL-safe base64, and open again', async () => {
    const text = await pack(payload);
    expect(text[0]).toBe('z');
    expect(text.slice(1)).toMatch(URL_SAFE);
    expect(await unpack(text)).toEqual(payload);
  });

  it('carry them plain ("j") where the browser can\'t compress, and open again', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const text = await pack(payload);
    expect(text[0]).toBe('j');
    expect(text.slice(1)).toMatch(URL_SAFE);
    expect(JSON.parse(atob(text.slice(1).replace(/-/g, '+').replace(/_/g, '/')))).toEqual(payload);
    vi.unstubAllGlobals();
    expect(await unpack(text)).toEqual(payload);
  });

  it('are shorter compressed', async () => {
    const big: SharePayload = { current: 'A', programs: { A: Array.from({ length: 40 }, () => ({ t: 'move', d: 50 })) } };
    const z = await pack(big);
    vi.stubGlobal('CompressionStream', undefined);
    const j = await pack(big);
    expect(z.length).toBeLessThan(j.length / 4);
  });

  it('use no padding, and - and _ for + and /', async () => {
    // JSON whose base64 has a / in it and needs padding.
    vi.stubGlobal('CompressionStream', undefined);
    const odd = { current: 'A', programs: { A: [{ t: '\u00fb\u00ff\u00fe?' }] } } as unknown as SharePayload;
    const text = await pack(odd);
    expect(text.slice(1)).toMatch(URL_SAFE);
    expect(text.slice(1)).not.toMatch(/[+/=]/);
    expect(await unpack(text)).toEqual(odd);
  });

  it('refuse a payload of another kind', async () => {
    await expect(unpack('x' + OLD_LINKS.j.slice(1))).rejects.toThrow('not a Turtle Tiles link');
  });

  for (const [kind, link] of Object.entries(OLD_LINKS)) {
    it(`from 1.8.11 still open (${kind === 'z' ? 'compressed' : 'plain'})`, async () => {
      const data = await unpack(link);
      expect((data as SharePayload).current).toBe('B');
      expect(opened(data)).toEqual(OLD_PROGRAMS);
    });
  }

  it('made now open as the same programs', async () => {
    const data = { current: 'B' as const, programs: { A: OLD_PROGRAMS.A, B: OLD_PROGRAMS.B } };
    expect(opened(await unpack(await pack(data)))).toEqual(OLD_PROGRAMS);
    // The plain one is the very link 1.8.11 made.
    vi.stubGlobal('CompressionStream', undefined);
    expect(await pack(data)).toBe(OLD_LINKS.j);
  });
});
