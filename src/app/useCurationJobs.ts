import { createContext, useContext } from 'react';
import type { DraftResponse } from '../../shared/cardTypes';
import type { CurationJob, CurationJobInput } from '../data/repositories/curationJobRepository';

export interface StartedCuration {
  job: CurationJob;
  completion: Promise<DraftResponse>;
}
export interface CurationJobsContextValue {
  /**
   * Jobs still running plus any that changed since this tab opened, newest first. Not the whole
   * history: Activity reads that page by page (D69).
   */
  jobs: CurationJob[];
  activeCount: number;
  start(input: CurationJobInput): Promise<StartedCuration>;
  cancel(id: string): Promise<void>;
  retry(job: CurationJob): Promise<void>;
}
export const CurationJobsContext = createContext<CurationJobsContextValue | null>(null);

export function useCurationJobs(): CurationJobsContextValue {
  const value = useContext(CurationJobsContext);
  if (!value) throw new Error('CurationJobsProvider is missing');
  return value;
}
