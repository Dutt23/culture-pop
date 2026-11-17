export type Category =
  | 'cartoon'
  | 'comics'
  | 'games'
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

/**
 * `retrieved` = gathered from sources, not yet explained. `source_curated` = gathered from sources
 * and explained by the deterministic curator with at least one source-supported interpretation.
 */
export type EditorialState = 'demo' | 'published' | 'retrieved' | 'source_curated';

/** Both states hold online evidence rather than editorial content; a new retrieval may replace them. */
export function isFromOnline(state: EditorialState): boolean {
  return state === 'retrieved' || state === 'source_curated';
}

/** How an interpretation was created. */
export type Provenance = 'seed_curated' | 'source_supported' | 'model_suggested' | 'unverified';

/** Quality of attached evidence. A model's assertion alone never makes this `supported`. */
export type Evidence = 'supported' | 'uncertain' | 'unverified';

/** Personal acknowledgement only; set solely by an explicit "This is what I meant" control. */
export type Selection = 'user_confirmed' | null;

export type SpoilerLevel = 'none' | 'major';

/**
 * How the reference relates to the phrase, as its source states it: the original work, a page that
 * quotes it, its dictionary sense, or another related page. Never inferred beyond the source.
 */
export type Relation = 'original' | 'quoted_in' | 'dictionary' | 'related';

/** An exact page about a reference on another site, from Wikidata's external IDs. Tap-only. */
export interface ExternalLink {
  label: string;
  url: string;
}

/** A work a reference appears in, as Wikidata states it: its item and its English label. */
export interface PresentIn {
  qid: string;
  label: string;
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
  /** Labels from Wikidata (P170 creator, P4584 first appearance); its `src:wd:` source backs them. */
  creators?: string[];
  firstAppearance?: string;
  /** Works Wikidata says it appears in (P1441), e.g. "The Matrix" for the red pill; cited by `src:wd:`. */
  presentIn?: PresentIn[];
  /** Works Wikidata says it was inspired by (P941), e.g. "The Matrix" for the red pill and blue pill. */
  inspiredBy?: PresentIn[];
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
  /** Glance card: what it means when someone says it, one spoiler-free sentence. Hand-written only. */
  gist?: string;
  /** Glance card: what the speaker is doing with it ("joking the plan is doomed"). Hand-written only. */
  socialMove?: string;
  /** Glance card: a short line to say back when someone uses it. Hand-written only. */
  reply?: string;
  summary: string;
  context: string;
  usageExample: string;
  spoiler: SpoilerLevel;
  sourceIds: string[];
  provenance: Provenance;
  evidence: Evidence;
  selection: Selection;
  relation: Relation;
  /** Set only when a source states the link to that other reference; otherwise evidence is shown side by side. */
  relatedReferenceId?: string;
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

/** A wider-web link kept by the reader (D46): title and address only, never the snippet. */
export interface SavedLink {
  url: string;
  title: string;
  /** ISO timestamp. */
  savedAt: string;
}

/**
 * How much a pack's cards may give away. `before_watching` hides major spoilers when a card is
 * opened from the pack; `open` follows the reader's spoiler setting.
 */
export type PackCeiling = 'before_watching' | 'open';

/** A named folder of existing references. One level only: packs never nest. */
export interface Pack {
  id: string;
  name: string;
  normalizedName: string;
  ceiling: PackCeiling;
  /** At most one pack is the Now pack. */
  now: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A reference filed in a pack. A join row only: the card's text is never copied. */
export interface PackMember {
  id: string;
  packId: string;
  referenceId: string;
  /** Manual order inside the pack: dense and 0-based. */
  position: number;
  addedAt: string;
  /** Set by "I get this now": the card leaves the pack's active list but stays filed. */
  doneAt?: string;
}

export interface Setting {
  key: string;
  value: string;
}
