import { useCallback, useEffect, useState } from 'react';
import { BehaviorSubject } from 'rxjs';
import { useRepositories } from '../../app/RepositoriesContext';
import { useRetrievalService } from '../../app/retrievalService';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { normalizePhrase } from '../../domain/normalize';
import {
  retrievalStates,
  type KeyedRetrievalState,
  type RetrievalRequest,
  type RetrievalState,
} from './retrievalPipeline';

export type { RetrievalState } from './retrievalPipeline';

const MIN_QUERY_CHARS = 2;

const IDLE: RetrievalState = { status: 'idle' };
const LOADING: RetrievalState = { status: 'loading' };

/**
 * Looks a query up online once the caller has decided it may (consent given, local cache miss).
 * Debounced, cancelled when the query changes, streamed as providers answer, and only the final
 * result is cached for offline reuse. The pipeline itself is `retrievalStates`.
 */
export function useRetrieval(
  query: string,
  enabled: boolean,
): {
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
  const [entry, setEntry] = useState<KeyedRetrievalState | null>(null);
  // A BehaviorSubject, so a resubscription (new service or cache) picks up the current request.
  const [requests$] = useState(() => new BehaviorSubject<RetrievalRequest | null>(null));

  useEffect(() => {
    const subscription = retrievalStates(requests$, service, (candidates) =>
      cache.saveCandidates(candidates),
    ).subscribe(setEntry);
    return () => subscription.unsubscribe();
  }, [requests$, service, cache]);

  useEffect(() => {
    requests$.next(requestKey === null ? null : { key: requestKey, text });
    // The same key can come back (offline and online again); it must start from loading.
    return () => setEntry(null);
  }, [requests$, requestKey, text]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state = requestKey === null ? IDLE : entry?.key === requestKey ? entry.state : LOADING;
  return { state, retry };
}
