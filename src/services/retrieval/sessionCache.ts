import { defer, finalize, of, share, tap, type Observable } from 'rxjs';
import { normalizePhrase } from '../../domain/normalize';
import type { RetrievalResult } from './types';

const MAX_RESULTS = 20;
const RESULT_TTL_MS = 10 * 60 * 1000;

type Retrieve = (query: string) => Observable<RetrievalResult>;

/**
 * Session-only memory in front of `retrieve$` (D37), never persisted:
 * - identical searches running at the same time share one set of requests;
 * - a finished search is replayed for ten minutes (e.g. after going back from a result), for at most
 *   the 20 most recently used queries.
 * A lookup that was cancelled or had a provider fail is never kept, so Retry always goes online.
 */
export function withSessionCache(retrieve: Retrieve, now: () => number = Date.now): Retrieve {
  const finished = new Map<string, { result: RetrievalResult; at: number }>();
  const running = new Map<string, Observable<RetrievalResult>>();

  const remember = (key: string, result: RetrievalResult) => {
    finished.set(key, { result, at: now() });
    // Map keeps insertion order, so the first key is the least recently used.
    while (finished.size > MAX_RESULTS) finished.delete(finished.keys().next().value as string);
  };

  return (query) =>
    defer(() => {
      const key = normalizePhrase(query);
      const hit = finished.get(key);
      finished.delete(key);
      if (hit && now() - hit.at <= RESULT_TTL_MS) {
        finished.set(key, hit);
        return of(hit.result);
      }
      const shared = running.get(key);
      if (shared) return shared;

      let last: RetrievalResult | undefined;
      const lookup = retrieve(query).pipe(
        tap({
          next: (result) => {
            last = result;
          },
          complete: () => {
            if (last?.outcomes.every((o) => o.status !== 'failed')) remember(key, last);
          },
        }),
        // Runs once the lookup completes, fails, or every subscriber has gone (which cancels it).
        finalize(() => running.delete(key)),
        share(),
      );
      running.set(key, lookup);
      return lookup;
    });
}
