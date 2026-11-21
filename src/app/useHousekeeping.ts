import { useEffect } from 'react';
import type { Repositories } from '../data/repositories';
import { MAX_CACHED_ONLINE } from '../data/repositories/retrievalRepository';
import { whenIdle } from './whenIdle';

/** Housekeeping runs at most this often, across app starts (D69: "once a day"). */
export const HOUSEKEEPING_EVERY_MS = 24 * 60 * 60 * 1000;
const LAST_RUN_KEY = 'pcd:housekeeping';

function lastRun(): number {
  try {
    return Number(localStorage.getItem(LAST_RUN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markRun(now: number) {
  try {
    localStorage.setItem(LAST_RUN_KEY, String(now));
  } catch {
    // Private mode or storage off: it simply runs again next start.
  }
}

/**
 * The limits on machine-made data (D69), applied once a day after the first screen settles:
 * finished Activity jobs past their keep window, cached online results past the cap, and kept web
 * results past 30 days. Nothing the reader made is touched. Each step is independent: one failing
 * (storage full, a locked database) never stops the others or the app.
 */
export async function runHousekeeping(
  repositories: Pick<Repositories, 'curationJobs' | 'retrieval' | 'webResults'>,
  now: number,
): Promise<void> {
  await Promise.allSettled([
    repositories.curationJobs.prune(now),
    repositories.retrieval.pruneOnline(MAX_CACHED_ONLINE),
    repositories.webResults.sweepExpired(now),
  ]);
}

export function useHousekeeping(
  repositories: Pick<Repositories, 'curationJobs' | 'retrieval' | 'webResults'>,
): void {
  useEffect(
    () =>
      whenIdle(() => {
        const now = Date.now();
        if (now - lastRun() < HOUSEKEEPING_EVERY_MS) return;
        // Marked once it has run, so a start that closes mid-way tries again next time.
        void runHousekeeping(repositories, now).then(() => markRun(now));
      }),
    [repositories],
  );
}
