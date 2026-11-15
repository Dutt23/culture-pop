import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

/**
 * The search text, mirrored to `?q=` for deep links and back/forward.
 * React Router 7 applies URL changes inside React transitions, so an input bound straight to the
 * URL can drop keystrokes on slow devices. The input owns the text; the URL follows it.
 */
export function useSearchQuery(): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  // Values written to the URL that haven't come back through the router yet.
  const pending = useRef<string[]>([]);

  useEffect(() => {
    const index = pending.current.indexOf(urlQuery);
    if (index >= 0) {
      pending.current = pending.current.slice(index + 1);
      return;
    }
    // Back/forward or a link changed the URL: follow it.
    setQuery(urlQuery);
  }, [urlQuery]);

  const updateQuery = useCallback(
    (value: string) => {
      setQuery(value);
      pending.current = [...pending.current, value];
      setParams(value ? { q: value } : {}, { replace: true });
    },
    [setParams],
  );

  return [query, updateQuery];
}
