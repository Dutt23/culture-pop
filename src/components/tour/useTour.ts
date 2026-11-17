import { useState } from 'react';
import { useSearchParams } from 'react-router';

const SEEN_PREFIX = 'pcd:tour-seen:';

/** `?tour=1` replays a page's tour on request (Settings → Show me around). */
export const TOUR_PARAM = 'tour';

function seen(id: string): boolean {
  try {
    return localStorage.getItem(SEEN_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN_PREFIX + id, '1');
  } catch {
    // Blocked storage: the tour may offer itself again, nothing worse.
  }
}

/** Lets every page's tour show again (Settings → Show me around). */
export function resetTours(ids: readonly string[]) {
  try {
    for (const id of ids) localStorage.removeItem(SEEN_PREFIX + id);
  } catch {
    // Blocked storage: nothing was marked seen either.
  }
}

/** A page's tour opens on the first visit, or on request, once the page has what it points at. */
export function useTour(id: string, ready: boolean): { open: boolean; close: () => void } {
  const [params, setParams] = useSearchParams();
  const asked = params.get(TOUR_PARAM) === '1';
  const [closed, setClosed] = useState(false);

  const close = () => {
    markSeen(id);
    setClosed(true);
    if (!asked) return;
    const next = new URLSearchParams(params);
    next.delete(TOUR_PARAM);
    setParams(next, { replace: true });
  };

  return { open: ready && !closed && (asked || !seen(id)), close };
}
