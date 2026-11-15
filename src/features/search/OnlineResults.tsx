import { Link } from 'react-router';
import { ReferenceCard } from '../../components/reference-card/ReferenceCard';
import { AnimatedItem } from '../../components/ui/AnimatedItem';
import { ExternalLinks } from '../../components/ui/ExternalLinks';
import { Section } from '../../components/ui/Section';
import type { RetrievalPreference } from '../../domain/settings';
import {
  communitySearchLinks,
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
} from '../../services/retrieval/types';
import styles from './OnlineResults.module.css';
import type { RetrievalState } from './useRetrieval';
import type { SavedOnlineMatch } from './useSearch';

const PROVIDER_NAME: Record<ProviderId, string> = {
  wikipedia: 'Wikipedia',
  wikidata: 'Wikidata',
  wiktionary: 'Wiktionary',
  wikiquote: 'Wikiquote',
  tvmaze: 'TVmaze',
};

/** How each card relates to the search, as its source states it (shown in the match-note slot). */
const ROLE_LABEL: Record<CandidateRole, string> = {
  work: 'Original work',
  quoted_in: 'Quoted in',
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

// en-GB: "A, B and C", matching the rest of the copy.
const NAME_LIST = new Intl.ListFormat('en-GB', { type: 'conjunction' });
const ALL_PROVIDERS = NAME_LIST.format(Object.values(PROVIDER_NAME));

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
  onAllow: () => void;
  onSkip: () => void;
  onRetry: () => void;
}

function failedProviders(outcomes: readonly ProviderOutcome[]): string[] {
  return outcomes
    .filter((o) => o.status === 'failed' && o.failure)
    .map((o) => `${PROVIDER_NAME[o.provider]} ${FAILURE_TEXT[o.failure as RetrievalFailure]}.`);
}

function pendingProviders(result: RetrievalResult): string[] {
  return result.outcomes.filter((o) => o.status === 'pending').map((o) => PROVIDER_NAME[o.provider]);
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
          To find references that aren't in your library, your search text is sent to Wikipedia,
          Wikidata, Wiktionary and Wikiquote (run by the Wikimedia Foundation). TVmaze is asked
          only about TV series they find. Nothing else is sent, and your searches aren't saved.
          What they find is kept on this device until you clear it in Settings.
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
        Still searching {NAME_LIST.format(pending)}…
      </p>
    ) : null;
  }
  if (state.status === 'error') {
    return (
      <div className={styles.error} role="alert">
        <p>
          Online search failed:{' '}
          {state.failure === 'offline' ? '' : 'the online sources '}
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

function CandidateList({ candidates }: { candidates: readonly RetrievedCandidate[] }) {
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
        Nothing found online explains &ldquo;{query.trim()}&rdquo; as a phrase. If it&rsquo;s slang
        or a meme, these sites often do.
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

/** Online lookup for a local cache miss: status, fresh (possibly partial) results, then cached ones. */
export function OnlineResults(props: OnlineResultsProps) {
  const { query, state, candidates, saved } = props;
  // Judged on everything found (unfiltered), once every provider has answered.
  const showCommunity =
    state.status === 'done' && suggestCommunityLinks(query, state.result.candidates);
  const result = state.status === 'partial' || state.status === 'done' ? state.result : undefined;
  const settled = state.status === 'done';
  const failures = result ? failedProviders(result.outcomes) : [];
  const allFailed =
    state.status === 'done' &&
    state.result.outcomes.every((o) => o.status === 'failed' || o.status === 'skipped');
  const showFresh = result !== undefined && (settled || candidates.length > 0 || failures.length > 0);

  return (
    <div className={styles.online}>
      {showCommunity && <CommunityLinks query={query} />}
      <OnlineStatus {...props} />

      {showFresh && (
        <Section
          title="Found online"
          description="Unverified matches from Wikimedia and TVmaze. Open one to see exactly what its sources say."
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
          {candidates.length > 0 ? (
            <CandidateList candidates={candidates} />
          ) : (
            // Unfiltered count: a type or era filter hiding every match isn't "no matches".
            state.status === 'done' &&
            !allFailed &&
            state.result.candidates.length === 0 && (
              <p className={styles.note}>No matches online either.</p>
            )
          )}
          {state.status === 'done' && !state.cached && (
            <p className={styles.note}>These results couldn't be saved for offline use.</p>
          )}
        </Section>
      )}

      {saved.length > 0 && (
        <Section
          title="Saved from earlier online searches"
          description="Found online before and kept on this device. Unverified, like anything found online."
        >
          <ul className={styles.list}>
            {saved.map(({ reference, teaser }, index) => (
              <AnimatedItem key={reference.id} index={index}>
                <ReferenceCard reference={reference} teaser={teaser} />
              </AnimatedItem>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
