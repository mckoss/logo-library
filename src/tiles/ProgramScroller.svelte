<!--
  The program the strip shows: its letter on a tile in its color, whose top
  half goes up a program and bottom half down (each marked with a small
  triangle; none above A, none below D). Going to another program scrolls
  the letter, as the strip scrolls (scroll.ts).
-->
<script lang="ts">
  import { NAMES, PROGRAM_COLORS, PROGRAM_INK } from './program.js';
  import { scrollIn, scrollOut } from './scroll.js';
  import type { StripState } from './strip.svelte.js';

  interface Props {
    strip: StripState;
    // Going up (-1) or down (1) a program.
    onstep(by: -1 | 1): void;
  }
  let { strip, onstep }: Props = $props();
  let scrolling = $state(0);
</script>

<div class="tt-button tt-prog" class:tt-scrolling={scrolling > 0} role="group"
  aria-label="Program {strip.current}" data-program={strip.current}
  style:--tile-color={PROGRAM_COLORS[strip.current]}>
  {#key strip.shown}
    <div class="tt-prog-letter" in:scrollIn={{ by: strip.by }} out:scrollOut={{ by: strip.by }}
      onoutrostart={() => scrolling++} onoutroend={() => scrolling--}>
      <svg viewBox="0 0 64 64" aria-hidden="true"><text x="32" y="45" text-anchor="middle"
        font-family="Archivo, sans-serif" font-size="34" font-weight="800"
        fill={PROGRAM_INK[strip.current]}>{strip.current}</text></svg>
    </div>
  {/key}
  <button type="button" class="tt-prog-step tt-prog-up" aria-label="Previous program" title="Previous program"
    hidden={strip.current === NAMES[0]} onclick={() => onstep(-1)}>
    <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 L44 14 H20 Z"/></svg>
  </button>
  <button type="button" class="tt-prog-step tt-prog-down" aria-label="Next program" title="Next program"
    hidden={strip.current === NAMES[NAMES.length - 1]} onclick={() => onstep(1)}>
    <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 60 L44 50 H20 Z"/></svg>
  </button>
</div>

<style>
  .tt-prog {
    position: relative;
    overflow: hidden;
    border-radius: calc(var(--b) * .2);
    box-shadow: 0 3px 0 rgba(0, 0, 0, .2), inset 0 0 0 2px rgba(0, 0, 0, .06);
    cursor: default;
  }
  .tt-prog-letter { display: grid; place-items: center; width: 100%; height: 100%; }
  .tt-prog-letter svg { width: 80%; height: 80%; }
  .tt-prog-step {
    position: absolute;
    left: 0;
    width: 100%;
    height: 50%;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }
  .tt-prog-step[hidden] { display: none; }
  .tt-prog-up { top: 0; }
  .tt-prog-down { bottom: 0; }
  .tt-prog-step svg { position: absolute; left: 0; width: 100%; height: 200%; fill: rgba(0, 0, 0, .45); pointer-events: none; }
  .tt-prog-up svg { top: 0; }
  .tt-prog-down svg { bottom: 0; }
  .tt-prog-step:focus-visible { outline: 3px solid #3b3a36; outline-offset: -3px; }
  .tt-scrolling { overflow: hidden !important; }
</style>
