import { defineConfig } from 'vitest/config';

/** Search benchmark only (docs/SEARCH_RANKING.md). Hits live providers; never part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/search-eval/**/*.eval.ts'],
    // ~100 sequential live queries with a 3 s pause between them, plus re-run passes for any
    // that Wikimedia throttled.
    testTimeout: 2 * 60 * 60 * 1000,
  },
});
