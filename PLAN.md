# Plan: the Logo library

This repo, `mckoss/logo-library` (package `@mckoss/logo-library`), takes the
Logo code out of the [mckoss.com](https://mckoss.com) Hugo site
([mckoss/mckoss.github.io](https://github.com/mckoss/mckoss.github.io)). It's
packaged for npm but **installed by URL** (no npm registry). The site installs
it and builds it into its pages, so everything is still **served from
mckoss.com at the same URLs**.

The site's pages stay Hugo pages: lesson text, templates and site chrome. The
Logo apps plug in as controls (custom elements) inside them. **None of the
lesson material moves here:** it stays in the site as content that these
elements present. This repo becomes a TypeScript project, with Svelte only
where it earns its place (see the steps).

_The plan began as [mckoss.github.io#84](https://github.com/mckoss/mckoss.github.io/issues/84).
An earlier version proposed a separate GitHub Pages project site. Importing the
package keeps one origin, which avoids most of that version's problems: no
redirects, no cross-site links, no localStorage migration, and share links
keep working._

## Fork point

The code here was copied from the site at:

- **mckoss/mckoss.github.io** `05344e2601b65831a22b265e2aa75f191dc5bbfa`
  (main, "Tiles 1.8.12: lightning turns; own favicon; share links
  documented (#90)", logo version **1.8.12**)
- **mckoss/jslogo** `26dfcac41daa4477182ce7c1a00acbd913ab5fd5` (the site's
  `third_party/jslogo` submodule at that commit)

Until the site switches to this package (step 2), fixes may still land in the
site. To bring them over, in the site repo list what changed since the fork
point in the files this repo took:

```sh
git log --oneline 05344e2..origin/main -- assets/js/logo assets/logo assets/css/custom.css \
  layouts/partials/logo-* layouts/shortcodes/logo-* layouts/_default/_markup/render-codeblock-logo.html \
  layouts/logo content/logo/playground content/logo/tiles content/logo/reference tests/e2e third_party/jslogo
```

Port each change here, then move the fork point above to the site commit
you've caught up to. `FORKED_FROM` holds the same two hashes for scripts.

## Shape

**This repo** holds behavior, the music player extension, and the whole
language reference. It holds no lesson content.
- **The name** never collides with the site's paths. A repo named `logo`
  would get a GitHub Pages project URL of `mckoss.com/logo/`, which is where
  the lessons live; `logo-library` keeps any future project page out of the
  way.
- **Source:** the site's `assets/js/logo/*` (runtime, view, debug, music,
  blocks, reference, playground, tiles) and the Logo parts of its
  `assets/css/custom.css`.
- **The music player extension**, bundled: `music.js` (`playnote`,
  `setinstrument`, `settempo`) and the `player.lgo` library (do re mi, note
  lengths, instruments, `beats`…). Every stage loads the library before
  running a program, as now. The package also ships `player.lgo` as a file
  in `dist/`, so the site's Music Player lesson can still show its source.
- **The language reference, all of it:** jslogo's own `language.html`, plus
  the site's entries (its `assets/logo/reference-site.html`: the music
  player's commands and words, the `"rainbow` color). Also the reference's
  search, its runnable examples, and the tooltips it gives lesson code. The
  docs travel with the code they describe, at the same version.
- **jslogo:** a dependency of this package, not of the site. It's the
  [mckoss/jslogo](https://github.com/mckoss/jslogo) fork pinned to one commit,
  and bundled into the package's `dist/`.
- **Build:** Vite produces `dist/`: one ES-module entry per control plus a
  shared chunk (jslogo, stage, view, music player), CSS, assets, `player.lgo`,
  the reference and `manifest.json`.
- **Controls:** custom elements in light DOM. [CONTRACT.md](CONTRACT.md) has
  their exact markup.
  - `<logo-example>`
  - `<logo-worksheet>`
  - `<logo-playground>`
  - `<logo-reference>`
  - `<turtle-tiles>`
- **Tests:** unit tests (Vitest), and app tests (Playwright) against demo
  host pages that emulate how mckoss.com embeds the controls. The demo pages
  carry their own sample content.
- **Notes:** the package-facing parts of the site's LOGO.md move here: the
  controls' contract, the music player extension, the reference, and the
  Turtle Tiles share-link format with its compatibility rules and the frozen
  old-link tests.
- **Releases:** CI builds a `vX.Y.Z` tag, runs `npm pack`, and attaches
  `mckoss-logo-library-X.Y.Z.tgz` to the GitHub Release.

**The site** keeps the pages and all the lesson material.
- **Lesson content stays there** (see "Content for the controls" below).
- **Dependency:**
  `"@mckoss/logo-library": "https://github.com/mckoss/logo-library/releases/download/vX.Y.Z/mckoss-logo-library-X.Y.Z.tgz"`,
  with its integrity hash pinned by `package-lock.json`. Upgrading is editing
  the URL.
- **Templates:** shortcodes and templates emit the custom elements with their
  content. Hugo copies `dist/` to `/logo/assets/` and emits script tags from
  `manifest.json`, replacing its `params.scripts` bundles. The `logo-file`
  shortcode reads the packaged `player.lgo` for the Music Player lesson.
- **Pages unchanged:** `/logo/playground/`, `/logo/tiles/`,
  `/logo/reference/` and the lessons keep their URLs. `/logo/reference/`
  becomes a Hugo page hosting `<logo-reference>`; the reference itself comes
  from this package.
- **Version:** the site's `logoVersion` comes from this package's version.
- **Tests:** the site's e2e suite becomes a contract test against its Hugo
  build, plus a few screenshot checks to catch UI drift on upgrades.
- **Removed from the site:**
  - jslogo: the submodule, its `config.toml` mount and the `keepVarNames`
    minifier setting
  - the music player: `assets/logo/player.lgo`
  - the reference: `assets/logo/reference-site.html`, the `logo-reference`
    partial's reference text, and the `reference` script bundle

## Content for the controls

Everything a lesson teaches with stays in the site and reaches the elements
as content:

| Content (stays in the site) | How the element gets it |
| --- | --- |
| Example programs in lessons (```` ```logo ```` blocks, `logo-file`) | the `<pre><code>` inside `<logo-example>`, with `try`, `view` and `name` attributes |
| Worksheets | the rows inside `<logo-worksheet>`, with each row's check command as an attribute |
| The Playground's Examples folder (gathered from the lessons) and its links back to lesson sections | a `<script type="application/json">` inside `<logo-playground>`, built by Hugo |
| The Music Player lesson's display of the library | `logo-file` reading `player.lgo` from the installed package (the library itself is this package's) |
| Lesson text, figures, `logo-grid`, the Logo landing page | plain Hugo, untouched |

So the demo pages here use their own small sample content, and the site can
change lessons and examples without a package release. A change to the music
player or the reference is a package release.

## How the site embeds the controls (no UI compromises)

**The split:** the site keeps owning every page: URL,
`<html>`/`<body>`/viewport, `<head>`, site chrome, lesson text and SEO. This
package owns only what's inside each control: its DOM, scoped CSS and
behavior.

### The site's integration points, and what each becomes

| Site today | Code today | After |
| --- | --- | --- |
| ```` ```logo ```` render hook + `partials/logo-code.html`, `logo-file` shortcode | `blocks.js` (Run, Step, Copy, Revert, Then run, Open in Playground) | `<logo-example try="…" view="600x360" name="…"><pre><code>…</code></pre></logo-example>`. The static `<pre>` stays readable before or without JS. |
| `logo-worksheet` shortcode | worksheet Check (`blocks.js`) | `<logo-worksheet>` around the same rows |
| `logo-playground` shortcode + `partials/logo-examples.html` (examples gathered from lessons at build time) | `playground.js`, `debug.js` | `<logo-playground>` with a `<script type="application/json">` child for the examples Hugo collects |
| `logo-reference` partial/shortcode, `/logo/reference/`, `assets/logo/reference-site.html` | `reference.js` + jslogo's `language.html` | `<logo-reference>`, with the whole reference (text, search, run) from this package |
| Lesson tooltips | `reference.js` | Run by this package for any `<logo-example>` |
| `assets/logo/player.lgo` (the music player library) | `music.js` | Both here. `logo-file` reads the packaged `player.lgo` to show it on the Music Player lesson. |
| `layouts/logo/tiles.html` (full-screen page, no site chrome) | `tiles.js` | The same Hugo template, owning `100dvh` and the body, containing `<turtle-tiles>` |
| `logo-version` partial, `logoVersion` in config | n/a | This package's version, read from its `package.json` |
| `params.scripts.*` bundles in `config.toml`, the jslogo submodule and mount | n/a | `<script type="module">` and `modulepreload` tags emitted from this package's Vite `manifest.json`; jslogo is this package's dependency |
| `logo-grid` shortcode | n/a | Unchanged: static figures, plain Hugo |

### Why custom elements, in light DOM

- **Simple templates:** the site's templates and shortcodes just emit tags.
  No per-page glue code; elements upgrade whenever the script arrives, any
  number per page.
- **Site styles still apply:** with no shadow DOM, site fonts, tokens and
  link styles still reach the controls.
- **Progressive enhancement:** child markup (the code, the worksheet rows) is
  real content before upgrade, so it's indexable and printable.
- **Stable contract:** the elements start as plain wrappers over today's code
  (step 1). If Svelte is adopted later, they mount ordinary Svelte components
  inside, with scoped component CSS. The tags and attributes don't change.

### No-compromise checklist

1. **Layout:** the site's templates own `html`/`body`/viewport and the box
   each control sits in. Controls fill their container and ship no global CSS
   (scoped selectors only, enforced by a lint rule). Turtle Tiles stays a
   full-screen Hugo template.
2. **No layout shift:** the site reserves each control's box before upgrade
   (an `aspect-ratio` from `view`, with `:not(:defined)` styles), so pages
   don't jump when scripts load.
3. **Same look:** the site's tokens reach controls as CSS custom properties
   (`--color-accent`, `--font-heading`, …) with fallbacks. The demo pages set
   the same tokens, so the apps look identical there and on mckoss.com.
   Pop-ups and menus use fixed positioning with z-index tokens.
4. **Assets:** icons and animals stay inline SVG. Anything else is emitted by
   Vite with hashed names and served under `/logo/assets/`.
5. **Performance:** one entry per control plus a shared chunk (jslogo, stage,
   view, music player), so lesson pages never load Turtle Tiles.
   - **Hashing:** Vite's hashed file names give immutable caching. The site
     copies `dist/` verbatim to `/logo/assets/` (no re-fingerprinting, which
     would break the chunks' relative imports) and reads `manifest.json` to
     emit the entry and `modulepreload` tags.
6. **Shared state:**
   - **Within a page:** the speed setting, the AudioContext and the reference
     index are ES-module singletons in the shared chunk, so several controls
     on one page cooperate as they do now.
   - **Across pages:** same-origin localStorage keys and the share-link
     format are frozen.
7. **Accessibility:** keyboard, focus and ARIA live inside the controls. The
   site provides headings and landmarks.
8. **Development loop:** with `hugo server` and an env var such as
   `LOGO_DEV=http://localhost:5173`, the site's templates load `@vite/client`
   and the source entries from this repo's Vite dev server. That gives hot
   reload of a control inside the real Hugo page. Without the variable, they
   use the installed `dist/`.
9. **Testing:**
   - **Here:** component and app tests against the demo hosts.
   - **The site:** its Playwright suite as a contract test against its Hugo
     build, plus a few `toHaveScreenshot` visual checks on the lesson,
     playground and tiles pages to catch UI drift when this package is
     upgraded.

### Distribution by URL (no npm registry)

- **Here:** on a `vX.Y.Z` tag, CI builds, runs `npm pack`, and attaches
  `mckoss-logo-library-X.Y.Z.tgz` to that GitHub Release.
- **The site:**
  `"@mckoss/logo-library": "https://github.com/mckoss/logo-library/releases/download/vX.Y.Z/mckoss-logo-library-X.Y.Z.tgz"`
  in its `package.json`.
  - `package-lock.json` pins its integrity hash.
  - Nothing builds at install time.
  - Upgrading is editing the URL.
  - This repo must be public (or CI needs a token).
- **Alternative:** `github:mckoss/logo-library#vX.Y.Z` with a `prepare`
  build. That needs no release step but builds on every install. The release
  tarball is the plan.

## Why

- **Same origin:** localStorage programs, share links (`/logo/tiles/?p=`) and
  "Open in Playground" keep working.
- **Free to improve:** this package can move to TypeScript, and to Svelte
  where it pays, at its own pace.
- **Pinned versions:** each site deploy uses a known package version, and
  rollback is a one-line change.

## Implementation order: TypeScript first, then Svelte only where it pays

Each step lands with all tests green. The site's end-to-end tests find
elements by role and label, not by internal structure, so they guard
behavior through each change.

1. **Extract, no behavior change.** Set up this repo with the site's code
   wrapped as plain custom elements (a few lines each:
   `class TurtleTiles extends HTMLElement` calling today's setup code). jslogo
   is its dependency. The music player extension (`music.js`, `player.lgo`)
   and the whole reference are bundled. Lesson content comes in through the
   element contract. Vite build. Demo host pages emulate mckoss.com, and the
   site's e2e suite is ported to run against them. Release 1.0.0 (see the
   version issue).
2. **Switch the site.** The site emits the elements with their content and
   loads this package's `dist/`. It deletes `assets/js/logo/`, `player.lgo`,
   `reference-site.html`, the jslogo submodule and its config. Its whole e2e
   suite passes unchanged.
3. **TypeScript, everywhere: the cheapest, safest win.** Turn on `allowJs`
   and `checkJs`, then convert module by module: engine glue (runtime, view,
   music, debug), then lessons and reference, then the Playground, then
   Turtle Tiles. Add types for jslogo's interfaces and Vitest unit tests
   (share-link encoding, `clean()`, view math). Types make any later rewrite
   safer.
4. **Svelte spike on one slice of Turtle Tiles.** Rebuild the strip and the
   program scroller as Svelte components inside `<turtle-tiles>`. Compare
   code size, clarity and the animations (keyed lists with `animate:flip`
   against today's clone-and-slide) with the TypeScript version.
5. **Decide from the spike.**
   - **If clearly better:** port the rest of Turtle Tiles (tiles, repeats,
     spinner, pop-ups, wheel, gutter) to Svelte. That retires the
     hand-written render/sync code (`render`, `showPlayhead`, `select`,
     `setPace`, `setLook`…) behind which most of its state bugs hid, and moves
     its CSS into scoped component styles.
   - **If not:** keep Turtle Tiles in TypeScript, restructured around a
     single state object and one render pass.
6. **Stays plain TypeScript regardless:** the engine (jslogo glue, the canvas
   stage and zoom, the run queue, the music player), lesson code blocks and
   worksheets, and the Reference. They're canvas, audio, or small
   enhancements. The Playground can be weighed later, once Turtle Tiles has
   shown what Svelte costs and buys.
7. **Move the e2e tests.** App-behavior tests live here; the site keeps the
   contract and screenshot tests.

Persisted formats (localStorage JSON, share-link payloads) stay compatible
through every step.

## Decided

- **Repo and package name:** `mckoss/logo-library`, package
  `@mckoss/logo-library`. It never collides with `mckoss.com/logo/` or a
  project page.
- **Distribution:** by URL, as a GitHub Release tarball. No npm registry.
  This repo must be public (or the site's CI needs a token).
- **Integration:** custom elements in light DOM. The site owns pages and
  layout; controls own their insides.
- **jslogo:** a dependency of this package only. Its build handles what
  jslogo needs, such as keeping variable names, since jslogo uses `eval`.
- **Music player extension:** bundled here (`music.js`, `player.lgo`). The
  Music Player lesson stays in the site and shows the packaged library.
- **Reference:** entirely here: jslogo's language reference, the site's
  entries, search, runnable examples and lesson tooltips. `/logo/reference/`
  stays a Hugo page that hosts it.
- **Lesson material stays in the site:** lessons, examples and worksheets.
  This package is behavior, the music player and the reference.
- **Order:** TypeScript first; Svelte only after a spike shows it pays,
  starting with Turtle Tiles.

## Still to decide

Open questions are tracked as issues in this repo.

- **How Svelte attaches, if adopted.** The recommendation is plain custom
  elements that mount ordinary Svelte components
  (`mount(Component, { target: this, props })`), rather than Svelte's own
  custom-element mode. That mode has no `<slot>` without shadow DOM (so
  `<logo-example>` couldn't simply wrap its code), needs string-to-type
  declarations for attributes, and ties the public contract to Svelte's
  compiler.
- **Theme:** confirm the token set (CSS custom properties) the controls read
  from the site.
- **Local development:** `LOGO_DEV` pointing Hugo at the Vite dev server for
  hot reload, versus `npm link` / `file:../logo-library`.

## Done when

- The site has no Logo source, no jslogo, no music player and no reference
  text left, only page shells, lesson content, and the URL dependency.
- Every current URL, saved program and share link works as before.
- This repo builds, tests and releases from its own CI, and the site deploys
  a pinned version of it.

## Progress

- [ ] Step 1: extract (done except the release)
  - [x] Repo created; plan and fork point recorded
  - [x] Package scaffold, jslogo dependency, Vite build with per-control entries and a manifest
  - [x] Code moved with no behavior change, wrapped as the five custom elements
  - [x] Demo host pages emulating mckoss.com's lesson, playground, reference and tiles pages
  - [x] The site's e2e suite ported and passing against the demo hosts (166 tests)
  - [x] CI, and a release workflow that attaches the tarball to a GitHub Release
  - [x] Merged (#7)
  - [ ] Tag the first release (waiting on the version issue, #1)
- [ ] Step 2: switch the site
- [x] Step 3: TypeScript
  - [x] Setup (strict tsconfig, Vitest), and the engine in strict TypeScript
  - [x] The lessons, reference, Playground and Turtle Tiles in strict TypeScript, typed against the engine
  - [x] Pure logic extracted word for word, with unit tests: view math, programs, instruments,
        the reference's words, the Playground's saved files and examples, Tiles' programs and share
        links (including the frozen 1.8.11 links)
  - [x] One fix found on the way: a Tiles tile named after a built-in object key (`constructor`)
        made `clean()` throw, so the whole link failed to open; now it's dropped like any unknown tile
- [ ] Steps 4–5: Svelte spike on Turtle Tiles, and the decision
- [ ] Step 7: e2e tests split between here and the site
