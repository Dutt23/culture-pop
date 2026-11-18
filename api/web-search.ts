import { checkAccess, type AccessResult } from './_lib/access.js';
import { devFlag } from './_lib/devFlags.js';
import { fakeParallelFetch } from './_lib/fakeParallel.js';
import { isCrossSite, json, readCapped } from './_lib/http.js';
import { bestSnippet, pageKey } from './_lib/snippet.js';

/**
 * Wider-web search for questions Wikipedia can't answer: forwards one query to Parallel's Search API
 * with the key kept on the server, and returns a small, re-validated, text-only list. Plan and
 * limits: docs/BACKEND_PLAN.md, D45. Never logs or stores anything. The query comes in a POST body,
 * so it is never part of a URL that the host's request logs could record.
 */

const PARALLEL_URL = 'https://api.parallel.ai/v1/search';
const MIN_QUERY = 2;
const MAX_QUERY = 200;
const MAX_RESULTS = 10;
const MAX_TITLE = 120;
const MAX_SNIPPET = 300;
/** Each excerpt is cut before cleaning, so a hostile page can't make the regex work slow. */
const MAX_EXCERPT = 4000;
const MAX_URL = 2048;
/** Parallel's answers are a few KB; anything bigger is refused unread. */
const MAX_UPSTREAM_BYTES = 256 * 1024;
/**
 * `{ "q": "…", "question": true, "videos": true, "about": […] }` with a 200-character query and
 * five 30-character tags fits, even in four-byte characters; anything bigger is refused.
 */
const MAX_REQUEST_BYTES = 2048;
/** Search tags sent as a hint (docs/SEARCH_TAGS_PLAN.md); the same caps as the app's. */
const MAX_ABOUT = 5;
const MIN_TAG = 2;
const MAX_TAG = 30;
// Marks (\p{M}) keep Indic tags whole: "बॉलीवुड" has vowel signs. At least one letter or number,
// so "&&" or "--" (nothing once normalized) is refused.
const TAG_TEXT = /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} &'-]+$/u;
/** What we send the phone stays small; results are dropped from the end until it fits. */
const MAX_RESPONSE_BYTES = 16 * 1024;
const TIMEOUT_MS = 8000;
/** 31 days × 150 = 4,650, under the ~5,000 free `fast` searches a month. */
const DAILY_CAP = 150;
const CONTROL_CHARS = /\p{Cc}/u;

/** How far a provider's terms let results be kept: `none`, this `device` only, or `shared`. */
export type StorageLevel = 'none' | 'device' | 'shared';

/**
 * The one place each provider's storage level is set (D45). Parallel: `device`, the owner's reading
 * of Customer Terms 2(b)(i): output may be kept for the one person who searched, never for others,
 * so no shared or server cache. This server stores nothing whatever the level.
 */
const STORAGE = { parallel: 'device' } as const satisfies Record<string, StorageLevel>;
const PROVIDER = 'parallel';

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  storage: StorageLevel;
}

export interface HandlerOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  dailyCap?: number;
  now?: () => Date;
  /** Who may search. Swappable: today the access-code cookie (`_lib/access.ts`). */
  checkAccess?: (request: Request) => AccessResult;
}

/** What to look for: what the words mean, an answer from fiction, or videos of it. */
export type SearchKind = 'meaning' | 'question' | 'videos';

interface SearchBody {
  q: string | null;
  kind: SearchKind;
  about: string[];
}

/**
 * The raw `q`, the kind of search and the `about` tags from a JSON body
 * `{ "q": "…", "question": true, "about": ["anime"] }` (or `"videos": true`). `q` is null when the
 * body is oversized, not JSON or has no string `q`; a flag that is not exactly `true` counts as
 * false, `videos` wins over `question`, and any bad tag is dropped, so a bad flag or tag never
 * blocks a search.
 */
async function readBody(request: Request): Promise<SearchBody> {
  try {
    const body: unknown = JSON.parse(await readCapped(request, MAX_REQUEST_BYTES));
    const fields = typeof body === 'object' && body !== null ? body : {};
    const { q, question, videos, about } = fields as Record<string, unknown>;
    return {
      q: typeof q === 'string' ? q : null,
      kind: videos === true ? 'videos' : question === true ? 'question' : 'meaning',
      about: validAbout(about),
    };
  } catch {
    return { q: null, kind: 'meaning', about: [] };
  }
}

/** Up to five tags, each 2–30 letters, numbers, spaces, `&`, `'` or `-`; anything else is dropped. */
export function validAbout(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().replace(/\s+/g, ' '))
    .filter((tag) => {
      const length = Array.from(tag).length;
      return length >= MIN_TAG && length <= MAX_TAG && TAG_TEXT.test(tag);
    })
    .slice(0, MAX_ABOUT);
}

