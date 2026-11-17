import { defineConfig } from 'vitest/config';

/** Query-classifier experiment only (docs/eval/query-classifier-2026-11.md); never part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/query-classifier/**/*.eval.ts'],
    // First run embeds ~130 queries on CPU and times each one on its own.
    testTimeout: 10 * 60 * 1000,
  },
});
