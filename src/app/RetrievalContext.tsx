import { createContext, useContext, type ReactNode } from 'react';
import type { Observable } from 'rxjs';
import { browserHttpDependencies, createGetJson } from '../services/retrieval/http';
import { retrieve$ } from '../services/retrieval/retrieve';
import { withSessionCache } from '../services/retrieval/sessionCache';
import type { RetrievalResult } from '../services/retrieval/types';

export interface RetrievalService {
  /**
   * A snapshot each time a provider answers, completing after the last one. Unsubscribing
   * cancels every request still running.
   */
  retrieve$: (query: string) => Observable<RetrievalResult>;
  /** Wait after the last keystroke before contacting providers. */
  debounceMs: number;
}

const SEARCH_DEBOUNCE_MS = 500;

export function createRetrievalService(): RetrievalService {
  const getJson = createGetJson(browserHttpDependencies);
  return {
    retrieve$: withSessionCache((query) =>
      retrieve$(query, { getJson, now: () => new Date().toISOString() }),
    ),
    debounceMs: SEARCH_DEBOUNCE_MS,
  };
}

const RetrievalContext = createContext<RetrievalService | null>(null);

interface RetrievalProviderProps {
  service: RetrievalService;
  children: ReactNode;
}

export function RetrievalProvider({ service, children }: RetrievalProviderProps) {
  return <RetrievalContext.Provider value={service}>{children}</RetrievalContext.Provider>;
}

export function useRetrievalService(): RetrievalService {
  const service = useContext(RetrievalContext);
  if (!service) throw new Error('useRetrievalService must be used inside RetrievalProvider');
  return service;
}
