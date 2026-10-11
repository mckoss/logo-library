// The Logo language reference: this site's additions (assets/logo/
// reference-site.html) followed by jslogo's own language.html, both built
// into the script bundle as strings. It renders the playground's searchable
// reference, and shows a tooltip for the word under the pointer in any
// Logo program: a command's usage with its input names and what it does, or
// the inputs of a procedure the program defines.
//
// The reading of Logo source (procedures, describe) and the search's
// matching are in words.ts, apart from the page.
import { describe as describeWord, leadingName, offsetAt, searchMatcher } from './words.js';
import type { CommandInfo, WordInfo } from './words.js';

export type { CommandInfo, Procedure, WordInfo } from './words.js';

// Where the pointer is in a program: the program's source and the offset
// of the character under the pointer.
export interface SourceAt {
  source: string;
  offset: number;
}

// Finds where the pointer is in a program from a pointer event, or null
// when it isn't over the program's text.
export type Locator = (e: MouseEvent) => SourceAt | null;

function html(): string {
  const guide = (self.LOGO_REFERENCE_GUIDE || '').match(/<div>([\s\S]*)<\/div>\s*<script/);
  return (self.LOGO_REFERENCE_SITE || '') + (guide ? guide[1] : '');
}

// Short names jslogo accepts that its language.html leaves out: each is
// added as another way to write the command, so the reference (and its
// tooltips) covers every name a program can use. tooltips.spec.js checks
// this against jslogo's source.
const ALIASES: Partial<Record<string, string[]>> = {
  setpencolor: ['setpc', 'setcolor'],
  setpensize: ['setpw', 'setwidth'],
  setbackground: ['setbg'],
};
function addAliases(root: Element): void {
  root.querySelectorAll('dt').forEach(dt => {
    const name = commandName(dt);
    const aliases = name && ALIASES[name];
    if (!aliases || (dt.previousElementSibling && commandName(dt.previousElementSibling) === name)) return;
    let last: Element = dt;
    while (last.nextElementSibling && last.nextElementSibling.tagName === 'DT') last = last.nextElementSibling;
    aliases.slice().reverse().forEach(alias => {
      const copy = dt.cloneNode(true) as HTMLElement;
      // (A <dt> with a name starts with its text, or with a <code> that does.)
      const text = (copy.querySelector('code') || copy).firstChild!;
      text.textContent = text.textContent!.replace(new RegExp('\\b' + name + '\\b', 'i'), alias);
      last.after(copy);
    });
  });
}

// Wraps each command's run of <dt>s and <dd>s in <div class="pg-ref-entry">
// (allowed inside <dl>), so it can be shown, hidden or looked up as one.
function group(root: Element): HTMLElement[] {
  root.querySelectorAll('dl').forEach(dl => {
    let entry: HTMLDivElement | null = null;
    [...dl.children].forEach(node => {
      if (node.tagName === 'DT' && (!entry || entry.lastElementChild!.tagName !== 'DT')) {
        entry = document.createElement('div');
        entry.className = 'pg-ref-entry';
        dl.insertBefore(entry, node);
      }
      if (entry) entry.appendChild(node);
    });
  });
  return [...root.querySelectorAll<HTMLElement>('.pg-ref-entry')];
}

// Fills an element with the reference; returns its entries.
function render(root: Element): HTMLElement[] {
  root.innerHTML = html();
  addAliases(root);
  return group(root);
}

// The command a <dt> documents: its first word, when it starts with a
// name (not an input, like "expr + expr", or a quoted word).
function commandName(dt: Element): string | null {
  const code = dt.querySelector('code') || dt;
  const first = code.firstChild;
  if (!first || first.nodeType !== Node.TEXT_NODE) return null;
  return leadingName(first.textContent!);
}

let index: Map<string, CommandInfo> | null = null;
// The reference's entry for a command, by any of its names (in any case),
// or undefined.
function lookup(name: string): CommandInfo | undefined {
  if (!index) {
    const found = index = new Map<string, CommandInfo>();
    const root = document.createElement('div');
    Object.assign(root, { innerHTML: html() });
    addAliases(root);
    group(root);
    root.querySelectorAll('.pg-ref-entry').forEach(entry => {
      const usages = [...entry.querySelectorAll('dt')].map(dt => dt.textContent.replace(/\s+/g, ' ').trim());
      const about = entry.querySelector('dd:not(.example)');
      const example = entry.querySelector('dd.example');
      const info: CommandInfo = {
        usages,
        about: about ? about.textContent.replace(/\s+/g, ' ').trim() : '',
        example: example ? example.textContent.trim() : '',
      };
      entry.querySelectorAll('dt').forEach(dt => {
        const name = commandName(dt);
        if (name && !found.has(name)) found.set(name, info);
      });
    });
  }
  return index.get(name.toLowerCase());
}

// What to show for the word at `offset` in `source`, or null; `context` is
// other Logo source whose procedures the program can use (see words.ts).
function describe(source: string, offset: number, context?: string | null): WordInfo | null {
  return describeWord(source, offset, context, lookup);
}

// The tooltip shared by the whole page.
let tip: HTMLDivElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | undefined;
function hide(): void {
  clearTimeout(showTimer);
  if (tip) tip.hidden = true;
}
function show(info: WordInfo, x: number, y: number): void {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'logo-tip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    ['scroll', 'keydown', 'pointerdown'].forEach(t => self.addEventListener(t, hide, true));
  }
  tip.textContent = '';
  const usage = document.createElement('div');
  usage.className = 'logo-tip-usage';
  (info.usages.length ? info.usages : [info.title]).forEach(u => {
    const line = document.createElement('code');
    line.textContent = u;
    usage.appendChild(line);
  });
  tip.appendChild(usage);
  if (info.about) {
    const about = document.createElement('p');
    about.textContent = info.about;
    tip.appendChild(about);
  }
  if (info.example) {
    const ex = document.createElement('p');
    ex.className = 'logo-tip-example';
    ex.textContent = 'Example: ' + info.example;
    tip.appendChild(ex);
  }
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(4, Math.min(x + 12, self.innerWidth - w - 4)) + 'px';
  tip.style.top = (y + 18 + h > self.innerHeight ? y - h - 8 : y + 18) + 'px';
}

