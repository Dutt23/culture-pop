import { describe, expect, it } from 'vitest';
import {
  HISTORY_TTL_MS,
  isExpired,
  recordSearch,
  soundsAlike,
  type HistoryChanges,
  type HistoryEntry,
  type HistoryLimits,
  type HistorySearch,
} from './history';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 15, 9);

function apply(entries: readonly HistoryEntry[], changes: HistoryChanges): HistoryEntry[] {
  const removed = new Set(changes.remove);
  const kept = entries.filter((e) => !removed.has(e.id));
  const put = new Map(changes.put.map((e) => [e.id, e]));
  return [...kept.filter((e) => !put.has(e.id)), ...changes.put];
}

/** Runs searches in order, as the repository would, and returns the stored entries. */
function run(
  searches: readonly (HistorySearch & { at: number })[],
  limits?: HistoryLimits,
  start: readonly HistoryEntry[] = [],
): HistoryEntry[] {
  return searches.reduce<HistoryEntry[]>(
    (entries, { at, ...search }) => apply(entries, recordSearch(entries, search, at, limits)),
    [...start],
  );
}

function find(entries: readonly HistoryEntry[], label: string): HistoryEntry | undefined {
  return entries.find((e) => e.label === label);
}

function scoreOf(entries: readonly HistoryEntry[], label: string): number {
  const entry = find(entries, label);
  if (!entry) throw new Error(`no entry labelled ${label}`);
  return entry.score;
}

describe('recordSearch: tiers', () => {
  it('starts every new search in Recent', () => {
    const [entry] = run([{ text: '  Point   Break ', at: T0 }]);
    expect(entry).toMatchObject({ tier: 'recent', label: 'Point Break', count: 1, days: 1 });
  });

  it('records nothing for blank or punctuation-only text', () => {
    expect(recordSearch([], { text: '  ?! ' }, T0)).toEqual({ put: [], remove: [] });
  });

  it('promotes to Frequent after a second search on a different day', () => {
    const entries = run([
      { text: 'bazinga', at: T0 },
      { text: 'bazinga', at: T0 + DAY },
    ]);
    expect(find(entries, 'bazinga')).toMatchObject({ tier: 'frequent', count: 2, days: 2 });
  });

  it('needs three searches to promote when they are all on the same day', () => {
    const twice = run([
      { text: 'bazinga', at: T0 },
      { text: 'bazinga', at: T0 + 2 * HOUR },
    ]);
    expect(find(twice, 'bazinga')).toMatchObject({ tier: 'recent', count: 2, days: 1 });

    const thrice = run([
      { text: 'bazinga', at: T0 },
      { text: 'bazinga', at: T0 + 2 * HOUR },
      { text: 'bazinga', at: T0 + 4 * HOUR },
    ]);
    expect(find(thrice, 'bazinga')).toMatchObject({ tier: 'frequent', count: 3 });
  });

  it('counts a submit followed by opening a result as one search', () => {
    const entries = run([
      { text: 'the matrix', at: T0 },
      { text: 'the matrix', referenceId: 'wd:Q83495', at: T0 + 60_000 },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ count: 1, referenceIds: ['wd:Q83495'], tier: 'recent' });
  });

  it('evicts the least recently used Recent entry when Recent is full', () => {
    const entries = run(
      [
        { text: 'one', at: T0 },
        { text: 'two', at: T0 + HOUR },
        { text: 'three', at: T0 + 2 * HOUR },
      ],
      { recent: 2, frequent: 2 },
    );
    expect(entries.map((e) => e.label).sort()).toEqual(['three', 'two']);
  });

  it('demotes the lowest-scoring Frequent entry to Recent instead of deleting it', () => {
    const entries = run(
      [
        { text: 'old habit', at: T0 },
        { text: 'old habit', at: T0 + DAY },
        { text: 'new habit', at: T0 + 30 * DAY },
        { text: 'new habit', at: T0 + 31 * DAY },
      ],
      { recent: 5, frequent: 1 },
    );
    expect(find(entries, 'new habit')?.tier).toBe('frequent');
    expect(find(entries, 'old habit')).toMatchObject({ tier: 'recent', count: 2 });
  });

  it('lets a demoted entry be evicted from Recent like any other', () => {
    const entries = run(
      [
        { text: 'old habit', at: T0 },
        { text: 'old habit', at: T0 + DAY },
        { text: 'new habit', at: T0 + 30 * DAY },
        { text: 'new habit', at: T0 + 31 * DAY },
        { text: 'passing', at: T0 + 32 * DAY },
      ],
      { recent: 1, frequent: 1 },
    );
    expect(entries.map((e) => e.label).sort()).toEqual(['new habit', 'passing']);
  });
});

