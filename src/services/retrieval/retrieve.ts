import {
  catchError,
  concat,
  connect,
  defer,
  EMPTY,
  filter,
  forkJoin,
  map,
  merge,
  Observable,
  of,
  scan,
  switchMap,
  take,
} from 'rxjs';
import { normalizePhrase, stripDisambiguator } from '../../domain/normalize';
import { PUBLISHER, referenceId, sourceIdOf, tvmazeSourceId } from '../../domain/sources';
import type { PresentIn, Source } from '../../domain/types';
import { classify, EXCLUDED_CLASSES, SERIES_CLASSES } from './classify';
import { pickExternalLinks } from './externalLinks';
import { rerankCandidates } from './rerank';
import { DEFAULT_REWRITE_OPTIONS, planRewrite, type RewriteOptions } from './rewrite';
import {
  RetrievalError,
  type GetJson,
  type ProviderId,
  type ProviderOutcome,
  type RetrievalFailure,
  type RetrievalResult,
  type RetrievedCandidate,
  type Rewrite,
} from './types';
import { searchTvmaze, type TvmazeShow } from './tvmaze';
import {
  fetchWikidataFacts,
  TVMAZE_ID_PROPERTY,
  wikidataUrl,
  type WikidataFacts,
} from './wikidata';
import { searchWikipedia, searchWikipediaWithSuggestion, type WikipediaHit } from './wikipedia';
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
// "Created by A, B, C and D" stays readable; sorted first, so the same four every time.
const MAX_CREATORS = 4;
const MAX_PRESENT_IN = 3;
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
  /** Which fallbacks may run, and in what order; the benchmark overrides it to measure each one. */
  rewrite?: RewriteOptions;
}

/** Called with a fresh snapshot each time a provider answers, so the UI never waits for the slowest. */
export type OnRetrievalUpdate = (snapshot: RetrievalResult) => void;

function failureOf(error: unknown): RetrievalFailure {
  return error instanceof RetrievalError ? error.failure : 'bad_response';
}

function wikipediaSource(hit: WikipediaHit, retrievedAt: string): Source {
  return {
    id: sourceIdOf(referenceId.wikipedia(hit.pageId)),
    url: hit.url,
    title: hit.title,
    publisher: PUBLISHER.wikipedia,
    sourceType: 'encyclopedia',
    retrievedAt,
    license: TEXT_LICENSE,
    excerpt: hit.extract,
  };
}

function wikidataSource(qid: string, title: string, retrievedAt: string): Source {
  return {
    id: sourceIdOf(referenceId.wikidata(qid)),
    url: wikidataUrl(qid),
    title,
    publisher: PUBLISHER.wikidata,
    sourceType: 'structured_data',
    retrievedAt,
    license: DATA_LICENSE,
  };
}

