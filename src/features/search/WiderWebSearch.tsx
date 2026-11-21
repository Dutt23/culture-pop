import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useRepositories } from '../../app/RepositoriesContext';
import { useRetrievalService } from '../../app/retrievalService';
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

export const FAILURE_TEXT: Record<WebSearchFailure, string> = {
  offline: "You're offline. The wider web search needs a connection.",
  signed_out: 'Sign in to search the wider web.',
  not_allowed: "The wider web search isn't turned on for your account yet. Ask the owner.",
  bad_query: 'This search is too long for the wider web search. Try fewer words.',
  rate_limited: 'Too many searches just now. Try again in a minute.',
  daily_cap: "Today's wider web searches are used up. Try again tomorrow.",
  out_of_credit: 'The wider web search is paused for now. Try again later.',
  not_configured: "The wider web search isn't set up on the server yet.",
  blocked: 'The server refused the search.',
  no_card: "These results don't explain it. Try ticking others.",
  failed: "The wider web search didn't answer. Try again.",
  aborted: 'The search was cancelled.',
};

/** The consent card's wording; Settings repeats it in short (D45). */
export const WEB_SEARCH_DISCLOSURE = [
  'Your search text goes through our server to Parallel (parallel.ai), a paid web-search service.',
  'Nothing else is sent: no account, no device details, no location.',
  'Parallel keeps searches and may use them to improve its service.',
  'Results are links to other sites, and nobody has checked them.',
  'Results from the wider web can be kept on this device, for you only, for 30 days while search',
  'history is on. They are never sent anywhere else, and Clear history deletes them.',
  'A link you save with the heart (its title and address only) stays on this device until you',
  'remove it or reset the app.',
  'If you make a card from results, the search, the results you picked and any style cards go',
  'through our server to OpenAI (or Cloudflare if OpenAI is busy) to write a draft, and Parallel',
  "reads the web pages you picked. They don't use it to train their models. The card is kept only",
  'on this device.',
].join(' ');

const failureOf = (error: unknown): WebSearchFailure =>
  error instanceof WebSearchError ? error.failure : 'failed';

type Phase =
  | { kind: 'idle' }
  | { kind: 'consent' }
  | { kind: 'loading' }
  | { kind: 'error'; failure: WebSearchFailure }
  | { kind: 'done'; results: readonly WebResult[] };

interface WiderWebSearchProps {
  query: string;
  contextKey?: string;
  isOnline: boolean;
  preference: WebSearchPreference;
  /** Search history on: only then are `device` results kept, because they are keyed by the query. */
  historyOn: boolean;
  /** Stores "On" after the reader agrees in the consent card. */
  onAllow: () => Promise<void>;
  /** This device signed in before (`readAccountHint`): only then does "On" search by itself. */
  signedIn: boolean;
  /** A question leans to stories and myths ("Stories & myths"). */
  stories: boolean;
  /** The reader's "on" search tags, sent as a hint ("about anime"); never the search text. */
  about?: readonly string[];
  /**
   * False once this search finished on this page, or while the online lookup may still answer it:
   * the block moves when results arrive, and a remount must not pay for the same search twice.
   */
  mayAutoSearch: boolean;
  /** This search finished (answered or failed), not cancelled. */
  onSearched: () => void;
  /**
   * The results on screen (searched or kept), so the page can offer to make a card from them; an
   * empty list whenever none are (before a search, while one runs, after one fails).
   */
  onResults?: (results: readonly WebResult[]) => void;
}

/**
 * "Search the wider web" for a local miss: one tap, consent first. Once the reader said "On" and is
 * signed in on this device, it runs by itself instead (D50). The server decides who may search (D64). `device` results are kept on
 * this device for 30 days while search history is on (D45), shown again with "Saved <date>" and
 * Refresh; `none` results live only in this component's state. Neither ever reaches the library,
 * history's reference IDs or favourites, and nothing kept here is ever sent anywhere.
 */
