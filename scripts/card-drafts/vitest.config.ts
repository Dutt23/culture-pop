import { defineConfig } from 'vitest/config';

/** Card-draft before/after comparison only (paid OpenAI calls); never part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/card-drafts/**/*.eval.ts'],
    testTimeout: 5 * 60 * 1000,
  },
});