/** At most three works, sorted by label so the same three show every time. */
function presentInOf(works: ReadonlyMap<string, string>): PresentIn[] {
  return [...works]
    .map(([qid, label]) => ({ qid, label }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.qid.localeCompare(b.qid))
    .slice(0, MAX_PRESENT_IN);
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
  const contributed =
    facts !== undefined &&
    (facts.classes.size > 0 ||
      facts.year !== undefined ||
      facts.creators.size > 0 ||
      facts.presentIn.size > 0 ||
      facts.firstAppearance !== undefined);
  const dataSource =
    hit.qid && contributed ? wikidataSource(hit.qid, hit.title, retrievedAt) : undefined;
  if (dataSource) sources.push(dataSource);

  const type = classify(classes);
  return {
    id: hit.qid ? referenceId.wikidata(hit.qid) : referenceId.wikipedia(hit.pageId),
    title: hit.title,
    ...type,
    // Only Wikidata's type makes a hit "the work itself"; anything else is a related page.
    role: type.kind === 'work' ? 'work' : 'topic',
    // A year is only kept when a source backs it (spec §4).
    ...(facts?.year !== undefined && dataSource
      ? { year: facts.year, yearSourceId: dataSource.id }
      : {}),
    ...(facts && dataSource && facts.creators.size > 0
      ? { creators: [...facts.creators].sort().slice(0, MAX_CREATORS) }
      : {}),
    ...(facts?.firstAppearance !== undefined && dataSource
      ? { firstAppearance: facts.firstAppearance }
      : {}),
    ...(facts && dataSource && facts.presentIn.size > 0
      ? { presentIn: presentInOf(facts.presentIn) }
      : {}),
    classifying: classifying && hit.qid !== undefined,
    sources,
    externalLinks: facts ? pickExternalLinks(facts.externalIds) : [],
  };
}

function fromWiktionary(entry: WiktionaryEntry, retrievedAt: string): RetrievedCandidate {
  return {
    id: referenceId.wiktionary(entry.title),
    title: entry.title,
    kind: 'phrase',
    category: 'saying',
    classifying: false,
    role: 'definition',
    externalLinks: [],
    sources: [
      {
        id: sourceIdOf(referenceId.wiktionary(entry.title)),
        url: entry.url,
        title: entry.title,
        publisher: PUBLISHER.wiktionary,
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
    id: referenceId.wikiquote(hit.pageId),
    title: `${hit.title} on Wikiquote`,
    kind: 'quote',
    category: 'catchphrase',
    classifying: false,
    role: 'quoted_in',
    externalLinks: [],
    sources: [
      {
        id: sourceIdOf(referenceId.wikiquote(hit.pageId)),
        url: hit.url,
        title: hit.title,
        publisher: PUBLISHER.wikiquote,
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
    id: tvmazeSourceId(show.id),
    url: show.url,
    title: show.name,
    publisher: PUBLISHER.tvmaze,
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

interface Gathered {
  hits: readonly WikipediaHit[];
  /** Wikipedia's "did you mean" for the plain search, if it gave one. */
  suggestion?: string;
  facts?: ReadonlyMap<string, WikidataFacts>;
  /** The fallback chosen after a miss, and what it found (see `rewrite.ts`). */
  rewrite?: Rewrite;
  extraHits: readonly WikipediaHit[];
  extraFacts?: ReadonlyMap<string, WikidataFacts>;
  /** True once Wikidata has answered (or failed) for the fallback's hits. */
  extraClassified: boolean;
  entry?: WiktionaryEntry;
  quotes: readonly WikiquoteHit[];
  /** TVmaze shows by the `wd:` candidate they enrich. */
  enrichments: ReadonlyMap<string, TvmazeShow>;
  outcomes: ReadonlyMap<ProviderId, ProviderOutcome>;
}

/** One provider's answer: what it found plus its outcome. Folded into `Gathered` by `scan`. */
interface Patch {
  data: Partial<Omit<Gathered, 'outcomes'>>;
  /** Absent for a fallback's results, which belong to no provider's outcome. */
  outcome?: ProviderOutcome;
}

const NOTHING_GATHERED: Gathered = {
  hits: [],
  extraHits: [],
  extraClassified: false,
  quotes: [],
  enrichments: new Map(),
  outcomes: new Map(),
};

function fold(state: Gathered, patch: Patch): Gathered {
  const outcomes = patch.outcome
    ? new Map(state.outcomes).set(patch.outcome.provider, patch.outcome)
    : state.outcomes;
  return { ...state, ...patch.data, outcomes };
}

/** The candidates and outcomes everything gathered so far supports. */
function toResult(state: Gathered, retrievedAt: string): RetrievalResult {
  const classifying = !state.outcomes.has('wikidata');
  const byId = new Map<string, RetrievedCandidate>();
  for (const hit of state.hits) {
    const itemFacts = hit.qid && state.facts ? state.facts.get(hit.qid) : undefined;
    const candidate = fromWikipedia(hit, itemFacts, classifying, retrievedAt);
    if (!candidate || byId.has(candidate.id)) continue;
    const show = state.enrichments.get(candidate.id);
    byId.set(candidate.id, show ? withTvmaze(candidate, show, retrievedAt) : candidate);
  }
  // A fallback's cards come after the plain search's, marked with the search that found them.
  const via = state.rewrite?.kind;
  for (const hit of state.extraHits) {
    const itemFacts = hit.qid ? state.extraFacts?.get(hit.qid) : undefined;
    const candidate = fromWikipedia(hit, itemFacts, !state.extraClassified, retrievedAt);
    if (candidate && via && !byId.has(candidate.id)) byId.set(candidate.id, { ...candidate, via });
  }
  for (const quote of state.quotes) {
    const candidate = fromWikiquote(quote, retrievedAt);
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }
  if (state.entry) {
    const candidate = fromWiktionary(state.entry, retrievedAt);
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }
  const candidates = [...byId.values()];
  return {
    candidates,
    outcomes: PROVIDERS.map(
      (provider) => state.outcomes.get(provider) ?? { provider, status: 'pending' },
    ),
    // Only worth a note on screen once the fallback actually added something.
    ...(state.rewrite && candidates.some((c) => c.via) ? { rewrite: state.rewrite } : {}),
  };
}

/** Runs one promise adapter per subscription; unsubscribing aborts its request. */
function fromAdapter<T>(run: (signal: AbortSignal) => Promise<T>): Observable<T> {
  return new Observable<T>((subscriber) => {
    const controller = new AbortController();
    run(controller.signal).then(
      (value) => {
        subscriber.next(value);
        subscriber.complete();
      },
      (error: unknown) => subscriber.error(error),
    );
    return () => controller.abort();
  });
}

/** A provider's answer as a patch; its failure becomes a failed outcome, never a stream error. */
function answer<T>(
  provider: ProviderId,
  source$: Observable<T>,
  toData: (value: T) => { data: Patch['data']; empty: boolean },
): Observable<Patch> {
  return source$.pipe(
    map((value): Patch => {
      const { data, empty } = toData(value);
      return { data, outcome: { provider, status: empty ? 'empty' : 'ok' } };
    }),
    catchError((error: unknown) =>
      of<Patch>({ data: {}, outcome: { provider, status: 'failed', failure: failureOf(error) } }),
    ),
  );
}

function skipped(provider: ProviderId): Patch {
  return { data: {}, outcome: { provider, status: 'skipped' } };
}

/**
 * Spec §6 steps 3–5 as one stream: a snapshot each time a provider answers, completing after the
 * last. Wikipedia, Wiktionary and Wikiquote start together; Wikidata follows Wikipedia
 * (`switchMap` on its IDs; one request per host at a time, per Wikimedia etiquette). Once Wikidata
 * has typed the hits, TVmaze looks up the canonical titles of at most two series and enriches those
 * cards in place. Every provider fails independently and nothing is guessed. Candidates are
 * de-duplicated by Wikidata ID or canonical page, never by phrase, and keep stable IDs across
 * snapshots so a card updates in place. Unsubscribing aborts every request still running; retries,
 * timeouts, the host allowlist and the size cap live in `http.ts`.
 */
export function retrieveRaw$(
  typedQuery: string,
  deps: RetrieveDependencies,
): Observable<RetrievalResult> {
  // A question is searched by its subject; the screen says so (`searched`).
  const query = questionSubject(typedQuery) ?? typedQuery;
  const searched = query === typedQuery ? {} : { searched: query };
  return defer(() => {
    const retrievedAt = deps.now();
    const { getJson } = deps;

    /** TVmaze follow-up: canonical titles of hits Wikidata calls a series, never the raw query. */
    const tvmaze$ = (
      hits: readonly WikipediaHit[],
      facts: ReadonlyMap<string, WikidataFacts>,
    ): Observable<Patch> => {
      const typed = fold(NOTHING_GATHERED, {
        data: { hits, facts },
        outcome: { provider: 'wikidata', status: 'ok' },
      });
      const targets = toResult(typed, retrievedAt)
        .candidates.filter((c) => {
          const classes = facts.get(c.id.slice('wd:'.length))?.classes ?? new Set();
          return c.id.startsWith('wd:') && [...classes].some((q) => SERIES_CLASSES.has(q));
        })
        .slice(0, MAX_TVMAZE_LOOKUPS);
      if (targets.length === 0) return of(skipped('tvmaze'));
      const lookups = targets.map((candidate) => {
        const name = stripDisambiguator(candidate.title);
        const tvmazeIds =
          facts.get(candidate.id.slice('wd:'.length))?.externalIds.get(TVMAZE_ID_PROPERTY) ??
          new Set<string>();
        return fromAdapter((signal) => searchTvmaze(name, getJson, signal)).pipe(
          map((shows) => ({
            id: candidate.id,
            show: matchingShow(shows, name, tvmazeIds, candidate.year),
          })),
          // One failed lookup doesn't fail the provider; only all of them failing does.
          catchError((error: unknown) => of({ id: candidate.id, error })),
        );
      });
      return forkJoin(lookups).pipe(
        map((results): Patch => {
          const answered = results.flatMap((r) => ('show' in r ? [r] : []));
          const [first] = results;
          if (answered.length === 0 && 'error' in first) {
            const failure = failureOf(first.error);
            return { data: {}, outcome: { provider: 'tvmaze', status: 'failed', failure } };
          }
          const enrichments = new Map<string, TvmazeShow>();
          for (const { id, show } of answered) if (show) enrichments.set(id, show);
          return {
            data: { enrichments },
            outcome: { provider: 'tvmaze', status: enrichments.size > 0 ? 'ok' : 'empty' },
          };
        }),
      );
    };

    const wikipediaHits$ = fromAdapter((signal) =>
      searchWikipediaWithSuggestion(query, getJson, signal),
    ).pipe(
      map(({ hits, suggestion }) => ({ hits, suggestion })),
      catchError((error: unknown) => of({ error })),
    );
    const wikimediaChain$ = wikipediaHits$.pipe(
      switchMap((found) => {
        if ('error' in found) {
          const failed: Patch = {
            data: {},
            outcome: { provider: 'wikipedia', status: 'failed', failure: failureOf(found.error) },
          };
          return of(failed, skipped('wikidata'), skipped('tvmaze'));
        }
        const { hits, suggestion } = found;
        const found$ = of<Patch>({
          data: { hits, suggestion },
          outcome: { provider: 'wikipedia', status: hits.length > 0 ? 'ok' : 'empty' },
        });
        const qids = hits.filter((h) => !h.isDisambiguation && h.qid).map((h) => h.qid as string);
        if (qids.length === 0) return concat(found$, of(skipped('wikidata'), skipped('tvmaze')));
        const wikidata$ = answer(
          'wikidata',
          fromAdapter((signal) => fetchWikidataFacts(qids, getJson, signal)),
          (facts) => ({ data: { facts }, empty: facts.size === 0 }),
        ).pipe(
          switchMap((patch) =>
            concat(
              of(patch),
              patch.outcome?.status === 'ok' && patch.data.facts
                ? tvmaze$(hits, patch.data.facts)
                : of(skipped('tvmaze')),
            ),
          ),
        );
        return concat(found$, wikidata$);
      }),
    );
    const wiktionary$ = answer(
      'wiktionary',
      fromAdapter((signal) => lookUpWiktionary(query, getJson, signal)),
      (entry) => ({ data: { entry }, empty: entry === undefined }),
    );
    const wikiquote$ = answer(
      'wikiquote',
      fromAdapter((signal) => searchWikiquote(query, getJson, signal)),
      (quotes) => ({ data: { quotes }, empty: quotes.length === 0 }),
    );

    /**
     * The fallback for a miss, if any. It starts once Wikipedia, Wiktionary and Wikiquote have all
     * answered (a failed provider means no fallback: never pile requests on an outage), plans at
     * most one fallback (`planRewrite`), and streams its results like another provider's.
     */
    const rewritePatches$ = (state: Gathered): Observable<Patch> => {
      const plan = planRewrite(
        {
          query,
          candidates: toResult(state, retrievedAt).candidates,
          suggestion: state.suggestion,
        },
        deps.rewrite ?? DEFAULT_REWRITE_OPTIONS,
      );
      if (!plan) return EMPTY;
      return fromAdapter((signal) => searchWikipedia(plan.text, getJson, signal)).pipe(
        switchMap((extraHits) => {
          const found: Patch = { data: { rewrite: plan, extraHits } };
          const known = new Set(state.hits.map((h) => h.qid));
          const qids = extraHits
            .filter((h) => !h.isDisambiguation && h.qid && !known.has(h.qid))
            .map((h) => h.qid as string);
          if (qids.length === 0) return of(found, { data: { extraClassified: true } });
          return concat(
            of(found),
            fromAdapter((signal) => fetchWikidataFacts(qids, getJson, signal)).pipe(
              map((extraFacts): Patch => ({ data: { extraFacts, extraClassified: true } })),
              // Without types the cards still show; they simply stay unclassified.
              catchError(() => of<Patch>({ data: { extraClassified: true } })),
            ),
          );
        }),
        catchError(() => EMPTY),
      );
    };
    const answered = (state: Gathered) =>
      (['wikipedia', 'wiktionary', 'wikiquote'] as const).every((provider) => {
        const status = state.outcomes.get(provider)?.status;
        return status === 'ok' || status === 'empty';
      });

    // Wiktionary and Wikiquote subscribe first, so their requests start before Wikipedia's.
    return merge(wiktionary$, wikiquote$, wikimediaChain$).pipe(
      // `connect` subscribes both branches before the first patch, so neither misses one.
      connect((patches$) =>
        merge(
          patches$,
          patches$.pipe(
            scan(fold, NOTHING_GATHERED),
            filter(answered),
            take(1),
            switchMap(rewritePatches$),
          ),
        ),
      ),
      scan(fold, NOTHING_GATHERED),
      map((state) => ({ ...toResult(state, retrievedAt), ...searched })),
    );
  });
}

/**
 * `retrieveRaw$` with each snapshot's candidates ordered by `rerankCandidates` (what the search
 * page shows). The raw stream is exported separately so the benchmark can capture the order the
 * providers arrive in, before any reranking.
 */
export function retrieve$(query: string, deps: RetrieveDependencies): Observable<RetrievalResult> {
  return retrieveRaw$(query, deps).pipe(
    map((result) => ({
      ...result,
      candidates: rerankCandidates(result.searched ?? query, result.candidates),
    })),
  );
}

/**
 * Promise form of `retrieve$` for callers that want one answer: `onUpdate` gets every snapshot,
 * the promise the last. Aborting `signal` unsubscribes (cancelling every request) and rejects.
 */
export function retrieve(
  query: string,
  deps: RetrieveDependencies,
  signal?: AbortSignal,
  onUpdate?: OnRetrievalUpdate,
): Promise<RetrievalResult> {
  return settle(retrieve$(query, deps), signal, onUpdate);
}

/** `retrieve` without the reranking step: candidates in the order the providers delivered them. */
export function retrieveRaw(
  query: string,
  deps: RetrieveDependencies,
  signal?: AbortSignal,
  onUpdate?: OnRetrievalUpdate,
): Promise<RetrievalResult> {
  return settle(retrieveRaw$(query, deps), signal, onUpdate);
}

function settle(
  result$: Observable<RetrievalResult>,
  signal?: AbortSignal,
  onUpdate?: OnRetrievalUpdate,
): Promise<RetrievalResult> {
  return new Promise((resolve, reject) => {
    const aborted = () => new RetrievalError('aborted', 'Request cancelled');
    if (signal?.aborted) {
      reject(aborted());
      return;
    }
    let latest: RetrievalResult | undefined;
    const onAbort = () => {
      subscription.unsubscribe();
      reject(aborted());
    };
    const subscription = result$.subscribe({
      next: (snapshot) => {
        latest = snapshot;
        onUpdate?.(snapshot);
      },
      error: (error: unknown) => {
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      },
      complete: () => {
        signal?.removeEventListener('abort', onAbort);
        if (latest) resolve(latest);
        else reject(new RetrievalError('bad_response', 'No provider answered'));
      },
    });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
