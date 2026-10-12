# Svelte spike: Turtle Tiles' strip and program scroller

Step 4 of [PLAN.md](PLAN.md). The strip and the program scroller of Turtle
Tiles are rebuilt as Svelte 5 components (runes), mounted from inside the
existing `<turtle-tiles>` code. The rest of `tiles.ts` stays as it was. This
note compares the two versions and recommends what to do in step 5.

Both versions are TypeScript, and both are fully type-checked. The choice is
between Svelte components (`<script lang="ts">` with typed props, markup
checked by `svelte-check`) and hand-written TypeScript DOM code. The repo
stays on TypeScript 7 for every `.ts` file; `svelte-check` runs on its own
TypeScript 6 until it supports 7 (see "Type checking").

**Result:** the slice works with no visible change and no test changes. All
126 unit tests and all 194 e2e tests pass, including every Tiles test and
the frozen 1.8.11 share links. The strip's state handling is clearly
cleaner, and with `svelte-check` the components are checked as strictly as
the rest. But the slice isn't any smaller, the Tiles entry's JavaScript
doubles (+17.8 kB gzipped), checking it needs a second TypeScript, and
Svelte adds new ways to get it wrong. **Recommendation: don't port the rest
of Tiles to Svelte. Take step 5's other branch: TypeScript with a single
state object and one render pass, reusing the state shape this spike
found** (details at the end).

## What was built

