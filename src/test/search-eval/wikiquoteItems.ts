import type { GetJson } from '../../services/retrieval/types';
import { parseWikibaseItems } from './report';

const WIKIQUOTE_QID_BATCH = 50;

/**
 * Looks up the Wikidata item of Wikiquote pages not yet in `cache` (one request per 50 pages,
 * kept for the whole run). Pages with no item are cached as absent. Returns the providers' failure
 * text, empty when every lookup worked; a failed page is not cached, so it is retried next case.
 */
export async function resolveWikiquoteQids(
  getJson: GetJson,
  pageIds: readonly string[],
  cache: Map<string, string | null>,
): Promise<string[]> {
  const missing = pageIds.filter((id) => !cache.has(id));
  const failures: string[] = [];
  for (let i = 0; i < missing.length; i += WIKIQUOTE_QID_BATCH) {
    const batch = missing.slice(i, i + WIKIQUOTE_QID_BATCH);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      origin: '*',
      prop: 'pageprops',
      ppprop: 'wikibase_item',
      pageids: batch.join('|'),
    });
    try {
      const items = parseWikibaseItems(
        await getJson(`https://en.wikiquote.org/w/api.php?${params}`),
      );
      for (const id of batch) cache.set(id, items.get(id) ?? null);
    } catch (error) {
      failures.push(`wikiquote-qid:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return failures;
}
