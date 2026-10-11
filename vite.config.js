// Builds dist/: one ES-module entry per kind of page (lessons, playground,
// reference, tiles), a shared chunk for the Logo engine (jslogo, the music
// player, the stage) and one for the reference, a stylesheet per entry,
// player.lgo, and manifest.json, which hosts read to emit the script,
// modulepreload and stylesheet tags (see CONTRACT.md). Files are hashed and
// import each other by relative path, so dist/ can be served from any path
// (mckoss.com serves it at /logo/assets/).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const path = p => fileURLToPath(new URL(p, import.meta.url));
const JSLOGO = path('./vendor/jslogo/');

// jslogo's logo.js is a classic script whose top-level function,
// LogoInterpreter, was a global; as a module it needs assigning to self.
// (turtle.js assigns CanvasTurtle to self itself; floodfill.js only adds a
// method to CanvasRenderingContext2D.)
function jslogoGlobals() {
  const file = JSLOGO + 'logo.js';
  return {
    name: 'jslogo-globals',
    transform(code, id) {
      if (id.split('?')[0] !== file) return null;
      return { code: code + '\nself.LogoInterpreter = LogoInterpreter;\n', map: null };
    },
  };
}

// Plain files in dist/: player.lgo, the music player library, for a page
// that shows its source; and jslogo's license, which must travel with
// copies of its code (Apache 2.0; the minifier drops its comments).
function plainFiles() {
  return {
    name: 'plain-files',
    apply: 'build',
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'player.lgo', source: await readFile(path('./src/library/player.lgo')) });
      this.emitFile({ type: 'asset', fileName: 'LICENSE-jslogo.md', source: await readFile(JSLOGO + 'LICENSE.md') });
    },
  };
}

export default defineConfig({
  base: './',
  resolve: {
    alias: { jslogo: JSLOGO.replace(/\/$/, '') },
  },
  // Svelte: Turtle Tiles' strip and program scroller (src/tiles/*.svelte).
  plugins: [jslogoGlobals(), plainFiles(), svelte()],
  // Unit tests (npm run test:unit): the engine's pure logic, in Node. The
  // end-to-end tests in tests/e2e are Playwright's.
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: 'manifest.json',
    // Ship the code as written (the site served it untranspiled).
    target: 'esnext',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: {
        lessons: path('./src/entries/lessons.ts'),
        playground: path('./src/entries/playground.ts'),
        reference: path('./src/entries/reference.ts'),
        tiles: path('./src/entries/tiles.ts'),
      },
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
        // The shared chunks: the Logo engine, and the reference (which the
        // reference page loads without the engine). Neither is named like
        // an entry, which hosts find by name.
        codeSplitting: {
          groups: [
            {
              name: 'reference-core',
              priority: 2,
              test: /[\\/]src[\\/]reference[\\/](reference|texts|index|markup)\.[jt]s$|[\\/]reference-site\.html|[\\/]vendor[\\/]jslogo[\\/]language\.html/,
            },
            {
              name: 'engine',
              priority: 1,
              test: /[\\/](vendor[\\/]jslogo|src[\\/]engine|src[\\/]library)[\\/]|[\\/]src[\\/]version\.[jt]s$|[\\/]package\.json$/,
            },
          ],
        },
        // jslogo builds functions with eval() that name their parameters
        // (logo.js's to_arity), so the minifier must not rename variables
        // in scopes that contain a direct eval.
        minify: {
          compress: true,
          mangle: { keepNames: true },
        },
      },
    },
  },
});
