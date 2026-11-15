import { vi } from 'vitest';
import type { RetrievalService } from '../app/RetrievalContext';
import { retrieve, type OnRetrievalUpdate } from '../services/retrieval/retrieve';
import type { GetJson, ProviderId, RetrievalResult } from '../services/retrieval/types';
import breakPointTvmaze from '../services/retrieval/fixtures/tvmaze-break-point.json';
import swatKatsTvmaze from '../services/retrieval/fixtures/tvmaze-swat-kats.json';
import catchMeOutsideWikidata from '../services/retrieval/fixtures/wikidata-catch-me-outside.json';
import hakunaWikidata from '../services/retrieval/fixtures/wikidata-hakuna-matata.json';
import okBoomerWikidata from '../services/retrieval/fixtures/wikidata-ok-boomer.json';
import swatKatsWikidata from '../services/retrieval/fixtures/wikidata-swat-kats.json';
import matrixWikidata from '../services/retrieval/fixtures/wikidata-the-matrix.json';
import catchMeOutsideWikipedia from '../services/retrieval/fixtures/wikipedia-catch-me-outside.json';
import hakunaWikipedia from '../services/retrieval/fixtures/wikipedia-hakuna-matata.json';
import okBoomerWikipedia from '../services/retrieval/fixtures/wikipedia-ok-boomer.json';
import swatKatsWikipedia from '../services/retrieval/fixtures/wikipedia-swat-kats.json';
import matrixWikipedia from '../services/retrieval/fixtures/wikipedia-the-matrix.json';
import catchMeOutsideWikiquote from '../services/retrieval/fixtures/wikiquote-catch-me-outside.json';
import catchMeOutsideWiktionary from '../services/retrieval/fixtures/wiktionary-catch-me-outside.json';
import hakunaWiktionary from '../services/retrieval/fixtures/wiktionary-hakuna-matata.json';
import missingWiktionary from '../services/retrieval/fixtures/wiktionary-missing.json';
import okBoomerWiktionary from '../services/retrieval/fixtures/wiktionary-ok-boomer.json';
import pointBreakWikidata from '../services/retrieval/fixtures/wikidata-point-break.json';
import pointBreakWikipedia from '../services/retrieval/fixtures/wikipedia-point-break.json';
import pointBreakWikiquote from '../services/retrieval/fixtures/wikiquote-point-break.json';
import pointBreakWiktionary from '../services/retrieval/fixtures/wiktionary-point-break.json';

export const FIXED_NOW = '2026-11-15T12:00:00.000Z';

/** TVmaze is only asked about show titles Wikidata found, so its answers are keyed by that title. */
type FixtureSet = Partial<Record<Exclude<ProviderId, 'tvmaze'>, unknown>> & {
  tvmaze?: Record<string, unknown>;
};

/** Real "nothing found" answers, served where a query has no recording for that provider. */
const NOTHING_FOUND: Partial<Record<ProviderId, unknown>> = {
  wikiquote: { batchcomplete: true, query: { search: [] } },
  tvmaze: [],
};

/** Real responses recorded 2026-11-15 (see docs/SOURCE_INVENTORY.md). */
export const FIXTURES = {
  'the matrix': { wikipedia: matrixWikipedia, wikidata: matrixWikidata, wiktionary: missingWiktionary },
  'swat kats': {
    wikipedia: swatKatsWikipedia,
    wikidata: swatKatsWikidata,
    wiktionary: missingWiktionary,
    tvmaze: { 'SWAT Kats: The Radical Squadron': swatKatsTvmaze },
  },
  'hakuna matata': { wikipedia: hakunaWikipedia, wikidata: hakunaWikidata, wiktionary: hakunaWiktionary },
  'ok boomer': { wikipedia: okBoomerWikipedia, wikidata: okBoomerWikidata, wiktionary: okBoomerWiktionary },
  'point break': {
    wikipedia: pointBreakWikipedia,
    wikidata: pointBreakWikidata,
    wiktionary: pointBreakWiktionary,
    wikiquote: pointBreakWikiquote,
    tvmaze: { 'Break Point': breakPointTvmaze },
  },
  'catch me outside': {
    wikipedia: catchMeOutsideWikipedia,
    wikidata: catchMeOutsideWikidata,
    wiktionary: catchMeOutsideWiktionary,
    wikiquote: catchMeOutsideWikiquote,
  },
} satisfies Record<string, FixtureSet>;

export type FixtureQuery = keyof typeof FIXTURES;

function providerOf(url: string): ProviderId {
  const host = new URL(url).hostname;
  if (host === 'en.wikipedia.org') return 'wikipedia';
  if (host === 'query.wikidata.org') return 'wikidata';
  if (host === 'en.wiktionary.org') return 'wiktionary';
  if (host === 'en.wikiquote.org') return 'wikiquote';
  if (host === 'api.tvmaze.com') return 'tvmaze';
  throw new Error(`Unexpected host ${host}`);
}

/** Serves recorded fixtures by host; any provider in `failures` rejects with that error instead. */
export function fixtureGetJson(
  query: FixtureQuery,
  failures: Partial<Record<ProviderId, Error>> = {},
): GetJson {
  return async (url) => {
    const provider = providerOf(url);
    const failure = failures[provider];
    if (failure) throw failure;
    const recorded: FixtureSet = FIXTURES[query];
    const body =
      provider === 'tvmaze'
        ? recorded.tvmaze?.[new URL(url).searchParams.get('q') ?? '']
        : recorded[provider];
    if (body === undefined && NOTHING_FOUND[provider] !== undefined) return NOTHING_FOUND[provider];
    if (body === undefined) throw new Error(`No ${provider} fixture for "${query}"`);
    return body;
  };
}

/** Runs the real orchestrator over fixtures; no debounce so tests stay fast and deterministic. */
export function fixtureRetrievalService(
  query: FixtureQuery,
  failures: Partial<Record<ProviderId, Error>> = {},
) {
  const service = {
    retrieve: vi.fn((text: string, signal: AbortSignal, onUpdate?: OnRetrievalUpdate) =>
      retrieve(
        text,
        { getJson: fixtureGetJson(query, failures), now: () => FIXED_NOW },
        signal,
        onUpdate,
      ),
    ),
    debounceMs: 0,
  };
  return service satisfies RetrievalService;
}

/** Default for tests that must never go online. */
export function unusedRetrievalService() {
  const service = {
    retrieve: vi.fn<
      (query: string, signal: AbortSignal, onUpdate?: OnRetrievalUpdate) => Promise<RetrievalResult>
    >(() =>
      Promise.reject(new Error('Retrieval should not run in this test')),
    ),
    debounceMs: 0,
  };
  return service satisfies RetrievalService;
}

/**
 * A service the test drives by hand: `emit` streams a snapshot, `finish` resolves the lookup.
 * Lets tests assert exactly what a partial result looks like, with no timing involved.
 */
export function controllableRetrievalService() {
  let onUpdate: OnRetrievalUpdate | undefined;
  let resolve: ((result: RetrievalResult) => void) | undefined;
  const service = {
    retrieve: vi.fn((_query: string, _signal: AbortSignal, update?: OnRetrievalUpdate) => {
      onUpdate = update;
      return new Promise<RetrievalResult>((done) => {
        resolve = done;
      });
    }),
    debounceMs: 0,
  } satisfies RetrievalService;
  return {
    service,
    emit: (snapshot: RetrievalResult) => onUpdate?.(snapshot),
    finish: (result: RetrievalResult) => resolve?.(result),
  };
}
