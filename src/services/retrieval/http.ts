import { RETRIEVAL_HOSTS, type RetrievalHost } from './hosts';
import { RetrievalError, type GetJson } from './types';

/**
 * Identifies the app to Wikimedia (browsers can't set User-Agent; Api-User-Agent is the documented
 * alternative). Add a project URL or contact here once one exists — see docs/SOURCE_INVENTORY.md.
 */
export const API_USER_AGENT = 'PopCultureDecoder/0.2';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const MAX_RETRY_AFTER_MS = 10_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const HOSTS = new Map(RETRIEVAL_HOSTS.map((h) => [h.host, h]));
/** The only hosts the app may call, matching CSP connect-src. Anything else is refused before fetch. */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set(HOSTS.keys());
/** Real responses are a few KB; anything far larger is refused rather than parsed. */
export const MAX_RESPONSE_BYTES = 1_000_000;

function assertAllowedUrl(url: string): RetrievalHost {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RetrievalError('blocked', 'Invalid URL');
  }
  const host = HOSTS.get(parsed.hostname);
  if (parsed.protocol !== 'https:' || !host) {
    throw new RetrievalError('blocked', `Host not allowed: ${parsed.hostname}`);
  }
  return host;
}

/** Reads the body as text, stopping as soon as it exceeds the cap. */
async function readCapped(response: Response): Promise<string> {
  const declared = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new RetrievalError('bad_response', 'Response too large');
  }
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new RetrievalError('bad_response', 'Response too large');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export interface HttpDependencies {
  fetch: typeof fetch;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  isOnline: () => boolean;
  timeoutMs?: number;
  retries?: number;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RetrievalError('aborted', 'Request cancelled'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RetrievalError('aborted', 'Request cancelled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export const browserHttpDependencies: HttpDependencies = {
  fetch: (...args) => globalThis.fetch(...args),
  sleep: abortableSleep,
  isOnline: () => navigator.onLine,
};

/** Seconds or HTTP-date per RFC 9110; capped so a hostile header can't stall the UI. */
function retryAfterMs(header: string | null, fallbackMs: number): number {
  if (!header) return fallbackMs;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
  return Number.isFinite(ms) && ms >= 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : fallbackMs;
}

/** GET + JSON with a per-attempt timeout, caller cancellation and bounded retries. */
export function createGetJson(deps: HttpDependencies): GetJson {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = deps.retries ?? DEFAULT_RETRIES;

  return async function getJson(url, signal) {
    // Defence in depth: even a bug that builds a bad URL can't reach another host.
    const host = assertAllowedUrl(url);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (host.apiUserAgent) headers['Api-User-Agent'] = API_USER_AGENT;
    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new RetrievalError('aborted', 'Request cancelled');
      if (!deps.isOnline()) throw new RetrievalError('offline', 'Device is offline');

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const forwardAbort = () => controller.abort();
      signal?.addEventListener('abort', forwardAbort, { once: true });
      const interrupted = () => {
        if (signal?.aborted) return new RetrievalError('aborted', 'Request cancelled');
        if (timedOut) return new RetrievalError('timeout', `Timed out after ${timeoutMs} ms`);
        return undefined;
      };

      let response: Response;
      // The timeout and caller abort stay armed until the body is read, so a slow body obeys both.
      try {
        try {
          response = await deps.fetch(url, {
            headers,
            signal: controller.signal,
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            // No redirects: a response can't bounce us to another host or into a loop.
            redirect: 'error',
          });
        } catch {
          // CORS rejections, DNS failures and dropped connections all surface as TypeError.
          throw (
            interrupted() ??
            new RetrievalError(deps.isOnline() ? 'network' : 'offline', 'Network request failed')
          );
        }
        if (response.ok) {
          let body: string;
          try {
            body = await readCapped(response);
          } catch (error) {
            throw interrupted() ?? (error instanceof RetrievalError ? error : new RetrievalError('network', 'Body read failed'));
          }
          try {
            return JSON.parse(body) as unknown;
          } catch {
            throw new RetrievalError('bad_response', 'Response was not valid JSON');
          }
        }
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', forwardAbort);
      }
      if (response.status === 403) throw new RetrievalError('blocked', 'Provider refused the request');
      if (!RETRYABLE_STATUS.has(response.status)) {
        throw new RetrievalError('http_error', `HTTP ${response.status}`);
      }
      if (attempt >= retries) {
        throw new RetrievalError(
          response.status === 429 ? 'rate_limited' : 'http_error',
          `HTTP ${response.status} after ${attempt + 1} attempts`,
        );
      }
      const backoff = BACKOFF_BASE_MS * 2 ** attempt;
      await deps.sleep(retryAfterMs(response.headers.get('Retry-After'), backoff), signal);
    }
  };
}
