#!/usr/bin/env node
// On a pull request: fails unless package.json's version will make a new
// release when merged (every push to main that passes CI is released as
// v<version>). That is, the version is above main's, or equal to main's
// while main's isn't released yet.
//
// Usage (in CI, after `git fetch origin main`): node .github/scripts/version-is-new.mjs

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const ours = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const mains = JSON.parse(execFileSync('git', ['show', 'FETCH_HEAD:package.json'], { encoding: 'utf8' })).version;

// -1, 0 or 1 as version a is below, equal to or above b (X.Y.Z only).
function compare(a, b) {
  const [pa, pb] = [a, b].map(v => v.split(/[.-]/).slice(0, 3).map(Number));
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

function released(version) {
  try {
    execFileSync('gh', ['release', 'view', `v${version}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const order = compare(ours, mains);
if (order > 0 || (order === 0 && !released(mains))) {
  console.log(`Merging releases v${ours} (main is at ${mains}).`);
} else {
  console.error(`package.json's version is ${ours}, and main's ${mains} is ${released(mains) ? 'already released' : 'higher'}.`);
  console.error('Each merge to main is released, so bump the version: npm version patch --no-git-tag-version');
  console.error('(minor for new features, major for breaking changes to CONTRACT.md).');
  process.exit(1);
}
