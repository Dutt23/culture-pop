// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRateLimit } from './rateLimit';

describe('createRateLimit', () => {
  it('allows the set number per key per window, then starts again', () => {
    let now = 0;
    const allow = createRateLimit(2, 60_000, () => now);
    expect([allow('a'), allow('a'), allow('a'), allow('b')]).toEqual([true, true, false, true]);
    now = 60_000;
    expect(allow('a')).toBe(true);
  });

  it('when full, refuses new keys instead of wiping existing counts', () => {
    const allow = createRateLimit(1, 60_000, () => 0);
    expect(allow('victim')).toBe(true);
    for (let i = 0; i < 10_000; i += 1) allow(`flood-${i}`);
    expect(allow('victim')).toBe(false);
    expect(allow('newcomer')).toBe(false);
  });
});
