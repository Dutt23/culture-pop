import type { Category, Decade, Reference } from './types';

export type EraKey = Decade | 'timeless';

const ERA_ORDER: readonly EraKey[] = ['1990s', '2000s', '2010s+', 'timeless'];

export type CategoryFilter = Category | 'all';

export function filterByCategory(
  references: readonly Reference[],
  filter: CategoryFilter,
): Reference[] {
  return filter === 'all' ? [...references] : references.filter((r) => r.category === filter);
}

/** Groups by editorial era, keeping input order inside each group. Empty eras are omitted. */
export function groupByEra(
  references: readonly Reference[],
): { era: EraKey; references: Reference[] }[] {
  return ERA_ORDER.map((era) => ({
    era,
    references: references.filter((r) => (r.decade ?? 'timeless') === era),
  })).filter((group) => group.references.length > 0);
}

/** mulberry32 — small seeded PRNG so decorative discovery order is reproducible in tests. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a new shuffled array; never mutates the input. Never use for factual rankings. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const random = createRandom(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
