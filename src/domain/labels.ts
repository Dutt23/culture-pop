import type { EraKey } from './discovery';
import type { Category, Provenance } from './types';

export const CATEGORY_LABEL: Readonly<Record<Category, string>> = {
  cartoon: 'Cartoon',
  film: 'Film',
  tv: 'TV',
  meme: 'Meme',
  catchphrase: 'Catchphrase',
  music: 'Music',
  saying: 'Saying',
};

export const CATEGORY_PLURAL_LABEL: Readonly<Record<Category, string>> = {
  cartoon: 'Cartoons',
  film: 'Film',
  tv: 'TV',
  meme: 'Memes',
  catchphrase: 'Catchphrases',
  music: 'Music',
  saying: 'Sayings',
};

export const CATEGORIES: readonly Category[] = [
  'cartoon',
  'film',
  'tv',
  'meme',
  'catchphrase',
  'music',
  'saying',
];

export const ERA_LABEL: Readonly<Record<EraKey, string>> = {
  '1990s': '1990s',
  '2000s': '2000s',
  '2010s+': '2010s & later',
  timeless: 'Timeless sayings',
};

export const PROVENANCE_LABEL: Readonly<Record<Provenance, string>> = {
  seed_curated: 'Demo entry · written by the editor, not externally verified',
  source_supported: 'Backed by cited sources',
  model_suggested: 'Model suggestion · unverified',
  unverified: 'Unverified',
};
