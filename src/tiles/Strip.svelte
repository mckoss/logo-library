<!--
  The strip: the program it shows, a tile for each item, as a tape. Its
  tiles wrap onto a second and a third line as it fills, and only then
  does it scroll. A repeat is a box with its count (its head) and its
  tiles; dots (or for big counts a bar) under the count show how far round
  it has gone. The playhead (the tile Play or Step plays next) has a
  dashed outline, the picked item a solid one, the tile playing is lit up,
  and while a tile is dragged a marker shows where it would land. Going to
  another program scrolls the strip, as the program's letter scrolls
  (scroll.ts).

  tiles.ts handles the taps and drags (itemOf and dropAt tell it what's
  where) and draws the tiles' pictures (`face`); this draws the state.
-->
<script lang="ts">
  import { flushSync } from 'svelte';
  import { scrollIn, scrollOut } from './scroll.js';
  import type { Item } from './program.js';
  import type { DropSpot, StripProps } from './strip.svelte.js';

  let { strip, face }: StripProps = $props();

  const DOTS_UP_TO = 8;  // a repeat's progress shows as dots up to here, else as a bar
  const program = $derived(strip.programs[strip.current]);
  let area: HTMLElement;
  let scrolling = $state(0);

  // Each item's element and back, and each list's element (the strip, or
  // a repeat's body).
  const nodes = new Map<Item, Element>();
  const items = new WeakMap<Element, Item>();
  const lists = new WeakMap<Element, Item[]>();
  const owns = (item: Item) => (node: Element) => {
    nodes.set(item, node);
    items.set(node, item);
    return () => { if (nodes.get(item) === node) nodes.delete(item); };
  };
  const holds = (list: Item[]) => (node: Element) => { lists.set(node, list); };

  export function itemOf(node: Element): Item | null {
    return items.get(node) ?? null;
  }
  export function reveal(item: Item | null | undefined) {
    flushSync();
    const node = item && nodes.get(item);
    if (node) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // The strip or a repeat's body under (x, y), and the item nearest
  // there to go before (null for the end). Repeats can't go inside repeats.
  export function dropAt(x: number, y: number, item: Item): DropSpot | null {
    const under = document.elementFromPoint(x, y);
    const stripEl = area.querySelector(':scope > .tt-strip');
    if (!under || !stripEl || !area.contains(under)) return null;
    const container = (item.t !== 'repeat' && under.closest('.tt-repeat-body')) || stripEl;
    const list = lists.get(container);
    if (!list) return null;
    const kids = [...container.children].filter(c => items.has(c) && items.get(c) !== strip.lifted);
    let index = kids.length;
    let best = Infinity;
    kids.forEach((k, i) => {
      const r = k.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const distance = Math.abs(y - (r.top + r.bottom) / 2) * 3 + Math.abs(x - cx);
      if (distance < best) {
        best = distance;
        index = x < cx ? i : i + 1;
      }
    });
    return { list, before: kids[index] ? items.get(kids[index])! : null };
  }
</script>

<!-- A list of items: the strip's, or a repeat's body, with the marker
     where a dragged tile would land. -->
{#snippet tiles(list: Item[])}
  {@const drop = strip.drop?.list === list ? strip.drop : null}
  {#each list as item (item)}
    {@const f = face(item)}
    {#if drop?.before === item}<div class="tt-marker"></div>{/if}
    {#if item.t === 'repeat'}
      {@const at = strip.next?.repeat === item ? strip.next.i! : -1}
      <div class="tt-item tt-repeat" class:tt-open={item === strip.openRepeat}
        class:tt-selected={item === strip.selected} class:tt-lifted={item === strip.lifted}
        role="listitem" {@attach owns(item)}>
        <div class="tt-tile tt-repeat-head" data-tile="repeat" style:--tile-color={f.color}
          role="button" aria-label={f.label} tabindex="0">
          {@html f.icon}
          {#if item.n > DOTS_UP_TO}
            <span class="tt-progress"><span class="tt-progress-fill"
              style:width={at >= 0 ? (100 * (at + 1) / item.n) + '%' : '0'}></span></span>
          {:else}
            <span class="tt-dots">
              {#each { length: item.n }, k}<span class="tt-dot" class:tt-on={k === at}></span>{/each}
            </span>
          {/if}
        </div>
        <div class="tt-repeat-body" {@attach holds(item.body)}>
          {@render tiles(item.body)}
        </div>
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class={f.crayon ? 'tt-tile tt-item tt-crayon-item' : 'tt-tile tt-item'}
        class:tt-selected={item === strip.selected}
        class:tt-next={strip.next?.item === item && strip.active !== item}
        class:tt-active={item === strip.active} class:tt-lifted={item === strip.lifted}
        role="listitem" data-tile={f.id} aria-label={f.label} tabindex="0" style:--tile-color={f.color}
        {@attach owns(item)}>{@html f.icon}</div>
    {/if}
  {/each}
  {#if drop && !drop.before}<div class="tt-marker"></div>{/if}
{/snippet}

<div class="tt-strip-area" class:tt-scrolling={scrolling > 0} bind:this={area}>
  {#key strip.shown}
    <div class="tt-strip" class:tt-empty={!program.length} role="list" aria-label="Program"
      in:scrollIn={{ by: strip.by }} out:scrollOut={{ by: strip.by, rename: ['tt-strip', 'tt-strip-ghost'] }}
      onoutrostart={() => scrolling++} onoutroend={() => scrolling--}
      {@attach holds(program)}>
      {@render tiles(program)}
    </div>
  {/key}
</div>

<style>
  .tt-strip-area {
    position: relative;
    --line: calc(var(--b) * .76 + 6px);  /* a line of the strip: a repeat's height */
    flex: 1;
    box-sizing: border-box;
    min-width: 0;
    max-height: calc(var(--line) * 3 + var(--gap) * 2 + 12px);
    padding: 4px;
    background: #fff;
    border: 2px dashed #d6cfbf;
    border-radius: calc(var(--b) * .22);
    overflow-x: hidden;
    overflow-y: auto;
  }
  :global(.tt-recording) .tt-strip-area { border-color: #e57373; }
  /* (The old strip, scrolling away, is renamed tt-strip-ghost.) */
  .tt-strip, .tt-strip-area > :global(.tt-strip-ghost) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    align-content: flex-start;
    gap: var(--gap) calc(var(--gap) - 1px);
    min-height: var(--line);
  }
  /* Every line as tall as a repeat, so three lines fill the strip exactly. */
  .tt-strip-area > * > .tt-tile { margin: 3px 0; }
  .tt-strip.tt-empty::before {
    content: "";
    box-sizing: border-box;
    width: calc(var(--b) * .72);
    height: calc(var(--b) * .72);
    border: 2px dashed #d6cfbf;
    border-radius: 10px;
  }
  .tt-strip-area .tt-tile { width: calc(var(--b) * .76); height: calc(var(--b) * .76); box-shadow: 0 2px 0 rgba(0, 0, 0, .2); }
  /* The playhead: the tile Play or Step plays next. */
  .tt-strip .tt-tile.tt-next { outline: 3px dashed #2e9d48; outline-offset: 2px; }
  /* The picked tile (or repeat), which recording goes after. */
  .tt-strip .tt-item.tt-selected { outline: 3px solid #3d7fd9; outline-offset: 2px; }
  .tt-tile.tt-active { transform: scale(1.12); box-shadow: 0 0 0 4px #ffd400, 0 3px 0 rgba(0, 0, 0, .2); }
  .tt-lifted { opacity: .25; }
  /* Where a dragged tile would land. */
  .tt-marker {
    flex: none;
    width: 5px;
    height: calc(var(--b) * .76);
    border-radius: 3px;
    background: #ffb000;
  }

  .tt-repeat {
    flex: none;
    max-width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border-radius: calc(var(--b) * .2);
    background: #ffe2b8;
    box-shadow: inset 0 0 0 2px #f08c00;
  }
  .tt-repeat .tt-tile { width: calc(var(--b) * .64); height: calc(var(--b) * .64); }
  .tt-repeat .tt-repeat-head { width: calc(var(--b) * .76); height: calc(var(--b) * .76); }
  .tt-repeat-head { position: relative; }
  .tt-dots {
    position: absolute;
    bottom: 3px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 1px;
  }
  .tt-dot {
    width: clamp(3px, calc(var(--b) * .07), 6px);
    height: clamp(3px, calc(var(--b) * .07), 6px);
    border-radius: 50%;
    background: #fff;
    opacity: .55;
  }
  .tt-dot.tt-on { opacity: 1; box-shadow: 0 0 0 1px #7a4500; }
  /* For big counts, a bar instead of dots. */
  .tt-progress {
    position: absolute;
    bottom: 4px;
    left: 12%;
    right: 12%;
    height: clamp(3px, calc(var(--b) * .07), 6px);
    border-radius: 3px;
    background: rgba(255, 255, 255, .45);
    overflow: hidden;
  }
  .tt-progress-fill { display: block; width: 0; height: 100%; background: #fff; }
  /* An open repeat, taking the tiles being recorded: its box is open at
     the end (and the Repeat button pulses until it's tapped again). */
  .tt-repeat.tt-open { box-shadow: inset 0 0 0 2px #f08c00; border-right: 3px dashed #f08c00; border-radius: calc(var(--b) * .2) 0 0 calc(var(--b) * .2); }
  .tt-repeat-head :global(svg) { margin-bottom: 14%; width: 90%; height: 90%; }
  .tt-repeat-body {
    display: flex;
    flex-wrap: wrap;
    min-width: 0;
    align-items: center;
    gap: 3px;
    min-width: calc(var(--b) * .64);
    min-height: calc(var(--b) * .64);
  }
  .tt-scrolling { overflow: hidden !important; }
</style>
