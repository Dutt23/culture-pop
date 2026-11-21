import type { ReactNode } from 'react';
import { RetrievalContext, type RetrievalService } from './retrievalServiceContext';

interface RetrievalProviderProps {
  /** Injected in tests; left out, the screens build the live service on first use. */
  service?: RetrievalService;
  children: ReactNode;
}

export function RetrievalProvider({ service, children }: RetrievalProviderProps) {
  return <RetrievalContext.Provider value={service ?? null}>{children}</RetrievalContext.Provider>;
}
