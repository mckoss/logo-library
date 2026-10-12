// The strip: the program the strip shows, a tile for each item, as a tape.
// Its tiles wrap onto a second and a third line as it fills, and only then
// does it scroll. A repeat is a box with its count (its head) and its
// tiles; dots (or for big counts a bar) under the count show how far round
// it has gone. The playhead (the tile Play or Step plays next) has a dashed
// outline, the picked item a solid one, the tile playing is lit up, an item
// being dragged is faded, and a marker shows where it would land.
//
// render() draws it from the state, keyed by item: each item keeps its
// element from one render to the next (made when it first shows, its
// picture redrawn when it changes, moved when it moves), so a drag, the
// focus, a pop-up's anchor and a tile's bounce stay with it.
import { TILE } from './program.js';
import type { Item, RepeatItem, Step } from './program.js';
import { PICTURED, crayon, lookOf, repeatCount } from './pictures.js';
import type { DropSpot } from './state.js';
import { el, showTile, tileElement } from './dom.js';

const DOTS_UP_TO = 8;  // a repeat's progress shows as dots up to here, else as a bar

// What the strip shows: the program, and the items marked.
export interface StripView {
  program: Item[];
  selected: Item | null;
  openRepeat: RepeatItem | null;
  next: Step | null;
  active: Item | null;
  lifted: Item | null;
  drop: DropSpot | null;
}
// An item's element: for a repeat, its head and body too; and what its
// picture shows.
interface Shown {
  node: HTMLElement;
  head?: HTMLElement;
  body?: HTMLElement;
  drawn: string;
}

// In the strip, a crayon is a colored pencil on a white tile, like the
// Colors button (the white one, Invisible, a white pencil).
const isCrayon = (item: Item) => Boolean(TILE[item.t] && TILE[item.t].group === 'crayons' && item.t !== 'nextcolor');
function faceOf(item: Item) {
  if (!isCrayon(item)) return lookOf(item);
  const def = TILE[item.t];
  return { ...def, color: '#fff', icon: crayon(item.t === 'invisible' ? '#fff' : def.color) };
}
// What an item's picture shows: redrawn when this changes.
const drawing = (item: Item) => (item.t === 'repeat' ? 'repeat ' + item.n : JSON.stringify(item));

