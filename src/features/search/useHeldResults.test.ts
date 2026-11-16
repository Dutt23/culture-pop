import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHeldResults } from './useHeldResults';

const item = (id: string) => ({ id });
const ids = (list: readonly { id: string }[]) => list.map((x) => x.id);
const isDoom = (x: { id: string }) => x.id === 'doom';

function streamed(lead?: (x: { id: string }) => boolean) {
  const hook = renderHook(({ items }) => useHeldResults(items, 'doctor doom', lead), {
    initialProps: { items: [item('quote-1'), item('quote-2')] },
  });
  hook.rerender({ items: [item('doom'), item('quote-1'), item('later'), item('quote-2')] });
  return hook;
}

describe('useHeldResults', () => {
  it('shows the first batch and holds later arrivals without moving the cards on screen', () => {
    const { result } = streamed(isDoom);
    expect(ids(result.current.shown)).toEqual(['quote-1', 'quote-2']);
    expect(ids(result.current.held)).toEqual(['doom', 'later']);
  });

  // The page named by the search goes above quote pages that happened to arrive first.
  it('puts a held lead on top when the reader taps, and the rest below the shown cards', () => {
    const { result } = streamed(isDoom);
    act(() => result.current.showHeld());
    expect(ids(result.current.shown)).toEqual(['doom', 'quote-1', 'quote-2', 'later']);
    expect(result.current.held).toEqual([]);
  });

  it('keeps the shown cards first when no held item is a lead', () => {
    const { result } = streamed();
    act(() => result.current.showHeld());
    expect(ids(result.current.shown)).toEqual(['quote-1', 'quote-2', 'doom', 'later']);
  });

  it('starts over for a new search', () => {
    const { result, rerender } = renderHook(({ items, key }) => useHeldResults(items, key), {
      initialProps: { items: [item('a')], key: 'first' },
    });
    rerender({ items: [item('b'), item('a')], key: 'second' });
    expect(ids(result.current.shown)).toEqual(['b', 'a']);
  });
});
