import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PEEKS_PER_DAY } from './peekBudget';
import { MAX_UP_MS, POINT_MS, SETTLE_MS, usePeek, type PeekOutcome } from './usePeek';

interface Props {
  query: string;
  outcome: PeekOutcome;
  enabled: boolean;
}

function peek(initialProps: Partial<Props> = {}) {
  return renderHook((props: Props) => usePeek(props.query, props.outcome, props.enabled), {
    initialProps: { query: '', outcome: 'pending', enabled: true, ...initialProps },
  });
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  // Unmount while the fake clock still owns the timers.
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

describe('usePeek', () => {
  it('rises once a search has two letters', () => {
    const { result, rerender } = peek({ query: 'r' });
    expect(result.current).toBe('hidden');
    rerender({ query: 'ra', outcome: 'pending', enabled: true });
    expect(result.current).toBe('watching');
  });

  it('peeks once per search, and again after the box is cleared', () => {
    const { result, rerender } = peek({ query: 'ra' });
    rerender({ query: 'ras', outcome: 'none', enabled: true });
    wait(SETTLE_MS);
    expect(result.current).toBe('hidden');
    rerender({ query: 'raso', outcome: 'pending', enabled: true });
    expect(result.current).toBe('hidden');
    // Backspacing to one letter to fix a typo is still the same search.
    rerender({ query: 'r', outcome: 'pending', enabled: true });
    rerender({ query: 'ra', outcome: 'pending', enabled: true });
    expect(result.current).toBe('hidden');

    rerender({ query: '', outcome: 'pending', enabled: true });
    rerender({ query: 'gr', outcome: 'pending', enabled: true });
    expect(result.current).toBe('watching');
  });

  it('points once typing pauses on a result, then ducks', () => {
    const { result, rerender } = peek({ query: 'gr', outcome: 'found' });
    wait(SETTLE_MS - 100);
    // Still typing: the wait starts over.
    rerender({ query: 'gro', outcome: 'found', enabled: true });
    wait(SETTLE_MS - 100);
    expect(result.current).toBe('watching');
    wait(100);
    expect(result.current).toBe('pointing');
    wait(POINT_MS);
    expect(result.current).toBe('hidden');
  });

  it('ducks as soon as the search settles with nothing found', () => {
    const { result } = peek({ query: 'zz', outcome: 'none' });
    wait(SETTLE_MS);
    expect(result.current).toBe('hidden');
  });

  it('never stays up longer than four seconds', () => {
    const { result } = peek({ query: 'ra', outcome: 'pending' });
    wait(MAX_UP_MS - 1);
    expect(result.current).toBe('watching');
    wait(1);
    expect(result.current).toBe('hidden');
  });

  it('stays hidden when switched off, without a late peek when switched back on', () => {
    const { result, rerender } = peek({ query: 'ra', enabled: false });
    expect(result.current).toBe('hidden');
    rerender({ query: 'ra', outcome: 'pending', enabled: true });
    expect(result.current).toBe('hidden');
  });

  it("stays hidden once the day's peeks are used", () => {
    const { result, rerender } = peek();
    for (let i = 0; i < PEEKS_PER_DAY; i += 1) {
      rerender({ query: 'ra', outcome: 'pending', enabled: true });
      expect(result.current).toBe('watching');
      rerender({ query: '', outcome: 'pending', enabled: true });
    }
    rerender({ query: 'ra', outcome: 'pending', enabled: true });
    expect(result.current).toBe('hidden');
  });

  it('leaves nothing running after the page goes', () => {
    const set = vi.spyOn(globalThis, 'setTimeout');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    peek({ query: 'ra', outcome: 'found' }).unmount();
    // React schedules zero-delay work of its own; every peek timer has a delay.
    const peekTimers = set.mock.calls.flatMap((call, i) =>
      call[1] ? [set.mock.results[i].value] : [],
    );
    expect(peekTimers).toHaveLength(2);
    expect(clear.mock.calls.map(([id]) => id)).toEqual(expect.arrayContaining(peekTimers));
  });
});
