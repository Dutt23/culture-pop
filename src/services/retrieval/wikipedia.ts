import type { GetJson } from './types';
import { compactText, isRecord, safeUrl, stringField, throwIfMediaWikiError } from './validate';

const HOST = 'en.wikipedia.org';
const RESULT_LIMIT = 5;
const QID = /^Q\d+$/;

export interface WikipediaHit {
  pageId: number;
  title: string;
  url: string;
  extract?: string;
  qid?: string;
  isDisambiguation: boolean;
  rank: number;
}

export function wikipediaSearchUrl(query: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: String(RESULT_LIMIT),
    gsrnamespace: '0',
    prop: 'pageprops|extracts|info',
    ppprop: 'wikibase_item|disambiguation',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    exlimit: String(RESULT_LIMIT),
    inprop: 'url',
    redirects: '1',
  });
  return `https://${HOST}/w/api.php?${params}`;
}

/** Parses a search response; malformed pages are dropped rather than trusted. */
export function parseWikipediaSearch(json: unknown): WikipediaHit[] {
  if (!isRecord(json) || !isRecord(json.query) || !Array.isArray(json.query.pages)) return [];
  const hits: WikipediaHit[] = [];
  for (const page of json.query.pages) {
    if (!isRecord(page)) continue;
    const title = stringField(page, 'title');
    const url = safeUrl(page.fullurl, HOST);
    if (!title || !url || typeof page.pageid !== 'number') continue;
    const props = isRecord(page.pageprops) ? page.pageprops : {};
    const qid = stringField(props, 'wikibase_item');
    const extract = stringField(page, 'extract');
    hits.push({
      pageId: page.pageid,
      title,
      url,
      extract: extract ? compactText(extract) || undefined : undefined,
      qid: qid && QID.test(qid) ? qid : undefined,
      isDisambiguation: 'disambiguation' in props,
      rank: typeof page.index === 'number' ? page.index : Number.MAX_SAFE_INTEGER,
    });
  }
  return hits.sort((a, b) => a.rank - b.rank);
}

export async function searchWikipedia(
  query: string,
  getJson: GetJson,
  signal?: AbortSignal,
): Promise<WikipediaHit[]> {
  const json = await getJson(wikipediaSearchUrl(query), signal);
  throwIfMediaWikiError(json);
  return parseWikipediaSearch(json);
}
