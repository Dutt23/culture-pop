import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useRepositories } from '../../app/RepositoriesContext';
import { useRetrievalService } from '../../app/RetrievalContext';
import { FavouriteButton } from '../../components/favourite-button/FavouriteButton';
import { ExternalAnchor } from '../../components/ui/ExternalAnchor';
import { hostOf } from '../../components/ui/safeHref';
import type { SavedWebResults } from '../../data/repositories/webResultRepository';
import { formatDate } from '../../domain/dates';
import type { WebSearchPreference } from '../../domain/settings';
import {
  isDeviceResult,
  WebSearchError,
  type WebResult,
  type WebSearchFailure,
} from '../../services/retrieval/webSearch';
import { useSavedLinks } from '../favourites/useSavedLinks';
import styles from './OnlineResults.module.css';
import own from './WiderWebSearch.module.css';

const FAILURE_TEXT: Record<WebSearchFailure, string> = {
  offline: "You're offline. The wider web search needs a connection.",
  locked: 'This search needs an access code.',
  wrong_code: "That code didn't work.",
  bad_query: 'This search is too long for the wider web search. Try fewer words.',
  rate_limited: 'Too many searches just now. Try again in a minute.',
  daily_cap: "Today's wider web searches are used up. Try again tomorrow.",
  not_configured: "The wider web search isn't set up on the server yet.",
  blocked: 'The server refused the search.',
  failed: "The wider web search didn't answer. Try again.",
  aborted: 'The search was cancelled.',
};

/** The consent card's wording; Settings repeats it in short (D45). */
const WEB_SEARCH_DISCLOSURE = [
  'Your search text goes through our server to Parallel (parallel.ai), a paid web-search service.',
  'Nothing else is sent: no account, no device details, no location.',
  'Parallel keeps searches and may use them to improve its service.',
  'Results are links to other sites, and nobody has checked them.',
  'Results from the wider web can be kept on this device, for you only, for 30 days while search',
  'history is on. They are never sent anywhere else, and Clear history deletes them.',
  'A link you save with the heart (its title and address only) stays on this device until you',
  'remove it or reset the app.',
].join(' ');

const failureOf = (error: unknown): WebSearchFailure =>
  error instanceof WebSearchError ? error.failure : 'failed';

type Phase =
  | { kind: 'idle' }
  | { kind: 'consent' }
  | { kind: 'loading' }
  | { kind: 'locked' }
  | { kind: 'error'; failure: WebSearchFailure }
  | { kind: 'done'; results: readonly WebResult[] };

interface WiderWebSearchProps {
  query: string;
  isOnline: boolean;
  preference: WebSearchPreference;
  /** Search history on: only then are `device` results kept, because they are keyed by the query. */
  historyOn: boolean;
  /** Stores "On" after the reader agrees in the consent card. */
  onAllow: () => Promise<void>;
}

/**
 * "Search the wider web" for a local miss: one tap, consent first. `device` results are kept on this
 * device for 30 days while search history is on (D45), shown again with "Saved <date>" and Refresh;
 * `none` results live only in this component's state. Neither ever reaches the library, history's
 * reference IDs or favourites, and nothing kept here is ever sent anywhere.
 */
export function WiderWebSearch(props: WiderWebSearchProps) {
  const { query, isOnline, preference, historyOn, onAllow } = props;
  const { webSearch } = useRetrievalService();
  const { webResults } = useRepositories();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [saved, setSaved] = useState<SavedWebResults | undefined>(undefined);
  const [saveFailed, setSaveFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);

  // Cancels a search still running when the query changes or the page closes.
  useEffect(() => () => controller.current?.abort(), []);

  // Results kept from an earlier search for this query; with history off, none are shown or kept.
  useEffect(() => {
    if (!historyOn) return;
    let live = true;
    webResults
      .get(query, Date.now())
      .then((row) => live && setSaved(row))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [webResults, query, historyOn]);

  if (preference === 'off') return null;

  const run = async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPhase({ kind: 'loading' });
    try {
      const results = await webSearch.search(query, current.signal);
      if (current.signal.aborted) return;
      setPhase({ kind: 'done', results });
      // Best effort: a failed write only means a new search next time.
      if (historyOn) {
        webResults.save(query, results.filter(isDeviceResult), Date.now()).catch(() => {});
      }
    } catch (error) {
      if (current.signal.aborted) return;
      const failure = failureOf(error);
      setPhase(failure === 'locked' ? { kind: 'locked' } : { kind: 'error', failure });
    }
  };

  const allow = () => {
    setSaveFailed(false);
    // The tap is consent for this search even if storing the choice fails.
    onAllow().catch(() => setSaveFailed(true));
    void run();
  };

  if (phase.kind === 'consent') {
    return (
      <section className={styles.consent} aria-labelledby="web-consent-title">
        <h2 id="web-consent-title" className={styles.consentTitle}>
          Search the wider web?
        </h2>
        <p>{WEB_SEARCH_DISCLOSURE}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={allow}>
            Search the wider web
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setPhase({ kind: 'idle' })}
          >
            Not now
          </button>
        </div>
      </section>
    );
  }

  if (phase.kind === 'locked') {
    return (
      <AccessCodeForm onUnlocked={() => void run()} onCancel={() => setPhase({ kind: 'idle' })} />
    );
  }

  // Refresh and the first search both go through consent when it's still "Ask first".
  const start = () => (preference === 'ask' ? setPhase({ kind: 'consent' }) : void run());
  const busy = !isOnline || phase.kind === 'loading';
  const showSaved = saved !== undefined && phase.kind !== 'done';

  return (
    <div className={own.wrapper}>
      {showSaved && (
        <CommunitySuggests
          results={saved.results}
          kept
          savedAt={saved.savedAt}
          onRefresh={start}
          refreshDisabled={busy}
        />
      )}
      {phase.kind !== 'done' && !showSaved && (
        <>
          <button type="button" className={styles.secondary} disabled={busy} onClick={start}>
            Search the wider web
          </button>
          <p className={styles.note}>
            {isOnline ? (
              <>
                Asks a web-search service through our server.{' '}
                <Link to="/settings">Privacy and settings</Link>.
              </>
            ) : (
              'Needs a connection.'
            )}
          </p>
        </>
      )}
      {saveFailed && (
        <p className={styles.note} role="status">
          Couldn&rsquo;t save your choice, so you&rsquo;ll be asked again next time.
        </p>
      )}
      {phase.kind === 'loading' && (
        <p className={styles.note} role="status" aria-busy="true">
          Searching the wider web…
        </p>
      )}
      {phase.kind === 'error' && (
        <div className={styles.error} role="alert">
          <p>{FAILURE_TEXT[phase.failure]}</p>
          {phase.failure !== 'bad_query' && phase.failure !== 'not_configured' && (
            <button type="button" className={styles.secondary} onClick={() => void run()}>
              Try again
            </button>
          )}
        </div>
      )}
      {phase.kind === 'done' && (
        <CommunitySuggests
          results={phase.results}
          kept={historyOn && phase.results.every(isDeviceResult)}
        />
      )}
    </div>
  );
}

