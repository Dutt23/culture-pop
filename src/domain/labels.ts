import {
  CATEGORY_ORDER,
  type BrowsableCategory,
  type CategoryFilter,
  type EraKey,
} from './discovery';
import type { RankedMatch } from './ranking';
import {
  isFromOnline,
  type Category,
  type PackCeiling,
  type PresentIn,
  type Provenance,
  type Reference,
} from './types';

export const CATEGORY_LABEL: Readonly<Record<Category, string>> = {
  anime: 'Anime',
  cartoon: 'Cartoon',
  comics: 'Comics',
  games: 'Games',
  film: 'Film',
  tv: 'TV',
  meme: 'Meme',
  catchphrase: 'Catchphrase',
  music: 'Music',
  saying: 'Saying',
  other: 'Other',
};

export const CEILING_LABEL: Readonly<Record<PackCeiling, string>> = {
  before_watching: 'Before you watch',
  open: 'My spoiler setting',
};

/** What a pack's spoiler choice does, in one plain line under the control. */
export const CEILING_HINT: Readonly<Record<PackCeiling, string>> = {
  before_watching: 'Cards opened from this pack hide story spoilers, whatever your Settings say.',
  open: 'Cards opened from this pack follow your spoiler choice in Settings.',
};

/** The pinned pack (`Pack.now`): listed first in your packs and in pack search. */
export const PINNED_LABEL = 'Pinned';

export const CATEGORY_PLURAL_LABEL: Readonly<Record<Category, string>> = {
  anime: 'Anime',
  cartoon: 'Cartoons',
  comics: 'Comics',
  games: 'Games',
  film: 'Film',
  tv: 'TV',
  meme: 'Memes',
  catchphrase: 'Catchphrases',
  music: 'Music',
  saying: 'Sayings',
  other: 'Other',
};

/** How to find something for an empty category: one example search each. */
export const SEARCH_HINT: Readonly<Record<BrowsableCategory, string>> = {
  anime: 'Search a series, like Cowboy Bebop, to find one.',
  cartoon: 'Search a show, like SpongeBob SquarePants, to find one.',
  comics: 'Search a character, like Doctor Doom, to find one.',
  games: 'Search a game, like Among Us, to find one.',
  film: 'Search a film, like The Matrix, to find one.',
  tv: 'Search a series, like Breaking Bad, to find one.',
  meme: 'Search a meme, like 6-7, to find one.',
  catchphrase: 'Search a line, like Hasta la vista, baby, to find one.',
  music: 'Search a song, like Bohemian Rhapsody, to find one.',
  saying: 'Search a phrase, like Break a leg, to find one.',
};

/** Browsable categories: the canonical order, without the catch-all "other". */
export const CATEGORIES: readonly BrowsableCategory[] = CATEGORY_ORDER.filter(
  (c): c is BrowsableCategory => c !== 'other',
);

/** "No games yet. Search a game, like Among Us, to find one." Acronyms like TV keep their case. */
export function emptyCategoryNote(category: BrowsableCategory): string {
  const label = CATEGORY_PLURAL_LABEL[category];
  const name = label === label.toUpperCase() ? label : label.toLowerCase();
  return `No ${name} yet. ${SEARCH_HINT[category]}`;
}

/**
 * Says where the surprise came from: the chosen category (or the library), what the reader opened
 * online when the pool holds any, and, after a fallback, that the category had nothing.
 */
export function surpriseNote(
  pool: readonly Reference[],
  filter: CategoryFilter,
  fellBack: boolean,
): string {
  if (fellBack && filter !== 'all') {
    const name = CATEGORY_PLURAL_LABEL[filter];
    return `Nothing in ${name} yet, so this is a random pick from everything.`;
  }
  const from = filter === 'all' ? 'your library' : CATEGORY_PLURAL_LABEL[filter];
  const online = pool.some((r) => isFromOnline(r.editorialState))
    ? " and what you've opened online"
    : '';
  return `A random pick from ${from}${online}, not a trend.`;
}

export const ERA_LABEL: Readonly<Record<EraKey, string>> = {
  earlier: 'Before 1990',
  '1990s': '1990s',
  '2000s': '2000s',
  '2010s+': '2010s & later',
  timeless: 'Timeless',
};

export const PROVENANCE_LABEL: Readonly<Record<Provenance, string>> = {
  seed_curated: 'Demo entry · written by the editor, not externally verified',
  source_supported: 'Backed by cited sources',
  model_suggested: 'Model suggestion · unverified',
  unverified: 'Unverified',
};

/** Why a result is listed, in plain words (docs/SEARCH_RANKING.md). */
export function matchReason(match: RankedMatch): string {
  switch (match.kind) {
    case 'exact_title':
      return 'Exact title';
    case 'exact_alias':
      return `Also known as \u201c${match.matchedPhrase}\u201d`;
    case 'title_prefix':
    case 'alias_prefix':
      return 'Starts with your search';
    case 'partial':
      return 'Possible match';
    case 'in_message':
      return `Found \u201c${match.matchedPhrase}\u201d in your text`;
    case 'typo':
      return 'Similar spelling';
    case 'sound':
      return 'Sounds like your search';
  }
}

const MAX_FROM_WORKS = 3;

/**
 * Each work once. Wikidata gives the comic and its films as different works with the same name
 * ("Fantastic Four" three times), and one work can come under two labels; either reads as a repeat.
 * A work is a repeat when its qid or its name (any case) was already seen; the first is kept.
 */
export function distinctWorks(works: readonly PresentIn[]): PresentIn[] {
  const qids = new Set<string>();
  const names = new Set<string>();
  return works.filter((work) => {
    const name = work.label.toLowerCase();
    if (qids.has(work.qid) || names.has(name)) return false;
    qids.add(work.qid);
    names.add(name);
    return true;
  });
}

/**
 * The works shown as "From: …": where Wikidata says a reference appears (P1441), then what it was
 * inspired by (P941), each name once, at most three.
 */
export function fromWorks(reference: Reference): PresentIn[] {
  return distinctWorks([...(reference.presentIn ?? []), ...(reference.inspiredBy ?? [])]).slice(
    0,
    MAX_FROM_WORKS,
  );
}
