import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { useCurationJobs } from '../../app/CurationJobsProvider';
import { useRepositories } from '../../app/RepositoriesContext';
import { Page } from '../../components/ui/Page';
import {
  MAX_RUNNING_CURATION_JOBS,
  type CurationJob,
} from '../../data/repositories/curationJobRepository';
import { DraftReveal } from '../drafts/DraftReveal';
import { useSettings } from '../settings/SettingsContext';
import draftStyles from '../drafts/drafts.module.css';
import styles from './ActivityPage.module.css';

const STATUS = {
  running: 'Making card…',
  completed: 'Ready to review',
  failed: 'Could not make card',
  cancelled: 'Cancelled',
  interrupted: 'Interrupted when the app closed',
} as const;

export function ActivityPage() {
  const { jobs, activeCount, cancel, retry } = useCurationJobs();
  const { drafts } = useRepositories();
  const { settings } = useSettings();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const savedCards = useLiveQuery(() => drafts.list(), [drafts]);
  const savedJobIds = new Set([
    ...saved,
    ...(savedCards ?? [])
      .filter((card) => card.id.startsWith('activity:'))
      .map((card) => card.id.slice('activity:'.length)),
  ]);
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set());
  const open = jobs.find((job) => job.id === openId);

  const cancelJob = async (id: string) => {
    setError('');
    try {
      await cancel(id);
    } catch {
      setError('Could not cancel this card. Try again.');
    }
  };

  const retryJob = async (job: CurationJob) => {
    setError('');
    setRetrying((ids) => new Set(ids).add(job.id));
    try {
      await retry(job);
    } catch {
      setError('Could not restart this card. Check your connection and try again.');
    } finally {
      setRetrying((ids) => new Set([...ids].filter((id) => id !== job.id)));
    }
  };

  return (
    <Page title="Activity" intro="Card requests and their results stay on this device.">
      <p className={styles.note} role="status">
        {activeCount} of {MAX_RUNNING_CURATION_JOBS} cards in progress
      </p>
      <p className={styles.note}>
        Keep this app open while cards are being made. You can browse other pages.
      </p>
      <Link to="/search">Find sources for another card</Link>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {jobs.length === 0 ? (
        <p>No card requests yet.</p>
      ) : (
        <ul className={styles.jobs} aria-label="Card requests">
          {jobs.map((job) => (
            <li key={job.id} className={styles.job}>
              <h2 className={styles.title}>{job.request.search}</h2>
              <p className={styles.note}>
                {savedJobIds.has(job.id) ? 'Saved to Your cards' : STATUS[job.status]}
              </p>
              {job.error && <p className={styles.error}>{job.error}</p>}
              {job.notUsed && job.notUsed.length > 0 && (
                <ul>
                  {job.notUsed.map((item) => (
                    <li key={item.source}>
                      Not used · {job.sent[item.source]?.title ?? 'Source'} · {item.why}
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.note}>
                {job.sent.length} selected {job.sent.length === 1 ? 'source' : 'sources'}
              </p>
              <div className={styles.actions}>
                {job.status === 'running' && (
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => void cancelJob(job.id)}
                  >
                    Cancel
                  </button>
                )}
                {job.status === 'completed' && job.response && (
                  <button
                    type="button"
                    className={styles.button}
                    aria-expanded={openId === job.id}
                    onClick={() => setOpenId(openId === job.id ? null : job.id)}
                  >
                    {openId === job.id ? 'Close preview' : 'Review card'}
                  </button>
                )}
                {['failed', 'cancelled', 'interrupted'].includes(job.status) && (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={activeCount >= MAX_RUNNING_CURATION_JOBS || retrying.has(job.id)}
                    onClick={() => void retryJob(job)}
                  >
                    {retrying.has(job.id) ? 'Starting…' : 'Try again'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {open?.response && (
        <section
          className={`${draftStyles.flow} ${styles.preview}`}
          data-scene="night"
          aria-label={`Preview for ${open.request.search}`}
        >
          <DraftReveal
            key={open.id}
            response={open.response}
            sent={open.sent}
            search={open.request.search}
            userContext={open.userContext}
            color={open.color}
            revealSpoilers={settings.spoilers === 'show'}
            readOnly={savedJobIds.has(open.id)}
            onKeep={(card) =>
              drafts.save({
                id: `activity:${open.id}`,
                search: open.request.search,
                card,
                sources: open.sent.map(({ from, title, url, provenance }) => ({
                  from,
                  title,
                  ...(url ? { url } : {}),
                  ...(provenance ? { provenance } : {}),
                })),
                promptVersion: open.response!.promptVersion,
                savedAt: new Date().toISOString(),
                ...(open.userContext ? { userContext: open.userContext } : {}),
                ...(open.color ? { color: open.color } : {}),
              })
            }
            onDone={(kept) => {
              if (kept) setSaved((ids) => new Set(ids).add(open.id));
              setOpenId(null);
            }}
          />
        </section>
      )}
    </Page>
  );
}
