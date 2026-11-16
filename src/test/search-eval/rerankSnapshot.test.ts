import { describe, expect, it } from 'vitest';
import { rerankCandidates } from '../../services/retrieval/rerank';
import {
  capturedCases,
  exactTitleCases,
  keepOrder,
  loadSnapshot,
  scoreSnapshot,
  summaryOf,
  worsened,
  type Order,
} from './rerankEval';
import { splitCases } from './split';

const snapshot = loadSnapshot();
const cases = capturedCases(snapshot);
const { tuning, heldOut } = splitCases(cases);
const reranked: Order = (query, candidates) => rerankCandidates(query, candidates);

describe('reranker against the captured live snapshot (offline)', () => {
  it('splits the cases into two disjoint halves that cover every case', () => {
    expect(tuning.length + heldOut.length).toBe(cases.length);
    const ids = new Set([...tuning, ...heldOut].map((c) => c.id));
    expect(ids.size).toBe(cases.length);
    // A case and its misremembered variant never land in different halves.
    for (const c of cases.filter((e) => e.id.endsWith('-v'))) {
      const base = c.id.replace(/-v$/, '');
      const half = tuning.some((t) => t.id === c.id) ? tuning : heldOut;
      expect(
        half.some((t) => t.id === base),
        c.id,
      ).toBe(true);
    }
  });

  it('does not make the held-out half worse', () => {
    const before = summaryOf(scoreSnapshot(snapshot, heldOut, keepOrder));
    const after = summaryOf(scoreSnapshot(snapshot, heldOut, reranked));
    expect(after.mrrAt10).toBeGreaterThan(before.mrrAt10);
    expect(after.incorrectTopRate).toBeLessThanOrEqual(before.incorrectTopRate);
  });

  it('never pushes an exact-title answer further down', () => {
    const exact = new Set(exactTitleCases(snapshot, cases).map((c) => c.id));
    const worse = worsened(
      scoreSnapshot(snapshot, cases, keepOrder),
      scoreSnapshot(snapshot, cases, reranked),
    ).filter((c) => exact.has(c.id));
    expect(worse).toEqual([]);
  });

  it('keeps every candidate: only the order changes', () => {
    for (const evalCase of cases) {
      const raw = snapshot.cases[evalCase.id]?.candidates ?? [];
      const ordered = rerankCandidates(evalCase.query, raw);
      expect(ordered.map((c) => c.id).sort()).toEqual(raw.map((c) => c.id).sort());
    }
  });
});
