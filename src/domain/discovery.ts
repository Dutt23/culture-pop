import { compareReferences } from './collections';
import { isWikiquoteReference } from './sources';
import { isFromOnline, type Category, type Decade, type Reference } from './types';

/** Canonical category order for every screen; `labels.ts` derives `CATEGORIES` from it. */
export const CATEGORY_ORDER: readonly Category[] = [
  'anime',
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

/** The categories that have a chip: everything but the catch-all "other". */
export type BrowsableCategory = Exclude<Category, 'other'>;

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

/**
 * What Discover lists. The library always; a found-online reference only when the reader opened it
 * from a search or favourited it, so strangers' search results never fill the page. A Wikiquote
 * quote page and an unexplained (`retrieved`) result are never listed.
 */
export function discoverable(
  references: readonly Reference[],
  opened: ReadonlySet<string>,
  favourites: ReadonlySet<string>,
): Reference[] {
  return references.filter((r) => {
    if (!isFromOnline(r.editorialState)) return true;
    if (r.editorialState === 'retrieved' || isWikiquoteReference(r.id)) return false;
    return opened.has(r.id) || favourites.has(r.id);
  });
}

/**
 * Groups by era (the sourced year first, else the editorial decade), each in title order like the
 * type view. Empty eras are omitted.
 */
export function groupByEra(
  references: readonly Reference[],
): { era: EraKey; references: Reference[] }[] {
  return ERA_ORDER.map((era) => ({
    era,
    references: references.filter((r) => eraOf(r) === era).sort(compareReferences),
  })).filter((group) => group.references.length > 0);
}

/** Groups by category in canonical order, each in title order. Empty categories are omitted. */
export function groupByCategory(
  references: readonly Reference[],
): { category: Category; references: Reference[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    references: references.filter((r) => r.category === category).sort(compareReferences),
  })).filter((group) => group.references.length > 0);
}

/** The browsable categories nothing is filed under yet, in canonical order. */
export function emptyCategories(references: readonly Reference[]): BrowsableCategory[] {
  const used = new Set(references.map((r) => r.category));
  return CATEGORY_ORDER.filter((c): c is BrowsableCategory => c !== 'other' && !used.has(c));
}

/**
 * What "Surprise me" draws from: the chosen category, or everything (`fellBack`) when it has
 * nothing, so the page can say so instead of changing the pick silently.
 */
export function surprisePool(
  references: readonly Reference[],
  filter: CategoryFilter,
): { pool: Reference[]; fellBack: boolean } {
  const inCategory = filterByCategory(references, filter);
  return inCategory.length > 0
    ? { pool: inCategory, fellBack: false }
    : { pool: [...references], fellBack: filter !== 'all' };
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
