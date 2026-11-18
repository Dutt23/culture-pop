import { describe, expect, it } from 'vitest';
import { flagSources } from '../../../api/_lib/cardCurate.js';

describe('shared api module', () => {
  it('is importable from the app', () => {
    expect(
      flagSources(
        [{ kind: 'wiki', from: 'wiktionary', title: 'ok boomer', text: 'A dismissive phrase.' }],
        'ok boomer',
      ),
    ).toEqual([null]);
  });
});
