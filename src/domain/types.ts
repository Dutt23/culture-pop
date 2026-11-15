export type Category = 'cartoon' | 'film' | 'tv' | 'meme' | 'catchphrase' | 'music' | 'saying';

/** Editorial browse era. Not a sourced release date — see `Reference.year` for that. */
export type Decade = '1990s' | '2000s' | '2010s+';

export type EditorialState = 'demo' | 'published';

/** How an interpretation was created. */
export type Provenance = 'seed_curated' | 'source_supported' | 'model_suggested' | 'unverified';

/** Quality of attached evidence. A model's assertion alone never makes this `supported`. */
export type Evidence = 'supported' | 'uncertain' | 'unverified';

/** Personal acknowledgement only; set solely by an explicit "This is what I meant" control. */
export type Selection = 'user_confirmed' | null;

export type SpoilerLevel = 'none' | 'major';

export interface Reference {
  id: string;
  title: string;
  normalizedTitle: string;
  category: Category;
  origin?: string;
  /** Only present when backed by a source. */
  year?: number;
  decade?: Decade;
  tags: string[];
  editorialState: EditorialState;
  createdAt: string;
  updatedAt: string;
}

export interface Interpretation {
  id: string;
  referenceId: string;
  label: string;
  summary: string;
  context: string;
  usageExample: string;
  spoiler: SpoilerLevel;
  sourceIds: string[];
  provenance: Provenance;
  evidence: Evidence;
  selection: Selection;
  createdAt: string;
  updatedAt: string;
}

export interface Alias {
  id: string;
  phrase: string;
  normalizedPhrase: string;
  referenceId: string;
}

export interface Source {
  id: string;
  url: string;
  publisher: string;
  sourceType: 'encyclopedia' | 'dictionary' | 'official' | 'other';
  retrievedAt?: string;
  attribution?: string;
  evidenceNote?: string;
}

export interface Favourite {
  referenceId: string;
  savedAt: string;
}

export interface Setting {
  key: string;
  value: string;
}
