import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DraftResponse } from '../../shared/cardTypes';
import type { PopCultureDb } from '../data/db';
import {
  CurationCapacityError,
  createCurationJobRepository,
  type CurationJobInput,
} from '../data/repositories/curationJobRepository';
import { WebSearchError } from '../services/retrieval/webSearch';
import type { RetrievalService } from './RetrievalContext';
import { unusedRetrievalService } from '../test/fakeRetrieval';
import { createTestDatabase } from '../test/renderApp';
import { AppProviders } from './AppProviders';
import { useCurationJobs } from './CurationJobsProvider';

type Runtime = ReturnType<typeof useCurationJobs>;
type Started = Awaited<ReturnType<Runtime['start']>>;
const databases: PopCultureDb[] = [];
const locksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

afterEach(() => {
  cleanup();
  for (const db of databases.splice(0)) db.close();
  if (locksDescriptor) Object.defineProperty(navigator, 'locks', locksDescriptor);
  else Reflect.deleteProperty(navigator, 'locks');
});

const input: CurationJobInput = {
  request: {
    search: 'bazinga',
    sources: [{ kind: 'app', from: 'app card', title: 'Bazinga', text: 'A catchphrase.' }],
  },
  sent: [
    { key: 'app:one', kind: 'app', from: 'app card', title: 'Bazinga', line: 'A catchphrase.' },
  ],
  color: 'sage',
  userContext: 'A joke in a group chat.',
};
const response: DraftResponse = {
  card: {
    label: 'Bazinga',
    gist: 'A catchphrase.',
    means: 'Gotcha!',
    reply: 'Nice one.',
    summary: [],
    context: [],
    example: null,
    spoiler: 'none',
  },
  notUsed: [],
  provider: 'fake',
  promptVersion: 'v1',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function mountRuntime(service: RetrievalService, existing?: PopCultureDb) {
  const db = existing ?? createTestDatabase();
  if (!databases.includes(db)) databases.push(db);
  await db.open();
  let runtime: Runtime | undefined;
  function Harness({ composer }: { composer: boolean }) {
    runtime = useCurationJobs();
    return (
      <>
        {composer && <span>Composer</span>}
        <output aria-label="Active jobs">{runtime.activeCount}</output>
      </>
    );
  }
  const tree = (composer: boolean) => (
    <AppProviders db={db} retrieval={service}>
      <Harness composer={composer} />
    </AppProviders>
  );
  const view = render(tree(true));
  await screen.findByText('Composer');
  return {
    db,
    jobs: createCurationJobRepository(db),
    runtime: () => {
      if (!runtime) throw new Error('Runtime did not mount');
      return runtime;
    },
    hideComposer: () => view.rerender(tree(false)),
    unmount: view.unmount,
  };
}

async function start(runtime: () => Runtime) {
  let started!: Started;
  await act(async () => {
    started = await runtime().start(input);
  });
  return started;
}

describe('curation jobs runtime', () => {
  it('continues after the composer closes and persists its completed response', async () => {
    const pending = deferred<DraftResponse>();
    const streamDraftCard = vi.fn(() => pending.promise);
    const service: RetrievalService = unusedRetrievalService();
    service.webSearch.streamDraftCard = streamDraftCard;
    const app = await mountRuntime(service);
    const started = await start(app.runtime);
    await waitFor(() => expect(app.runtime().activeCount).toBe(1));
    app.hideComposer();
    expect(screen.queryByText('Composer')).toBeNull();
    expect(streamDraftCard.mock.calls[0]).toBeDefined();
    await act(async () => {
      pending.resolve(response);
      expect(await started.completion).toEqual(response);
    });
    await waitFor(() => expect(app.runtime().activeCount).toBe(0));
    expect(await app.jobs.get(started.job.id)).toMatchObject({ status: 'completed', response });
    expect(service.webSearch.draftCard).not.toHaveBeenCalled();
  });

  it('admits five concurrent calls and refuses a sixth before sending it', async () => {
    const pending = deferred<DraftResponse>();
    const streamDraftCard = vi.fn(() => pending.promise);
    const service: RetrievalService = unusedRetrievalService();
    service.webSearch.streamDraftCard = streamDraftCard;
    const app = await mountRuntime(service);
    let attempts!: PromiseSettledResult<Started>[];
    await act(async () => {
      attempts = await Promise.allSettled(
        Array.from({ length: 6 }, () => app.runtime().start(input)),
      );
    });
    const started = attempts.flatMap((attempt) =>
      attempt.status === 'fulfilled' ? [attempt.value] : [],
    );
    expect(started).toHaveLength(5);
    expect(attempts.find((attempt) => attempt.status === 'rejected')).toMatchObject({
      reason: expect.any(CurationCapacityError),
    });
    expect(streamDraftCard).toHaveBeenCalledTimes(5);
    await act(async () => {
      pending.resolve(response);
      await Promise.all(started.map((job) => job.completion));
    });
    await waitFor(() => expect(app.runtime().activeCount).toBe(0));
  });

  it('cancels the producer signal and ignores a response arriving after cancellation', async () => {
    const pending = deferred<DraftResponse>();
    let signal: AbortSignal | undefined;
    const service: RetrievalService = unusedRetrievalService();
    service.webSearch.streamDraftCard = vi.fn((_request, current) => {
      signal = current;
      return pending.promise;
    });
    const app = await mountRuntime(service);
    const started = await start(app.runtime);
    await act(() => app.runtime().cancel(started.job.id));
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve(response);
      await expect(started.completion).rejects.toMatchObject({ failure: 'aborted' });
    });
    const row = await app.jobs.get(started.job.id);
    expect(row?.status).toBe('cancelled');
    expect(row?.response).toBeUndefined();
  });

  it('retains no_card reasons and source exclusions when research cannot support a card', async () => {
    const pending = deferred<DraftResponse>();
    const service: RetrievalService = unusedRetrievalService();
    service.webSearch.streamDraftCard = vi.fn(() => pending.promise);
    const app = await mountRuntime(service);
    const started = await start(app.runtime);
    const notUsed = [{ source: 0, why: 'Unrelated source' }];
    await act(async () => {
      pending.reject(
        new WebSearchError('no_card', 'No evidence', { reason: 'missing_evidence', notUsed }),
      );
      await expect(started.completion).rejects.toMatchObject({ failure: 'no_card' });
    });
    expect(await app.jobs.get(started.job.id)).toMatchObject({
      status: 'failed',
      failure: 'no_card',
      notUsed,
    });
  });

  it('retries a failed snapshot as a separate job while retaining its previous result', async () => {
    const service: RetrievalService = unusedRetrievalService();
    service.webSearch.streamDraftCard = vi
      .fn()
      .mockRejectedValueOnce(new WebSearchError('offline', 'Offline'))
      .mockResolvedValueOnce(response);
    const app = await mountRuntime(service);
    const original = await start(app.runtime);
    await expect(original.completion).rejects.toMatchObject({ failure: 'offline' });
    const failed = await app.jobs.get(original.job.id);
    expect(failed?.status).toBe('failed');
    await act(() => app.runtime().retry(failed!));
    await waitFor(async () =>
      expect((await app.jobs.list()).filter((job) => job.status === 'completed')).toHaveLength(1),
    );
    const rows = await app.jobs.list();
    expect(rows).toHaveLength(2);
    expect(rows.find((job) => job.status === 'completed')).toMatchObject({
      request: input.request,
      sent: input.sent,
      color: input.color,
      userContext: input.userContext,
    });
    expect((await app.jobs.get(original.job.id))?.status).toBe('failed');
  });

  it('recovers abandoned jobs while leaving a job locked by another tab running', async () => {
    const db = createTestDatabase();
    databases.push(db);
    await db.open();
    const jobs = createCurationJobRepository(db);
    const abandoned = await jobs.create({ ...input, ownerId: 'closed-tab' });
    const live = await jobs.create({ ...input, ownerId: 'live-tab' });
    await db.curationJobs.toCollection().modify({ createdAt: '2020-01-01T00:00:00.000Z' });
    const request = vi.fn(
      async (name: string, _options: unknown, callback: (lock: Lock | null) => Promise<unknown>) =>
        callback(name === 'curation:' + live.id ? null : ({ name, mode: 'exclusive' } as Lock)),
    );
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    const service: RetrievalService = unusedRetrievalService();
    await mountRuntime(service, db);
    await waitFor(async () => expect((await jobs.get(abandoned.id))?.status).toBe('interrupted'));
    expect((await jobs.get(live.id))?.status).toBe('running');
    expect(request).toHaveBeenCalledWith(
      'curation:' + abandoned.id,
      { ifAvailable: true },
      expect.any(Function),
    );
    expect(service.webSearch.draftCard).not.toHaveBeenCalled();
  });
});
