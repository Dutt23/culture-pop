import type { GetJson } from './types';
import {
  compactText,
  containsPhrase,
  htmlToText,
  isRecord,
  safeUrl,
  stringField,
} from './validate';

const HOST = 'api.tvmaze.com';
const SITE_HOST = 'www.tvmaze.com';
const RESULT_LIMIT = 5;
/** TVmaze scores below this are loose word matches, not the show the user meant. */
const MIN_SCORE = 0.5;
const PREMIERED = /^(\d{4})-\d{2}-\d{2}$/;

export interface TvmazeShow {
  /** TVmaze's own numeric ID, also stored on Wikidata as P8600. */
  id: number;
  name: string;
  url: string;
  isAnimation: boolean;
  /** Year of the first episode (`premiered`). */
  year?: number;
  network?: string;
  summary?: string;
}

export function tvmazeSearchUrl(query: string): string {
  return `https://${HOST}/search/shows?${new URLSearchParams({ q: query })}`;
}

function networkName(show: Record<string, unknown>): string | undefined {
  for (const key of ['network', 'webChannel']) {
    const channel = show[key];
    const name = isRecord(channel) ? stringField(channel, 'name') : undefined;
    if (name) return compactText(name, 60);
  }
  return undefined;
}

/**
 * Parses search results in score order. TVmaze search is fuzzy ("point break" scores "Break Point"
 * highest), so only shows whose name contains the whole phrase are kept; anything malformed or
 * off-site is dropped too.
 */
export function parseTvmazeSearch(json: unknown, query: string): TvmazeShow[] {
  if (!Array.isArray(json)) return [];
  const shows: TvmazeShow[] = [];
  for (const result of json) {
    if (!isRecord(result) || !isRecord(result.show)) continue;
    if (typeof result.score !== 'number' || result.score < MIN_SCORE) continue;
    const show = result.show;
    const name = stringField(show, 'name');
    const url = safeUrl(show.url, SITE_HOST);
    if (typeof show.id !== 'number' || !Number.isSafeInteger(show.id) || !name || !url) continue;
    if (!containsPhrase(name, query)) continue;
    const genres = Array.isArray(show.genres) ? show.genres : [];
    const premiered = PREMIERED.exec(stringField(show, 'premiered') ?? '')?.[1];
    const summary = stringField(show, 'summary');
    const text = summary ? compactText(htmlToText(summary)) : '';
    shows.push({
      id: show.id,
      name: compactText(name, 200),
      url,
      isAnimation: genres.includes('Animation') || stringField(show, 'type') === 'Animation',
      year: premiered ? Number(premiered) : undefined,
      network: networkName(show),
      summary: text || undefined,
    });
    if (shows.length === RESULT_LIMIT) break;
  }
  return shows;
}

export async function searchTvmaze(
  query: string,
  getJson: GetJson,
  signal?: AbortSignal,
): Promise<TvmazeShow[]> {
  return parseTvmazeSearch(await getJson(tvmazeSearchUrl(query), signal), query);
}
