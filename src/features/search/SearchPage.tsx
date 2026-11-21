import { animationScope, searchContextKey } from '../../../shared/text';
import { AnimatePresence, m } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';
import { useOnlineStatus } from '../../app/useOnlineStatus';
import { SearchPeek } from '../../components/mascot/SearchPeek';
import type { PeekOutcome } from '../../components/mascot/usePeek';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { SearchBar } from '../../components/search-bar/SearchBar';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExternalSearchLinks } from '../../components/ui/ExternalSearchLinks';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { Tour } from '../../components/tour/Tour';
import { useTour } from '../../components/tour/useTour';
import { filterOptions, matchesFilter, NO_FILTER, type ResultFilter } from '../../domain/discovery';
import { normalizePhrase } from '../../domain/normalize';
import { matchReason } from '../../domain/labels';
import { isExactMatch, looksLikeMessage } from '../../domain/ranking';
import {
  aboutHint,
  hasActiveTags,
  leanByTaste,
  liftTagged,
  matchesTags,
  orderChanged,
  tasteNote,
} from '../../domain/searchTags';
import {
  looksLikeQuestion,
  splitFolded,
  suggestCommunityLinks,
} from '../../services/retrieval/community';
import { useMotionPresets } from '../../motion/MotionPreferenceProvider';
import { isExactTitle } from '../../services/retrieval/rerank';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import type { WebResult } from '../../services/retrieval/webSearch';
import { CardNoteButton } from '../drafts/CardNoteButton';
import { CurateFlow } from '../drafts/CurateFlow';
import { useFavourites } from '../favourites/useFavourites';
import { useSettings } from '../settings/SettingsContext';
import { OnlineResults, SavedOnlineResults } from './OnlineResults';
import { SearchFilters } from './SearchFilters';
import { SearchTags } from './SearchTags';
import { SEARCH_TOUR } from './searchTour';
import styles from './SearchPage.module.css';
import { useHeldResults } from './useHeldResults';
import { useRetrieval } from './useRetrieval';
import { useSearch } from './useSearch';
import { useRecentSearches, useRecordSearch } from './useSearchHistory';
import { useSearchQuery } from './useSearchQuery';
import { useSearchTags, useTaste } from './useSearchTags';
import { WiderWebSearch } from './WiderWebSearch';
import { readAccountHint } from '../../services/auth/authClient';

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
        Show other places to look
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
  const [query, setQuery, settleQuery] = useSearchQuery();
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

  // Spec §6: go online on a local miss, with consent. Also when a saved online answer already
  // stands in and online search is on: those saved cards are an older lookup, and the rest of the
  // cards (a film, a later page) stay missing until Refresh. Latched per query so saving the new
  // results does not end the lookup and move the cards.
  const missesLocally = hasQuery && !search.loading && search.needsRetrieval;
  const [onlineQuery, setOnlineQuery] = useState<string | null>(null);
  // A pasted or shared message is someone's private text: even with online search on, it goes to
  // the reference sites only after a tap on "Search online" (the wider web already asks the same).
  const [releasedMessage, setReleasedMessage] = useState<string | null>(null);
  const messageHeld =
    settings.retrieval === 'on' && looksLikeMessage(query) && releasedMessage !== query;
  const savedNeedsLookup =
    hasQuery &&
    !search.loading &&
    settingsLoaded &&
    settings.retrieval === 'on' &&
    !messageHeld &&
    !search.needsRetrieval &&
    search.savedOnline.length > 0;
  if ((missesLocally || savedNeedsLookup) && onlineQuery !== query) setOnlineQuery(query);
  const wantsOnline = missesLocally || onlineQuery === query;
  const online = useRetrieval(query, wantsOnline && settings.retrieval === 'on' && !messageHeld);

  // Filters reset whenever the query changes (state adjusted during render, React's documented pattern).
  const [filter, setFilter] = useState<ResultFilter>(NO_FILTER);
  const [onlyTagged, setOnlyTagged] = useState(false);
  const [filterQuery, setFilterQuery] = useState(query);
  if (filterQuery !== query) {
    setFilterQuery(query);
    setFilter(NO_FILTER);
    setOnlyTagged(false);
  }
  // Tags lift matching results; only "Only these" hides the rest (docs/SEARCH_TAGS_PLAN.md).
  const tags = useSearchTags();
  const tour = useTour('search', true);
  const { reduced, reveal } = useMotionPresets();
  // Until stored settings load, `taste` reads its default, which may not be the reader's choice.
  const taste = useTaste(
    settingsLoaded && settings.taste === 'on',
    settingsLoaded && settings.history === 'on',
  );
  // With every tag off, "Only these" has nothing to keep and its chip is gone, so it lets go.
  const about = aboutHint(tags.state);
  const scope = animationScope(
    tags.state.types.map((tag) => (tag === 'cartoon' ? 'cartoons' : tag)),
  );
  const contextKey = searchContextKey(settings.stories === 'on', [
    ...tags.state.types,
    ...tags.state.custom.filter((tag) => tag.on).map((tag) => tag.text),
  ]);
  const onlyThese = onlyTagged && hasActiveTags(tags.state);
  const shows = (item: Parameters<typeof matchesFilter>[0], tagged: boolean) =>
    matchesFilter(item, filter) &&
    (!looksLikeQuestion(query) ||
      scope.length === 0 ||
      scope.some((tag) => item.category === (tag === 'cartoons' ? 'cartoon' : tag))) &&
    (!onlyThese || tagged);

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
  const libraryTagged = (m: (typeof search.matches)[number]) =>
    matchesTags(m.reference, tags.state, search.summaries.get(m.reference.id)?.teaser);
  const libraryShown = (matches: typeof search.matches) =>
    liftTagged(matches, libraryTagged, isExactMatch).filter((m) =>
      shows(m.reference, libraryTagged(m)),
    );
  const localShown = libraryShown(leanByTaste(search.matches, taste?.lean));
  // Said only when the lean moved something on screen.
  const tasteMoved = orderChanged(libraryShown(search.matches), localShown);
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
  const fresh = useHeldResults(onlineCandidates, query, isAnswer, onlineState.status === 'done');
  // Held results don't count: the chips mustn't appear above cards before the reader taps.
  const resultCount = search.matches.length + fresh.shown.length + savedOnline.length;
  const onlineTagged = (c: RetrievedCandidate) => matchesTags(c, tags.state, c.sources[0]?.excerpt);
  const onlineShown = liftTagged(fresh.shown, onlineTagged, isAnswer).filter((c) =>
    shows(c, onlineTagged(c)),
  );
  const heldShown = fresh.held.filter((c) => shows(c, onlineTagged(c)));
  const heldCount = heldShown.length;
  // A late likely answer gets named on the button.
  const heldLead = heldShown.find(isAnswer)?.title;
  const savedTagged = (m: (typeof savedOnline)[number]) =>
    matchesTags(m.reference, tags.state, m.teaser);
  const savedShown = liftTagged(
    savedOnline,
    savedTagged,
    (m) => m.reference.normalizedTitle === normalizePhrase(query),
  ).filter((m) => shows(m.reference, savedTagged(m)));
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
    ((isQuestion && splitFolded(query, onlineCandidates, stories).shown.length === 0) ||
      (isQuestion && scope.length > 0 && onlineShown.length === 0 && savedShown.length === 0));
  // Wider-web searches that finished here, by mode, tags and query: the block moves behind "Show other
  // places to look" when online results arrive, and that remount must not pay for the same search
  // again.
  const [webSearched, setWebSearched] = useState<ReadonlySet<string>>(() => new Set());
  const webKey = JSON.stringify([query, contextKey]);
  const lookupSettled = onlineState.status !== 'loading' && onlineState.status !== 'partial';
  // The wider-web results on screen for this search and lean, and the search a card is made for.
  const [webFound, setWebFound] = useState<{ key: string; results: readonly WebResult[] }>();
  const webShown = webFound?.key === webKey ? webFound.results : [];
  const [curating, setCurating] = useState<string | null>(null);
  // The entry slides in once per search, not again each time results come back.
  const [curateShown, setCurateShown] = useState<string | null>(null);
  const curateHintId = useId();
  const canCurate =
    settingsLoaded &&
    settings.webSearch !== 'off' &&
    (onlineShown.length > 0 || webShown.length > 0);
  // Query, mode and tags identify the result set; changing context starts it afresh.
  const widerWeb = (search.needsRetrieval || questionFoundNothing) && settingsLoaded && (
    <WiderWebSearch
      key={webKey}
      query={query}
      contextKey={contextKey}
      isOnline={isOnline}
      preference={settings.webSearch}
      historyOn={settings.history === 'on'}
      onAllow={() => setSetting('webSearch', 'on')}
      signedIn={readAccountHint() !== null}
      stories={stories}
      about={about.length ? about : undefined}
      // A pasted message is someone's private text: the wider web gets it only on a tap.
      mayAutoSearch={lookupSettled && !webSearched.has(webKey) && !looksLikeMessage(query)}
      onSearched={() => setWebSearched((done) => new Set(done).add(webKey))}
      onResults={(results) => setWebFound({ key: webKey, results })}
    />
  );
  // "Where people talk about it" is on the page: its sites aren't listed a second time below.
  const communityShown =
    wantsOnline &&
    onlineState.status === 'done' &&
    suggestCommunityLinks(query, onlineState.result.candidates);
  // While the "Search online?" card waits for an answer, "nothing found" would be premature.
  const asksConsent =
    wantsOnline &&
    isOnline &&
    (settings.retrieval === 'ask' || messageHeld) &&
    !onlineSearchSkipped;
  const showEmpty =
    !asksConsent &&
    localShown.length === 0 &&
    onlineShown.length === 0 &&
    savedShown.length === 0 &&
    onlineState.status !== 'loading' &&
    onlineState.status !== 'partial';
  // The mascot points only at an answer on screen; a waiting "Search online?" card isn't one.
  const peekOutcome: PeekOutcome =
    !hasQuery || search.loading
      ? 'pending'
      : localShown.length > 0 || hasOnlineResults
        ? 'found'
        : showEmpty || asksConsent
          ? 'none'
          : 'pending';

  return (
    <Page title="Search" eyebrow="Decode a reference" wide>
      <div className={styles.searchBar} data-tour="search-bar">
        <SearchPeek query={query} outcome={peekOutcome} enabled={!reduced && !tour.open}>
          <SearchBar
            value={query}
            autoFocus={!hasQuery}
            onChange={setQuery}
            onSubmit={(value) => {
              settleQuery();
              recordSearch(value);
            }}
          />
        </SearchPeek>
      </div>
      <div data-tour="search-tags">
        <SearchTags
          tags={tags}
          onlyThese={hasQuery ? { value: onlyTagged, onChange: setOnlyTagged } : undefined}
        />
      </div>

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

      {hasQuery && (
        // Kept in the page while searching: a live region that arrives with its text isn't read.
        <p className={styles.count} aria-live="polite">
          {!search.loading && (
            <>
              {search.matches.length === 1 ? '1 match' : `${search.matches.length} matches`} in your
              library
            </>
          )}
        </p>
      )}
      {hasQuery && !search.loading && (
        <>
          {taste && tasteMoved && (
            <p className={styles.count}>{tasteNote(taste.lean, taste.usesHistory)}</p>
          )}

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

          {/* The tag row above replaces the category chips; eras stay here. */}
          <SearchFilters
            categories={[]}
            eras={options.eras}
            resultCount={resultCount}
            value={filter}
            onChange={setFilter}
          />

          {/* Above the first results, so it's on screen as soon as they arrive. It stays while the
              flow is open: focus comes back to it. */}
          {canCurate && (
            <m.div
              key={query}
              className={styles.curate}
              variants={reveal}
              initial={curateShown === query ? false : 'hidden'}
              animate="visible"
              onAnimationComplete={() => setCurateShown(query)}
            >
              <CardNoteButton
                aria-describedby={curateHintId}
                onClick={(event) => {
                  // Safari doesn't focus a tapped button; the flow returns focus here on close.
                  event.currentTarget.focus();
                  setCurating(query);
                }}
              >
                Make a card from these
              </CardNoteButton>
              <p id={curateHintId} className={styles.curateHint}>
                Pick the results you trust and get one card.
              </p>
            </m.div>
          )}
          {/* An open flow stays while results come and go: closing it would drop the picks. */}
          <AnimatePresence>
            {curating === query && (
              <CurateFlow
                key={query}
                search={query}
                about={about.length ? about : undefined}
                candidates={onlineShown}
                webResults={webShown}
                onClose={() => setCurating(null)}
              />
            )}
          </AnimatePresence>

          {onlyThese &&
            resultCount > 0 &&
            localShown.length === 0 &&
            onlineShown.length === 0 &&
            savedShown.length === 0 &&
            webShown.length === 0 && (
              <p className={styles.count}>
                No results match these tags. Turn off Only these or change your tags.
              </p>
            )}
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
              preference={messageHeld ? 'ask' : settings.retrieval}
              isOnline={isOnline}
              skipped={onlineSearchSkipped}
              state={onlineState}
              candidates={onlineShown}
              saved={savedShown}
              newCount={heldCount}
              newLead={heldLead}
              onShowNew={fresh.showHeld}
              onAllow={() => {
                if (messageHeld) {
                  setReleasedMessage(query);
                  return;
                }
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

          {/* Under online results the heading asks and the toggle answers. */}
          <Section
            title={
              search.needsRetrieval && !hasOnlineResults
                ? 'Look it up elsewhere'
                : 'Not what you meant?'
            }
          >
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
      {tour.open && <Tour steps={SEARCH_TOUR} onClose={tour.close} />}
    </Page>
  );
}