/** Trimmed, single-spaced query, or undefined when it breaks the length or character rules. */
export function validQuery(raw: string | null): string | undefined {
  if (raw === null || CONTROL_CHARS.test(raw)) return undefined;
  const q = raw.trim().replace(/\s+/g, ' ');
  return q.length >= MIN_QUERY && q.length <= MAX_QUERY ? q : undefined;
}

/** Cuts by code points, so an emoji is never split into a broken half. */
function cut(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max
    ? text
    : `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/** Text only: images dropped, links reduced to their words, HTML tags and Markdown marks removed. */
function plainText(markup: string): string {
  return markup
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string' || value.length > MAX_URL) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * What we ask Parallel for: the meaning and origin, so its excerpts explain rather than just mention.
 * A question leans to fiction, myths and pop culture (D50) unless the reader unticked "Stories &
 * myths", in which case the app sends `question: false`: left to itself, Parallel answers "who
 * committed the worst genocides" with real-world history.
 * `q` is already validated (≤200 characters, no control characters).
 */
export function objective(
  q: string,
  kind: SearchKind = 'meaning',
  about: readonly string[] = [],
): string {
  // A hint only: the search text itself never changes with tags.
  const hint = about.length > 0 ? ` Prefer results about ${about.join(', ')}.` : '';
  return baseObjective(q, kind) + hint;
}

function baseObjective(q: string, kind: SearchKind): string {
  if (kind === 'videos') {
    return `Find YouTube videos for "${q}": the official music video, live performances, trailers, clips or explainers. Prefer official channels.`;
  }
  if (kind === 'question') {
    return `Answer "${q}" about fiction, myths and pop culture: characters, events and works in films, TV, anime, books, comics, games, myths, legends and folklore — not real-world history or news. Name the characters and works.`;
  }
  return `Explain "${q}": what it means or refers to in pop culture or internet culture (films, TV, comics, games, music, memes, slang), and where it comes from.`;
}

/** A second, short angle on the same words; the objective carries the rest of the intent. */
const ANGLE: Record<SearchKind, string> = {
  meaning: ' meaning origin',
  question: ' fiction',
  videos: ' video',
};
/** Parallel's guide asks for keyword queries of 3–6 words. */
const MAX_KEYWORDS = 6;
/** Words that carry no search meaning; dropped only from text longer than six words. */
const FILLER = new Set(
  (
    'a an the is are was were be been do does did what who whom whose which why how when where ' +
    'of in on to for and or but that this these those it its i me my you your we our they their ' +
    'he him his she her about with from by at as if so can could would should will there'
  ).split(' '),
);

/**
 * The search words of long text, at most six of them in order. Text of six words or fewer is kept
 * whole, so a line like "I am your father" is never cut down to "father".
 */
export function keywords(q: string): string {
  const words = q.split(' ');
  if (words.length <= MAX_KEYWORDS) return q;
  const bare = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
  const kept = words.filter((word) => bare(word) && !FILLER.has(bare(word)));
  return (kept.length > 0 ? kept : words).slice(0, MAX_KEYWORDS).join(' ');
}

/**
 * Parallel's search queries: the reader's words as typed, then their keywords with a short angle.
 * Its guide asks for 1–3 short keyword queries rather than one long sentence; the full text stays
 * in the first query and the objective, so no context is lost. The price is per request, so the
 * second query costs nothing.
 */
export function searchQueries(q: string, kind: SearchKind = 'meaning'): string[] {
  const angle = ANGLE[kind];
  return [q, cut(keywords(q), MAX_QUERY - angle.length) + angle];
}

/** Videos come from YouTube only; plain domains include www. and m. (Parallel's source policy). */
const VIDEO_DOMAIN = 'youtube.com';
const isVideoPage = (url: URL) =>
  url.hostname === VIDEO_DOMAIN || url.hostname.endsWith(`.${VIDEO_DOMAIN}`);

function advancedSettings(kind: SearchKind) {
  return kind === 'videos'
    ? { max_results: MAX_RESULTS, source_policy: { include_domains: [VIDEO_DOMAIN] } }
    : { max_results: MAX_RESULTS };
}

/**
 * Rebuilds each result from three allowlisted fields; every other field Parallel sends (images,
 * media, page content) is dropped, and anything malformed is skipped, not repaired. Copies of a
 * page (another form of its URL, or the same text on another site) are dropped, and the snippet
 * starts at the sentence that best answers `q`. With `videosOnly`, anything not on YouTube is
 * dropped.
 */
export function toResults(body: unknown, q: string, videosOnly = false): WebResult[] | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const raw = (body as { results?: unknown }).results;
  if (!Array.isArray(raw)) return undefined;
  const results: WebResult[] = [];
  const seenPages = new Set<string>();
  const seenSnippets = new Set<string>();
  for (const item of raw) {
    if (results.length >= MAX_RESULTS) break;
    if (typeof item !== 'object' || item === null) continue;
    const { url, title, excerpts } = item as { url?: unknown; title?: unknown; excerpts?: unknown };
    const parsed = safeUrl(url);
    // Parallel already limits videos to YouTube; checked again so nothing else can slip through.
    if (!parsed || (videosOnly && !isVideoPage(parsed))) continue;
    const page = pageKey(parsed);
    if (seenPages.has(page)) continue;
    seenPages.add(page);
    // Cut before cleaning: the markdown patterns slow down on a huge, hostile title.
    const cleanTitle = typeof title === 'string' ? plainText(title.slice(0, MAX_EXCERPT)) : '';
    const texts = Array.isArray(excerpts)
      ? excerpts
          .filter((e): e is string => typeof e === 'string')
          .map((e) => plainText(e.slice(0, MAX_EXCERPT)))
      : [];
    const snippet = cut(bestSnippet(texts, q), MAX_SNIPPET);
    if (snippet && seenSnippets.has(snippet)) continue;
    seenSnippets.add(snippet);
    results.push({
      title: cut(cleanTitle || parsed.hostname, MAX_TITLE),
      url: parsed.href,
      snippet,
      storage: STORAGE[PROVIDER],
    });
  }
  return results;
}

const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** The response body, with results dropped from the end until it is under the byte budget. */
export function responseBody(results: readonly WebResult[]) {
  const body = (kept: readonly WebResult[]) => ({ storage: STORAGE[PROVIDER], results: kept });
  let kept = [...results];
  while (kept.length > 0 && byteLength(body(kept)) > MAX_RESPONSE_BYTES) kept = kept.slice(0, -1);
  return body(kept);
}

export function createHandler(
  options: HandlerOptions = {},
): (request: Request) => Promise<Response> {
  const doFetch =
    options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const dailyCap = options.dailyCap ?? DAILY_CAP;
  const now = options.now ?? (() => new Date());
  const access = options.checkAccess ?? ((request) => checkAccess(request, now().getTime()));
  // shortcut: per-instance memory, so cold starts and parallel instances each get their own count;
  // Parallel's dashboard spend limit is the real cap. Upgrade to a shared store if use grows.
  let day = '';
  let used = 0;

  return async function handle(request) {
    if (isCrossSite(request)) return json(403, { error: 'cross_site' });
    const allowed = access(request);
    if (allowed === 'not_configured') return json(503, { error: 'not_configured' });
    if (allowed === 'locked') return json(401, { error: 'locked' });

    const { q: rawQuery, kind, about } = await readBody(request);
    const q = validQuery(rawQuery);
    if (!q) return json(400, { error: 'bad_query' });

    // Local testing only (never on a Vercel deployment): canned answers, no key, nothing spent.
    const fake = devFlag('WEB_SEARCH_FAKE');
    const apiKey = fake ? 'local-fake' : process.env.PARALLEL_API_KEY;
    if (!apiKey) return json(503, { error: 'not_configured' });

    if (!fake) {
      const today = now().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        used = 0;
      }
      if (used >= dailyCap) return json(429, { error: 'daily_cap' });
      used++;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await (fake ? fakeParallelFetch : doFetch)(PARALLEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        // No session_id: Parallel can't link one search to the next.
        body: JSON.stringify({
          objective: objective(q, kind, about),
          search_queries: searchQueries(q, kind),
          mode: 'fast',
          max_chars_total: 6000,
          advanced_settings: advancedSettings(kind),
        }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) {
        // Release the connection; the error body is never read.
        await response.body?.cancel().catch(() => {});
        // 402: Parallel's balance or spend limit is used up. Not a fault: it comes back once topped up.
        if (response.status === 402) return json(503, { error: 'out_of_credit' });
        return json(response.status === 429 ? 429 : 502, {
          error: response.status === 429 ? 'rate_limited' : 'provider_failed',
        });
      }
      const upstreamBody: unknown = JSON.parse(await readCapped(response, MAX_UPSTREAM_BYTES));
      const results = toResults(upstreamBody, q, kind === 'videos');
      return results ? json(200, responseBody(results)) : json(502, { error: 'provider_failed' });
    } catch {
      // Timeout, network failure, oversized or bad JSON. Not logged: the error could echo the request.
      return json(502, { error: 'provider_failed' });
    } finally {
      clearTimeout(timer);
    }
  };
}

export const POST = createHandler();
