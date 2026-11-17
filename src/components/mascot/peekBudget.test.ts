import { afterEach, describe, expect, it, vi } from 'vitest';
import { PEEK_KEY, PEEKS_PER_DAY, takePeek } from './peekBudget';

const MONDAY = new Date(2026, 10, 16, 23, 50);
const TUESDAY = new Date(2026, 10, 17, 0, 5);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('takePeek', () => {
  it('allows three peeks a day, then none', () => {
    const taken = Array.from({ length: PEEKS_PER_DAY + 2 }, () => takePeek(MONDAY));
    expect(taken).toEqual([true, true, true, false, false]);
  });

  it('starts again the next day', () => {
    for (let i = 0; i < PEEKS_PER_DAY; i += 1) takePeek(MONDAY);
    expect(takePeek(MONDAY)).toBe(false);
    expect(takePeek(TUESDAY)).toBe(true);
  });

  it('refuses when the saved count is garbled', () => {
    localStorage.setItem(PEEK_KEY, '2026-11-16:lots');
    expect(takePeek(MONDAY)).toBe(false);
  });

  it('refuses when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(takePeek(MONDAY)).toBe(false);
  });
});
