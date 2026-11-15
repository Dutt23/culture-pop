import { normalizePhrase } from '../../domain/normalize';
import type { Source } from '../../domain/types';
import { classify, EXCLUDED_CLASSES, SERIES_CLASSES } from './classify';
import { pickExternalLinks } from './externalLinks';
import {
  RetrievalError,
  type GetJson,
  type ProviderId,
  type ProviderOutcome,
  type RetrievalFailure,
  type RetrievalResult,
  type RetrievedCandidate,
} from './types';
import { searchTvmaze, type TvmazeShow } from './tvmaze';
import {
  fetchWikidataFacts,
  TVMAZE_ID_PROPERTY,
  wikidataUrl,
  type WikidataFacts,
} from './wikidata';
import { searchWikipedia, type WikipediaHit } from './wikipedia';
import { searchWikiquote, type WikiquoteHit } from './wikiquote';
import { lookUpWiktionary, type WiktionaryEntry } from './wiktionary';

const TEXT_LICENSE = 'CC BY-SA 4.0';
const DATA_LICENSE = 'CC0 1.0';
/** Wikiquote's text is CC BY-SA, but the quoted lines themselves are often fair use. */
const WIKIQUOTE_LICENSE = 'CC BY-SA 4.0 (the quoted line may be fair use, not CC)';
/** TVmaze: "Use of the TVmaze API is licensed by CC BY-SA"; attribution is a link back. */
const TVMAZE_LICENSE = 'CC BY-SA';
/** TVmaze only matched canonical show titles in the demand research, so it enriches, never searches. */
const MAX_TVMAZE_LOOKUPS = 2;
/** Wikipedia titles carry a disambiguator TVmaze doesn't use: "Break Point (2021 TV series)". */
const DISAMBIGUATOR = /\s*\([^)]*\)$/;
const PROVIDERS: readonly ProviderId[] = [
  'wikipedia',
  'wikidata',
  'wiktionary',
  'wikiquote',
  'tvmaze',
];

export interface RetrieveDependencies {
  getJson: GetJson;
  now: () => string;
}

/** Called with a fresh snapshot each time a provider answers, so the UI never waits for the slowest. */
export type OnRetrievalUpdate = (snapshot: RetrievalResult) => void;

function failureOf(error: unknown): RetrievalFailure {
  return error instanceof RetrievalError ? error.failure : 'bad_response';
}

function wikipediaSource(hit: WikipediaHit, retrievedAt: string): Source {
  return {
    id: `src:enwiki:${hit.pageId}`,
    url: hit.url,
    title: hit.title,
    publisher: 'Wikipedia',
    sourceType: 'encyclopedia',
    retrievedAt,
    license: TEXT_LICENSE,
    excerpt: hit.extract,
  };
}

function wikidataSource(qid: string, title: string, retrievedAt: string): Source {
  return {
    id: `src:wd:${qid}`,
    url: wikidataUrl(qid),
    title,
    publisher: 'Wikidata',
    sourceType: 'structured_data',
    retrievedAt,
    license: DATA_LICENSE,
  };
}

/** `facts` is undefined while Wikidata is still answering; the card then shows "checking". */
function fromWikipedia(
  hit: WikipediaHit,
  facts: WikidataFacts | undefined,
  classifying: boolean,
  retrievedAt: string,
): RetrievedCandidate | undefined {
  if (hit.isDisambiguation) return undefined;
  const classes = facts?.classes ?? new Set<string>();
  if ([...classes].some((c) => EXCLUDED_CLASSES.has(c))) return undefined;

  const sources = [wikipediaSource(hit, retrievedAt)];
  // Cite Wikidata only when it actually contributed a type or a year.
  const contributed = facts !== undefined && (facts.classes.size > 0 || facts.year !== undefined);
  const dataSource = hit.qid && contributed ? wikidataSource(hit.qid, hit.title, retrievedAt) : undefined;
  if (dataSource) sources.push(dataSource);

  const type = classify(classes);
  return {
    id: hit.qid ? `wd:${hit.qid}` : `enwiki:${hit.pageId}`,
    title: hit.title,
    ...type,
    // Only Wikidata's type makes a hit "the work itself"; anything else is a related page.
    role: type.kind === 'work' ? 'work' : 'topic',
    // A year is only kept when a source backs it (spec §4).
    ...(facts?.year !== undefined && dataSource
      ? { year: facts.year, yearSourceId: dataSource.id }
      : {}),
    classifying: classifying && hit.qid !== undefined,
    sources,
    externalLinks: facts ? pickExternalLinks(facts.externalIds) : [],
  };
}