| File | What |
| --- | --- |
| `src/tiles/strip.svelte.ts` | `StripState`, the explicit interface between `tiles.ts` and the components. It holds `programs` (deep `$state`), `current`, `top`, `playhead`, `selected`, `openRepeat`, `active`, `lifted` and `drop` (`$state.raw`), plus the derived `steps` and `next`. |
| `src/tiles/Strip.svelte` | The strip (its props typed in its own `<script lang="ts">`): a keyed `{#each}` of items, repeats with their heads (count, dots or bar) and bodies (a recursive snippet), and the playhead, picked, active, lifted, open-repeat and drop-marker states, all derived from `StripState`. It exports `itemOf(node)`, `reveal(item)` and `dropAt(x, y, item)` for `tiles.ts`'s pointer code, and has scoped CSS. |
| `src/tiles/ProgramScroller.svelte` | The A–D letter with its up and down triangles, and scoped CSS. |
| `src/tiles/scroll.ts` | The scroll between programs as Svelte `in:`/`out:` transitions on a `{#key}` block. It replaces the clone-and-slide. |
| `tools/svelte-check/` | A small private package with its own `svelte-check` 4.7.6, TypeScript 6.0.3, `svelte2tsx` 0.7.61 and `svelte` 5.57.1, plus `emit-types.mjs`, which generates the components' declarations for `tsc` (see "Type checking"). |
| `src/tiles/tiles.ts` | Mounts both components into `.tt-strip-row` with `mount()` (PLAN's decision #4: no custom-element mode). It talks to the strip only through `StripState`, a `face(item)` callback (the tile pictures stay in `tiles.ts`) and the three exports. |
| `src/tiles/program.ts` | `PROGRAM_INK` moved here from `tiles.ts`, so the scroller can use it. |
| `src/styles/tiles.css` | The strip, repeat and scroller rules moved out into the components. |
| `package.json`, `vite.config.js`, `tsconfig.json` | `svelte` 5.57.1 and `@sveltejs/vite-plugin-svelte` 7.3.1 (published 2026-09-18 and 09-23; peers Vite ^8 and Svelte ^5.46), and `svelte()` in the plugins. TypeScript stays 7.0.2. A `prepare` script installs `tools/svelte-check`, and `typecheck` runs it, then `tsc`. `tsconfig.json` gains `rootDirs` for the generated declarations. jslogo's eval-safe minify settings are untouched. |

Persisted formats are unchanged. `save()` and Share a link still
`JSON.stringify` the programs; they're Svelte proxies now, which serialize to
the same keys in the same order. The frozen-link and localStorage tests pass
as they are. Roles, labels, classes and `data-` attributes are as before,
and the DOM is light DOM throughout.

## Lines of code

Code lines here means non-blank, non-comment lines.

| | Before (main) | After |
| --- | --- | --- |
| `tiles.ts` | 1,924 lines (1,518 code) | 1,743 lines (1,349 code): **−169 code** |
| New TS and Svelte logic | none | `Strip.svelte` 98 (script 51, markup 47), `ProgramScroller.svelte` 29, `strip.svelte.ts` 40, `scroll.ts` 34: **+201 code** |
| Type-checking tooling | none | `tools/svelte-check/emit-types.mjs` 29, its `package.json`, 3 lines of `tsconfig.json` |
| CSS for the slice | about 125 lines in `tiles.css` | about 127 lines in the components' `<style>` (moved, nearly verbatim) |

**Net: about +32 code lines for the slice (+2%), plus the checking tooling.** The imperative DOM code
went away, and declarations, the explicit interface and glue replaced it.

What went from `tiles.ts`, with lines on main (including comments):

| Removed or shrunk | Main | Now |
| --- | --- | --- |
| Building the strip row: letter, arrows, strip area and strip | 22 | 6 (two `mount()` calls) |
| `progIcon` and the arrow click handlers | 13 | 10 (`goTo`) |
| `showProgram` (with the `scrolls` flag) | 22 | 10 |
| `snapshot`, `still`, `scroll` (the clone-and-slide) | 31 | 0 (`scroll.ts`, 50 lines) |
| The `itemOf`, `elementOf` and `bodyOf` maps | 3 | 0 (in `Strip.svelte`) |
| `progress`, `showCount` | 18 | 0 (markup) |
| `itemElement` | 25 | 15 (`faceOf`: pictures only) |
| `select` and the selection state | 18 | 13 |
| `showPlayhead` | 25 | 5 (plus 3 lines of comment) |
| `render` | 8 | 0 |
| `openCount`, `openMove`, `openTurn` (the spinner's `set`) | 40 | 30 |
| `dropTarget`, `showMarker` | 34 | 0 (`dropAt` in `Strip.svelte`, 24) |
| `playStep`, `changed`, `tapSource`, `tapItem`, `startDrag` | 139 | 133 |

## Bundle size

The Tiles entry and what it loads, measured from `manifest.json`, gzip -9:

| | Before | After | Change |
| --- | --- | --- | --- |
| `tiles-*.js` (entry) | 48,922 B / **16,688 gz** | 101,415 B / **34,470 gz** | +52.5 kB / **+17.8 kB gz (×2.07)** |
| `tiles-*.css` | 14,969 B / 3,714 gz | 15,785 B / 3,809 gz | +0.8 kB / +0.1 kB gz |
| `engine-*.js` (shared) | 83,210 B / 25,451 gz | unchanged (same hash) | 0 |
| **Total for the Tiles page** | 147,101 B / **45,853 gz** | 200,410 B / **63,730 gz** | **+39 % gz** |

What's in the new entry chunk, from its sourcemap (minified bytes; gzip
measured for each part on its own):

| Part | Raw | gz alone |
| --- | --- | --- |
| Svelte runtime (`node_modules/svelte`: batch, each, effects, boundary, transitions, proxy…) | 48.2 kB | 16.7 kB |
| Tiles' own code (`tiles.ts`, `program.ts`, `share.ts`, element, entry) | 44.5 kB (was 48.9) | 15.1 kB |
| Compiled components | 5.4 kB | 2.1 kB |
| `strip.svelte.ts` + `scroll.ts` | 2.5 kB | 1.0 kB |

So the Svelte runtime is **about half of the new entry** (48% raw). The
app's own code for the slice grew a little (−4.4 kB of `tiles.ts`, +7.9 kB
of compiled components and state), because compiled templates are wordier
than the hand-written DOM calls. The runtime is mostly a fixed cost: porting
more of Tiles would add little more of it. It lands only in the Tiles chunk.
Lessons, Playground, Reference and the engine chunk are byte-identical (same
hashes). jslogo's `keepNames` minify setting also applies to the Svelte
runtime; I didn't measure how much that costs.

## Clarity: where state-sync bugs could hide

**Before:** the strip was rebuilt from scratch by `render()` on every change,
and its marks were patched in afterwards by walking the DOM. Each mark had
its own path, and each had to be called at the right moments:

