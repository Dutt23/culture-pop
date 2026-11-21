/** How long to wait for an idle moment before running the work anyway. */
const IDLE_TIMEOUT_MS = 5000;

/**
 * Runs housekeeping once the browser is idle (or after a few seconds at most), so it never competes
 * with the first screen. Returns a cancel function, ready to return from a React effect.
 */
export function whenIdle(work: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(work, { timeout: IDLE_TIMEOUT_MS });
    return () => cancelIdleCallback(handle);
  }
  const timer = setTimeout(work, 0);
  return () => clearTimeout(timer);
}