function fromWiktionary(entry: WiktionaryEntry, retrievedAt: string): RetrievedCandidate {
  return {
    id: `enwiktionary:${entry.title}`,
    title: entry.title,
    kind: 'phrase',
    category: 'saying',
    classifying: false,
    role: 'definition',
    externalLinks: [],
    sources: [
      {
        id: `src:enwiktionary:${entry.title}`,
        url: entry.url,
        title: entry.title,
        publisher: 'Wiktionary',
        sourceType: 'dictionary',
        retrievedAt,
        license: TEXT_LICENSE,
        excerpt: entry.definition,
      },
    ],
  };
}

function fromWikiquote(hit: WikiquoteHit, retrievedAt: string): RetrievedCandidate {
  return {
    id: `enwikiquote:${hit.pageId}`,
    title: `Quoted in ${hit.title}`,
    kind: 'quote',
    category: 'catchphrase',
    classifying: false,
    role: 'quoted_in',
    externalLinks: [],
    sources: [
      {
        id: `src:enwikiquote:${hit.pageId}`,
        url: hit.url,
        title: hit.title,
        publisher: 'Wikiquote',
        sourceType: 'other',
        retrievedAt,
        license: WIKIQUOTE_LICENSE,
        excerpt: hit.quote,
      },
    ],
  };
}

function tvmazeSource(show: TvmazeShow, retrievedAt: string): Source {
  const excerpt = [show.network, show.summary].filter(Boolean).join(' — ');
  return {
    id: `src:tvmaze:${show.id}`,
    url: show.url,
    title: show.name,
    publisher: 'TVmaze',
    sourceType: 'structured_data',
    retrievedAt,
    license: TVMAZE_LICENSE,
    excerpt: excerpt || undefined,
  };
}

/**
 * The TVmaze show a Wikidata item describes: the one its TVmaze ID (P8600) names, or else one with
 * exactly the same name whose premiere year matches Wikidata's. Anything less certain, such as a
 * same-named show from another country, is not merged.
 */
function matchingShow(
  shows: readonly TvmazeShow[],
  name: string,
  tvmazeIds: ReadonlySet<string>,
  year: number | undefined,
): TvmazeShow | undefined {
  if (tvmazeIds.size > 0) return shows.find((show) => tvmazeIds.has(String(show.id)));
  const key = normalizePhrase(name);
  return year === undefined
    ? undefined
    : shows.find((show) => normalizePhrase(show.name) === key && show.year === year);
}

