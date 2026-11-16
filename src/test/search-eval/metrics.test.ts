import { describe, expect, it } from 'vitest';
import { latencySummary, percentile, scoreCase, summarize } from './metrics';

const song = new Set(['wd:Q1', 'local-song']);
const phrase = new Set(['enwiktionary:x']);

describe('scoreCase', () => {
  it('finds the first acceptable result across meanings', () => {
    const score = scoreCase(['wd:Q9', 'enwiktionary:x', 'wd:Q1'], [song, phrase], true);
    expect(score.rank).toBe(2);
    expect(score.incorrectTop).toBe(true);
    expect(score.meaningsInTopK).toBe(2);
    expect(score.ambiguityScored).toBe(true);
  });

  it('counts only the top 5 for meaning coverage', () => {
    const ranked = ['wd:Q1', 'a', 'b', 'c', 'd', 'enwiktionary:x'];
    expect(scoreCase(ranked, [song, phrase], true).meaningsInTopK).toBe(1);
  });

  it('separates an empty list from a wrong first result', () => {
    expect(scoreCase([], [song], false)).toMatchObject({
      rank: null,
      noResults: true,
      incorrectTop: false,
    });
    expect(scoreCase(['wd:Q9'], [song], false)).toMatchObject({
      rank: null,
      noResults: false,
      incorrectTop: true,
    });
  });

  it('does not score ambiguity when fewer than two meanings have IDs', () => {
    expect(scoreCase(['wd:Q1'], [song, new Set()], true).ambiguityScored).toBe(false);
    expect(scoreCase(['wd:Q1'], [song, phrase], false).ambiguityScored).toBe(false);
  });
});

describe('summarize', () => {
  it('computes Recall@5, MRR@10, error rates and ambiguity coverage', () => {
    const scores = [
      scoreCase(['wd:Q1'], [song], false), // rank 1
      scoreCase(['a', 'b', 'wd:Q1'], [song], false), // rank 3
      scoreCase(['a', 'b', 'c', 'd', 'e', 'f', 'wd:Q1'], [song], false), // rank 7: in MRR@10, not R@5
      scoreCase([], [song], false), // no results
      scoreCase(['wd:Q1', 'enwiktionary:x'], [song, phrase], true), // both meanings
      scoreCase(['wd:Q1'], [song, phrase], true), // one meaning
    ];
    const summary = summarize(scores);
    expect(summary.cases).toBe(6);
    expect(summary.recallAt5).toBeCloseTo(4 / 6);
    expect(summary.mrrAt10).toBeCloseTo((1 + 1 / 3 + 1 / 7 + 0 + 1 + 1) / 6);
    expect(summary.incorrectTopRate).toBeCloseTo(2 / 6);
    expect(summary.noResultRate).toBeCloseTo(1 / 6);
    expect(summary.ambiguityCases).toBe(2);
    expect(summary.ambiguityCoverage).toBeCloseTo(0.5);
  });

  it('gives zero MRR beyond rank 10', () => {
    const ranked = [...Array.from({ length: 10 }, (_, i) => `x${i}`), 'wd:Q1'];
    expect(summarize([scoreCase(ranked, [song], false)]).mrrAt10).toBe(0);
  });

  it('reports null ambiguity coverage and zero rates for an empty group', () => {
    expect(summarize([])).toMatchObject({ cases: 0, recallAt5: 0, ambiguityCoverage: null });
  });
});

describe('percentile', () => {
  it('uses the nearest-rank method on unsorted input', () => {
    const values = [50, 10, 40, 20, 30];
    expect(percentile(values, 50)).toBe(30);
    expect(percentile(values, 90)).toBe(50);
    expect(percentile(values, 0)).toBe(10);
    expect(latencySummary(values)).toEqual({ p50: 30, p90: 50, p95: 50, max: 50 });
  });

  it('is NaN for no samples', () => {
    expect(percentile([], 50)).toBeNaN();
  });
});
