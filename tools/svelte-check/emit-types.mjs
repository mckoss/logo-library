// Writes a declaration for each .svelte component (Strip.svelte ->
// .svelte-types/src/tiles/Strip.svelte.d.ts), generated from the component
// itself by svelte2tsx, so the repo's tsc (TypeScript 7, which can't read
// .svelte files) sees the components' real props and exports. tsconfig's
// rootDirs makes `import Strip from './Strip.svelte'` find them. Nothing
// here is hand-written, so it can't drift: npm run typecheck regenerates it
// every time, before tsc runs.
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { emitDts } from 'svelte2tsx';

const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL('../../', import.meta.url));
const out = join(repo, '.svelte-types');
const temp = await mkdtemp(join(tmpdir(), 'svelte-types-'));
const cwd = process.cwd();
try {
  process.chdir(repo);
  await emitDts({
    libRoot: join(repo, 'src'),
    declarationDir: join(temp, 'src'),
    svelteShimsPath: require.resolve('svelte2tsx/svelte-shims-v4.d.ts'),
    tsconfig: join(repo, 'tsconfig.json'),
  });
  // Only the components': declarations of .ts modules would be second,
  // different copies of their types (tsc reads the .ts files themselves).
  await rm(out, { recursive: true, force: true });
  // (Strip.svelte's is Strip.svelte.d.ts; strip.svelte.ts's, a rune
  // module, is strip.svelte.d.ts too, and is left out.)
  const components = new Set((await readdir(join(repo, 'src'), { recursive: true })).filter(f => f.endsWith('.svelte')));
  const files = (await readdir(temp, { recursive: true }))
    .filter(f => f.startsWith('src') && components.has(relative('src', f).replace(/\.d\.ts$/, '')));
  for (const f of files) await cp(join(temp, f), join(out, f));
  console.log(`${files.length} component declarations in ${relative(repo, out)}/`);
} finally {
  process.chdir(cwd);
  await rm(temp, { recursive: true, force: true });
}
