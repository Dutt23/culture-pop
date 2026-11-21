import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../../data/seed';
import type { RankedMatch } from '../../domain/ranking';
import type { LibraryResult } from './rankLibrary';
import { useSearch, WORKER_FROM_CARDS } from './useSearch';

/** Replies the test releases by hand, in any order, to check that the latest query wins. */
const { replies, listeners, library, workerSearch } = vi.hoisted(() => ({
  replies: new Map<string, (result: LibraryResult) => void>(),
  listeners: new Set<() => void>(),
  library: { size: 0 },
  workerSearch: { calls: 0 },
}));

vi.mock('../../app/useRepositories', async () => {
  const { buildSeed: seed } = await import('../../data/seed');
  const { references, aliases, interpretations } = seed();
  const references_ = {
    count: async () => library.size,
    getSearchIndex: async () => ({
      references,
      aliases,
      interpretations,
      sources: [],
      validSourceIds: new Set<string>(),
    }),
  };
  return { useRepositories: () => ({ references: references_ }) };
});

vi.mock('../../services/search/searchClient', () => ({
  getSearchClient: () => ({
    search: (query: string) => {
      workerSearch.calls += 1;
      return new Promise<LibraryResult>((resolve) => replies.set(query, resolve));
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  }),
}));

const match = { reference: { id: 'x' } } as unknown as RankedMatch;

function result(needsRetrieval: boolean, matches: RankedMatch[] = []): LibraryResult {
  return { matches, isAmbiguous: false, needsRetrieval, summaries: new Map(), savedOnline: [] };
}

beforeEach(() => {
  replies.clear();
  listeners.clear();
  workerSearch.calls = 0;
  library.size = WORKER_FROM_CARDS + 1;
});

describe('useSearch with a small library (every reader today)', () => {
  it('ranks on this thread, in the same render as the query, and never starts the worker', async () => {
    library.size = buildSeed().references.length;
    const { result: hook, rerender } = renderHook(({ query }) => useSearch(query), {
      initialProps: { query: 'hakuna matata' },
    });
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.matches.length).toBeGreaterThan(0);

    rerender({ query: 'bazinga' });
    // No waiting: the new query's results are there on the very next render.
    expect(hook.current.matches[0]?.reference.title.toLowerCase()).toContain('bazinga');
    expect(workerSearch.calls).toBe(0);
  });
});

describe('useSearch with a big library (in the worker)', () => {
  it('drops a slow reply to an earlier query once a newer one has been asked', async () => {
    const { result: hook, rerender } = renderHook(({ query }) => useSearch(query), {
      initialProps: { query: 'doo' },
    });
    await waitFor(() => expect(replies.has('doo')).toBe(true));
    rerender({ query: 'doom' });
    await waitFor(() => expect(replies.has('doom')).toBe(true));

    await act(async () => replies.get('doom')?.(result(true)));
    await act(async () => replies.get('doo')?.(result(false)));

    expect(hook.current.loading).toBe(false);
    expect(hook.current.needsRetrieval).toBe(true);
  });

  it('keeps the last results on screen while the next query is ranked, without going online for it', async () => {
    const { result: hook, rerender } = renderHook(({ query }) => useSearch(query), {
      initialProps: { query: 'doo' },
    });
    expect(hook.current.loading).toBe(true);
    await waitFor(() => expect(replies.has('doo')).toBe(true));
    await act(async () => replies.get('doo')?.(result(true, [match])));
    expect(hook.current.needsRetrieval).toBe(true);

    rerender({ query: 'doom' });

    expect(hook.current.loading).toBe(false);
    expect(hook.current.matches).toEqual([match]);
    // Those results belong to "doo": they must not send "doom" online.
    expect(hook.current.needsRetrieval).toBe(false);
  });

  it('asks again when the library changes', async () => {
    const { result: hook } = renderHook(() => useSearch('doom'));
    await waitFor(() => expect(replies.has('doom')).toBe(true));
    await act(async () => replies.get('doom')?.(result(true)));
    replies.clear();

    act(() => listeners.forEach((listener) => listener()));
    await waitFor(() => expect(replies.has('doom')).toBe(true));
    await act(async () => replies.get('doom')?.(result(false)));

    expect(hook.current.needsRetrieval).toBe(false);
  });
});