export function WiderWebSearch(props: WiderWebSearchProps) {
  const { query, isOnline, preference, onAllow, signedIn, stories, onSearched } = props;
  const historyOn = props.historyOn;
  const { webSearch } = useRetrievalService();
  const { webResults } = useRepositories();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [saved, setSaved] = useState<SavedWebResults | undefined>(undefined);
  const [saveFailed, setSaveFailed] = useState(false);
  // With history off nothing is kept, so there is nothing to wait for before searching by itself.
  const [savedChecked, setSavedChecked] = useState(!historyOn);
  // Which search was asked for last: the wider web, or YouTube videos only ("Search videos").
  const [videos, setVideos] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const started = useRef(false);

  // Cancels a search still running when the query changes or the page closes. A cancelled search
  // never finished, so a remount (StrictMode's included) may start it again.
  useEffect(
    () => () => {
      controller.current?.abort();
      started.current = false;
    },
    [],
  );

  // Results kept from an earlier search for this query; with history off, none are shown or kept.
  useEffect(() => {
    if (!historyOn) return;
    let live = true;
    webResults
      .get(query, Date.now(), props.contextKey)
      .then((row) => live && setSaved(row))
      .catch(() => {})
      .finally(() => live && setSavedChecked(true));
    return () => {
      live = false;
    };
  }, [webResults, query, historyOn, props.contextKey]);

  const run = async (auto = false, wantVideos = videos) => {
    // Any search, tapped or not, means this mount never searches by itself again.
    started.current = true;
    setVideos(wantVideos);
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPhase({ kind: 'loading' });
    try {
      // Without tags the call is exactly what it was before tags existed.
      const results = await (wantVideos
        ? webSearch.search(query, current.signal, stories, props.about, true)
        : props.about
          ? webSearch.search(query, current.signal, stories, props.about)
          : webSearch.search(query, current.signal, stories));
      if (current.signal.aborted) return;
      onSearched();
      setPhase({ kind: 'done', results });
      // Best effort: a failed write only means a new search next time. Videos are never kept: kept
      // they have a different search mode from the saved wider-web results.
      if (historyOn && !wantVideos) {
        webResults
          .save(query, results.filter(isDeviceResult), Date.now(), props.contextKey)
          .catch(() => {});
      }
    } catch (error) {
      if (current.signal.aborted) return;
      onSearched();
      const failure = failureOf(error);
      // A search that ran by itself never shows a sign-in message: the button comes back instead.
      if (auto && isAccessFailure(failure)) setPhase({ kind: 'idle' });
      else setPhase({ kind: 'error', failure });
    }
  };

  // Runs by itself once per query, after any kept results were checked: kept ones are shown free.
  const autoSearch = useEffectEvent(() => void run(true, false));
  const autoReady =
    preference === 'on' && signedIn && isOnline && props.mayAutoSearch && savedChecked && !saved;
  useEffect(() => {
    if (autoReady && !started.current) autoSearch();
    // An effect event never goes in the list; this plugin version doesn't know useEffectEvent yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReady]);

  // What `onResults` reports: the list on screen, empty while nothing is (idle, loading, failed).
  const shownResults =
    preference === 'off' ? undefined : phase.kind === 'done' ? phase.results : saved?.results;
  const reportResults = useEffectEvent(() => props.onResults?.(shownResults ?? []));
  // An effect event never goes in the list (see above).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => reportResults(), [shownResults]);

  if (preference === 'off') return null;

  const allow = () => {
    setSaveFailed(false);
    // The tap is consent for this search even if storing the choice fails.
    onAllow().catch(() => setSaveFailed(true));
    void run();
  };

  if (phase.kind === 'consent') {
    return (
      <WebConsent
        title="Search the wider web?"
        action={videos ? 'Search videos' : 'Search the wider web'}
        onAllow={allow}
        onCancel={() => {
          setVideos(false);
          setPhase({ kind: 'idle' });
        }}
      />
    );
  }

  // Refresh and the first search both go through consent when it's still "Ask first".
  const start = (wantVideos = false) => {
    if (preference !== 'ask') {
      void run(false, wantVideos);
      return;
    }
    setVideos(wantVideos);
    setPhase({ kind: 'consent' });
  };
  const busy = !isOnline || phase.kind === 'loading';
  const showSaved = saved !== undefined && phase.kind !== 'done';
  const showingVideos = phase.kind === 'done' && videos;
  const searchVideos = (
    <button type="button" className={styles.secondary} disabled={busy} onClick={() => start(true)}>
      Search videos
    </button>
  );

  return (
    <div className={own.wrapper}>
      {showSaved && (
        <CommunitySuggests
          results={saved.results}
          kept
          savedAt={saved.savedAt}
          onRefresh={() => start()}
          refreshDisabled={busy}
        />
      )}
      {phase.kind !== 'done' && !showSaved && (
        <>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => start()}
            >
              Search the wider web
            </button>
            {searchVideos}
          </div>
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
        <p className={styles.note} role="status">
          {videos ? 'Searching for videos…' : 'Searching the wider web…'}
        </p>
      )}
      {phase.kind === 'error' && (
        <div className={styles.error} role="alert">
          <p>
            <AccessNotice failure={phase.failure} />
          </p>
          {phase.failure !== 'bad_query' &&
            phase.failure !== 'not_configured' &&
            !isAccessFailure(phase.failure) && (
              <button type="button" className={styles.secondary} onClick={() => void run()}>
                Try again
              </button>
            )}
        </div>
      )}
      {phase.kind === 'done' && (
        <CommunitySuggests
          results={phase.results}
          videos={videos}
          kept={!videos && historyOn && phase.results.every(isDeviceResult)}
        />
      )}
      {(showSaved || (phase.kind === 'done' && !videos)) && searchVideos}
      {showingVideos && (
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => start()}>
          Search the wider web
        </button>
      )}
    </div>
  );
}

