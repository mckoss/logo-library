// Turtle Tiles' share links: a link that carries the programs is ?p= and
// then "z" and the programs as JSON, compressed (raw deflate) and in
// URL-safe base64; or "j" and the JSON uncompressed, in a browser that
// can't compress. Links are out in the world: every version must still open
// old ones (see SHARE-LINKS.md), so change the format only by adding. No
// page needed (Node has CompressionStream too), so the unit tests run them.
import type { ProgramName, Programs } from './program.js';

export const SHARE_PARAM = 'p';

// What a link carries: the program to show, and the programs that have
// tiles.
export interface SharePayload {
  current: ProgramName;
  programs: Partial<Programs>;
}
// A payload as a link brings it, which could be anything: clean() makes
// sense of its programs, and a `current` that isn't a program shows A.
export interface IncomingPayload {
  current?: unknown;
  programs?: Partial<Record<ProgramName, unknown>>;
}

const toBase64 = (bytes: Uint8Array): string => {
  let text = '';
  bytes.forEach(b => { text += String.fromCharCode(b); });
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const through = (bytes: Uint8Array<ArrayBuffer> | ArrayBuffer, stream: CompressionStream | DecompressionStream) =>
  new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
// A link's payload (what follows ?p=) for `data`.
export async function pack(data: SharePayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  if (!globalThis.CompressionStream) return 'j' + toBase64(bytes);
  return 'z' + toBase64(new Uint8Array(await through(bytes, new CompressionStream('deflate-raw'))));
}
// The data in a link's payload, parsed but unchecked; throws if it isn't
// one.
export async function unpack(text: string): Promise<unknown> {
  let bytes: Uint8Array<ArrayBuffer> | ArrayBuffer = fromBase64(text.slice(1));
  if (text[0] === 'z') bytes = await through(bytes, new DecompressionStream('deflate-raw'));
  else if (text[0] !== 'j') throw new Error('not a Turtle Tiles link');
  return JSON.parse(new TextDecoder().decode(bytes));
}