interface AccessCodeFormProps {
  onUnlocked: () => void;
  onCancel: () => void;
}

/**
 * Asks for the access code the owner shares. The code is sent once and dropped: the field is
 * cleared on submit and nothing is written to storage. The server's HttpOnly cookie is the only
 * credential afterwards.
 */
function AccessCodeForm({ onUnlocked, onCancel }: AccessCodeFormProps) {
  const { webSearch } = useRetrievalService();
  const inputId = useId();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<WebSearchFailure | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const given = code.trim();
    setCode('');
    if (!given) return;
    setChecking(true);
    setFailure(null);
    try {
      await webSearch.unlock(given);
      onUnlocked();
    } catch (error) {
      setChecking(false);
      setFailure(failureOf(error));
    }
  };

  return (
    <section className={styles.consent} aria-labelledby="access-code-title">
      <h2 id="access-code-title" className={styles.consentTitle}>
        Enter access code
      </h2>
      <p>The wider web search is for people the owner has given a code to.</p>
      <form className={own.form} onSubmit={submit}>
        <label htmlFor={inputId}>Access code</label>
        <input
          id={inputId}
          className={own.input}
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {failure && (
          <p className={styles.note} role="alert">
            {FAILURE_TEXT[failure]}
          </p>
        )}
        <div className={styles.actions}>
          <button type="submit" className={styles.primary} disabled={checking}>
            Unlock
          </button>
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

interface CommunitySuggestsProps {
  results: readonly WebResult[];
  /** True when these results are (or now will be) kept on this device. */
  kept: boolean;
  /** Set for results read back from this device. */
  savedAt?: number;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

function CommunitySuggests({
  results,
  kept,
  savedAt,
  onRefresh,
  refreshDisabled,
}: CommunitySuggestsProps) {
  const savedOn = savedAt === undefined ? undefined : formatDate(new Date(savedAt).toISOString());
  const savedLinks = useSavedLinks();
  return (
    <section className={styles.community} aria-labelledby="web-results-title">
      <h2 id="web-results-title" className={styles.communityTitle}>
        Community suggests… (unverified)
      </h2>
      {savedOn && <p className={styles.note}>Saved {savedOn}</p>}
      {results.length === 0 ? (
        <p className={styles.note}>The wider web had nothing for this either.</p>
      ) : (
        <>
          <p className={styles.note}>
            Links found by a web search. Nobody has checked them.{' '}
            {kept ? 'Kept on this device for 30 days, for you only.' : 'Not saved on this device.'}
          </p>
          <p className={styles.note}>Tap the heart to save a link until you remove it.</p>
          {savedLinks.error && (
            <p className={styles.note} role="alert">
              {savedLinks.error}
            </p>
          )}
          {/* Text and links only: a result URL is never an image, video or frame source. */}
          <ul className={own.results}>
            {results.map((result) => (
              <li key={result.url} className={own.result}>
                <div className={own.titleRow}>
                  <ExternalAnchor href={result.url} className={own.title}>
                    {result.title}
                  </ExternalAnchor>
                  <FavouriteButton
                    iconOnly
                    label={`Save link ${result.title}`}
                    isFavourite={savedLinks.isSaved(result.url)}
                    // Title and link only: the snippet is never kept with a saved link.
                    onToggle={() =>
                      void savedLinks.toggle({ url: result.url, title: result.title })
                    }
                  />
                </div>
                <span className={own.host}>{hostOf(result.url)}</span>
                {result.snippet && <p className={own.snippet}>{result.snippet}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
      {onRefresh && (
        <button
          type="button"
          className={styles.secondary}
          disabled={refreshDisabled}
          onClick={onRefresh}
        >
          Refresh
        </button>
      )}
    </section>
  );
}
