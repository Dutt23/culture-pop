import { useOnlineStatus } from '../../app/useOnlineStatus';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { SearchBar } from '../../components/search-bar/SearchBar';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExternalSearchLinks } from '../../components/ui/ExternalSearchLinks';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { normalizePhrase } from '../../domain/normalize';
import { isExactMatch, type RankedMatch } from '../../domain/ranking';
import styles from './SearchPage.module.css';
import { useSearch } from './useSearch';
import { useSearchQuery } from './useSearchQuery';

const EXAMPLE_QUERIES = ['hakuna matata', 'let it go', 'this is fine', 'bazinga', 'all izz well'];

function matchNote(match: RankedMatch): string | undefined {
  return match.matchedPhrase === match.reference.title
    ? undefined
    : `Matched “${match.matchedPhrase}”`;
}

export function SearchPage() {
  const [query, setQuery] = useSearchQuery();
  const hasQuery = normalizePhrase(query).length > 0;
  const search = useSearch(query);
  const isOnline = useOnlineStatus();
  const exactCount = search.matches.filter(isExactMatch).length;

  return (
    <Page title="Search" eyebrow="Decode a reference">
      <SearchBar
        value={query}
        autoFocus={!hasQuery}
        onChange={setQuery}
      />

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
            {search.matches.length === 1 ? '1 match' : `${search.matches.length} matches`}
          </p>

          {search.isAmbiguous && (
            <p className={styles.disambiguation}>
              <strong>&ldquo;{query.trim()}&rdquo; can mean {exactCount} different things.</strong>{' '}
              Pick the one you meant — we won&rsquo;t guess for you.
            </p>
          )}

          {search.matches.length > 0 ? (
            <ul className={styles.results}>
              {search.matches.map((match, index) => {
                const summary = search.summaries.get(match.reference.id);
                return (
                  <AnimatedItem key={match.reference.id} index={index}>
                    <ReferenceCard
                      reference={match.reference}
                      teaser={summary?.teaser}
                      meaningsCount={summary?.meaningsCount}
                      matchNote={matchNote(match)}
                    />
                  </AnimatedItem>
                );
              })}
            </ul>
          ) : (
            <EmptyState title={`Nothing in your library for “${query.trim()}” yet`}>
              <p>Check the spelling, try fewer words, or look it up outside the app.</p>
            </EmptyState>
          )}

          <Section
            title={search.needsRetrieval ? 'Look it up elsewhere' : 'Not what you meant?'}
          >
            <ExternalSearchLinks query={query} isOnline={isOnline} />
          </Section>
        </>
      )}
    </Page>
  );
}
