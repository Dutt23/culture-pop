import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PAGE_SIZE, usePagedList } from './usePagedList';

// Two and a half pages, whatever the page size is.
const ALL = Array.from({ length: PAGE_SIZE * 2 + PAGE_SIZE / 2 }, (_, i) => `row-${i}`);
const countAll = async () => ALL.length;

describe('usePagedList', () => {
  it('reads the first page, takes its total from count, and grows by a page on more()', async () => {
    const load = vi.fn(async (limit: number) => ALL.slice(0, limit));
    const { result } = renderHook(() => usePagedList(load, countAll, []));

    await waitFor(() => expect(result.current.rows).toHaveLength(PAGE_SIZE));
    expect(result.current.rows?.[0]).toBe('row-0');
    await waitFor(() => expect(result.current.total).toBe(ALL.length));

    act(() => result.current.more());
    await waitFor(() => expect(result.current.rows).toHaveLength(PAGE_SIZE * 2));

    act(() => result.current.more());
    await waitFor(() => expect(result.current.rows).toHaveLength(ALL.length));
    expect(result.current.total).toBe(ALL.length);
  });

  it('does not ask for another page once every row is read', async () => {
    const few = ALL.slice(0, 10);
    const load = vi.fn(async (limit: number) => few.slice(0, limit));
    const { result } = renderHook(() => usePagedList(load, async () => few.length, []));
    await waitFor(() => expect(result.current.rows).toHaveLength(10));

    act(() => result.current.more());
    await waitFor(() => expect(result.current.total).toBe(10));
    expect(load).not.toHaveBeenCalledWith(PAGE_SIZE * 2);
  });

  it('keeps showing the rows it has while the next page loads', async () => {
    let releaseSecondPage: () => void = () => {};
    const secondPage = new Promise<void>((resolve) => {
      releaseSecondPage = resolve;
    });
    const load = vi.fn(async (limit: number) => {
      if (limit > PAGE_SIZE) await secondPage;
      return ALL.slice(0, limit);
    });
    const seen: (number | undefined)[] = [];
    const { result } = renderHook(() => {
      const list = usePagedList(load, countAll, []);
      seen.push(list.rows?.length);
      return list;
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(PAGE_SIZE));

    act(() => result.current.more());
    // The second page is still pending: the first is still on screen.
    await waitFor(() => expect(load).toHaveBeenCalledWith(PAGE_SIZE * 2));
    expect(result.current.rows).toHaveLength(PAGE_SIZE);

    releaseSecondPage();
    await waitFor(() => expect(result.current.rows).toHaveLength(PAGE_SIZE * 2));
    // Once the first page arrived, rows never went back to undefined.
    const firstPageAt = seen.findIndex((length) => length !== undefined);
    expect(seen.slice(firstPageAt).every((length) => length !== undefined)).toBe(true);
  });
});
