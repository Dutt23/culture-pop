import { useState, type ReactNode } from 'react';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { SearchBar } from '../../components/search-bar/SearchBar';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExternalSearchLinks } from '../../components/ui/ExternalSearchLinks';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { filterOptions, matchesFilter, NO_FILTER, type ResultFilter } from '../../domain/discovery';
import { normalizePhrase } from '../../domain/normalize';
import { matchReason } from '../../domain/labels';
import { isExactMatch } from '../../domain/ranking';
import { useSettings } from '../settings/SettingsContext';
import { OnlineResults, SavedOnlineResults } from './OnlineResults';
import { SearchFilters } from './SearchFilters';
import styles from './SearchPage.module.css';
import { useHeldResults } from './useHeldResults';
import { useRetrieval } from './useRetrieval';
import { useSearch } from './useSearch';
import { useRecentSearches, useRecordSearch } from './useSearchHistory';
import { useSearchQuery } from './useSearchQuery';
import { WiderWebSearch } from './WiderWebSearch';

const EXAMPLE_QUERIES = ['hakuna matata', 'let it go', 'this is fine', 'bazinga', 'all izz well'];
const RECENT_CHIPS = 8;

interface NotWhatIMeantProps {
  query: string;
  isOnline: boolean;
  /** The "Search the wider web" button, offered only on a local miss (D45). */
  widerWeb: ReactNode;
}

/** Shown under online and saved results: other places to look, only when asked for. */
function NotWhatIMeant({ query, isOnline, widerWeb }: NotWhatIMeantProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Not what I meant
      </button>
      {open && (
        <>
          {widerWeb}
          <ExternalSearchLinks query={query} isOnline={isOnline} />
        </>
      )}
    </>
  );
}

