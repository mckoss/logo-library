#!/usr/bin/env node
// Builds the demo host site, demo/site/, from the committed page templates
// in demo/pages/ and the package's build in dist/: the stand-in for the
// Hugo templates that will embed this package on mckoss.com.
//
// As CONTRACT.md's "Loading" section tells a host to, it
// - copies dist/ verbatim to /logo/assets/ (no renaming: the chunks import
//   each other by relative path), and
// - for each page's entry, found by `name` in dist/manifest.json, replaces
//   the page's <!--#logo-entry NAME--> marker with
//     <link rel="stylesheet"> for the CSS,
//     <link rel="modulepreload"> for the chunks it imports, and
//     <script type="module" src> for the entry itself.
//   Imports and CSS are followed through the imported chunks too, as Vite's
//   own HTML output (and its backend-integration guide) does.
// - fills in <!--#logo-version--> with the package's version.
//
// Usage: npm run hosts (after npm run build). LOGO_DIST=<dir> uses another
// build directory than dist/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = path.join(root, 'demo/pages');
const site = path.join(root, 'demo/site');
const dist = path.resolve(root, process.env.LOGO_DIST || 'dist');  // (LOGO_DIST: another build)
const BASE = '/logo/assets/';

function readManifest() {
  for (const rel of ['manifest.json', '.vite/manifest.json']) {
    const file = path.join(dist, rel);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  throw new Error('dist/manifest.json not found: run npm run build first');
}

const manifest = readManifest();
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

// The tags for one entry, by its name.
function entryTags(name) {
  const keys = Object.keys(manifest).filter(key => manifest[key].isEntry && manifest[key].name === name);
  if (keys.length !== 1) throw new Error(`dist/manifest.json: ${keys.length} entries named "${name}"`);
  const entry = manifest[keys[0]];
  const preload = [];
  const css = [];
  const seen = new Set();
  const visit = (key, isEntry) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`dist/manifest.json: no chunk "${key}"`);
    for (const file of chunk.css ?? []) if (!css.includes(file)) css.push(file);
    for (const imported of chunk.imports ?? []) visit(imported, false);
    if (!isEntry && !preload.includes(chunk.file)) preload.push(chunk.file);
  };
  visit(keys[0], true);
  return [
    ...css.map(file => `<link rel="stylesheet" href="${BASE}${file}">`),
    ...preload.map(file => `<link rel="modulepreload" href="${BASE}${file}">`),
    `<script type="module" src="${BASE}${entry.file}"></script>`,
  ].join('\n');
}

function copyTree(from, to, transform) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst, transform);
    else if (transform && entry.name.endsWith('.html')) fs.writeFileSync(dst, transform(fs.readFileSync(src, 'utf8'), src));
    else fs.copyFileSync(src, dst);
  }
}

const tags = new Map();
const used = new Map();
function render(html, file) {
  const rel = path.relative(pages, file);
  html = html.replace(/<!--#logo-entry (\w+)-->/g, (all, name) => {
    if (!tags.has(name)) tags.set(name, entryTags(name));
    used.set(rel, name);
    return tags.get(name);
  });
  html = html.replace(/<!--#logo-version-->/g, version);
  if (/<!--#logo-/.test(html)) throw new Error(`${rel}: unknown <!--#logo-…--> marker`);
  return html;
}

fs.rmSync(site, { recursive: true, force: true });
copyTree(pages, site, render);
copyTree(dist, path.join(site, BASE));

for (const [rel, name] of [...used].sort()) console.log(`${rel}: ${name}`);
console.log(`demo/site/ built with @mckoss/logo-library ${version}`);
