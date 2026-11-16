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
/** `{ "q": "…" }` with a 200-character query fits easily; anything bigger is refused. */
const MAX_REQUEST_BYTES = 1024;
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

/** The raw `q` from a JSON body `{ "q": "…" }`; null when the body is oversized, not JSON or has no string `q`. */
async function readQuery(request: Request): Promise<string | null> {
  try {
    const body: unknown = JSON.parse(await readCapped(request, MAX_REQUEST_BYTES));
    const q = typeof body === 'object' && body !== null ? (body as { q?: unknown }).q : null;
    return typeof q === 'string' ? q : null;
  } catch {
    return null;
  }
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
 * `q` is already validated (≤200 characters, no control characters).
 */
export function objective(q: string): string {
  return `Explain "${q}": what it means or refers to in pop culture or internet culture (films, TV, comics, games, music, memes, slang), and where it comes from.`;
}

/**
 * Rebuilds each result from three allowlisted fields; every other field Parallel sends (images,
 * media, page content) is dropped, and anything malformed is skipped, not repaired. Copies of a
 * page (another form of its URL, or the same text on another site) are dropped, and the snippet
 * starts at the sentence that best answers `q`.
 */
export function toResults(body: unknown, q: string): WebResult[] | undefined {
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
    if (!parsed) continue;
    const page = pageKey(parsed);
    if (seenPages.has(page)) continue;
    seenPages.add(page);
    const cleanTitle = typeof title === 'string' ? plainText(title) : '';
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

    const q = validQuery(await readQuery(request));
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
          objective: objective(q),
          search_queries: [q],
          mode: 'fast',
          max_chars_total: 6000,
          advanced_settings: { max_results: MAX_RESULTS },
        }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) {
        // Release the connection; the error body is never read.
        await response.body?.cancel().catch(() => {});
        return json(response.status === 429 ? 429 : 502, {
          error: response.status === 429 ? 'rate_limited' : 'provider_failed',
        });
      }
      const results = toResults(JSON.parse(await readCapped(response, MAX_UPSTREAM_BYTES)), q);
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
