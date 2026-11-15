import { describe, expect, it } from 'vitest';
import { isAmbiguous, rankReferences } from '../domain/ranking';
import { buildSeed } from './seed';

const seed = buildSeed();

describe('seed content', () => {
  it('has at least 12 demo references across the required categories', () => {
    expect(seed.references.length).toBeGreaterThanOrEqual(12);
    const categories = new Set(seed.references.map((r) => r.category));
    for (const required of ['cartoon', 'film', 'tv', 'meme', 'saying'] as const) {
      expect(categories).toContain(required);
    }
    expect(seed.references.every((r) => r.editorialState === 'demo')).toBe(true);
  });

  it.each(['hakuna matata', 'let it go'])(
    '"%s" is ambiguous across different references',
    (query) => {
      const matches = rankReferences(query, seed.references, seed.aliases);
      expect(isAmbiguous(matches)).toBe(true);
      expect(new Set(matches.map((m) => m.reference.id)).size).toBeGreaterThanOrEqual(2);
    },
  );

  it('includes at least one spoiler-gated interpretation', () => {
    expect(seed.interpretations.some((i) => i.spoiler === 'major')).toBe(true);
  });

  it('marks every interpretation seed_curated, unconfirmed and without invented sources', () => {
    for (const interpretation of seed.interpretations) {
      expect(interpretation.provenance).toBe('seed_curated');
      expect(interpretation.selection).toBeNull();
      expect(interpretation.sourceIds).toEqual([]);
    }
  });

  it('stores no unsourced years', () => {
    expect(seed.references.every((r) => r.year === undefined)).toBe(true);
  });

  it('has unique ids and aliases that point at existing references', () => {
    const referenceIds = new Set(seed.references.map((r) => r.id));
    expect(referenceIds.size).toBe(seed.references.length);
    expect(new Set(seed.interpretations.map((i) => i.id)).size).toBe(seed.interpretations.length);
    expect(new Set(seed.aliases.map((a) => a.id)).size).toBe(seed.aliases.length);
    for (const alias of seed.aliases) expect(referenceIds).toContain(alias.referenceId);
    for (const i of seed.interpretations) expect(referenceIds).toContain(i.referenceId);
  });

  it('gives every reference at least one interpretation', () => {
    const withMeaning = new Set(seed.interpretations.map((i) => i.referenceId));
    expect(seed.references.every((r) => withMeaning.has(r.id))).toBe(true);
  });
});
