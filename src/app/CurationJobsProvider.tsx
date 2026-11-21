import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { DraftResponse } from '../../shared/cardTypes';
import type { CurationJob, CurationJobInput } from '../data/repositories/curationJobRepository';
import { WebSearchError } from '../services/retrieval/webSearch';
import { DRAFT_FAILURE_TEXT } from '../features/drafts/failureText';
import { useRepositories } from './RepositoriesContext';
import { useRetrievalService } from './retrievalService';

interface StartedCuration {
  job: CurationJob;
  completion: Promise<DraftResponse>;
}
interface CurationJobsContextValue {
  jobs: CurationJob[];
  activeCount: number;
  start(input: CurationJobInput): Promise<StartedCuration>;
  cancel(id: string): Promise<void>;
  retry(job: CurationJob): Promise<void>;
}
const Context = createContext<CurationJobsContextValue | null>(null);
const EMPTY_JOBS: CurationJob[] = [];

export function CurationJobsProvider({ children }: { children: ReactNode }) {
  const { curationJobs } = useRepositories();
  const { webSearch } = useRetrievalService();
  const jobs = useLiveQuery(() => curationJobs.list(), [curationJobs]) ?? EMPTY_JOBS;
  const controllers = useRef(new Map<string, AbortController>());
  const observed = useRef(new Set<string>());
  const owner = useRef(crypto.randomUUID());
  const boot = useRef(Date.now());

  useEffect(() => {
    let mounted = true;
    void curationJobs
      .list()
      .then(async (rows) => {
        if (!mounted || typeof navigator.locks?.request !== 'function') return;
        for (const job of rows.filter(
          (row) => row.status === 'running' && Date.parse(row.createdAt) < boot.current,
        )) {
          await navigator.locks.request(
            'curation:' + job.id,
            { ifAvailable: true },
            async (lock) => {
              if (lock && mounted) await curationJobs.interrupt([job.id]);
            },
          );
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [curationJobs]);

  useEffect(() => {
    const present = new Set(jobs.map((job) => job.id));
    for (const [id, controller] of controllers.current) {
      if (observed.current.has(id) && !present.has(id)) controller.abort();
    }
    for (const job of jobs) {
      observed.current.add(job.id);
      if (job.status !== 'running') controllers.current.get(job.id)?.abort();
    }
  }, [jobs]);

  const value = useMemo<CurationJobsContextValue>(() => {
    const start = async (input: CurationJobInput): Promise<StartedCuration> => {
      const job = await curationJobs.create({ ...input, ownerId: owner.current });
      const controller = new AbortController();
      controllers.current.set(job.id, controller);
      const execute = async () => {
        try {
          if (controller.signal.aborted) throw new WebSearchError('aborted', 'Cancelled');
          const send = webSearch.streamDraftCard ?? webSearch.draftCard;
          const response = await send(job.request, controller.signal);
          const committed = await curationJobs.complete(job.id, response);
          if (!committed) throw new WebSearchError('aborted', 'Cancelled');
          return response;
        } catch (error) {
          if (controller.signal.aborted) await curationJobs.cancel(job.id).catch(() => {});
          else {
            const failure = error instanceof WebSearchError ? error.failure : 'failed';
            await curationJobs
              .fail(
                job.id,
                DRAFT_FAILURE_TEXT[failure],
                failure,
                error instanceof WebSearchError ? error.details?.notUsed : undefined,
              )
              .catch(() => {});
          }
          throw error;
        } finally {
          controllers.current.delete(job.id);
        }
      };
      const completion =
        typeof navigator.locks?.request === 'function'
          ? navigator.locks.request('curation:' + job.id, execute)
          : execute();
      // Activity owns the result even after the composer unmounts.
      void completion.catch(() => {});
      return { job, completion };
    };
    return {
      jobs,
      activeCount: jobs.filter((job) => job.status === 'running').length,
      start,
      cancel: async (id) => {
        await curationJobs.cancel(id);
        controllers.current.get(id)?.abort();
      },
      retry: async (job) => {
        await start({
          request: job.request,
          sent: job.sent,
          userContext: job.userContext,
          color: job.color,
        });
      },
    };
  }, [curationJobs, jobs, webSearch]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCurationJobs(): CurationJobsContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('CurationJobsProvider is missing');
  return value;
}
