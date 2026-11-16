import { Link } from 'react-router';
import {
  ReferenceCard,
  type ReferenceCardFavourite,
} from '../../components/reference-card/ReferenceCard';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { ExternalLinks } from '../../components/ui/ExternalLinks';
import { Section } from '../../components/ui/Section';
import { formatDate } from '../../domain/dates';
import type { RetrievalPreference } from '../../domain/settings';
import { PUBLISHER } from '../../domain/sources';
import { listOf } from '../../domain/text';
import {
  communitySearchLinks,
  isWeakHit,
  looksLikeQuestion,
  suggestCommunityLinks,
} from '../../services/retrieval/community';
import { candidateToReference } from '../../services/retrieval/toReference';
import type {
  CandidateRole,
  ProviderId,
  ProviderOutcome,
  RetrievalFailure,
  RetrievalResult,
  RetrievedCandidate,
  Rewrite,
} from '../../services/retrieval/types';
import styles from './OnlineResults.module.css';
import type { RetrievalState } from './useRetrieval';
import type { SavedOnlineMatch } from './useSearch';

const PROVIDER_NAME: Record<ProviderId, string> = PUBLISHER;

/** How each card relates to the search, as its source states it (shown in the match-note slot). */
const ROLE_LABEL: Record<CandidateRole, string> = {
  work: 'Work',
  quoted_in: 'On Wikiquote',
  definition: 'Dictionary',
  topic: 'Related',
};

const FAILURE_TEXT: Record<RetrievalFailure, string> = {
  offline: "you're offline",
  network: "couldn't be reached",
  timeout: 'took too long to answer',
  rate_limited: 'asked us to slow down; try again in a minute',
  blocked: 'refused the request',
  http_error: 'returned an error',
  bad_response: 'sent something we couldn’t read',
  aborted: 'was cancelled',
};

const ALL_PROVIDERS = listOf(Object.values(PROVIDER_NAME));

interface OnlineResultsProps {
  /** The search text, for the community search links. */
  query: string;
  preference: RetrievalPreference;
  isOnline: boolean;
  /** "Not now" was chosen this session. */
  skipped: boolean;
  state: RetrievalState;
  /** Fresh candidates, already filtered and with local duplicates removed. */
  candidates: readonly RetrievedCandidate[];
  /** Results cached by earlier online searches, filtered and not repeated in `candidates`. */
  saved: readonly SavedOnlineMatch[];
  /** Fresh candidates that arrived after the first ones were shown, held back until tapped. */
  newCount: number;
  /** The title of a held result named exactly like the search, so the button says the answer came. */
  newLead?: string;
  onShowNew: () => void;
  onAllow: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onOpen: (referenceId: string) => void;
  /** The heart for a card. Fresh results get one only once they are saved to the library. */
  favouriteOf: (referenceId: string) => ReferenceCardFavourite;
}

function savedOn(isoDate: string): string | undefined {
  const date = formatDate(isoDate);
  return date && `Saved ${date}`;
}

function failedProviders(outcomes: readonly ProviderOutcome[]): string[] {
  return outcomes
    .filter((o) => o.status === 'failed' && o.failure)
    .map((o) => `${PROVIDER_NAME[o.provider]} ${FAILURE_TEXT[o.failure as RetrievalFailure]}.`);
}

function pendingProviders(result: RetrievalResult): string[] {
  return result.outcomes
    .filter((o) => o.status === 'pending')
    .map((o) => PROVIDER_NAME[o.provider]);
}