interface WebConsentProps {
  title: string;
  action: string;
  onAllow: () => void;
  onCancel: () => void;
}

/** The consent card: the disclosure, then the action or "Not now". */
export function WebConsent({ title, action, onAllow, onCancel }: WebConsentProps) {
  const titleId = useId();
  return (
    <section className={styles.consent} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.consentTitle}>
        {title}
      </h2>
      <p>{WEB_SEARCH_DISCLOSURE}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onAllow}>
          {action}
        </button>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Not now
        </button>
      </div>
    </section>
  );
}

export const isAccessFailure = (failure: WebSearchFailure): boolean =>
  failure === 'signed_out' || failure === 'not_allowed';

/** "Sign in", coming back to this page afterwards. */
function SignInLink() {
  const { pathname, search } = useLocation();
  return (
    <Link to="/sign-in" state={{ from: pathname + search }}>
      Sign in
    </Link>
  );
}

/**
 * A failure in plain words (inline, for the caller's own paragraph); after "signed out", a "Sign in"
 * link. Only that link reads the page address, so the notice works anywhere.
 */
export function AccessNotice({
  failure,
  text = FAILURE_TEXT,
}: {
  failure: WebSearchFailure;
  text?: Record<WebSearchFailure, string>;
}) {
  return (
    <>
      {text[failure]}
      {failure === 'signed_out' && (
        <>
          {' '}
          <SignInLink />
        </>
      )}
    </>
  );
}

interface CommunitySuggestsProps {
  results: readonly WebResult[];
  /** True when these results are (or now will be) kept on this device. */
  kept: boolean;
  /** YouTube videos only ("Search videos"). */
  videos?: boolean;
  /** Set for results read back from this device. */
  savedAt?: number;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

function CommunitySuggests({
  results,
  kept,
  videos = false,
  savedAt,
  onRefresh,
  refreshDisabled,
}: CommunitySuggestsProps) {
  const savedOn = savedAt === undefined ? undefined : formatDate(new Date(savedAt).toISOString());
  // Only these results' links are looked up, not every saved link (D69).
  const savedLinks = useSavedLinks(results.map((result) => result.url));
  return (
    <section className={styles.community} aria-labelledby="web-results-title">
      <h2 id="web-results-title" className={styles.communityTitle}>
        {videos ? 'Videos found… (unverified)' : 'Community suggests… (unverified)'}
      </h2>
      {savedOn && <p className={styles.note}>Saved {savedOn}</p>}
      {results.length === 0 ? (
        <p className={styles.note}>
          {videos ? 'No videos found for this.' : 'The wider web had nothing for this either.'}
        </p>
      ) : (
        <>
          <p className={styles.note}>
            {videos ? 'YouTube links found by a web search.' : 'Links found by a web search.'}{' '}
            Nobody has checked them.{' '}
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
