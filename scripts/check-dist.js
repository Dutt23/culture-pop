#!/usr/bin/env node
// Fails if anything test-only reaches the production build in dist/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** File names that must never ship. */
const FORBIDDEN_PATHS = [/\.test\./, /\.spec\./, /fixtures?/i, /\.map$/, /(^|\/)test(\/|$)/];

/** Strings that only exist in tests, test helpers, dev-only pages or recorded API responses. */
const FORBIDDEN_CONTENT = [
  'fixtureRetrievalService',
  'unusedRetrievalService',
  'controllableRetrievalService',
  '@testing-library',
  'fake-indexeddb',
  'vitest',
  'Component gallery',
  // The dev-only on-device model benchmark, its labelled cases, and WebLLM (not shipped until D39 passes).
  'On-device model benchmark',
  'Kattappa ne Baahubali',
  'CreateMLCEngine',
  '"batchcomplete"',
  // From the search evaluation set (src/test/search-eval/queries.ts), which the dev bench imports.
  'cash-me-ousside-howbow-dah',
];

/** Pure check over { path, content } pairs, so it can be unit-tested without a build. */
export function findLeaks(files) {
  const leaks = [];
  for (const { path, content } of files) {
    for (const pattern of FORBIDDEN_PATHS) {
      if (pattern.test(path)) leaks.push(`${path}: forbidden file (${pattern})`);
    }
    for (const marker of FORBIDDEN_CONTENT) {
      if (content.includes(marker)) leaks.push(`${path}: contains "${marker}"`);
    }
  }
  return leaks;
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  let paths;
  try {
    paths = listFiles(dist);
  } catch {
    console.error('dist/ not found: run `npm run build` first.');
    process.exit(1);
  }
  const textual = /\.(js|css|html|json|webmanifest|svg|txt)$/;
  const files = paths.map((full) => ({
    path: relative(dist, full),
    content: textual.test(full) ? readFileSync(full, 'utf8') : '',
  }));
  const leaks = findLeaks(files);
  if (leaks.length > 0) {
    for (const leak of leaks) console.error(`LEAK  ${leak}`);
    process.exit(1);
  }
  console.log(
    `dist/ clean: ${files.length} files, no test code, fixtures, dev pages or source maps.`,
  );
}