/** Consent, offline, skipped/off and progress messages that sit above any results. */
function OnlineStatus(props: OnlineResultsProps) {
  const { preference, isOnline, skipped, state } = props;

  if (!isOnline) {
    return (
      <p className={styles.note} role="status">
        You're offline, so only what's saved on this device is shown. Online search will run when
        you're back.
      </p>
    );
  }

  if (preference === 'ask' && !skipped) {
    return (
      <section className={styles.consent} aria-labelledby="online-consent-title">
        <h2 id="online-consent-title" className={styles.consentTitle}>
          Search online?
        </h2>
        <p>
          To find references that aren't in your library, your search text is sent to public online
          reference sites. Nothing else is sent. What they find is kept on this device until you
          clear it in Settings.
        </p>
        <p>
          Your search history stays on this device too; you can turn it off or clear it in Settings.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={props.onAllow}>
            Search online
          </button>
          <button type="button" className={styles.secondary} onClick={props.onSkip}>
            Not now
          </button>
        </div>
      </section>
    );
  }

  if (preference === 'ask') {
    return (
      <p className={styles.note}>
        Online search skipped for now. You'll be asked again next time you open the app, or{' '}
        <Link to="/settings">choose in Settings</Link>.
      </p>
    );
  }

  if (preference === 'off') {
    return (
      <p className={styles.note}>
        Online search is off. <Link to="/settings">Turn it on in Settings</Link>.
      </p>
    );
  }

  if (state.status === 'loading') {
    return (
      <p className={styles.note} role="status" aria-busy="true">
        Searching {ALL_PROVIDERS}…
      </p>
    );
  }
  if (state.status === 'partial') {
    const pending = pendingProviders(state.result);
    return pending.length > 0 ? (
      <p className={styles.note} role="status" aria-busy="true">
        Still searching {listOf(pending)}…
      </p>
    ) : null;
  }
  if (state.status === 'error') {
    return (
      <div className={styles.error} role="alert">
        <p>
          Online search failed: {state.failure === 'offline' ? '' : 'the online sources '}
          {FAILURE_TEXT[state.failure]}.
        </p>
        <button type="button" className={styles.secondary} onClick={props.onRetry}>
          Try again
        </button>
      </div>
    );
  }
  return null;
}

interface CandidateListProps {
  candidates: readonly RetrievedCandidate[];
  onOpen: (referenceId: string) => void;
  /** Undefined until the candidates are saved: a favourite needs its reference in the library. */
  favouriteOf?: (referenceId: string) => ReferenceCardFavourite;
}

function CandidateList({ candidates, onOpen, favouriteOf }: CandidateListProps) {
  return (
    <ul className={styles.list}>
      {/* Keyed by stable candidate ID, so a card updates in place as later providers answer. */}
      {candidates.map((candidate, index) => (
        <AnimatedItem key={candidate.id} index={index}>
          <ReferenceCard
            reference={candidateToReference(candidate, candidate.sources[0]?.retrievedAt ?? '')}
            teaser={candidate.sources.find((s) => s.excerpt)?.excerpt}
            matchNote={ROLE_LABEL[candidate.role]}
            pending={candidate.classifying}
            onOpen={() => onOpen(candidate.id)}
            favourite={favouriteOf?.(candidate.id)}
          />
        </AnimatedItem>
      ))}
    </ul>
  );
}

/** Owner-approved fallback: sites where slang and memes get explained, offered before the results. */
function CommunityLinks({ query }: { query: string }) {
  return (
    <section className={styles.community} aria-labelledby="community-links-title">
      <h2 id="community-links-title" className={styles.communityTitle}>
        Where people talk about it
      </h2>
      <p>
        {looksLikeQuestion(query) ? (
          <>
            This sounds like a running joke or a question. Communities explain these better than
            encyclopedias.
          </>
        ) : (
          <>
            Nothing found online explains &ldquo;{query.trim()}&rdquo; as a phrase. If it&rsquo;s
            slang or a meme, these sites often do.
          </>
        )}
      </p>
      <ExternalLinks
        accessiblePrefix="Search "
        links={communitySearchLinks(query).map((link) => ({ label: link.site, href: link.href }))}
      />
      <p className={styles.note}>
        Opens outside the app. Your search text is sent to that site only when you tap.
      </p>
    </section>
  );
}

/** Says what a fallback search looked for, so nobody mistakes its results for the plain search's. */
function rewriteNote(rewrite: Rewrite): string {
  switch (rewrite.kind) {
    case 'suggestion':
      return `Also searched \u201c${rewrite.text}\u201d, Wikipedia's suggestion for your spelling.`;
    case 'shorter_phrase':
      return `Also searched \u201c${rewrite.text}\u201d, the start of your search.`;
  }
}

