import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import styles from './CardReadyToast.module.css';
import { useCurationJobs } from './useCurationJobs';
import { isWatched } from './watchedJobs';

/** About how long the toast stays before it leaves on its own. */
export const TOAST_MS = 6000;

interface Toast {
  id: string;
  search: string;
  failed: boolean;
}

/**
 * Says when a card this tab watched being made has finished or failed, on any page. The region is
 * always mounted so screen readers announce what appears in it. Only the newest finish shows.
 */
export function CardReadyToast({ hidden = false }: { hidden?: boolean }) {
  const { jobs } = useCurationJobs();
  // Jobs this tab has seen running: a job already finished at load never gets a toast.
  const seen = useRef(new Set<string>());
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    // Newest first, so the first match is the one to show.
    let next: Toast | null = null;
    for (const job of jobs) {
      if (job.status === 'running') seen.current.add(job.id);
      else if (seen.current.delete(job.id)) {
        const done = job.status === 'completed' || job.status === 'failed';
        // Watched in Make a card: the reader sees it appear there instead.
        if (done && !isWatched(job.id)) {
          next ??= { id: job.id, search: job.request.search, failed: job.status === 'failed' };
        }
      }
    }
    if (next) setToast(next);
  }, [jobs]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const shown = hidden ? null : toast;
  return (
    <div className={styles.region} aria-live="polite">
      {shown && (
        <div key={shown.id} className={styles.toast}>
          <p className={styles.text}>
            {shown.failed
              ? `Your “${shown.search}” card couldn't be made`
              : `Your “${shown.search}” card is ready`}
          </p>
          <Link to="/activity" className={styles.open} onClick={() => setToast(null)}>
            Open
          </Link>
          <button
            type="button"
            className={styles.close}
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}
    </div>
  );
}
