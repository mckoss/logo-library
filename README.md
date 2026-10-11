# logo-library

Logo in a web page, as five custom elements: runnable, editable programs for
lessons (`<logo-example>`), worksheets (`<logo-worksheet>`), the Logo
Playground (`<logo-playground>`), the language reference
(`<logo-reference>`), and Turtle Tiles, Logo for little ones with picture
tiles (`<turtle-tiles>`). The turtle, the music player and the reference come
with the package; the page supplies its own programs and text.

It runs Logo with [jslogo](https://github.com/inexorabletash/jslogo) by Joshua
Bell (Apache 2.0), through the [mckoss/jslogo](https://github.com/mckoss/jslogo)
fork. It began as the Logo programs of [mckoss.com](https://mckoss.com/logo/),
which installs it and keeps its lessons in its own pages.

**See it working:** [mckoss.com/logo-library](https://mckoss.com/logo-library/).

## Getting started

### 1. Install it by URL

The package isn't on the npm registry. Each release attaches a tarball to its
GitHub Release, and you install that URL:

```sh
npm install https://github.com/mckoss/logo-library/releases/download/v2.0.0/mckoss-logo-library-2.0.0.tgz
```

`package-lock.json` pins its integrity hash; upgrading is changing the URL.

### 2. Serve `dist/`

Serve `node_modules/@mckoss/logo-library/dist/` as static files, at any path
(mckoss.com uses `/logo/assets/`). Copy it as it is: the files are hashed and
import each other by relative path, so don't rename or re-fingerprint them.
It includes jslogo's license, `LICENSE-jslogo.md`, which must be served or
distributed with the code.

### 3. Load an entry on each page

`dist/manifest.json` (Vite's manifest) has one entry per kind of page, found
by its `name`:

| Entry | Defines |
| --- | --- |
| `lessons` | `<logo-example>` and `<logo-worksheet>` |
| `playground` | `<logo-playground>` |
| `reference` | `<logo-reference>` |
| `tiles` | `<turtle-tiles>` |

For each entry a page uses, write in its `<head>`, after your own styles:

- a `<link rel="stylesheet">` for each file in the entry's `css`,
- a `<link rel="modulepreload">` for each chunk in its `imports`,
- a `<script type="module">` for its `file`,

and **follow the imports**: each imported chunk's own `imports` are
preloaded too, and its `css` added, all the way down (as Vite's own HTML
output does). For the `lessons` entry, served at `/logo/assets/`, that gives
tags like these (the hashes differ from build to build):

```html
<link rel="stylesheet" href="/logo/assets/lessons-CjInuMdp.css">
<link rel="modulepreload" href="/logo/assets/engine-yRfbJ9Bg.js">
<link rel="modulepreload" href="/logo/assets/reference-core-C7BRvRaL.js">
<script type="module" src="/logo/assets/lessons-BmTKUP3R.js"></script>
```

The file names change with every release, so generate these tags from the
manifest in your build; don't copy them.
[`demo/build-hosts.mjs`](demo/build-hosts.mjs) is a working implementation
(its `entryTags` function).

### 4. Write the elements

```html
<logo-example try="square 100" name="Square">
<pre><code>to square :size
  repeat 4 [fd :size rt 90]
end</code></pre>
</logo-example>
```

Each [example page](examples/) shows one element's markup beside the element
working, and [CONTRACT.md](CONTRACT.md) has every element's attributes and
content. The elements use light DOM, fill the box you give them, and add no
styles outside themselves. Your page styles the content it writes inside them
(the code, the worksheet's boxes) and makes them `display: block`; see the
example pages' `<style>`.

### 5. Optional: tell the controls about your site

Two `<meta>` tags in a page's head (CONTRACT.md, "Paths" and "Saved in the
browser"):

```html
<meta name="logo-library-root" content="/logo/">
<meta name="logo-library-storage" content="my-site.">
```

- **`logo-library-root`**: where you serve the pages the controls link to:
  `playground/` under it (Open in Playground) and the root itself (Turtle
  Tiles' link back to the lessons). Default `/logo/`. The reference links to
  the music player as `../player/`, relative to its own page.
- **`logo-library-storage`**: a prefix for the controls' localStorage keys, so
  pages that share an origin keep their own saved programs. Default: none.

The controls also read your colors from CSS custom properties (`--color-text`,
`--color-accent`, …), each with a fallback; see CONTRACT.md, "Theme".

## Examples

- **Live:** [mckoss.com/logo-library](https://mckoss.com/logo-library/), deployed
  by CI from `main`: the example pages, and
  [mckoss.com's Logo lessons](https://mckoss.com/logo-library/logo/) running this
  package, as an integration test.
- **Source:** [`examples/`](examples/), plain HTML pages, one per element, plus
  their index and a music player page. Each loads the package with
  `<!--#logo-entry NAME-->` and `<!--#logo-version-->` markers, which
  `demo/build-hosts.mjs` replaces with the tags above and the version.
  Their own Playground and music player pages are the ones the controls link
  to (`logo-library-root` names the examples' root), and they keep their saved
  programs under the `logo-library-demo.` prefix.

## Development

```sh
npm install
git submodule update --init   # jslogo, in vendor/jslogo
npm test                      # type check, unit tests, then build and end-to-end tests
```

To look at the pages yourself:

```sh
npm run build && npm run hosts && npm run serve
```

then open:

- http://localhost:8790/: the examples
- http://localhost:8790/logo/: the mckoss.com lessons (the integration fixture)
- http://localhost:8790/logo-library/ and http://localhost:8790/logo-library/logo/:
  the same, built for the GitHub Pages path, as deployed

`npm run hosts` builds both into `demo/site/`; `PORT` changes the server's port.
The end-to-end tests (`npm run test:e2e`) start that server themselves; set
`PW_CHROMIUM_EXECUTABLE` to use a Chromium other than Playwright's own.

## Repository layout

- `src/`: the package, in TypeScript: `engine/` (jslogo, the stage, the music
  player), `lessons/`, `playground/`, `reference/`, `tiles/`, `styles/`, and
  `entries/`, the four entries Vite builds into `dist/`.
- `vendor/jslogo/`: the jslogo fork, a git submodule, bundled into `dist/`.
- `examples/`: the example pages.
- `demo/`: `pages/`, mckoss.com's Logo pages copied at the fork point, the
  integration fixture until mckoss.com's own tests cover it; `build-hosts.mjs`,
  which builds the pages and the examples into `demo/site/`; and `serve.mjs`,
  which serves it.
- `tests/unit/` (Vitest) and `tests/e2e/` (Playwright, against `demo/site/`).
- [PLAN.md](PLAN.md): why this repo exists, the steps, and progress.
- [CONTRACT.md](CONTRACT.md): what a host page writes, and what the package
  promises.
- [SHARE-LINKS.md](SHARE-LINKS.md): the Turtle Tiles share-link format, which
  must keep working.

## Releasing

1. Bump `version` in `package.json` (and `package-lock.json`, with
   `npm version X.Y.Z --no-git-tag-version`), and merge it to `main`.
2. Tag that commit `vX.Y.Z` and push the tag.
3. The release workflow (`.github/workflows/release.yml`) checks that the tag
   matches `package.json`, runs the tests, runs `npm pack`, and attaches
   `mckoss-logo-library-X.Y.Z.tgz` to the GitHub Release `vX.Y.Z`: the URL
   that hosts install.

## License

Copyright 2026 Mike Koss. Licensed under the Apache License, Version 2.0: see
[LICENSE](LICENSE). jslogo, bundled in `dist/`, is Copyright Joshua Bell,
also Apache 2.0 (`dist/LICENSE-jslogo.md`).