export function SearchPage() {
  const [query, setQuery] = useSearchQuery();
  const hasQuery = normalizePhrase(query).length > 0;
  const search = useSearch(query);
  const isOnline = useOnlineStatus();
  const { settings, settingsLoaded, setSetting, onlineSearchSkipped, skipOnlineSearch } =
    useSettings();
  const [consentError, setConsentError] = useState(false);
  const recordSearch = useRecordSearch();
  const recent = useRecentSearches(RECENT_CHIPS);
  const openResult = (referenceId: string) => recordSearch(query, referenceId);

  // Spec §6: go online only on a local miss (no eligible top match) and with consent. Latched per
  // query: saving explains the results, which would otherwise end the lookup and move its cards.
  const missesLocally = hasQuery && !search.loading && search.needsRetrieval;
  const [onlineQuery, setOnlineQuery] = useState<string | null>(null);
  if (missesLocally && onlineQuery !== query) setOnlineQuery(query);
  const wantsOnline = missesLocally || onlineQuery === query;
  const online = useRetrieval(query, wantsOnline && settings.retrieval === 'on');

  // Filters reset whenever the query changes (state adjusted during render, React's documented pattern).
  const [filter, setFilter] = useState<ResultFilter>(NO_FILTER);
  const [filterQuery, setFilterQuery] = useState(query);
  if (filterQuery !== query) {
    setFilterQuery(query);
    setFilter(NO_FILTER);
  }

  const { state: onlineState } = online;
  const localIds = new Set(search.matches.map((m) => m.reference.id));
  const onlineCandidates =
    onlineState.status === 'partial' || onlineState.status === 'done'
      ? onlineState.result.candidates.filter((c) => !localIds.has(c.id))
      : [];
  // Cached online results belong to the online section only, never to the curated list.
  const freshIds = new Set(onlineCandidates.map((c) => c.id));
  // Saved online results show either way: below a running lookup, or alone when one of them
  // (already explained from sources) resolves the query without going online.
  const savedOnline = search.savedOnline.filter((m) => !freshIds.has(m.reference.id));
  const options = filterOptions([
    ...search.matches.map((m) => m.reference),
    ...onlineCandidates,
    ...savedOnline.map((m) => m.reference),
  ]);
  const localShown = search.matches.filter((m) => matchesFilter(m.reference, filter));
  // Later online answers wait behind "N new results" instead of moving cards already on screen.
  const fresh = useHeldResults(onlineCandidates, query);
  const onlineShown = fresh.shown.filter((c) => matchesFilter(c, filter));
  const heldCount = fresh.held.filter((c) => matchesFilter(c, filter)).length;
  const savedShown = savedOnline.filter((m) => matchesFilter(m.reference, filter));
  const hasOnlineResults = onlineShown.length > 0 || savedShown.length > 0;
  const exactCount = search.matches.filter(isExactMatch).length;
  // Keyed by query: its results live only in its state, so a new search starts it afresh.
  const widerWeb = search.needsRetrieval && settingsLoaded && (
    <WiderWebSearch
      key={query}
      query={query}
      isOnline={isOnline}
      preference={settings.webSearch}
      historyOn={settings.history === 'on'}
      onAllow={() => setSetting('webSearch', 'on')}
    />
  );
  const showEmpty =
    localShown.length === 0 &&
    onlineShown.length === 0 &&
    savedShown.length === 0 &&
    onlineState.status !== 'loading' &&
    onlineState.status !== 'partial';

  return (
    <Page title="Search" eyebrow="Decode a reference">
      <SearchBar value={query} autoFocus={!hasQuery} onChange={setQuery} onSubmit={recordSearch} />

      {!hasQuery && recent.length > 0 && (
        <Section title="Recent searches">
          <ul className={styles.examples}>
            {recent.map((entry) => (
              <li key={entry.id}>
                <Chip to={`/search?q=${encodeURIComponent(entry.label)}`}>{entry.label}</Chip>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!hasQuery && (
        <Section title="Try one of these">
          <ul className={styles.examples}>
            {EXAMPLE_QUERIES.map((example) => (
              <li key={example}>
                <Chip to={`/search?q=${encodeURIComponent(example)}`}>{example}</Chip>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {hasQuery && !search.loading && (
        <>
          <p className={styles.count} aria-live="polite">
            {search.matches.length === 1 ? '1 match' : `${search.matches.length} matches`} in your
            library
          </p>

          {search.isAmbiguous && (
            <p className={styles.disambiguation}>
              <strong>
                &ldquo;{query.trim()}&rdquo; can mean {exactCount} different things.
              </strong>{' '}
              Pick the one you meant — we won&rsquo;t guess for you.
            </p>
          )}

          <SearchFilters
            categories={options.categories}
            eras={options.eras}
            value={filter}
            onChange={setFilter}
          />

          {localShown.length > 0 && (
            <ul className={styles.results}>
              {localShown.map((match, index) => {
                const summary = search.summaries.get(match.reference.id);
                return (
                  <AnimatedItem key={match.reference.id} index={index}>
                    <ReferenceCard
                      reference={match.reference}
                      teaser={summary?.teaser}
                      meaningsCount={summary?.meaningsCount}
                      matchNote={matchReason(match)}
                      onOpen={() => openResult(match.reference.id)}
                    />
                  </AnimatedItem>
                );
              })}
            </ul>
          )}

          {consentError && (
            <p className={styles.error} role="alert">
              Couldn&rsquo;t save your choice. Please try again.
            </p>
          )}

          {/* Wait for stored settings so the consent prompt never flashes for someone who already chose. */}
          {wantsOnline && settingsLoaded && (
            <OnlineResults
              query={query}
              preference={settings.retrieval}
              isOnline={isOnline}
              skipped={onlineSearchSkipped}
              state={onlineState}
              candidates={onlineShown}
              saved={savedShown}
              newCount={heldCount}
              onShowNew={fresh.showHeld}
              onAllow={() => {
                setConsentError(false);
                setSetting('retrieval', 'on').catch(() => setConsentError(true));
              }}
              onSkip={skipOnlineSearch}
              onRetry={online.retry}
              onOpen={openResult}
            />
          )}

          {!wantsOnline && (
            <SavedOnlineResults
              saved={savedShown}
              onOpen={openResult}
              // Reruns the lookup through the same per-query latch; it saves again when done.
              onRefresh={() => setOnlineQuery(query)}
            />
          )}

          {showEmpty && (
            <EmptyState title={`Nothing in your library for “${query.trim()}” yet`}>
              <p>Check the spelling, try fewer words, or look it up outside the app.</p>
            </EmptyState>
          )}

          <Section title={search.needsRetrieval ? 'Look it up elsewhere' : 'Not what you meant?'}>
            {hasOnlineResults ? (
              <NotWhatIMeant key={query} query={query} isOnline={isOnline} widerWeb={widerWeb} />
            ) : (
              <>
                {widerWeb}
                <ExternalSearchLinks query={query} isOnline={isOnline} />
              </>
            )}
          </Section>
        </>
      )}
    </Page>
  );
}
