import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REST_AFTER_MS, useResting } from './useResting';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const fire = (type: string) => act(() => void window.dispatchEvent(new Event(type)));

describe('useResting', () => {
  it('is awake at the start and rests after 20 s with no events', () => {
    const { result } = renderHook(() => useResting());
    expect(result.current).toBe(false);
    advance(REST_AFTER_MS - 1);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it.each(['pointerdown', 'scroll'])('wakes on %s and rests again 20 s later', (type) => {
    const { result } = renderHook(() => useResting());
    advance(REST_AFTER_MS);
    expect(result.current).toBe(true);

    fire(type);
    expect(result.current).toBe(false);
    advance(REST_AFTER_MS - 1);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it('counts the 20 s from the last event, not the first', () => {
    const { result } = renderHook(() => useResting());
    advance(15_000);
    fire('scroll');
    advance(15_000);
    expect(result.current).toBe(false);
    advance(5_000);
    expect(result.current).toBe(true);
  });

  it('stays awake when disabled', () => {
    const { result } = renderHook(() => useResting(REST_AFTER_MS, false));
    advance(REST_AFTER_MS * 3);
    expect(result.current).toBe(false);
  });
});
