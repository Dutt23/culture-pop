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
import { isExactMatch, looksLikeMessage } from '../../domain/ranking';
import {
  looksLikeQuestion,
  splitFolded,
  suggestCommunityLinks,
} from '../../services/retrieval/community';
import { isExactTitle } from '../../services/retrieval/rerank';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import { useFavourites } from '../favourites/useFavourites';
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
  /** The community card already offers the meme and slang sites. */
  skipCommunity: boolean;
}

/** Shown under online and saved results: other places to look, only when asked for. */
function NotWhatIMeant({ query, isOnline, widerWeb, skipCommunity }: NotWhatIMeantProps) {
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
          <ExternalSearchLinks query={query} isOnline={isOnline} skipCommunity={skipCommunity} />
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
  const favourites = useFavourites();
  const favouriteOf = (referenceId: string) => ({
    isFavourite: favourites.ids.has(referenceId),
    onToggle: () => void favourites.toggle(referenceId),
  });

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
  // A page named exactly like the search, or like the topic of a request ("Gundam" for "give me
  // history of gundam"), is the likely answer.
  const rewrite =
    onlineState.status === 'partial' || onlineState.status === 'done'
      ? onlineState.result.rewrite
      : undefined;
  const topic = rewrite?.kind === 'topic' ? rewrite.text : undefined;
  const isAnswer = (c: RetrievedCandidate) =>
    isExactTitle(query, c) || (topic !== undefined && isExactTitle(topic, c));
  // Later online answers wait behind "N new results" instead of moving cards already on screen.
  const fresh = useHeldResults(onlineCandidates, query, isAnswer);
  const onlineShown = fresh.shown.filter((c) => matchesFilter(c, filter));
  const heldShown = fresh.held.filter((c) => matchesFilter(c, filter));
  const heldCount = heldShown.length;
  // A late likely answer gets named on the button.
  const heldLead = heldShown.find(isAnswer)?.title;
  const savedShown = savedOnline.filter((m) => matchesFilter(m.reference, filter));
  const stories = settings.stories === 'on';
  const isQuestion = looksLikeQuestion(query);
  // Folded pages (real-world pages for a question) don't count: nothing visible answers the search.
  const hasOnlineResults =
    splitFolded(query, onlineShown, stories).shown.length > 0 || savedShown.length > 0;
  const exactCount = search.matches.filter(isExactMatch).length;
  // A question that found only real-world pages online has no pop-culture answer either: the wider
  // web is offered even when the library settled the lookup (D45).
  const questionFoundNothing =
    onlineState.status === 'done' &&
    isQuestion &&
    splitFolded(query, onlineCandidates, stories).shown.length === 0;
  // Wider-web searches that finished here, by lean and query: the block moves into "Not what I meant"
  // when online results arrive, and that remount must not pay for the same search again.
  const [webSearched, setWebSearched] = useState<ReadonlySet<string>>(() => new Set());
  const webKey = `${stories}:${query}`;
  const lookupSettled = onlineState.status !== 'loading' && onlineState.status !== 'partial';
  // Keyed by query and lean: its results live only in its state, so either change starts it afresh.
  const widerWeb = (search.needsRetrieval || questionFoundNothing) && settingsLoaded && (
    <WiderWebSearch
      key={webKey}
      query={query}
      isOnline={isOnline}
      preference={settings.webSearch}
      historyOn={settings.history === 'on'}
      onAllow={() => setSetting('webSearch', 'on')}
      unlocked={settings.webAccess === 'unlocked'}
      // Best effort: a failed write only means the button shows instead of a search by itself.
      onAccess={(unlocked) =>
        void setSetting('webAccess', unlocked ? 'unlocked' : 'unknown').catch(() => {})
      }
      stories={stories}
      // A pasted message is someone's private text: the wider web gets it only on a tap.
      mayAutoSearch={lookupSettled && !webSearched.has(webKey) && !looksLikeMessage(query)}
      onSearched={() => setWebSearched((done) => new Set(done).add(webKey))}
    />
  );
  // "Where people talk about it" is on the page: its sites aren't listed a second time below.
  const communityShown =
    wantsOnline &&
    onlineState.status === 'done' &&
    suggestCommunityLinks(query, onlineState.result.candidates);
  // While the "Search online?" card waits for an answer, "nothing found" would be premature.
  const asksConsent =
    wantsOnline && isOnline && settings.retrieval === 'ask' && !onlineSearchSkipped;
  const showEmpty =
    !asksConsent &&
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

          {isQuestion && settingsLoaded && (
            <label className={styles.stories}>
              <input
                type="checkbox"
                checked={stories}
                onChange={(event) =>
                  setSetting('stories', event.target.checked ? 'on' : 'off').catch(() =>
                    setConsentError(true),
                  )
                }
              />
              <span>
                <strong>Stories &amp; myths</strong>
                <span className={styles.storiesHint}>
                  Answer from films, TV, anime, books, games and myths, not real-world history.
                </span>
              </span>
            </label>
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
                      favourite={favouriteOf(match.reference.id)}
                    />
                  </AnimatedItem>
                );
              })}
            </ul>
          )}

          {favourites.error && (
            <p className={styles.error} role="alert">
              {favourites.error}
            </p>
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
              newLead={heldLead}
              onShowNew={fresh.showHeld}
              onAllow={() => {
                setConsentError(false);
                setSetting('retrieval', 'on').catch(() => setConsentError(true));
              }}
              onSkip={skipOnlineSearch}
              onRetry={online.retry}
              onOpen={openResult}
              favouriteOf={favouriteOf}
              stories={stories}
            />
          )}

          {!wantsOnline && (
            <SavedOnlineResults
              saved={savedShown}
              onOpen={openResult}
              favouriteOf={favouriteOf}
              // Reruns the lookup through the same per-query latch; it saves again when done.
              onRefresh={() => setOnlineQuery(query)}
            />
          )}

          {showEmpty && (
            <EmptyState title={`Nothing in your library for “${query.trim()}” yet`}>
              <p>
                {isOnline
                  ? 'Check the spelling, try fewer words, or look it up outside the app.'
                  : 'Check the spelling or try fewer words. Discover and Favourites work offline.'}
              </p>
            </EmptyState>
          )}

          <Section title={search.needsRetrieval ? 'Look it up elsewhere' : 'Not what you meant?'}>
            {hasOnlineResults ? (
              <NotWhatIMeant
                key={query}
                query={query}
                isOnline={isOnline}
                widerWeb={widerWeb}
                skipCommunity={communityShown}
              />
            ) : (
              <>
                {widerWeb}
                <ExternalSearchLinks
                  query={query}
                  isOnline={isOnline}
                  skipCommunity={communityShown}
                />
              </>
            )}
          </Section>
        </>
      )}
    </Page>
  );
}
