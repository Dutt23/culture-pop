import type { Category, Decade, Reference } from './types';

/** Canonical category order for every screen; `labels.ts` derives `CATEGORIES` from it. */
export const CATEGORY_ORDER: readonly Category[] = [
  'cartoon',
  'comics',
  'games',
  'film',
  'tv',
  'meme',
  'catchphrase',
  'music',
  'saying',
  'other',
];

export type EraKey = 'earlier' | Decade | 'timeless';

const ERA_ORDER: readonly EraKey[] = ['earlier', '1990s', '2000s', '2010s+', 'timeless'];

const FIRST_TRACKED_YEAR = 1990;

/** A sourced year wins over the editorial decade label. */
export function eraOf(reference: Pick<Reference, 'year' | 'decade'>): EraKey {
  const { year } = reference;
  if (year === undefined) return reference.decade ?? 'timeless';
  if (year < FIRST_TRACKED_YEAR) return 'earlier';
  if (year < 2000) return '1990s';
  if (year < 2010) return '2000s';
  return '2010s+';
}

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
    references: references.filter((r) => eraOf(r) === era),
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

export interface ResultFilter {
  category: CategoryFilter;
  era: EraKey | 'all';
}

export const NO_FILTER: ResultFilter = { category: 'all', era: 'all' };

type Filterable = Pick<Reference, 'category' | 'year' | 'decade'>;

export function matchesFilter(item: Filterable, filter: ResultFilter): boolean {
  return (
    (filter.category === 'all' || item.category === filter.category) &&
    (filter.era === 'all' || eraOf(item) === filter.era)
  );
}

/** Only offer filters that would leave something to show, in canonical order. */
export function filterOptions(items: readonly Filterable[]): {
  categories: Category[];
  eras: EraKey[];
} {
  const categories = new Set(items.map((i) => i.category));
  const eras = new Set(items.map(eraOf));
  return {
    categories: CATEGORY_ORDER.filter((c) => categories.has(c)),
    eras: ERA_ORDER.filter((e) => eras.has(e)),
  };
}
