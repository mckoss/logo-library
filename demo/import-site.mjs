#!/usr/bin/env node
// Imports mckoss.com's Logo pages as this repo's demo host pages.
//
// The demo hosts are fixtures of the integration: the site's real Hugo
// output for /logo/, its lessons, the Playground, the Reference and Turtle
// Tiles, with the site's chrome kept and its Logo markup replaced by the
// custom elements in CONTRACT.md, as the site will emit them once it
// switches to this package. The output, demo/pages/, is committed, so this
// repo's tests need neither Hugo nor the site. Re-run this only to refresh
// the fixtures from a newer site commit.
//
// Usage:
//   hugo --source <site> --destination <built> --cacheDir <tmp>/cache \
//        (with HUGO_RESOURCEDIR=<tmp>/resources, so nothing is written into <site>)
//   node demo/import-site.mjs <built> <site>
//
// <built> is the Hugo-built site (a production build, not `hugo server`);
// <site> is the site's source checkout, read for its CSS sources and commit.
//
// What it does, page by page (see CONTRACT.md):
// - <div class="logo-code" data-try data-view data-name><pre><code>
//   becomes <logo-example try view name><pre><code> (color spans kept).
// - <div class="logo-worksheet"> becomes <logo-worksheet>, rows unchanged.
// - <div class="logo-playground"> becomes <logo-playground> holding only its
//   <script type="application/json" class="pg-examples-data">.
// - <div class="logo-reference-page"> becomes <logo-reference hint="…">.
// - <main class="turtle-tiles"> becomes <turtle-tiles aria-label>.
// - The site's Logo bundles (js/logo, js/tiles, js/reference) become a
//   <!--#logo-entry NAME--> marker, which demo/build-hosts.mjs replaces with
//   the package's tags for that entry from dist/manifest.json, as Hugo will.
// - "Logo v1.8.12" becomes "Logo v<!--#logo-version-->": the package's
//   version, filled in by build-hosts.mjs from package.json.
// - The site's fingerprinted CSS bundle becomes /css/site.css, built here
//   from its sources (theme tokens.css + main.css + custom.css) minus the
//   Logo rules that move to the package (its rules for the old .logo-code
//   and .logo-worksheet wrappers now name the elements, which are blocks);
//   its site.js becomes /js/site.js.
// - The analytics snippet is dropped (tests must not send page views).
// - Local files the pages use (images, icons) are copied alongside.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'pages');

const [built, site] = process.argv.slice(2);
if (!built || !site) {
  console.error('usage: node demo/import-site.mjs <hugo-built-site> <site-source>');
  process.exit(2);
}

// The package's part of custom.css starts here and runs to the end, except
// for .tt-body, which stays with the host (it styles the host's <body>).
const PACKAGE_CSS_START = '/* Interactive Logo: toolbars, stages, the playground. */';

// Which entry each kind of page loads, by the site bundle it loaded.
const BUNDLE_ENTRY = { logo: 'lessons', tiles: 'tiles', reference: 'reference' };

const write = (rel, text) => {
  const file = path.join(out, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

// The end of the element that starts at `start` (an opening <tag), counting
// nested tags of the same name.
function elementEnd(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  throw new Error(`unclosed <${tag}> at ${start}`);
}

// Replaces every element whose opening tag matches `open` (a regexp for the
// whole opening tag), calling replace(outerHTML, openMatch).
function replaceElements(html, open, tag, replace) {
  let result = '';
  let at = 0;
  const re = new RegExp(open.source, 'g');
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const end = elementEnd(html, m.index, tag);
    result += html.slice(at, m.index) + replace(html.slice(m.index, end), m);
    at = end;
    re.lastIndex = end;
  }
  return result + html.slice(at);
}

function required(html, re, what, page) {
  const m = html.match(re);
  if (!m) throw new Error(`${page}: no ${what}`);
  return m;
}

function convert(html, page) {
  // Head: the site's CSS and JS bundles, now unfingerprinted files.
  html = html.replace(/<link rel="stylesheet" href="\/css\/site\.min\.[0-9a-f]+\.css"[^>]*>/,
    '<link rel="stylesheet" href="/css/site.css">');
  html = html.replace(/<script src="\/js\/site\.min\.[0-9a-f]+\.js"[^>]*><\/script>/,
    '<script src="/js/site.js" defer></script>');
  let entry = null;
  html = html.replace(/<script src="\/js\/(\w+)\.min\.[0-9a-f]+\.js"[^>]*><\/script>/g, (all, bundle) => {
    if (!(bundle in BUNDLE_ENTRY)) throw new Error(`${page}: unknown bundle ${bundle}`);
    entry = BUNDLE_ENTRY[bundle];
    return '<!--#logo-entry ENTRY-->';
  });
  if (/site\.min\./.test(html)) throw new Error(`${page}: site bundle left over`);

  // Analytics: dropped.
  html = html.replace(/\n?<script async src="https:\/\/www\.googletagmanager\.com\/[\s\S]*?<\/script>\n<script>[\s\S]*?gtag\('config'[^\n]*\n<\/script>/,
    '');
  if (/googletagmanager/.test(html)) throw new Error(`${page}: analytics left over`);

  // Lesson examples.
  html = replaceElements(html, /<div class="logo-code"([^>]*)>/, 'div', (outer, m) => {
    const attrs = m[1].replace(/ data-(try|view|name)=/g, ' $1=');
    if (/ data-/.test(attrs)) throw new Error(`${page}: unexpected logo-code attributes ${m[1]}`);
    const pre = required(outer, /<pre><code>[\s\S]*<\/code><\/pre>/, 'code in a logo-code', page)[0];
    return `<logo-example${attrs}>\n${pre}\n</logo-example>`;
  });

  // Worksheets.
  html = replaceElements(html, /<div class="logo-worksheet">/, 'div', outer =>
    `<logo-worksheet>${outer.slice('<div class="logo-worksheet">'.length, -'</div>'.length)}</logo-worksheet>`);

  // The Playground: just its examples data.
  html = replaceElements(html, /<div class="logo-playground">/, 'div', outer => {
    const data = required(outer, /<script type="application\/json" class="pg-examples-data">[\s\S]*?<\/script>/,
      'examples data in the playground', page)[0];
    entry = 'playground';
    return `<logo-playground>\n${data}\n</logo-playground>`;
  });

  // The Reference page.
  html = replaceElements(html, /<div class="logo-reference-page">/, 'div', () =>
    `<logo-reference hint="Type the start of a command's name to find it."></logo-reference>`);

  // Turtle Tiles.
  html = html.replace(/<main class="turtle-tiles" aria-label="([^"]*)"[^>]*><\/main>/,
    '<turtle-tiles aria-label="$1"></turtle-tiles>');

  // The version, from the package.
  html = html.replace(/<p class="logo-version">Logo v[\d.]+<\/p>/g,
    '<p class="logo-version">Logo v<!--#logo-version--></p>');

  for (const left of ['class="logo-code"', 'class="logo-worksheet"', 'class="logo-playground"',
    'class="logo-reference-page"', 'class="turtle-tiles"', 'data-version=']) {
    if (html.includes(left)) throw new Error(`${page}: ${left} left over`);
  }
  if (html.includes('<!--#logo-entry ENTRY-->')) {
    html = html.replace('<!--#logo-entry ENTRY-->', `<!--#logo-entry ${entry}-->`);
  }
  return { html, entry };
}

