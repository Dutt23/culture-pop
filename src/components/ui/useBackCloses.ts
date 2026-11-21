import { useEffect, useId, useLayoutEffect, useRef } from 'react';

/** The key on history.state that holds the id of the overlay that added the entry. */
export const OVERLAY_MARK = 'pcdOverlay';

type MarkedState = Record<string, unknown> | null;

const topId = (): unknown => (window.history.state as MarkedState)?.[OVERLAY_MARK];

function pushMark(id: string): void {
  window.history.pushState({ ...(window.history.state ?? {}), [OVERLAY_MARK]: id }, '');
}

/**
 * Back (a phone's back gesture or the browser's button) closes an open overlay instead of leaving
 * the page: opening adds a history entry tagged with this overlay's own id, and leaving it closes.
 * Closing another way (Close, Escape, a route change) takes the entry back off. While `stayOpen`,
 * Back is refused and the entry put back, so the next Back still closes.
 *
 * Safe under React StrictMode, which mounts, unmounts and remounts at once in development: the
 * entry is pushed once per overlay, and the unmount's step back waits a task and is skipped if the
 * same overlay came straight back (owner bug, 2026-11-22: the account tray closed itself in dev).
 * Overlays opened on top of each other each answer only to their own entry.
 */
export function useBackCloses(onClose: () => void, { stayOpen = false } = {}): void {
  const id = useId();
  const closeRef = useRef(onClose);
  const stayOpenRef = useRef(stayOpen);
  useLayoutEffect(() => {
    closeRef.current = onClose;
    stayOpenRef.current = stayOpen;
  });
  // Kept across StrictMode's remount of the same overlay.
  const pushed = useRef(false);
  const mounted = useRef(false);
  const poppedByBack = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (!pushed.current) {
      pushMark(id);
      pushed.current = true;
      poppedByBack.current = false;
    }
    const onPop = () => {
      // Still on our entry (an overlay above ours closed): not ours to answer.
      if (topId() === id) return;
      // Work still running: stay, and put our entry back so the next Back still closes.
      if (stayOpenRef.current) return pushMark(id);
      poppedByBack.current = true;
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      mounted.current = false;
      // A task later: StrictMode's remount has happened by then, and a real close has not.
      window.setTimeout(() => {
        if (mounted.current) return;
        pushed.current = false;
        // Closed some other way: take our entry back off, unless the page already moved on.
        if (!poppedByBack.current && topId() === id) window.history.back();
      }, 0);
    };
  }, [id]);
}
