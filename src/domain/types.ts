export type Category =
  | 'cartoon'
  | 'film'
  | 'tv'
  | 'meme'
  | 'catchphrase'
  | 'music'
  | 'saying'
  | 'other';

/** What the reference *is*: a whole work (film, show, song), or something said or shared. */
export type ReferenceKind = 'work' | 'quote' | 'phrase' | 'meme' | 'character' | 'other';

/** Editorial browse era. Not a sourced release date — see `Reference.year` for that. */
export type Decade = '1990s' | '2000s' | '2010s+';

/** `retrieved` = gathered from sources, not yet curated or explained. */
export type EditorialState = 'demo' | 'published' | 'retrieved';

/** How an interpretation was created. */
export type Provenance = 'seed_curated' | 'source_supported' | 'model_suggested' | 'unverified';

/** Quality of attached evidence. A model's assertion alone never makes this `supported`. */
export type Evidence = 'supported' | 'uncertain' | 'unverified';

/** Personal acknowledgement only; set solely by an explicit "This is what I meant" control. */
export type Selection = 'user_confirmed' | null;

export type SpoilerLevel = 'none' | 'major';

/** An exact page about a reference on another site, from Wikidata's external IDs. Tap-only. */
export interface ExternalLink {
  label: string;
  url: string;
}

export interface Reference {
  id: string;
  title: string;
  normalizedTitle: string;
  category: Category;
  kind: ReferenceKind;
  origin?: string;
  /** Only present when backed by a source; `yearSourceId` names it. */
  year?: number;
  yearSourceId?: string;
  decade?: Decade;
  /** Citations that describe this reference (not interpretation evidence). */
  sourceIds: string[];
  /** Exact pages on other sites (Know Your Meme, TV Tropes…); links only, never ingested. */
  externalLinks?: ExternalLink[];
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

export type SourceType = 'encyclopedia' | 'dictionary' | 'structured_data' | 'official' | 'other';

export interface Source {
  id: string;
  url: string;
  title: string;
  publisher: string;
  sourceType: SourceType;
  retrievedAt: string;
  /** Licence the excerpt is reused under, e.g. "CC BY-SA 4.0". */
  license: string;
  /** Short quoted excerpt (≤2 sentences), shown with attribution. */
  excerpt?: string;
}

export interface Favourite {
  referenceId: string;
  savedAt: string;
}

export interface Setting {
  key: string;
  value: string;
}
