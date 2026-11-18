import { devFlag } from './devFlags.js';
import { readCapped } from './http.js';
import { objective, plainText } from '../../shared/text.js';

/**
 * Reads the text inside web links with Parallel's Extract API. The key stays on the server; nothing
 * is logged or stored. Never throws: any failure leaves every URL `null`, and the caller falls back
 * to the reader's snippet.
 */

const EXTRACT_URL = 'https://api.parallel.ai/v1/extract';
/** Parallel's answers are small; anything bigger is refused unread. */
const MAX_UPSTREAM_BYTES = 256 * 1024;
const TIMEOUT_MS = 10_000;

export interface ExtractDeps {
  fetch: typeof fetch;
  apiKey: string;
  timeoutMs?: number;
}

const allNull = (urls: readonly string[]) =>
  new Map<string, string | null>(urls.map((url) => [url, null]));

/** Longer "sentences" are page menus run together, not prose. */
const MAX_SENTENCE_CHARS = 400;

/** Sentence ends, including the Devanagari danda and double danda. */
const SENTENCE_END = /(?<=[.!?।॥])\s+/u;

/** Lowercase words of any script (letters with their marks, numbers), space-padded so ` word ` matches whole words. */
const padded = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim()} `;

/**
 * The sentences that name the search (the whole phrase, or all but one of its words of 3+
 * characters), as whole words in any script, in page order. Drops menus and sidebars that would
 * otherwise fill the 1,200-character item cut. Empty when none do; the caller then keeps the text.
 */
function namingSentences(text: string, search: string): string {
  const phrase = padded(search);
  const words = phrase
    .trim()
    .split(' ')
    .filter((w) => w.length > 2);
  const names = (sentence: string) => {
    const plain = padded(sentence);
    if (phrase.trim() && plain.includes(phrase)) return true;
    const hits = words.filter((w) => plain.includes(` ${w} `)).length;
    return hits >= Math.max(1, words.length - 1);
  };
  const kept: string[] = [];
  for (const sentence of text.split(SENTENCE_END)) {
    if (sentence.length <= MAX_SENTENCE_CHARS && names(sentence) && !kept.includes(sentence)) {
      kept.push(sentence);
    }
  }
  return kept.join(' ');
}

const href = (value: string): string => {
  try {
    return new URL(value).href;
  } catch {
    return value;
  }
};

/** Text per input URL (an entry for every one); `null` when the page couldn't be read. */
export async function extractPages(
  urls: readonly string[],
  search: string,
  deps: ExtractDeps,
): Promise<Map<string, string | null>> {
  const out = allNull(urls);
  if (devFlag('WEB_SEARCH_FAKE')) {
    for (const url of urls) {
      out.set(url, `Local test page for "${search}": no real page was read.`);
    }
    return out;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await deps.fetch(EXTRACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': deps.apiKey },
      body: JSON.stringify({ urls, objective: objective(search, 'meaning') }),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      // Release the connection; the error body is never read.
      await response.body?.cancel().catch(() => {});
      return out;
    }
    const body: unknown = JSON.parse(await readCapped(response, MAX_UPSTREAM_BYTES));
    const results = (body as { results?: unknown } | null)?.results;
    if (!Array.isArray(results)) return out;

    const byHref = new Map(urls.map((url) => [href(url), url]));
    for (const item of results) {
      if (typeof item !== 'object' || item === null) continue;
      const { url, excerpts } = item as { url?: unknown; excerpts?: unknown };
      if (typeof url !== 'string' || !Array.isArray(excerpts)) continue;
      const input = out.has(url) ? url : byHref.get(href(url));
      if (input === undefined) continue;
      const text = plainText(excerpts.filter((e): e is string => typeof e === 'string').join(' '));
      out.set(input, namingSentences(text, search) || text || null);
    }
    return out;
  } catch {
    // Timeout, network failure, oversized or bad JSON. Not logged: the error could echo the request.
    return allNull(urls);
  } finally {
    clearTimeout(timer);
  }
}