/** Online lookup for a local cache miss: status, fresh (possibly partial) results, then cached ones. */
export function OnlineResults(props: OnlineResultsProps) {
  const { query, state, candidates, saved } = props;
  // Judged on everything found (unfiltered), once every provider has answered.
  const showCommunity =
    state.status === 'done' && suggestCommunityLinks(query, state.result.candidates);
  const result = state.status === 'partial' || state.status === 'done' ? state.result : undefined;
  const settled = state.status === 'done';
  // Fresh candidates reach the library only when the lookup is done and the save worked.
  const favouriteOf = state.status === 'done' && state.cached ? props.favouriteOf : undefined;
  const failures = result ? failedProviders(result.outcomes) : [];
  const allFailed =
    state.status === 'done' &&
    state.result.outcomes.every((o) => o.status === 'failed' || o.status === 'skipped');
  const showFresh =
    result !== undefined && (settled || candidates.length > 0 || failures.length > 0);
  // For a question-style query, related pages that share no word with it are folded away.
  const weak = looksLikeQuestion(query) ? candidates.filter((c) => isWeakHit(query, c)) : [];
  const strong = candidates.filter((c) => !weak.includes(c));

  return (
    <div className={styles.online}>
      {showCommunity && <CommunityLinks query={query} />}
      <OnlineStatus {...props} />

      {showFresh && (
        <Section
          title="Found online"
          description="Unverified matches found online. Open one to see exactly what its sources say."
        >
          {failures.length > 0 && (
            <div className={styles.error} role={allFailed ? 'alert' : 'status'}>
              {failures.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {settled && (
                <button type="button" className={styles.secondary} onClick={props.onRetry}>
                  Try again
                </button>
              )}
            </div>
          )}
          {result?.searched && (
            <p className={styles.note}>
              Searched for &ldquo;{result.searched}&rdquo;, your question without its first words.
            </p>
          )}
          {result?.rewrite && <p className={styles.note}>{rewriteNote(result.rewrite)}</p>}
          {candidates.length > 0 ? (
            <>
              {strong.length > 0 && (
                <CandidateList
                  candidates={strong}
                  onOpen={props.onOpen}
                  favouriteOf={favouriteOf}
                />
              )}
              {weak.length > 0 && (
                // Related pages that share nothing with the question look like answers; folded away.
                <details className={styles.otherPages}>
                  <summary>Other pages found ({weak.length})</summary>
                  <CandidateList
                    candidates={weak}
                    onOpen={props.onOpen}
                    favouriteOf={favouriteOf}
                  />
                </details>
              )}
            </>
          ) : (
            // Unfiltered count: a type or era filter hiding every match isn't "no matches".
            state.status === 'done' &&
            !allFailed &&
            state.result.candidates.length === 0 && (
              <p className={styles.note}>No matches online either.</p>
            )
          )}
          <div aria-live="polite">
            {props.newCount > 0 && (
              <button type="button" className={styles.secondary} onClick={props.onShowNew}>
                {props.newCount === 1 ? '1 new result' : `${props.newCount} new results`}
                {props.newLead && <>, including &ldquo;{props.newLead}&rdquo;</>}, tap to show
              </button>
            )}
          </div>
          {state.status === 'done' && !state.cached && (
            <p className={styles.note}>These results couldn't be saved for offline use.</p>
          )}
        </Section>
      )}

      <SavedOnlineResults saved={saved} onOpen={props.onOpen} favouriteOf={props.favouriteOf} />
    </div>
  );
}

interface SavedOnlineResultsProps {
  saved: readonly SavedOnlineMatch[];
  onOpen: (referenceId: string) => void;
  favouriteOf: (referenceId: string) => ReferenceCardFavourite;
  /** Offered when the saved answer stands alone (no lookup running): reruns it and saves again. */
  onRefresh?: () => void;
}

/**
 * Results kept from earlier online searches. Shown on their own when a saved, source-explained answer
 * already resolves the query (no lookup runs), and below fresh results otherwise. Never refreshed on a
 * timer: only when the reader asks (D37).
 */
export function SavedOnlineResults({
  saved,
  onOpen,
  favouriteOf,
  onRefresh,
}: SavedOnlineResultsProps) {
  if (saved.length === 0) return null;
  return (
    <Section
      title="Saved from earlier online searches"
      description="Found online before and kept on this device. Open one to see exactly what its sources say."
    >
      <ul className={styles.list}>
        {saved.map(({ reference, teaser }, index) => (
          <AnimatedItem key={reference.id} index={index}>
            <ReferenceCard
              reference={reference}
              teaser={teaser}
              matchNote={savedOn(reference.updatedAt)}
              onOpen={() => onOpen(reference.id)}
              favourite={favouriteOf(reference.id)}
            />
          </AnimatedItem>
        ))}
      </ul>
      {onRefresh && (
        <button type="button" className={styles.secondary} onClick={onRefresh}>
          Refresh
        </button>
      )}
    </Section>
  );
}
