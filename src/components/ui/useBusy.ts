import { useCallback, useRef, useState } from 'react';

/**
 * `[busy, run]`: `run(work)` marks busy until `work` settles (success or error) and ignores a
 * second call while the first is still running, so a double tap does the work once.
 */
export function useBusy(): [boolean, <T>(work: () => Promise<T>) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = useCallback(async <T>(work: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