// Shows tooltips for words in `el`. locate(event) returns {source, offset}
// for the character under the pointer, or null; context() returns other
// Logo source whose procedures the program can use.
function attach(el: HTMLElement, locate: Locator, context?: () => string): void {
  let last: string | null = null;
  el.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const at = locate(e);
    const info = at && describe(at.source, at.offset, context && context());
    const key = info && info.title + '|' + (info.usages[0] || '') + '|' + info.about;
    if (key === last && !tip?.hidden) {
      return;
    }
    last = key;
    hide();
    if (info) showTimer = setTimeout(() => show(info, e.clientX, e.clientY), 300);
  });
  el.addEventListener('pointerleave', () => { last = null; hide(); });
}

// locate() for an element showing code as text (spans allowed): the
// character under the pointer, from the browser's caret hit-testing.
function textLocator(el: Element): Locator {
  return e => {
    let node: Node, offset: number;
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (!pos) return null;
      node = pos.offsetNode; offset = pos.offset;
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (!range) return null;
      node = range.startContainer; offset = range.startOffset;
    } else {
      return null;
    }
    if (!node || node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return null;
    const text = node as Text;
    // Only when the pointer is over the text itself, not past a line's end.
    const range = document.createRange();
    range.setStart(text, Math.max(0, offset - 1));
    range.setEnd(text, Math.min(text.length, offset + 1));
    const hit = [...range.getClientRects()].some(r =>
      e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top && e.clientY <= r.bottom);
    if (!hit) return null;
    let total = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    // (The walker shows only text nodes.)
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      if (n === text) return { source: el.textContent, offset: total + offset };
      total += n.length;
    }
    return null;
  };
}

// locate() for a <textarea> that doesn't wrap lines, in a monospace font:
// the line and column come straight from the pointer position (offsetAt,
// in words.ts, finds the character there).
function textareaLocator(ta: HTMLTextAreaElement): Locator {
  const measure = document.createElement('canvas').getContext('2d')!;
  return e => {
    const style = getComputedStyle(ta);
    const rect = ta.getBoundingClientRect();
    const x = e.clientX - rect.left - parseFloat(style.borderLeftWidth) - parseFloat(style.paddingLeft) + ta.scrollLeft;
    const y = e.clientY - rect.top - parseFloat(style.borderTopWidth) - parseFloat(style.paddingTop) + ta.scrollTop;
    measure.font = style.font;
    const charWidth = measure.measureText('M').width;
    const lineHeight = parseFloat(style.lineHeight);
    if (x < 0 || y < 0 || !charWidth || !lineHeight) return null;
    const tab = parseInt(style.tabSize, 10) || 8;
    const offset = offsetAt(ta.value, Math.floor(y / lineHeight), x / charWidth, tab);
    return offset === null ? null : { source: ta.value, offset };
  };
}

// A searchable reference in `section` (the playground's, or the
// reference page's): typing shows the commands whose names start with
// what's typed, or, when it's exactly a command's name, just that command
// (with its other names). Clicking an example runs it, when there's
// somewhere to run it (`runLine`).
function setup(section: Element | null, runLine?: (line: string) => void): void {
  if (!section) return;
  const body = section.querySelector('.pg-reference-body')!;
  const entries = render(body).map(entry => ({
    entry,
    names: [...entry.querySelectorAll('dt')].map(dt => commandName(dt) || dt.textContent.trim().split(/\s+/)[0].toLowerCase().replace(/^"/, '')),
  }));

  // Is there anything left to show between this heading and the next one
  // of the same or higher level?
  function hasMatches(heading: Element): boolean {
    const stop = heading.tagName === 'H3' ? /^H3$/ : /^H[34]$/;
    for (let n = heading.nextElementSibling; n && !stop.test(n.tagName); n = n.nextElementSibling) {
      if (n.tagName === 'DL' && !(n as HTMLElement).hidden) return true;
    }
    return false;
  }

  const search = section.querySelector<HTMLInputElement>('.pg-reference-search')!;
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    const shows = searchMatcher(q, entries.map(({ names }) => names));
    entries.forEach(({ entry, names }) => {
      entry.hidden = !shows(names);
    });
    body.querySelectorAll('dl').forEach(dl => {
      dl.hidden = Boolean(q) && !dl.querySelector('.pg-ref-entry:not([hidden])');
    });
    [...body.children].forEach(node => {
      if (node.tagName === 'DL') return;
      (node as HTMLElement).hidden = Boolean(q) && !(/^H[34]$/.test(node.tagName) && hasMatches(node));
    });
  });

  if (runLine) {
    body.addEventListener('click', e => {
      const example = (e.target as Element).closest('.example');
      if (example) runLine(example.textContent.trim());
    });
    body.querySelectorAll<HTMLElement>('.example').forEach(ex => { ex.title = 'Click to run this example'; });
  }
}

// (The reference page's <logo-reference> element, element.ts, calls
// setup() on its section.)

const api = { render, lookup, describe, attach, textLocator, textareaLocator, setup };
// LogoReference's type (src/types/lessons-globals.d.ts declares the global).
export type LogoReferenceApi = typeof api;
self.LogoReference = api;
