import { useContext } from 'react';
import { browserHttpDependencies, createGetJson } from '../services/retrieval/http';
import { retrieve$ } from '../services/retrieval/retrieve';
import { withSessionCache } from '../services/retrieval/sessionCache';
import { createWebSearch } from '../services/retrieval/webSearch';
import { RetrievalContext, type RetrievalService } from './retrievalServiceContext';

const SEARCH_DEBOUNCE_MS = 500;

export function createRetrievalService(): RetrievalService {
  const getJson = createGetJson(browserHttpDependencies);
  return {
    retrieve$: withSessionCache((query) =>
      retrieve$(query, { getJson, now: () => new Date().toISOString() }),
    ),
    debounceMs: SEARCH_DEBOUNCE_MS,
    webSearch: createWebSearch(browserHttpDependencies),
  };
}

/** One live service for the whole visit, so the session cache is shared across screens. */
let live: RetrievalService | undefined;

/** The injected service (tests), else the live one, built on first use. */
export function useRetrievalService(): RetrievalService {
  const injected = useContext(RetrievalContext);
  if (injected) return injected;
  live ??= createRetrievalService();
  return live;
}
