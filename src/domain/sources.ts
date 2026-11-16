/**
 * The one place that names the online sources: the publisher written on every `Source` record, and
 * the shapes of reference and source IDs. The retrieval adapters write these; the curator, the
 * search page and the reference page read them, so a typo in one place can no longer silently
 * break another.
 */
export const PUBLISHER = {
  wikipedia: 'Wikipedia',
  wikidata: 'Wikidata',
  wiktionary: 'Wiktionary',
  wikiquote: 'Wikiquote',
  tvmaze: 'TVmaze',
} as const;

/** Reference IDs of online candidates: `wd:Q83495`, `enwiki:12345`, `enwiktionary:no cap`, `enwikiquote:99`. */
export const referenceId = {
  wikidata: (qid: string) => `wd:${qid}`,
  wikipedia: (pageId: number) => `enwiki:${pageId}`,
  wiktionary: (title: string) => `enwiktionary:${title}`,
  wikiquote: (pageId: number) => `enwikiquote:${pageId}`,
};

const WIKIQUOTE_PREFIX = referenceId.wikiquote(0).slice(0, -1);
const WIKIDATA_PREFIX = referenceId.wikidata('');
const WIKIPEDIA_PREFIX = referenceId.wikipedia(0).slice(0, -1);

/** A Wikipedia hit: with a Wikidata item (`wd:`) or, without one, by page (`enwiki:`). */
export const isWikipediaReference = (id: string): boolean =>
  id.startsWith(WIKIDATA_PREFIX) || id.startsWith(WIKIPEDIA_PREFIX);

export const isWikiquoteReference = (id: string): boolean => id.startsWith(WIKIQUOTE_PREFIX);

/** The Wikiquote page ID inside an `enwikiquote:` reference ID, or undefined for any other ID. */
export const wikiquotePageId = (id: string): string | undefined =>
  isWikiquoteReference(id) ? id.slice(WIKIQUOTE_PREFIX.length) : undefined;

/** The `Source` ID that goes with a reference ID: `src:wd:Q83495`, `src:enwiki:12345`. */
export const sourceIdOf = (reference: string): string => `src:${reference}`;

export const tvmazeSourceId = (showId: number): string => `src:tvmaze:${showId}`;