/** Adds TVmaze's evidence to the show Wikidata identified; Wikidata's type and year win. */
function withTvmaze(
  candidate: RetrievedCandidate,
  show: TvmazeShow,
  retrievedAt: string,
): RetrievedCandidate {
  const source = tvmazeSource(show, retrievedAt);
  return {
    ...candidate,
    ...(candidate.year === undefined && show.year !== undefined
      ? { year: show.year, yearSourceId: source.id }
      : {}),
    sources: [...candidate.sources, source],
  };
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

/**
 * Spec §6 steps 3–5. Wikipedia, Wiktionary and Wikiquote start together; Wikidata follows
 * Wikipedia because it needs the IDs Wikipedia returns (one request per host at a time, per
 * Wikimedia etiquette). Once Wikidata has typed the hits, TVmaze looks up the canonical titles of
 * at most two shows or cartoons and enriches those cards in place. Every provider fails
 * independently and nothing is guessed. Candidates are de-duplicated by Wikidata ID or canonical
 * page, never by phrase, and keep stable IDs across snapshots so a card updates in place.
 */
export async function retrieve(
  query: string,
  deps: RetrieveDependencies,
  signal?: AbortSignal,
  onUpdate?: OnRetrievalUpdate,
): Promise<RetrievalResult> {
  const retrievedAt = deps.now();
  const outcomes = new Map<ProviderId, ProviderOutcome>();
  let hits: WikipediaHit[] = [];
  let facts: Map<string, WikidataFacts> | undefined;
  let entry: WiktionaryEntry | undefined;
  let quotes: WikiquoteHit[] = [];
  /** TVmaze shows by the `wd:` candidate they enrich. */
  const enrichments = new Map<string, TvmazeShow>();

  const snapshot = (): RetrievalResult => {
    const classifying = !outcomes.has('wikidata');
    const byId = new Map<string, RetrievedCandidate>();
    for (const hit of hits) {
      const itemFacts = hit.qid && facts ? facts.get(hit.qid) : undefined;
      const candidate = fromWikipedia(hit, itemFacts, classifying, retrievedAt);
      if (!candidate || byId.has(candidate.id)) continue;
      const show = enrichments.get(candidate.id);
      byId.set(candidate.id, show ? withTvmaze(candidate, show, retrievedAt) : candidate);
    }
    for (const quote of quotes) {
      const candidate = fromWikiquote(quote, retrievedAt);
      if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
    }
    if (entry) {
      const candidate = fromWiktionary(entry, retrievedAt);
      if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
    }
    return {
      candidates: [...byId.values()],
      outcomes: PROVIDERS.map((provider) => outcomes.get(provider) ?? { provider, status: 'pending' }),
    };
  };
  const settle = (provider: ProviderId, result: { empty: boolean } | { error: unknown }) => {
    outcomes.set(
      provider,
      'error' in result
        ? { provider, status: 'failed', failure: failureOf(result.error) }
        : { provider, status: result.empty ? 'empty' : 'ok' },
    );
    if (!signal?.aborted) onUpdate?.(snapshot());
  };
  const skip = (provider: ProviderId) => {
    outcomes.set(provider, { provider, status: 'skipped' });
    if (!signal?.aborted) onUpdate?.(snapshot());
  };

  /** Runs one provider: it stores its own answer and fails without affecting the others. */
  const track = <T>(provider: ProviderId, task: Promise<T>, store: (value: T) => boolean) =>
    task.then(
      (value) => settle(provider, { empty: !store(value) }),
      (error: unknown) => settle(provider, { error }),
    );

  const otherTasks = [
    track('wiktionary', lookUpWiktionary(query, deps.getJson, signal), (value) => {
      entry = value;
      return value !== undefined;
    }),
    track('wikiquote', searchWikiquote(query, deps.getJson, signal), (value) => {
      quotes = value;
      return value.length > 0;
    }),
  ];

  /** TVmaze follow-up: canonical titles of hits Wikidata calls a series, never the raw query. */
  const enrichShows = async (): Promise<void> => {
    if (signal?.aborted) return;
    const itemFacts = facts;
    const targets =
      outcomes.get('wikidata')?.status === 'ok' && itemFacts
        ? snapshot()
            .candidates.filter((c) => {
              const classes = itemFacts.get(c.id.slice('wd:'.length))?.classes ?? new Set();
              return c.id.startsWith('wd:') && [...classes].some((q) => SERIES_CLASSES.has(q));
            })
            .slice(0, MAX_TVMAZE_LOOKUPS)
        : [];
    if (targets.length === 0) return skip('tvmaze');
    const lookups = targets.map(async (candidate) => {
      const name = candidate.title.replace(DISAMBIGUATOR, '');
      const shows = await searchTvmaze(name, deps.getJson, signal);
      const tvmazeIds =
        itemFacts?.get(candidate.id.slice('wd:'.length))?.externalIds.get(TVMAZE_ID_PROPERTY) ??
        new Set<string>();
      return { id: candidate.id, show: matchingShow(shows, name, tvmazeIds, candidate.year) };
    });
    // One failed lookup doesn't fail the provider; only all of them failing does.
    const settled = Promise.allSettled(lookups).then((results) => {
      const answered = results.filter(isFulfilled).map((r) => r.value);
      if (answered.length === 0) throw (results[0] as PromiseRejectedResult).reason;
      return answered;
    });
    await track('tvmaze', settled, (matches) => {
      for (const { id, show } of matches) if (show) enrichments.set(id, show);
      return enrichments.size > 0;
    });
  };

  await track('wikipedia', searchWikipedia(query, deps.getJson, signal), (value) => {
    hits = value;
    return value.length > 0;
  });
  if (signal?.aborted) throw new RetrievalError('aborted', 'Request cancelled');

  const qids = hits.filter((h) => !h.isDisambiguation && h.qid).map((h) => h.qid as string);
  const wikidataTask = (
    qids.length === 0
      ? Promise.resolve(skip('wikidata'))
      : track('wikidata', fetchWikidataFacts(qids, deps.getJson, signal), (value) => {
          facts = value;
          return value.size > 0;
        })
  ).then(enrichShows);

  await Promise.all([wikidataTask, ...otherTasks]);
  if (signal?.aborted) throw new RetrievalError('aborted', 'Request cancelled');
  return snapshot();
}