// The host's CSS: what the site concatenates (theme tokens, theme, custom
// CSS), with the package's Logo rules taken out of custom.css.
function hostCSS() {
  const theme = path.join(site, 'themes/mckoss-modernist/assets/css');
  const custom = fs.readFileSync(path.join(site, 'assets/css/custom.css'), 'utf8');
  const split = custom.indexOf(PACKAGE_CSS_START);
  if (split < 0) throw new Error('custom.css: the package section marker is missing');
  const ttBody = required(custom.slice(split), /^\.tt-body \{[\s\S]*?^\}\n/m, '.tt-body rule', 'custom.css')[0];
  // The host's rules for the old wrappers now style the elements that
  // replace them: the worksheet's print layout must apply before (or
  // without) the script, so it can't wait for the element to add a class.
  const host = custom.slice(0, split).trimEnd()
    .replace(/(^|[\s,])\.logo-code\b/gm, '$1logo-example')
    .replace(/(^|[\s,])\.logo-worksheet\b/gm, '$1logo-worksheet');
  return [
    '/* The demo host\'s CSS, generated by demo/import-site.mjs from the site\'s',
    '   sources, in the order its head.html concatenates them. The Logo rules of',
    '   custom.css that belong to the package are left out. */',
    '',
    '/* themes/mckoss-modernist/assets/css/tokens.css */',
    fs.readFileSync(path.join(theme, 'tokens.css'), 'utf8'),
    '/* themes/mckoss-modernist/assets/css/main.css */',
    fs.readFileSync(path.join(theme, 'main.css'), 'utf8'),
    '/* assets/css/custom.css, up to its Interactive Logo section (the package\'s),',
    '   with .logo-code and .logo-worksheet renamed logo-example and logo-worksheet */',
    host + '\n',
    '/* The boxes the host gives the elements: blocks, like the divs they replace. */',
    'logo-example, logo-worksheet, logo-playground, logo-reference { display: block; }',
    '',
    '/* assets/css/custom.css: the Turtle Tiles page\'s body, which stays with the host */',
    ttBody,
  ].join('\n');
}

// Pages: /logo/ and every /logo/<page>/.
const logoDir = path.join(built, 'logo');
const pages = ['logo/index.html', ...fs.readdirSync(logoDir)
  .filter(name => fs.existsSync(path.join(logoDir, name, 'index.html')))
  .sort()
  .map(name => `logo/${name}/index.html`)];

fs.rmSync(out, { recursive: true, force: true });
const assets = new Set();
const summary = [];
for (const page of pages) {
  const { html, entry } = convert(fs.readFileSync(path.join(built, page), 'utf8'), page);
  write(page, html);
  summary.push(`${page}: ${entry ?? 'no entry'}`);
  for (const [, url] of html.matchAll(/(?:src|href)="(\/[^/"][^"]*)"/g)) assets.add(url.split(/[?#]/)[0]);
}

write('css/site.css', hostCSS());
write('js/site.js', fs.readFileSync(path.join(site, 'themes/mckoss-modernist/assets/js/site.js'), 'utf8'));

// Local files the pages refer to (not pages, and not what's generated here).
const copied = [];
for (const url of [...assets].sort()) {
  if (url.endsWith('/') || url === '/css/site.css' || url === '/js/site.js') continue;
  const from = path.join(built, url);
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
    console.warn(`missing: ${url}`);
    continue;
  }
  fs.mkdirSync(path.dirname(path.join(out, url)), { recursive: true });
  fs.copyFileSync(from, path.join(out, url));
  copied.push(url);
}

let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', site, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch { /* not a git checkout */ }
write('IMPORTED_FROM', [
  '# The site commit demo/pages/ was imported from by demo/import-site.mjs.',
  `mckoss/mckoss.github.io ${commit}`,
  '',
].join('\n'));

console.log(summary.join('\n'));
console.log(`${copied.length} files copied`);
