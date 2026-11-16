/**
 * Captures each query-rewriting fallback's results for the cases the plain search missed (D43).
 * Never part of `npm test`:
 *   npx vitest run --config vitest.eval.config.ts src/test/search-eval/fallbacks.eval.ts
 * For every case `isMiss` flags in the main snapshot, runs retrieval four times (no fallback, then each
 * fallback alone) over one cached `getJson`, so the plain search is fetched once and each
 * fallback's extra requests are counted exactly. Writes snapshot/fallbacks.json after every case.
 * A case whose plain search had a failing provider gets no fallback runs (they would be noise).
 */
import { expect, it } from 'vitest';
import { DEFAULT_REWRITE_OPTIONS, isMiss } from '../../services/retrieval/rewrite';
import { retrieveRaw } from '../../services/retrieval/retrieve';
import type { RewriteKind } from '../../services/retrieval/types';
import { cachedCounting, createEvalGetJson, sleep } from './evalHttp';
import {
  FALLBACK_SNAPSHOT_PATH,
  loadFallbackSnapshot,
  writeFallbackSnapshot,
  type FallbackCase,
} from './fallbackSnapshot';
import { capturedCases, loadSnapshot } from './rerankEval';

const PAUSE_BETWEEN_CASES_MS = 3000;
const KINDS: readonly RewriteKind[] = DEFAULT_REWRITE_OPTIONS.order;

/** `FALLBACK_REDO=1` re-captures only the cases a provider failed on (e.g. HTTP 429), slower. */
const REDO = process.env.FALLBACK_REDO === '1';
/** `FALLBACK_ONLY=Q2-v,B6` re-captures just those cases (e.g. after the fallback rules changed). */
const ONLY = process.env.FALLBACK_ONLY?.split(',').filter(Boolean);
const REDO_PAUSE_MS = 10_000;
const REDO_COOLDOWN_MS = 120_000;
const REDO_PASSES = 3;

it(
  'captures the fallbacks for the missed cases',
  async () => {
    const snapshot = loadSnapshot();
    const missed = capturedCases(snapshot).filter((c) =>
      isMiss(c.query, snapshot.cases[c.id]?.candidates ?? []),
    );
    const out: Record<string, FallbackCase> = REDO || ONLY ? loadFallbackSnapshot().cases : {};
    const http = cachedCounting(createEvalGetJson());
    const now = () => new Date().toISOString();

    async function capture(evalCase: (typeof missed)[number]): Promise<FallbackCase> {
      const plain = await retrieveRaw(evalCase.query, {
        getJson: http.getJson,
        now,
        rewrite: { order: [] },
      });
      // Everything the plain search asked for, including a request that failed and may be asked again.
      const plainUrls = new Set(http.sent());
      const failures = plain.outcomes
        .filter((o) => o.status === 'failed')
        .map((o) => `${o.provider}:${o.failure ?? 'unknown'}`);
      const entry: FallbackCase = {
        query: evalCase.query,
        primary: plain.candidates,
        failures,
        fallbacks: {},
      };
      if (failures.length > 0) return entry;
      for (const kind of KINDS) {
        const before = http.sent().length;
        const result = await retrieveRaw(evalCase.query, {
          getJson: http.getJson,
          now,
          rewrite: { order: [kind] },
        });
        // Requests this fallback added: sent since `before`, and not part of the plain search.
        const extraRequests = http
          .sent()
          .slice(before)
          .filter((url) => !plainUrls.has(url)).length;
        if (extraRequests > 0) {
          entry.fallbacks[kind] = {
            rewrite: result.rewrite,
            candidates: result.candidates,
            extraRequests,
          };
        }
      }
      return entry;
    }

    const passes = REDO && !ONLY ? REDO_PASSES : 1;
    for (let pass = 0; pass < passes; pass++) {
      const todo = missed.filter(
        (c) => !REDO || out[c.id] === undefined || out[c.id]?.failures.length,
      );
      if (todo.length === 0) break;
      if (REDO && !ONLY) await sleep(REDO_COOLDOWN_MS);
      for (const [index, evalCase] of todo.entries()) {
        if (index > 0) await sleep(REDO ? REDO_PAUSE_MS : PAUSE_BETWEEN_CASES_MS);
        out[evalCase.id] = await capture(evalCase);
        writeFallbackSnapshot(FALLBACK_SNAPSHOT_PATH, out);
      }
    }
    expect(Object.keys(out).length).toBe(missed.length);
  },
  3 * 60 * 60 * 1000,
);
