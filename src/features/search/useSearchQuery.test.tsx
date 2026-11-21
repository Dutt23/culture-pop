import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useSearchQuery } from './useSearchQuery';

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/discover', '/search']} initialIndex={1}>
      {children}
    </MemoryRouter>
  );
  return renderHook(
    () => {
      const [query, update, settle] = useSearchQuery();
      return { query, update, settle, navigate: useNavigate(), location: useLocation() };
    },
    { wrapper },
  );
}

function typeAndSubmit(result: ReturnType<typeof setup>['result'], text: string) {
  // One URL update per keystroke, as the search box does.
  for (let i = 1; i <= text.length; i++) act(() => result.current.update(text.slice(0, i)));
  act(() => result.current.settle());
}

describe('useSearchQuery history', () => {
  it('Back returns to the previous submitted search, not past it', async () => {
    const { result } = setup();
    typeAndSubmit(result, 'hakuna');
    typeAndSubmit(result, 'pivot');
    expect(result.current.location.search).toBe('?q=pivot');

    act(() => result.current.navigate(-1));
    await waitFor(() => expect(result.current.location.search).toBe('?q=hakuna'));
    expect(result.current.query).toBe('hakuna');

    act(() => result.current.navigate(-1));
    await waitFor(() => expect(result.current.location.pathname).toBe('/search'));
    expect(result.current.location.search).toBe('');
  });

  it('keystrokes within one search share a single history entry', async () => {
    const { result } = setup();
    typeAndSubmit(result, 'bazinga');
    act(() => result.current.navigate(-1));
    // Straight back to the empty search page: no entry per letter.
    await waitFor(() => expect(result.current.location.search).toBe(''));
    act(() => result.current.navigate(-1));
    await waitFor(() => expect(result.current.location.pathname).toBe('/discover'));
  });
});
