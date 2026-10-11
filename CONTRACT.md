# The controls' contract

What a host page (mckoss.com's Hugo templates, or this repo's demo hosts)
writes, and what this package promises in return. Everything not listed here
is the package's own business and may change between releases. A change to
anything listed here is a breaking change.

## Loading

`dist/manifest.json` (Vite's manifest) names one entry per kind of page:

| Entry | Defines | Used on |
| --- | --- | --- |
| `lessons` | `<logo-example>`, `<logo-worksheet>`, and tooltips on their code | lesson pages |
| `playground` | `<logo-playground>` (it includes the reference) | `/logo/playground/` |
| `reference` | `<logo-reference>` | `/logo/reference/` |
| `tiles` | `<turtle-tiles>` | `/logo/tiles/` |

A host serves `dist/` as is (no renaming: chunks import each other by
relative path), and for each entry a page uses, emits:

- `<script type="module" src="…/{entry file}">`
- `<link rel="modulepreload">` for the entry's `imports`, and theirs in turn
  (follow `imports` through the chunks, as Vite does)
- `<link rel="stylesheet">` for the `css` of the entry and of every chunk it
  imports

mckoss.com serves `dist/` at `/logo/assets/`. Shared state (the drawing
speed, the audio context, the reference index) is shared by every control on
a page, whichever entries loaded it.

The package's stylesheets go after the host's own, as the site's Logo
styles did after its theme.

`dist/LICENSE-jslogo.md` is jslogo's license (Apache 2.0), which has to be
served or distributed along with the code.

`dist/player.lgo` is the music player library's source, for a page that
shows it. The package already runs it before every program; a host never
needs to load it.

The package's version is `version` in its `package.json`. Hosts show it
where they show the Logo version.

## Elements

All are custom elements in light DOM (no shadow DOM). Each fills the box its
host gives it, and adds no styles outside itself.

The host styles the content it writes inside the elements, before and
without the script (the code's colors, the worksheet's printable boxes), by
the element names (`logo-example`, `logo-worksheet`). It makes those
elements `display: block`.

### `<logo-example>`

A runnable, editable example in a lesson.

```html
<logo-example try="pumpkin 200" view="900x720" name="Pumpkin" lesson="Fun Programs">
<pre><code>to pumpkin :size
  …
end</code></pre>
</logo-example>
```

- **Content:** one `<pre><code>` holding the program. It may contain markup
  for syntax colors (the site's `lg-*` spans); the program is its text.
- **`try`** (optional): a command to run after the program ("Then run").
- **`view`** (optional): the stage size in turtle steps, `WIDTHxHEIGHT`;
  default `600x360`.
- **`name`** (optional): the example's name, for the Playground's Examples
  folder and for snapshot and video file names; default "Example *n*", by
  page order.
- **`lesson`** (optional): the lesson's title, for file names and Open in
  Playground. Default: the text of the page's `.post-title`, else
  `document.title`.

### `<logo-worksheet>`

A worksheet: turtle instructions beside empty boxes to draw in, each with a
Check button.

```html
<logo-worksheet>
<pre data-check="tri 80">to tri :size
  …
end</pre><div class="logo-box" aria-label="Space to draw the shape"></div>
<pre>fd 100 rt 90 …</pre><div class="logo-box" aria-label="Space to draw the shape"></div>
</logo-worksheet>
```

- **Content:** rows of a `<pre>` (the instructions) followed by a
  `<div class="logo-box">` (the box). The boxes are in the markup so a
  printed page has them without the script.
- **`data-check`** on a `<pre>` (optional): a command Check runs after the
  row's definitions.

### `<logo-playground>`

The whole Logo Playground: file manager, editor, controls, debugger, stage,
command line, and the language reference.

```html
<logo-playground>
<script type="application/json" class="pg-examples-data">
[{"lesson": "Turtle Basics", "url": "/logo/turtle/",
  "examples": [{"name": "Example 1", "auto": true, "code": "fd 100", "run": ""}]}]
</script>
</logo-playground>
```

- **Content:** a `<script type="application/json" class="pg-examples-data">`
  listing the Examples folder: lessons in order, each with `lesson` (title),
  `url` (its page) and `examples`. Each example has `name`, `auto` (true if
  the name was made up), `code`, and `run` (a command to run after it, or
  `""` or `null` for none; Hugo writes `null`).

### `<logo-reference>`

The Logo language reference with its search, on a page of its own.

```html
<logo-reference hint="Type the start of a command's name to find it."></logo-reference>
```

- **Content:** none; the reference is the package's.
- **`hint`** (optional): the line shown under the search box. Default: "Type
  the start of a command's name to find it."
- A page holds at most one reference (in a `<logo-reference>` or a
  `<logo-playground>`): it has a fixed heading id.

### `<turtle-tiles>`

Turtle Tiles, filling its box. The host makes that box the whole screen.

```html
<body class="tt-body">
  <turtle-tiles aria-label="Turtle Tiles"></turtle-tiles>
</body>
```

- **Content:** none.
- **Landmark:** it's the page's `main` landmark (it takes `role="main"`
  unless the host gives it a role or puts it inside a `<main>`).
- **Query string:** `?p=…` on the page's URL opens a shared link: the
  package loads its programs, then removes `p` from the address with
  `history.replaceState`.
- **The host page** sets the viewport (`width=device-width,
  initial-scale=1`) and lets the element fill `100dvh`.

## Paths

The controls link to each other at these paths, which a host serves:

- `/logo/playground/`: the Playground (lessons' and Turtle Tiles' Open in
  Playground)
- `/logo/`: the Logo lessons (Turtle Tiles' grown-ups menu)

A host serving them somewhere else names the root in the page's head, and the
controls link under it instead (this repo's demo hosts do, on GitHub Pages):

```html
<meta name="logo-library-root" content="/logo-library/logo/">
```

The reference links to the music player as `../player/`, relative to the
Playground's and the reference's pages.

## Saved in the browser (frozen)

These localStorage keys and their formats outlive releases. Newer versions
must read what older ones wrote.

| Key | Holds |
| --- | --- |
| `mckoss.logo.files` | the Playground's programs |
| `mckoss.logo.import` | a program handed to the Playground by Open in Playground |
| `mckoss.logo.speed` | the drawing speed on lesson pages and the Playground |
| `mckoss.logo.tiles` | Turtle Tiles' programs (the share-link JSON) |
| `mckoss.logo.tiles.look` | Turtle Tiles' turtle look |
| `mckoss.logo.tiles.speed` | Turtle Tiles' speed (its animal) |

The Turtle Tiles share-link format (`?p=`) is frozen the same way: see
[SHARE-LINKS.md](SHARE-LINKS.md).

## Theme

Controls read the host's look from CSS custom properties, with fallbacks so
they look right on a page that sets none. Tracked in the theme-tokens issue.
