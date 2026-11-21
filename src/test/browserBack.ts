import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * A Back like Chrome's: the step back lands a task later, on an entry without an overlay's mark.
 * The overlays' own history handling must survive this under StrictMode (owner bug, 2026-11-22).
 */
export function browserLikeBack() {
  return vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.setTimeout(() => {
      window.history.replaceState(null, '');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, 0);
  });
}

/** Lets queued tasks (a deferred step back and its popstate) run. */
export const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