describe('recordSearch: expiry and score', () => {
  it('drops entries untouched for more than 90 days on the next write', () => {
    const start = run([{ text: 'ancient', at: T0 }]);
    const later = T0 + HISTORY_TTL_MS + 1;
    expect(isExpired(start[0], later)).toBe(true);
    expect(isExpired(start[0], T0 + HISTORY_TTL_MS)).toBe(false);

    const changes = recordSearch(start, { text: 'fresh' }, later);
    expect(changes.remove).toContain(start[0].id);
    expect(apply(start, changes).map((e) => e.label)).toEqual(['fresh']);
  });

  it('starts an expired search over instead of continuing its count', () => {
    const entries = run([
      { text: 'bazinga', at: T0 },
      { text: 'bazinga', at: T0 + HISTORY_TTL_MS + DAY },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ count: 1, tier: 'recent' });
  });

  it('ranks by decayed frequency: many old searches lose to one recent one', () => {
    const entries = run([
      { text: 'old', at: T0 },
      { text: 'old', at: T0 + DAY },
      { text: 'old', at: T0 + 2 * DAY },
      { text: 'new', at: T0 + 80 * DAY },
    ]);
    expect(scoreOf(entries, 'new')).toBeGreaterThan(scoreOf(entries, 'old'));
  });

  it('ranks by decayed frequency: three searches yesterday beat one today', () => {
    const entries = run([
      { text: 'busy', at: T0 },
      { text: 'busy', at: T0 + 2 * HOUR },
      { text: 'busy', at: T0 + 4 * HOUR },
      { text: 'once', at: T0 + DAY },
    ]);
    expect(scoreOf(entries, 'busy')).toBeGreaterThan(scoreOf(entries, 'once'));
  });

  it('stores a score that never needs recomputing: its order holds at any later time', () => {
    // Weight at time T is e^(score − λT): the same λT is subtracted from every entry.
    const [a, b] = run([
      { text: 'alpha', at: T0 },
      { text: 'beta', at: T0 + DAY },
    ]);
    const stored = Math.sign(a.score - b.score);
    for (const later of [T0 + DAY, T0 + 60 * DAY]) {
      const shift = (Math.LN2 / 30) * (later / DAY);
      expect(Math.sign(Math.exp(a.score - shift) - Math.exp(b.score - shift))).toBe(stored);
    }
  });
});

describe('recordSearch: one entry per meaning', () => {
  it('merges spellings that normalize the same, labelled with the most used one', () => {
    const entries = run([
      { text: "D'oh", at: T0 },
      { text: 'doh', at: T0 + DAY },
      { text: 'doh', at: T0 + 2 * DAY },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe('doh');
  });

  it('merges "point breakz" into "point break"', () => {
    const entries = run([
      { text: 'point break', at: T0 },
      { text: 'point breakz', at: T0 + DAY },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ count: 2, tier: 'frequent' });
  });

  it('merges "cash me outside" and "catch me outside"', () => {
    const entries = run([
      { text: 'catch me outside', at: T0 },
      { text: 'cash me outside', at: T0 + DAY },
      { text: 'cash me outside', at: T0 + 2 * DAY },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe('cash me outside');
  });

  it('keeps "break point" and "point break" apart', () => {
    const entries = run([
      { text: 'point break', at: T0 },
      { text: 'break point', at: T0 + HOUR },
    ]);
    expect(entries).toHaveLength(2);
  });

  it('keeps different phrases apart even when they opened the same reference', () => {
    const entries = run([
      { text: 'the matrix', referenceId: 'wd:Q83495', at: T0 },
      { text: 'red pill', referenceId: 'wd:Q83495', at: T0 + DAY },
    ]);
    expect(entries.map((e) => e.label).sort()).toEqual(['red pill', 'the matrix']);
    expect(find(entries, 'red pill')).toMatchObject({ count: 1, tier: 'recent' });
  });
});

describe('soundsAlike', () => {
  it.each([
    ['point break', 'point breakz'],
    ['catch me outside', 'cash me outside'],
    ['bazinga', 'bazingaa'],
  ])('matches %s ~ %s', (a, b) => {
    expect(soundsAlike(a, b)).toBe(true);
  });

  it.each([
    ['point break', 'break point', 'word order'],
    ['let it go', 'let it be', 'a different last word'],
    ['rocky 2', 'rocky 3', 'different numbers'],
    ['cat', 'hat', 'too few letters for an edit'],
    ['the matrix', 'the matrix reloaded', 'a different word count'],
    ['शोले', 'शोलो', 'non-Latin text'],
  ])('keeps %s and %s apart (%s)', (a, b) => {
    expect(soundsAlike(a, b)).toBe(false);
  });
});
