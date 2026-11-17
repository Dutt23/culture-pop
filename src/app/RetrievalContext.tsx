import { createContext, type ReactNode } from 'react';
import type { Observable } from 'rxjs';
import type { RetrievalResult } from '../services/retrieval/types';
import type { WebSearchClient } from '../services/retrieval/webSearch';

export interface RetrievalService {
  /**
   * A snapshot each time a provider answers, completing after the last one. Unsubscribing
   * cancels every request still running.
   */
  retrieve$: (query: string) => Observable<RetrievalResult>;
  /** Wait after the last keystroke before contacting providers. */
  debounceMs: number;
  /** The wider-web search (D45): only after a tap and consent; results are never stored. */
  webSearch: WebSearchClient;
}

/**
 * Types and the context only: the live service is built by `useRetrievalService`
 * (`retrievalService.ts`), which only the screens loaded on demand import, so online-search code
 * stays out of the first load (Phase 5 step 2). Null means "use the live service".
 */
export const RetrievalContext = createContext<RetrievalService | null>(null);

interface RetrievalProviderProps {
  /** Injected in tests; left out, the screens build the live service on first use. */
  service?: RetrievalService;
  children: ReactNode;
}

export function RetrievalProvider({ service, children }: RetrievalProviderProps) {
  return <RetrievalContext.Provider value={service ?? null}>{children}</RetrievalContext.Provider>;
}
