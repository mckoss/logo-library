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

// dist/player.lgo: the music player library as a plain file, for a page
// that shows its source.
function playerLibrary() {
  return {
    name: 'player-library',
    apply: 'build',
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'player.lgo', source: await readFile(path('./src/library/player.lgo')) });
    },
  };
}

export default defineConfig({
  base: './',
  resolve: {
    alias: { jslogo: JSLOGO.replace(/\/$/, '') },
  },
  plugins: [jslogoGlobals(), playerLibrary()],
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
        lessons: path('./src/entries/lessons.js'),
        playground: path('./src/entries/playground.js'),
        reference: path('./src/entries/reference.js'),
        tiles: path('./src/entries/tiles.js'),
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
              test: /[\\/]src[\\/]reference[\\/](reference|texts|index|markup)\.js$|[\\/]reference-site\.html|[\\/]vendor[\\/]jslogo[\\/]language\.html/,
            },
            {
              name: 'engine',
              priority: 1,
              test: /[\\/](vendor[\\/]jslogo|src[\\/]engine|src[\\/]library)[\\/]|[\\/]src[\\/]version\.js$|[\\/]package\.json$/,
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
