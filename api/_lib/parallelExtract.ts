import { CONFIG } from './config.js';
import { devFlag } from './devFlags.js';
import { readCapped } from './http.js';
import { animationScope, objective, plainText } from '../../shared/text.js';
import type { CardKind } from '../../shared/cardTypes.js';

/**
 * Reads the text inside web links with Parallel's Extract API. The key stays on the server; nothing
 * is logged or stored. Never throws: any failure leaves every URL `null`, and the caller falls back
 * to the reader's snippet.
 */

const {
  url: EXTRACT_URL,
  maxBytes: MAX_UPSTREAM_BYTES,
  timeoutMs: TIMEOUT_MS,
  maxSentenceChars: MAX_SENTENCE_CHARS,
} = CONFIG.extract;

export interface ExtractDeps {
  fetch: typeof fetch;
  apiKey: string;
  timeoutMs?: number;
}

export interface ExtractContext {
  kind?: CardKind;
  about?: readonly string[];
}

export function extractionObjective(search: string, context: ExtractContext = {}): string {
  if (!context.kind || context.kind === 'reference')
    return objective(search, 'meaning', context.about);
  const scope = animationScope(context.about ?? []);
  const domain = scope.length
    ? ` Focus on ${scope.join(' OR ')}; either category is sufficient.`
    : '';
  return `Read this page for a ${context.kind} card about "${search}".${domain} Extract named fictional characters, works, events or concepts that answer the request, and the specific facts explaining why each fits. Keep the name, work and supporting description together with qualifications and attribution. Include relevant examples even when they do not repeat the search words. Preserve any stated comparison criterion and ordering; never invent a ranking. Return relevant passages rather than menus or a definition alone.`;
}

const allNull = (urls: readonly string[]) =>
  new Map<string, string | null>(urls.map((url) => [url, null]));


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

const TV_TROPES_MAIN =
  /^https:\/\/(?:www\.)?tvtropes\.org\/pmwiki\/pmwiki\.php\/Main\/([A-Za-z0-9]+)$/;
const MEDIUM_PAGE = { anime: 'AnimeAndManga', cartoons: 'WesternAnimation' } as const;

/**
 * The per-medium subpages to read in place of a TV Tropes `Main/<Trope>` page when the search is
 * tagged anime or cartoons. The Main page carries the trope's "Fan Works" folder; the medium pages
 * hold only that medium's examples. Empty for any other URL or tag.
 */
export function mediumPages(url: string, about: readonly string[] = []): string[] {
  const trope = TV_TROPES_MAIN.exec(url)?.[1];
  if (!trope) return [];
  return animationScope(about).map(
    (tag) =>
      `https://tvtropes.org/pmwiki/pmwiki.php/${trope}/${MEDIUM_PAGE[tag as keyof typeof MEDIUM_PAGE]}`,
  );
}

/**
 * Text per input URL (an entry for every one); `null` when the page couldn't be read. A tagged
 * TV Tropes Main page is read through its medium subpages in the same call, keyed by the URL the
 * reader picked, and falls back to the Main page's own text when no subpage has any. When the
 * reader also picked one of those subpages, the Main page is not read at all (left `null`, so the
 * caller keeps its snippet): the same text would otherwise fill two items, and the Main page's own
 * text carries the fan works.
 */
export async function extractPages(
  urls: readonly string[],
  search: string,
  deps: ExtractDeps,
  context: ExtractContext = {},
): Promise<Map<string, string | null>> {
  const out = allNull(urls);
  if (devFlag('WEB_SEARCH_FAKE')) {
    for (const url of urls) {
      out.set(url, `Local test page for "${search}": no real page was read.`);
    }
    return out;
  }

  const picked = new Set(urls.map(href));
  const subpagePicked = (url: string) =>
    mediumPages(url, context.about).some((page) => picked.has(href(page)));
  const requested = [
    ...new Set(
      urls.flatMap((url) => (subpagePicked(url) ? [] : [...mediumPages(url, context.about), url])),
    ),
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await deps.fetch(EXTRACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': deps.apiKey },
      body: JSON.stringify({ urls: requested, objective: extractionObjective(search, context) }),
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

    // Text per page Parallel read, by normalised URL, so a returned `https://c.example/` matches.
    const read = new Map<string, string>();
    for (const item of results) {
      if (typeof item !== 'object' || item === null) continue;
      const { url, excerpts } = item as { url?: unknown; excerpts?: unknown };
      if (typeof url !== 'string' || !Array.isArray(excerpts)) continue;
      const text = plainText(excerpts.filter((e): e is string => typeof e === 'string').join(' '));
      if (text) read.set(href(url), text);
    }
    for (const url of urls) {
      if (subpagePicked(url)) continue;
      const fromSubpages = mediumPages(url, context.about)
        .flatMap((page) => read.get(href(page)) ?? [])
        .join(' ');
      const text = fromSubpages || read.get(href(url));
      if (!text) continue;
      const selected =
        context.kind && context.kind !== 'reference' ? text : namingSentences(text, search) || text;
      out.set(url, selected || null);
    }
    return out;
  } catch {
    // Timeout, network failure, oversized or bad JSON. Not logged: the error could echo the request.
    return allNull(urls);
  } finally {
    clearTimeout(timer);
  }
}