```ts
function render() {
  elementOf.clear();
  strip.textContent = '';
  program.forEach(item => strip.appendChild(itemElement(item)));
  strip.classList.toggle('tt-empty', !program.length);
  select(selected && placeOf(selected) ? selected : null, selectedInto);
  showPlayhead();
}
function showPlayhead() {
  root.querySelectorAll('.tt-next, .tt-dot.tt-on').forEach(n => n.classList.remove('tt-next', 'tt-on'));
  root.querySelectorAll<HTMLElement>('.tt-progress-fill').forEach(f => { f.style.width = '0'; });
  ...                       // find the step, maybe switch program and return,
  node.classList.add('tt-next'); dotEls[i].classList.add('tt-on'); fill.style.width = ...;
}
```

- **Stale element references.** Because `render()` replaces every element,
  anything holding one can go stale. The spinner's `set` had to re-find the
  repeat head and re-point the pop-up's anchor:

  ```ts
  set(n) {
    item.n = n;
    const node = elementOf.get(item)!.querySelector<HTMLElement>('.tt-repeat-head')!;
    showCount(item, node);
    popups.count.btn = node;
    edited();
  }
  ```

  `openMove` and `openTurn` patched `innerHTML`, `aria-label` and
  `--tile-color` by hand, which duplicated `itemElement`.
- **Hand-maintained maps.** `elementOf`, `itemOf` and `bodyOf` had to be
  rebuilt in step with every render.
- **Marks set in the wrong order.** `playStep` removed `tt-next` and added
  `tt-active` by hand, then relied on `showPlayhead` to put things back.
  `tt-open` was set only at render time.

**After:** the strip is a function of `StripState`. Each mark is one
expression, evaluated by Svelte whenever its inputs change:

```svelte
<div class={f.crayon ? 'tt-tile tt-item tt-crayon-item' : 'tt-tile tt-item'}
  class:tt-selected={item === strip.selected}
  class:tt-next={strip.next?.item === item && strip.active !== item}
  class:tt-active={item === strip.active} class:tt-lifted={item === strip.lifted}
  role="listitem" data-tile={f.id} aria-label={f.label} tabindex="0" style:--tile-color={f.color}
  {@attach owns(item)}>{@html f.icon}</div>
```

- `render`, the three maps' upkeep, `progress` and `showCount` are gone.
  `select` is two assignments.
- `showPlayhead` only follows the playhead into another program. The marks
  come from the derived `strip.next`.
- The spinner's `set` is `item.n = n; edited();`. The keyed `{#each}` keeps
  each element alive, so the pop-up's anchor never goes stale.
- `playStep` is `strip.active = step.item; await …; strip.active = null`.

**New hazards that come with Svelte:**

- **Proxy identity.** Deep `$state` hands back a proxy, not the object you
  put in. `tiles.ts` compares items by identity everywhere (`selected`,
  `openRepeat`, `indexOf`, `includes`), so an item must be read back from its
  list after it's inserted. Forgetting this fails silently: the picked tile
  isn't outlined, or `indexOf` returns −1. There are two such places today:

  ```ts
  list.splice(at, 0, item);
  shown = list[at];  // (the strip's own: see strip.svelte.ts)
  ```

  Porting the rest of Tiles would spread this rule across all of its state.
- **Asynchronous DOM.** Svelte updates the DOM in a microtask. Imperative
  code that measures the DOM right after a state change needs `flushSync()`.
  `reveal()` (scroll the new tile into view) does this. The pop-up
  positioning, the drag hit-testing and the stage's ResizeObserver happened
  not to need it.
- **A key block resumes outgoing content.** Going back to a program whose
  strip was still scrolling away reused that outgoing strip, renamed ghost
  and all, so the strip was empty. Two tests caught it (Share a link and the
  1.8.11 links). The fix keys the `{#key}` on a counter (`strip.shown`),
  which the `current` setter bumps. It's a subtle library behavior to know
  about.
- **Sync pairs that remain.** The Repeat button's pulsing `tt-open` (outside
  the slice) still mirrors `strip.openRepeat` by hand. `tiles.ts` keeps a
  local `program` alias that `showProgram` re-points.

