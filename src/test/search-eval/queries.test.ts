import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { EVAL_CASES } from './queries';
import { casesFor, meaningIds } from './report';

const QID = /^Q[1-9]\d*$/;

describe('search evaluation set', () => {
  it('has unique case IDs', () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('meets the Phase 3 size targets', () => {
    const scored = EVAL_CASES.filter((c) => c.status === 'scored');
    expect(scored.length).toBeGreaterThanOrEqual(30);
    expect(scored.filter((c) => c.ambiguous || c.indian).length).toBeGreaterThanOrEqual(30);
  });

  it('gives every scored case an answer and every ambiguous case two meanings', () => {
    for (const c of EVAL_CASES.filter((e) => e.status === 'scored')) {
      expect(c.meanings.length, c.id).toBeGreaterThan(0);
      if (c.ambiguous) expect(c.meanings.length, c.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses well-formed QIDs', () => {
    for (const qid of EVAL_CASES.flatMap((c) => c.meanings.flatMap((m) => m.qids ?? []))) {
      expect(qid).toMatch(QID);
    }
  });

  it('points local answers at references that exist in the seed', () => {
    const seeded = new Set(buildSeed().references.map((r) => r.id));
    const localIds = casesFor('local').flatMap((c) =>
      c.meanings.flatMap((m) => [...meaningIds(m, 'local')]),
    );
    expect(localIds.length).toBeGreaterThan(0);
    for (const id of localIds) expect(seeded.has(id), id).toBe(true);
  });

  it('maps meanings to the IDs retrieve() and rankReferences() emit', () => {
    const meaning = { label: 'x', qids: ['Q1'], wiktionary: ["d'oh"], local: ['doh-simpsons'] };
    expect([...meaningIds(meaning, 'live')]).toEqual(['wd:Q1', "enwiktionary:d'oh"]);
    expect([...meaningIds(meaning, 'local')]).toEqual(['doh-simpsons']);
  });
});
