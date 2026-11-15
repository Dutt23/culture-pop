import { useState } from 'react';
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
import { OnlineResults } from './OnlineResults';
import { SearchFilters } from './SearchFilters';
import styles from './SearchPage.module.css';
import { useRetrieval } from './useRetrieval';
import { useSearch } from './useSearch';
import { useSearchQuery } from './useSearchQuery';

const EXAMPLE_QUERIES = ['hakuna matata', 'let it go', 'this is fine', 'bazinga', 'all izz well'];

export function SearchPage() {
  const [query, setQuery] = useSearchQuery();
  const hasQuery = normalizePhrase(query).length > 0;
  const search = useSearch(query);
  const isOnline = useOnlineStatus();
  const { settings, settingsLoaded, setSetting, onlineSearchSkipped, skipOnlineSearch } =
    useSettings();
  const [consentError, setConsentError] = useState(false);

  // Spec §6: go online only on a local miss (no eligible top match) and with consent.
  const wantsOnline = hasQuery && !search.loading && search.needsRetrieval;
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
  const savedOnline = wantsOnline
    ? search.savedOnline.filter((m) => !freshIds.has(m.reference.id))
    : [];
  const options = filterOptions([
    ...search.matches.map((m) => m.reference),
    ...onlineCandidates,
    ...savedOnline.map((m) => m.reference),
  ]);
  const localShown = search.matches.filter((m) => matchesFilter(m.reference, filter));
  const onlineShown = onlineCandidates.filter((c) => matchesFilter(c, filter));
  const savedShown = savedOnline.filter((m) => matchesFilter(m.reference, filter));
  const exactCount = search.matches.filter(isExactMatch).length;
  const showEmpty =
    localShown.length === 0 &&
    onlineShown.length === 0 &&
    savedShown.length === 0 &&
    onlineState.status !== 'loading' &&
    onlineState.status !== 'partial';

  return (
    <Page title="Search" eyebrow="Decode a reference">
      <SearchBar value={query} autoFocus={!hasQuery} onChange={setQuery} />

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
              <strong>&ldquo;{query.trim()}&rdquo; can mean {exactCount} different things.</strong>{' '}
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
              onAllow={() => {
                setConsentError(false);
                setSetting('retrieval', 'on').catch(() => setConsentError(true));
              }}
              onSkip={skipOnlineSearch}
              onRetry={online.retry}
            />
          )}

          {showEmpty && (
            <EmptyState title={`Nothing in your library for “${query.trim()}” yet`}>
              <p>Check the spelling, try fewer words, or look it up outside the app.</p>
            </EmptyState>
          )}

          <Section title={search.needsRetrieval ? 'Look it up elsewhere' : 'Not what you meant?'}>
            <ExternalSearchLinks query={query} isOnline={isOnline} />
          </Section>
        </>
      )}
    </Page>
  );
}
