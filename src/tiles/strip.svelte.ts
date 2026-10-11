/// <reference types="svelte" />
// The strip's state: what tiles.ts and the strip's Svelte components
// (ProgramScroller.svelte, Strip.svelte) share. It's Svelte 5 state
// (runes): the components read it in their markup and redraw what changed
// whenever tiles.ts assigns a field, or changes the programs in place (a
// move's distance, a repeat's count, a tile spliced into a list).
//
// The programs are deeply reactive, so an item read from them is Svelte's
// proxy of the object that was put in, not that object: after putting an
// item into a list, read it back from the list before keeping it (as
// `selected` or `openRepeat`), and compare only items read from here.
import { NAMES, stepsOf } from './program.js';
import type { Item, ProgramName, Programs, RepeatItem, Step } from './program.js';

// Where a dragged item would land: in `list` (the program or a repeat's
// body), before `before` (null for the end).
export interface DropSpot {
  list: Item[];
  before: Item | null;
}

export class StripState {
  // The programs, A to D (replaced in place, never as a whole).
  readonly programs: Programs = $state({ A: [], B: [], C: [], D: [] });
  // The program the strip shows. Going to another makes a new strip (the
  // old one scrolls away): `shown` counts them (the components key their
  // {#key} blocks on it, so going back to a program whose strip is still
  // scrolling away makes it anew), and `by` is which way it went, 1 down
  // (to a later program) or -1 up.
  #current: ProgramName = $state('A');
  shown = $state(0);
  by = 0;
  get current(): ProgramName {
    return this.#current;
  }
  set current(p: ProgramName) {
    if (p === this.#current) return;
    this.by = Math.sign(NAMES.indexOf(p) - NAMES.indexOf(this.#current));
    this.shown++;
    this.#current = p;
  }
  // The program Play and Step go through, which may play others; and the
  // playhead, the next of its steps to play.
  top: ProgramName = $state('A');
  playhead = $state(0);
  // The item picked by tapping it, which recording goes after; the open
  // repeat, which recording goes into; the tile playing; the item being
  // dragged; and where it would land. ($state.raw: kept as they are, the
  // programs' own proxies.)
  selected: Item | null = $state.raw(null);
  openRepeat: RepeatItem | null = $state.raw(null);
  active: Item | null = $state.raw(null);
  lifted: Item | null = $state.raw(null);
  drop: DropSpot | null = $state.raw(null);

  // The tiles Play goes through, one at a time.
  readonly steps: Step[] = $derived(stepsOf(this.programs, this.programs[this.top], this.top));
  // The step at the playhead, if it's in the program the strip shows.
  readonly next: Step | null = $derived.by(() => {
    const step = this.steps[this.playhead];
    return step && step.prog === this.current ? step : null;
  });
}

// How an item looks in the strip (tiles.ts draws the pictures): for a
// repeat, its head.
export interface Face {
  id: string;
  label: string;
  icon: string;
  color: string;
  crayon?: boolean;
}

export interface StripProps {
  strip: StripState;
  face(item: Item): Face;
}
export interface StripExports {
  // The item a strip element shows (null if none).
  itemOf(node: Element): Item | null;
  // Scrolls an item into view in the strip, once it's drawn.
  reveal(item: Item | null | undefined): void;
  // Where `item`, dragged to (x, y), would land; null if not over the strip.
  dropAt(x: number, y: number, item: Item): DropSpot | null;
}
export interface ScrollerProps {
  strip: StripState;
  // Going up (-1) or down (1) a program.
  onstep(by: -1 | 1): void;
}
