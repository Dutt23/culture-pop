import type { GetJson } from './types';
import {
  compactText,
  containsPhrase,
  htmlToText,
  isRecord,
  safeUrl,
  stringField,
  throwIfMediaWikiError,
} from './validate';

const HOST = 'en.wikiquote.org';
/** Most phrase hits are the work's own page, lists or passing mentions: ask for more than we keep. */
const RESULT_LIMIT = 10;
const MAX_QUOTING_PAGES = 3;
const LIST_PAGE = /^List of /;
/** Wikiquote's quotes are often fair-use extracts: keep one short line, never more. */
const MAX_QUOTE_CHARS = 160;

export interface WikiquoteHit {
  pageId: number;
  /** The person or work the quote page is about. */
  title: string;
  url: string;
  /** The sentence of the matched text that contains the phrase, as plain text. */
  quote: string;
}

export function wikiquoteSearchUrl(query: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    list: 'search',
    // Quoted: CirrusSearch then matches the exact phrase in page text, not scattered words.
    srsearch: `"${query.replace(/"/g, ' ').trim()}"`,
    srlimit: String(RESULT_LIMIT),
    srnamespace: '0',
    srprop: 'snippet',
  });
  return `https://${HOST}/w/api.php?${params}`;
}

/** The first sentence of `text` that contains the phrase. */
function sentenceWithPhrase(text: string, query: string): string | undefined {
  return text.split(/(?<=[.!?…])\s+/).find((sentence) => containsPhrase(sentence, query));
}

/**
 * Parses a search response in rank order into pages that quote the phrase. Search can still
 * match across punctuation or stemmed words, so the matched text must contain the whole phrase.
 * A page named after the phrase is the work's own page, not somewhere it's quoted, so it's
 * dropped (Wikipedia covers the work), and so are "List of" pages.
 */
export function parseWikiquoteSearch(json: unknown, query: string): WikiquoteHit[] {
  if (!isRecord(json) || !isRecord(json.query) || !Array.isArray(json.query.search)) return [];
  const hits: WikiquoteHit[] = [];
  for (const result of json.query.search) {
    if (!isRecord(result) || typeof result.pageid !== 'number') continue;
    const title = stringField(result, 'title');
    if (!title) continue;
    const url = safeUrl(
      `https://${HOST}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      HOST,
    );
    if (!url) continue;
    if (containsPhrase(title, query) || LIST_PAGE.test(title)) continue;
    const sentence = sentenceWithPhrase(htmlToText(stringField(result, 'snippet') ?? ''), query);
    if (!sentence) continue;
    const quote = compactText(sentence, MAX_QUOTE_CHARS);
    hits.push({ pageId: result.pageid, title, url, quote });
    if (hits.length === MAX_QUOTING_PAGES) break;
  }
  return hits;
}

export async function searchWikiquote(
  query: string,
  getJson: GetJson,
  signal?: AbortSignal,
): Promise<WikiquoteHit[]> {
  const json = await getJson(wikiquoteSearchUrl(query), signal);
  throwIfMediaWikiError(json);
  return parseWikiquoteSearch(json, query);
}