export function createStrip(strip: HTMLElement) {
  const shown = new Map<Item, Shown>();
  const itemAt = new WeakMap<Element, Item>();   // an item's element -> the item
  const listAt = new WeakMap<Element, Item[]>();  // the strip or a repeat's body -> its list
  const marker = el('div', 'tt-marker');

  function make(item: Item): Shown {
    let s: Shown;
    if (item.t === 'repeat') {
      const node = el('div', 'tt-item tt-repeat');
      const head = tileElement(PICTURED.repeat, 'tt-repeat-head');
      node.appendChild(head);
      s = { node, head, body: el('div', 'tt-repeat-body', node), drawn: '' };
    } else {
      s = { node: tileElement(faceOf(item), isCrayon(item) ? 'tt-item tt-crayon-item' : 'tt-item'), drawn: '' };
    }
    s.node.setAttribute('role', 'listitem');
    itemAt.set(s.node, item);
    shown.set(item, s);
    return s;
  }

  // A repeat's head: its count, and how far round it has gone, a dot for
  // each time, or for big counts a bar.
  function drawHead(item: RepeatItem, head: HTMLElement) {
    head.innerHTML = repeatCount(item.n);
    head.setAttribute('aria-label', 'Repeat ' + item.n + (item.n === 1 ? ' time' : ' times'));
    if (item.n > DOTS_UP_TO) {
      el('span', 'tt-progress-fill', el('span', 'tt-progress', head));
      return;
    }
    const dots = el('span', 'tt-dots', head);
    for (let i = 0; i < item.n; i++) el('span', 'tt-dot', dots);
  }

  // Brings `item`'s element in line with it and `view`; returns it.
  function update(item: Item, view: StripView, seen: Set<Item>): HTMLElement {
    seen.add(item);
    const s = shown.get(item) || make(item);
    const { node } = s;
    const now = drawing(item);
    if (s.drawn !== now) {
      s.drawn = now;
      if (item.t === 'repeat') drawHead(item, s.head!);
      else showTile(node, faceOf(item));
    }
    node.classList.toggle('tt-selected', item === view.selected);
    node.classList.toggle('tt-lifted', item === view.lifted);
    if (item.t === 'repeat') {
      node.classList.toggle('tt-open', item === view.openRepeat);
      // Which time round it is, while the playhead is in it.
      const at = view.next && view.next.repeat === item ? view.next.i! : -1;
      s.head!.querySelectorAll('.tt-dot').forEach((d, i) => d.classList.toggle('tt-on', i === at));
      const fill = s.head!.querySelector<HTMLElement>('.tt-progress-fill');
      if (fill) fill.style.width = at >= 0 ? (100 * (at + 1) / item.n) + '%' : '0';
      place(s.body!, item.body, view, seen);
    } else {
      node.classList.toggle('tt-next', Boolean(view.next && view.next.item === item) && view.active !== item);
      node.classList.toggle('tt-active', item === view.active);
    }
    return node;
  }

  // Puts `list`'s elements in `container` (the strip, or a repeat's body),
  // in order, with the marker where a dragged item would land: elements
  // already there stay, others move in, and what's no longer in the list
  // leaves.
  function place(container: HTMLElement, list: Item[], view: StripView, seen: Set<Item>) {
    listAt.set(container, list);
    const drop = view.drop && view.drop.list === list ? view.drop : null;
    const want: Element[] = [];
    list.forEach(item => {
      if (drop && drop.before === item) want.push(marker);
      want.push(update(item, view, seen));
    });
    if (drop && (!drop.before || !list.includes(drop.before))) want.push(marker);
    const keep = new Set(want);
    [...container.children].forEach(c => { if (!keep.has(c)) c.remove(); });
    want.forEach((node, i) => {
      if (container.children[i] !== node) container.insertBefore(node, container.children[i] || null);
    });
  }

  return {
    render(view: StripView) {
      const seen = new Set<Item>();
      place(strip, view.program, view, seen);
      strip.classList.toggle('tt-empty', !view.program.length);
      shown.forEach((_, item) => { if (!seen.has(item)) shown.delete(item); });
    },
    // The item an element in the strip shows.
    itemOf: (node: Element): Item | undefined => itemAt.get(node),
    // The element showing `item`, if the strip shows it; and a repeat's
    // head.
    nodeOf: (item: Item | null | undefined): HTMLElement | undefined => (item ? shown.get(item)?.node : undefined),
    headOf: (item: RepeatItem): HTMLElement | undefined => shown.get(item)?.head,
    // Where a dragged item would land at (x, y): the strip or a repeat's
    // body, and the item to go before (null for the end), nearest there.
    // Repeats can't go inside repeats. Null if (x, y) isn't over `area`.
    dropAt(x: number, y: number, moving: Item, lifted: Item | null, area: Element): DropSpot | null {
      const under = document.elementFromPoint(x, y);
      if (!under || !area.contains(under)) return null;
      const container = (moving.t !== 'repeat' && under.closest('.tt-repeat-body')) || strip;
      const list = listAt.get(container);
      if (!list) return null;
      const kids = [...container.children].filter(c => itemAt.has(c) && itemAt.get(c) !== lifted);
      let index = kids.length;
      let best = Infinity;
      kids.forEach((k, i) => {
        const r = k.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        const distanceTo = Math.abs(y - (r.top + r.bottom) / 2) * 3 + Math.abs(x - cx);
        if (distanceTo < best) {
          best = distanceTo;
          index = x < cx ? i : i + 1;
        }
      });
      return { list, before: kids[index] ? itemAt.get(kids[index])! : null };
    },
  };
}
export type StripRenderer = ReturnType<typeof createStrip>;
