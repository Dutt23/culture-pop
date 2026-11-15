import { createContext, useContext, type ReactNode } from 'react';
import { browserHttpDependencies, createGetJson } from '../services/retrieval/http';
import { retrieve, type OnRetrievalUpdate } from '../services/retrieval/retrieve';
import type { RetrievalResult } from '../services/retrieval/types';

export interface RetrievalService {
  /** Resolves with the final result; `onUpdate` receives a snapshot each time a provider answers. */
  retrieve: (
    query: string,
    signal: AbortSignal,
    onUpdate?: OnRetrievalUpdate,
  ) => Promise<RetrievalResult>;
  /** Wait after the last keystroke before contacting providers. */
  debounceMs: number;
}

const SEARCH_DEBOUNCE_MS = 500;

export function createRetrievalService(): RetrievalService {
  const getJson = createGetJson(browserHttpDependencies);
  return {
    retrieve: (query, signal, onUpdate) =>
      retrieve(query, { getJson, now: () => new Date().toISOString() }, signal, onUpdate),
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
