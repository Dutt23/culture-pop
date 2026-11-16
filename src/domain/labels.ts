import { CATEGORY_ORDER, type EraKey } from './discovery';
import type { RankedMatch } from './ranking';
import type { Category, Provenance } from './types';

export const CATEGORY_LABEL: Readonly<Record<Category, string>> = {
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

export const CATEGORY_PLURAL_LABEL: Readonly<Record<Category, string>> = {
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

/** Browsable categories: the canonical order, without the catch-all "other". */
export const CATEGORIES: readonly Category[] = CATEGORY_ORDER.filter((c) => c !== 'other');

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
    case 'typo':
      return 'Similar spelling';
    case 'sound':
      return 'Sounds like your search';
  }
}