## Animations

**Program scroll.** The clone-and-slide is replaced by a `{#key}` block with
`in:`/`out:` transitions (`scroll.ts`): the same 280 ms, and `sineInOut` in
place of CSS `ease-in-out`. The transitions are deferred until both strips
are in the DOM, so the box has its new height. The look is the same:
[before](spike/scroll-before.png) and [after](spike/scroll-after.png) show
frames 45 ms apart, with animations slowed ten times through CDP. The first
and last frames are pixel-identical. The middle frames differ by 3–6% of
pixels, because of capture timing and the slightly different easing. Svelte
didn't remove the DOM tricks: the outgoing element still has to be laid over
the new one (absolute position), renamed to `tt-strip-ghost` (so the
`.tt-strip > .tt-item` tests see only the new program's items, as before),
hidden with `aria-hidden` and `inert`, and the box given `overflow: hidden`
while it scrolls. `scroll.ts` (34 code lines) is a little bigger than the
`snapshot`, `scroll` and `still` code it replaces (about 27 code lines). The reduced
motion preference is still honored.

**Strip states.** Five states compare pixel-identical between the two
builds: stepping inside a repeat (dots), a 12× repeat's bar, a picked tile
with an open repeat while recording, mid-drag with the marker, and after a
drop.

**`animate:flip` (tried, then removed).** Keyed `{#each}` with `animate:flip`
(160 ms) worked: after a drop or an insertion, the other tiles slide to
their new places ([frames](spike/flip-drop.png)). The dropped tile flies
from its old spot, behind the others. I dropped it for three reasons:

1. It's a behavior change a user would notice, which this spike wasn't
   meant to make.
2. It made "tiles can be dragged into the strip, moved…" flaky: 2 failures
   in 16 runs, against 0 in 24 without it. Tiles keep moving for 160 ms
   after the DOM settles, so the test's next drag sometimes starts where a
   tile used to be. A child chasing a sliding tile would meet the same
   thing.
3. `animate:` requires each keyed item to be a single element. That forced
   repeats and tiles into one element with conditional attributes, and the
   drop marker (which can't sit inside the `{#each}`) to be placed with flex
   `order`. Without flip, the template has plain `{#if}` branches and an
   inline marker.

## Effort and friction

- **Effort:** about half a day of agent time: setup and baseline (about
  20 min), the components and the `tiles.ts` edits (about 2 h), and finding
  and fixing the key-block resume and the flip flakiness (about 1 h).
- **Tooling:** the Svelte 5.57 and vite-plugin-svelte 7.3 setup worked on
  Vite 8.3 with no configuration (it logs "no Svelte config found"). Vitest
  and the jslogo build settings were unaffected. The Svelte runtime went
  into the Tiles chunk without changing `codeSplitting`.
- **Types:** see "Type checking" below. In short, the components are now
  checked as strictly as the `.ts` code, at the cost of a second, isolated
  TypeScript (6) just for `svelte-check`.
- **Light DOM and custom elements:** no problems. `mount(Component, {
  target })` from the existing element's code works, and scoped styles work
  in light DOM. Svelte 5 adds the scoping class once per selector (later
  ones in `:where()`), so each rule gains exactly (0,1,0). That keeps their
  order against the remaining global rules (`.tt-tile`, the white tiles,
  `.tt-active` against the strip's sizing). The old strip, renamed while it
  scrolls away, needs a `:global(.tt-strip-ghost)` selector, or Svelte
  prunes the rule. Cloning a Svelte-owned element for the drag ghost is fine.
- **jslogo globals:** not involved. The engine is untouched, and the strip
  never touches `self.LogoStage` or `self.LogoMusic`.
- **Testing:** **no test was changed.** Every selector the tests use
  (`.tt-strip > .tt-item`, `.tt-repeat-head`, `.tt-dot`,
  `.tt-progress-fill`'s `style.width`, `.tt-next`, `.tt-selected`,
  `.tt-active`, `.tt-strip-ghost`, `.tt-prog`'s `aria-label`, the arrows'
  names) still holds. The full suite and three more runs of the Tiles and
  standalone specs all pass.

## Type checking

`svelte-check` 4.7.6 supports TypeScript ^5 and ^6 only. TypeScript 7 is the
native compiler, with no JS API for it to drive. The repo keeps TypeScript
7.0.2 for all `.ts` code, and `svelte-check` gets its own TypeScript 6:

- **`tools/svelte-check/`** is a private package with its own lockfile:
  `svelte-check` 4.7.6, `typescript` 6.0.3, `svelte2tsx` 0.7.61 and
  `svelte` 5.57.1, all published at least two weeks ago. Node resolves
  `svelte-check`'s `require('typescript')` to that package's own
  TypeScript 6, so the root `typescript` stays 7.0.2 for everything else.
  An npm alias (`"typescript6": "npm:typescript@6"`) can't work, because
  `svelte-check` requires the name `typescript`. A workspace would likely hoist
  `svelte-check` next to TypeScript 7. The root's `prepare` script
  (`npm ci --prefix tools/svelte-check`) installs it, so CI's plain `npm ci`
  and `npm run typecheck` work unchanged. `prepare` doesn't run for the
  site's tarball install, and `files: ["dist"]` keeps `tools/` out of the
  package.
- **`npm run typecheck`** runs `svelte-check --tsconfig ./tsconfig.json
  --fail-on-warnings` (TypeScript 6, with the same strict tsconfig). It
  checks every `.svelte` file (script and markup) and, along the way, every
  `.ts` file. Then `emit-types.mjs` regenerates the declarations, and
  `tsc --noEmit` (TypeScript 7) checks every `.ts` file.
- **No hand-written shims.** `tsc` can't read `.svelte` files, so
  `import Strip from './Strip.svelte'` needs a declaration. `emit-types.mjs`
  generates one per component with `svelte2tsx`'s `emitDts` into the
  git-ignored `.svelte-types/src/tiles/Strip.svelte.d.ts` (props and
  exports, taken from the component). The `rootDirs` setting in
  `tsconfig.json` makes the import find it. Only the components'
  declarations are kept: a generated `strip.svelte.d.ts` would be a second
  `StripState`, which TypeScript rejects because of its `#private` field.
  The declarations are regenerated on every typecheck, so they can't drift.
  The props interfaces moved into the components themselves, and the
  hand-written `Strip.svelte.d.ts` and `ProgramScroller.svelte.d.ts` are
  deleted.
- **Proof that it catches errors.** Each of these was introduced
  temporarily, failed `npm run typecheck`, and was reverted:
  - (a) A wrong prop type from `tiles.ts`, `face: 42`:
    `tiles.ts:459:70 Error: Type 'number' is not assignable to type '(item: Item) => Face'.`
  - (b) A type error in `Strip.svelte`'s script, `const shownCount: number = strip.current;`:
    `Strip.svelte:30:9 Error: Type 'string' is not assignable to type 'number'.`
    It also gave a Svelte warning: "This reference only captures the
    initial value of `strip`".
  - (c) Misuse of `StripState` in the markup,
    `class:tt-next={strip.next?.itm === item && strip.playhead.length > 0}`:
    `Strip.svelte:110:36 Error: Property 'itm' does not exist on type 'Step'. Did you mean 'item'?` and
    `Strip.svelte:110:67 Error: Property 'length' does not exist on type 'number'.`
  - (d) A prop renamed in the component only (`face` to `look`), with
    `tiles.ts` unchanged. `svelte-check` reported
    `tiles.ts:459:70 Error: Object literal may only specify known properties, and 'face' does not exist in type 'Props'.`
    After regenerating, TypeScript 7 reported the same against the
    generated declaration:
    `src/tiles/tiles.ts(459,70): error TS2353: Object literal may only specify known properties, and 'face' does not exist in type 'Props'.`
  - (e) A misnamed export, `stripView.itemAt(node)`, was also caught
    (`Property 'itemAt' does not exist on type '{ itemOf: …; reveal: …; dropAt: … }'`).
    A plain `.ts` error elsewhere (`src/engine/host.ts`) fails both
    checkers.
- **Costs.**
  - Two TypeScripts to keep in step, and the `.ts` code checked twice (by 6
    through `svelte-check`, and by 7). A construct only one of them accepts
    would need care. None came up: the code passes both with no new casts
    or loosening.
  - A second lockfile, and 39 MB in `tools/svelte-check/node_modules`. The
    nested `npm ci` takes about 1 s here.
  - `npm run typecheck` goes from 0.7 s (`tsc` alone) to about 6.6 s
    (`svelte-check` 3.4 s, generating declarations 2.3 s, `tsc` 0.7 s).
  - Before the first typecheck (a fresh clone in an editor), `tsc` falls
    back to Svelte's loose ambient `*.svelte` type. The typecheck script
    always generates first, so this affects editors, not CI.
  - All of this can go once `svelte-check` supports TypeScript 7: move it
    back to the root and drop the generated declarations.

## Recommendation for step 5: stay TypeScript, with a single state object and one render pass

Svelte made the strip clearly easier to reason about. With `svelte-check`,
typing no longer counts against it: components, props and markup are
checked as strictly as the TypeScript. But this slice was the best case for
Svelte, and even here it isn't clearly better overall:

1. **No smaller.** The slice is about 32 code lines bigger, and the
   scroller's DOM tricks are still there, moved into transitions (which
   are a little longer than the clone-and-slide).
2. **Twice the JavaScript for Tiles.** The entry goes from 16.7 to 34.5 kB
   gzipped, and the Tiles page from 46 to 64 kB. It's a fixed cost that
   porting more would spread thinner, but nothing else in the package would
   share it (PLAN step 6 keeps the engine, lessons and reference in plain
   TypeScript).
3. **New failure modes, and heavier tooling.** Deep `$state` gives every
   item two identities in a codebase that compares items by identity
   throughout. The type checker can't catch that, since a proxy has the
   item's type. DOM updates become asynchronous for imperative code
   (`flushSync`). Key-block reuse produced a real bug that the tests
   happened to catch. Type checking is now complete, but it needs a second,
   pinned TypeScript, generated declarations, and a typecheck about nine
   times slower, until `svelte-check` supports TypeScript 7.
4. **The rest of Tiles gains less.** What's left is mostly static buttons
   with a few state-driven attributes: `setPace`, `setLook`,
   `setRecording`, `setPlaying`, `setDistance` and `setAngle` are each "set
   a value, update two or three attributes". There's also the pop-ups'
   measuring and positioning, the wheel's pointer math, and the stage.
   Svelte would shorten the attribute updates. It wouldn't touch the
   measuring, the pointer code or the canvas.

The clarity win comes from the *state model*, not from Svelte. That model
ports directly to TypeScript:

- **One state object, like `StripState` minus the runes.** `programs`,
  `current`, `top`, `playhead`, `selected`, `openRepeat`, `active`,
  `lifted`, `drop`, plus the rest of Tiles' state (`recording`, `playing`,
  `pace`, `look`, `distance`, `angle`, `openPopup`). Getters like `next` and
  `steps` are recomputed in render.
- **One `render()` pass,** scheduled with `queueMicrotask` after any change
  (or called directly where the DOM is measured next). It sets every
  attribute from the state.
- **For the strip, a small keyed reconcile (about 40 lines):** a
  `Map<Item, Element>` reused across renders, with elements created for new
  items, removed for gone ones, and reordered with `insertBefore`.
  Elements then stay put, as with Svelte's keyed `{#each}`, so anchors don't
  go stale. Items keep a single identity, with no proxies.
- **Keep the clone-and-slide.** It's a little shorter than the transition
  version and looks the same. Keep `animate:flip`-style motion out unless it's wanted
  for itself, and then slow the tests down for it.

This keeps the current bundle and one TypeScript, and retires the same
bug surface: `render`, `showPlayhead` and `select` become reads of one
object. If Svelte comes up again (say, for the Playground), this spike's
numbers are the baseline: about 17 kB gzipped of runtime per entry that uses
it, unless the entries share a chunk.

With the typing gap closed, the case against Svelte rests on the bundle
(+17.8 kB gzipped), the lack of a code-size win, and the proxy and
asynchronous-DOM pitfalls. It no longer rests on weaker checking. If the
owner values declarative markup and scoped styles enough to pay that, Svelte
is a workable choice. The evidence still favors TypeScript with one state
object.
