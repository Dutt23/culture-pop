import type {
  DraftRequestBody,
  DraftResponse,
  SourceKind,
  NotUsed,
} from '../../../shared/cardTypes.js';
import type { PopCultureDb } from '../db';

/** Snapshot of a selected source, independent of the modal's component types. */
export interface CurationSourceSnapshot {
  key: string;
  kind: SourceKind;
  from: string;
  title: string;
  line: string;
  url?: string;
  text?: string;
  provenance?: 'user';
}

export interface CurationJobInput {
  request: DraftRequestBody;
  sent: CurationSourceSnapshot[];
  userContext?: string;
  color?: 'lavender' | 'sage' | 'peach';
  ownerId?: string;
}

export interface CurationJob extends CurationJobInput {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  createdAt: string;
  updatedAt: string;
  response?: DraftResponse;
  error?: string;
  failure?: string;
  notUsed?: NotUsed[];
}

export const MAX_RUNNING_CURATION_JOBS = 5;

export class CurationCapacityError extends Error {
  constructor() {
    super('Five cards are already being made. Wait for one to finish or cancel it.');
    this.name = 'CurationCapacityError';
  }
}

export interface CurationJobRepository {
  /** Atomically admits at most five running jobs across tabs sharing this database. */
  create(input: CurationJobInput): Promise<CurationJob>;
  /** Newest first, including finished jobs. */
  list(): Promise<CurationJob[]>;
  get(id: string): Promise<CurationJob | undefined>;
  /** Only running jobs may transition. False means missing or already finished. */
  complete(id: string, response: DraftResponse): Promise<boolean>;
  fail(id: string, error: string, failure?: string, notUsed?: NotUsed[]): Promise<boolean>;
  cancel(id: string): Promise<boolean>;
  /** The caller identifies abandoned jobs; never interrupts every tab's running work. */
  interrupt(ids: readonly string[]): Promise<number>;
}

export function createCurationJobRepository(db: PopCultureDb): CurationJobRepository {
  const finish = (
    id: string,
    patch: Pick<CurationJob, 'status'> &
      Partial<Pick<CurationJob, 'response' | 'error' | 'failure' | 'notUsed'>>,
  ) =>
    db.transaction('rw', db.curationJobs, async () => {
      const job = await db.curationJobs.get(id);
      if (!job || job.status !== 'running') return false;
      await db.curationJobs.update(id, { ...patch, updatedAt: new Date().toISOString() });
      return true;
    });

  return {
    create: (input) => {
      const snapshot = structuredClone(input);
      return db.transaction('rw', db.curationJobs, async () => {
        const running = await db.curationJobs.where('status').equals('running').count();
        if (running >= MAX_RUNNING_CURATION_JOBS) throw new CurationCapacityError();
        const now = new Date().toISOString();
        const job: CurationJob = {
          ...snapshot,
          id: `curation:${crypto.randomUUID()}`,
          status: 'running',
          createdAt: now,
          updatedAt: now,
        };
        await db.curationJobs.add(job);
        return job;
      });
    },
    list: () => db.curationJobs.orderBy('createdAt').reverse().toArray(),
    get: (id) => db.curationJobs.get(id),
    complete: (id, response) => finish(id, { status: 'completed', response }),
    fail: (id, error, failure, notUsed) =>
      finish(id, { status: 'failed', error, failure, notUsed }),
    cancel: (id) => finish(id, { status: 'cancelled' }),
    interrupt: (ids) =>
      db.transaction('rw', db.curationJobs, async () => {
        const jobs = await db.curationJobs.bulkGet([...new Set(ids)]);
        const running = jobs.filter((job): job is CurationJob => job?.status === 'running');
        const now = new Date().toISOString();
        await db.curationJobs.bulkPut(
          running.map((job) => ({ ...job, status: 'interrupted', updatedAt: now })),
        );
        return running.length;
      }),
  };
}
