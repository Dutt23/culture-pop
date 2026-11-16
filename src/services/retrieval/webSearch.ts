import { safeHref } from '../../components/ui/safeHref';
import { isRecord, stringField } from './validate';

/**
 * The wider-web search: our own `/api/web-search` function, which asks Parallel (D45,
 * docs/BACKEND_PLAN.md). Same origin, so CSP `connect-src 'self'` covers it. Only ever called after
 * a tap. Access is an HttpOnly cookie set by `/api/unlock`; the code itself is never kept here.
 */
export const WEB_SEARCH_PATH = '/api/web-search';
export const UNLOCK_PATH = '/api/unlock';
export const LOCK_PATH = '/api/lock';

/**
 * How far a provider's terms let the app keep its results (D45), set per provider on the server:
 * - `none`: shown once, never saved;
 * - `device`: may be kept in this device's IndexedDB, for this person only, never sent anywhere;
 * - `shared`: may be cached for everyone. Reserved; no provider uses it.
 * Anything missing or unknown counts as `none`.
 */
export type StorageLevel = 'none' | 'device' | 'shared';

interface WebResultFields {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

/** Never saved anywhere. */
export interface EphemeralResult extends WebResultFields {
  readonly storage: 'none';
}

/** May be kept in this device's own store only; never synced or sent to any server. */
export interface DeviceResult extends WebResultFields {
  readonly storage: 'device';
}

/**
 * A wider-web result. Its `storage` is a literal type, so neither kind fits the library save path
 * (`RetrievalRepository.saveCandidates`), and only `DeviceResult` fits the device store.
 */
export type WebResult = EphemeralResult | DeviceResult;

/** What this device may do with a result: `shared` still only means "keep it here". */
export function storageOf(value: unknown): 'none' | 'device' {
  return value === 'device' || value === 'shared' ? 'device' : 'none';
}

export type WebSearchFailure =
  | 'offline'
  | 'locked'
  | 'wrong_code'
  | 'bad_query'
  | 'rate_limited'
  | 'daily_cap'
  | 'not_configured'
  | 'blocked'
  | 'failed'
  | 'aborted';

export class WebSearchError extends Error {
  constructor(
    readonly failure: WebSearchFailure,
    message: string,
  ) {
    super(message);
    this.name = 'WebSearchError';
  }
}

export interface WebSearchClient {
  search: (query: string, signal?: AbortSignal) => Promise<WebResult[]>;
  /** Sends the code once; the server answers with the cookie. Throws `wrong_code` if it's wrong. */
  unlock: (code: string) => Promise<void>;
  /** Asks the server to clear the cookie ("Forget access code"). */
  lock: () => Promise<void>;
}

export interface WebSearchDependencies {
  fetch: typeof fetch;
  isOnline: () => boolean;
  timeoutMs?: number;
}

/** The server sends at most 16 KB; a body far bigger than that is not parsed. */
const MAX_BODY_CHARS = 50_000;
const MAX_RESULTS = 10;
const MAX_TITLE = 120;
const MAX_SNIPPET = 300;
// The server allows Parallel 8 s; a little more covers the hop to Vercel.
const DEFAULT_TIMEOUT_MS = 12_000;

function failureFor(status: number, code: string | undefined): WebSearchFailure {
  // Unlock answers 400 for an over-long code: to the reader that is just a wrong code.
  if (status === 400) return code === 'bad_request' ? 'wrong_code' : 'bad_query';
  if (status === 401) return code === 'wrong_code' ? 'wrong_code' : 'locked';
  if (status === 429) return code === 'daily_cap' ? 'daily_cap' : 'rate_limited';
  if (status === 503) return 'not_configured';
  if (status === 403) return 'blocked';
  return 'failed';
}

/**
 * Our server already cleaned these; checked again because anything off the network is untrusted.
 * A result is `device` only when both the answer and the result say so; a missing, malformed or
 * unknown value on either makes it `none`.
 */
export function parseWebResults(body: unknown): WebResult[] {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new WebSearchError('failed', 'Unexpected response');
  }
  const batch = storageOf(body.storage);
  const results = body.results.flatMap((item: unknown): WebResult[] => {
    if (!isRecord(item)) return [];
    const url = safeHref(stringField(item, 'url') ?? '');
    const title = stringField(item, 'title')?.trim();
    if (!url || !title) return [];
    const fields = {
      title: title.slice(0, MAX_TITLE),
      url,
      snippet: (stringField(item, 'snippet') ?? '').slice(0, MAX_SNIPPET),
    };
    const storage = batch === 'device' ? storageOf(item.storage) : 'none';
    return [storage === 'device' ? { ...fields, storage } : { ...fields, storage: 'none' }];
  });
  return results.slice(0, MAX_RESULTS);
}

/** Run-time half of the device lock: only well-formed `device` results pass. */
export function isDeviceResult(value: unknown): value is DeviceResult {
  return (
    isRecord(value) &&
    value.storage === 'device' &&
    typeof value.title === 'string' &&
    typeof value.snippet === 'string' &&
    safeHref(stringField(value, 'url') ?? '') !== undefined
  );
}

export function createWebSearch(deps: WebSearchDependencies): WebSearchClient {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  /** One same-origin call: timeout, cancellation, a size cap, and typed failures. */
  async function call(url: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
    if (signal?.aborted) throw new WebSearchError('aborted', 'Request cancelled');
    if (!deps.isOnline()) throw new WebSearchError('offline', 'Device is offline');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort, { once: true });
    try {
      let response: Response;
      try {
        response = await deps.fetch(url, {
          ...init,
          signal: controller.signal,
          // Only the access cookie goes along, and only to our own origin.
          credentials: 'same-origin',
          referrerPolicy: 'no-referrer',
          cache: 'no-store',
          redirect: 'error',
        });
      } catch {
        if (signal?.aborted) throw new WebSearchError('aborted', 'Request cancelled');
        throw new WebSearchError(deps.isOnline() ? 'failed' : 'offline', 'Request failed');
      }
      const text = await response.text().catch(() => '');
      let body: unknown;
      try {
        body = text.length <= MAX_BODY_CHARS ? JSON.parse(text) : undefined;
      } catch {
        body = undefined;
      }
      if (!response.ok) {
        const code = isRecord(body) ? stringField(body, 'error') : undefined;
        throw new WebSearchError(failureFor(response.status, code), `HTTP ${response.status}`);
      }
      return body;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    }
  }

  const post = (body?: unknown): RequestInit => ({
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    // POST, so the search text is never part of a URL that request logs could record.
    search: async (query, signal) =>
      parseWebResults(await call(WEB_SEARCH_PATH, post({ q: query.trim() }), signal)),
    unlock: async (code) => {
      await call(UNLOCK_PATH, post({ code }));
    },
    lock: async () => {
      await call(LOCK_PATH, post());
    },
  };
}
