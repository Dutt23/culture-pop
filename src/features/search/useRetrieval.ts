import { useCallback, useEffect, useState } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { useRetrievalService } from '../../app/RetrievalContext';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { normalizePhrase } from '../../domain/normalize';
import {
  RetrievalError,
  type RetrievalFailure,
  type RetrievalResult,
} from '../../services/retrieval/types';

const MIN_QUERY_CHARS = 2;

export type RetrievalState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** Some providers have answered; the rest are still `pending` in `result.outcomes`. */
  | { status: 'partial'; result: RetrievalResult }
  | { status: 'done'; result: RetrievalResult; cached: boolean }
  | { status: 'error'; failure: RetrievalFailure };

const IDLE: RetrievalState = { status: 'idle' };
const LOADING: RetrievalState = { status: 'loading' };

/**
 * Looks a query up online once the caller has decided it may (consent given, local cache miss).
 * Debounced, cancelled when the query changes, streamed as providers answer, and only the final
 * result is cached for offline reuse.
 */
export function useRetrieval(query: string, enabled: boolean): {
  state: RetrievalState;
  retry: () => void;
} {
  const service = useRetrievalService();
  const { retrieval: cache } = useRepositories();
  const isOnline = useOnlineStatus();
  const [attempt, setAttempt] = useState(0);
  const text = query.trim();
  const active = enabled && isOnline && normalizePhrase(text).length >= MIN_QUERY_CHARS;
  // State is tagged with the request it belongs to, so a new query reads as loading at once
  // instead of showing the previous query's results during the debounce.
  const requestKey = active ? `${attempt}\n${text}` : null;
  const [entry, setEntry] = useState<{ key: string; state: RetrievalState } | null>(null);

  useEffect(() => {
    if (requestKey === null) return;
    const controller = new AbortController();
    const update = (state: RetrievalState) => {
      if (!controller.signal.aborted) setEntry({ key: requestKey, state });
    };
    const timer = setTimeout(async () => {
      let result: RetrievalResult;
      try {
        result = await service.retrieve(text, controller.signal, (snapshot) =>
          update({ status: 'partial', result: snapshot }),
        );
      } catch (error) {
        update({
          status: 'error',
          failure: error instanceof RetrievalError ? error.failure : 'bad_response',
        });
        return;
      }
      if (controller.signal.aborted) return;
      // Without Wikidata, types and years are missing: caching would overwrite a good earlier copy.
      const wikidataFailed = result.outcomes.some(
        (o) => o.provider === 'wikidata' && o.status === 'failed',
      );
      let cached = !wikidataFailed;
      if (cached) {
        try {
          await cache.saveCandidates(result.candidates);
        } catch {
          cached = false;
        }
      }
      update({ status: 'done', result, cached });
    }, service.debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
      // The same key can come back (offline and online again); it must start from loading.
      setEntry(null);
    };
  }, [requestKey, text, service, cache]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state = requestKey === null ? IDLE : entry?.key === requestKey ? entry.state : LOADING;
  return { state, retry };
}
