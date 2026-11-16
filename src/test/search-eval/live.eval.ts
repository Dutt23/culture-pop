/**
 * Search benchmark. Never part of `npm test`; run with
 *   npx vitest run --config vitest.eval.config.ts
 * or, without network,
 *   EVAL_MODE=local npx vitest run --config vitest.eval.config.ts
 * Writes docs/eval/search-eval-<date>[-<EVAL_TAG>].md (…-local.md for local-only runs).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { fuzzyMatches } from '../../domain/miniSearchExtras';
import { rankByTiers, rankReferences } from '../../domain/ranking';
import type { Alias, Reference } from '../../domain/types';
import { rerankCandidates } from '../../services/retrieval/rerank';
import { retrieveRaw } from '../../services/retrieval/retrieve';
import {
  casesFor,
  renderReport,
  toRun,
  wikiquotePageIds,
  type CaseRun,
  type EvalMode,
} from './report';
import { createEvalGetJson, sleep } from './evalHttp';
import { resolveWikiquoteQids } from './wikiquoteItems';
import type { EvalCase } from './queries';
import { SNAPSHOT_PATH, writeSnapshot, type SnapshotCase } from './snapshot';

/** Wikimedia etiquette: one query at a time, with a pause; each query makes ~4–6 requests. */
const PAUSE_BETWEEN_CASES_MS = 3000;
/** Re-run passes for cases a provider failed on (e.g. HTTP 429): a pause, then slower pacing. */
const RETRY_PASSES = 2;
const RETRY_COOLDOWN_MS = 120_000;
const RETRY_PAUSE_MS = 10_000;
const LOCAL_ONLY = process.env.EVAL_MODE === 'local';
/** `EVAL_SNAPSHOT=1` also saves each case's raw `retrieve()` candidates (see `snapshot.ts`). */
const SNAPSHOT = process.env.EVAL_SNAPSHOT === '1';
/** `EVAL_TAG=name` is added to the report file name, so two runs on one day never overwrite each other. */
const TAG = process.env.EVAL_TAG;
const REPORT_DIR = fileURLToPath(new URL('../../../docs/eval/', import.meta.url));

/** `EVAL_LOCAL_ENGINE=typo|minisearch` scores a MiniSearch variant instead of the tier ranker. */
const LOCAL_RANKERS = {
  tiers: rankByTiers,
  /** Tiers plus MiniSearch typo matching, without the sound-alike pass. */
  typo: (query: string, references: readonly Reference[], aliases: readonly Alias[]) => {
    const tiers = rankByTiers(query, references, aliases);
    const found = new Set(tiers.map((m) => m.reference.id));
    return [...tiers, ...fuzzyMatches(query, references, aliases, found, { sound: false })];
  },
  /** What the app uses: tiers, typo matches, then sound-alike matches. */
  minisearch: rankReferences,
};
const LOCAL_ENGINE: keyof typeof LOCAL_RANKERS =
  process.env.EVAL_LOCAL_ENGINE === 'minisearch' || process.env.EVAL_LOCAL_ENGINE === 'typo'
    ? process.env.EVAL_LOCAL_ENGINE
    : 'tiers';

function runLocal(): CaseRun[] {
  const { references, aliases } = buildSeed();
  const rank = LOCAL_RANKERS[LOCAL_ENGINE];
  // The first call builds MiniSearch's index; time it apart so per-query latency is steady state.
  const buildStart = performance.now();
  rank('warm up', references, aliases);
  console.info(
    `local engine ${LOCAL_ENGINE}: first call ${(performance.now() - buildStart).toFixed(2)} ms`,
  );
  return casesFor('local').map((evalCase) => {
    const start = performance.now();
    const matches = rank(evalCase.query, references, aliases);
    const latencyMs = performance.now() - start;
    const results = matches.map((m) => ({ id: m.reference.id, title: m.reference.title }));
    return toRun(evalCase, 'local', results, latencyMs);
  });
}

/** Appends each finished case to `runs` and calls `onCase`, so an interrupted run keeps a report. */
async function runLive(runs: CaseRun[], onCase: () => void): Promise<void> {
  const http = createEvalGetJson();
  let requestCount = 0;
  const getJson: typeof http = (url, signal) => {
    requestCount += 1;
    return http(url, signal);
  };
  const deps = { getJson, now: () => new Date().toISOString() };
  const wikiquoteQids = new Map<string, string | null>();
  const snapshotCases: Record<string, SnapshotCase> = {};

  async function runCase(evalCase: EvalCase): Promise<CaseRun> {
    const start = performance.now();
    const requestsBefore = requestCount;
    try {
      // Raw providers' order for the snapshot; the score uses the reranked order, which is exactly
      // what `retrieve()` returns (`retrieve.test.ts` checks that the two agree).
      const result = await retrieveRaw(evalCase.query, deps);
      const requests = requestCount - requestsBefore;
      const shown = rerankCandidates(evalCase.query, result.candidates);
      const latencyMs = performance.now() - start;
      const failures = result.outcomes
        .filter((o) => o.status === 'failed')
        .map((o) => `${o.provider}:${o.failure ?? 'unknown'}`);
      const results = shown.map((c) => ({ id: c.id, title: c.title }));
      // After the timer stops: the lookup is scoring work, not part of the app's latency.
      failures.push(
        ...(await resolveWikiquoteQids(
          http,
          wikiquotePageIds(results.map((r) => r.id)),
          wikiquoteQids,
        )),
      );
      const qidByPage = new Map<string, string>();
      for (const [page, qid] of wikiquoteQids) if (qid) qidByPage.set(page, qid);
      snapshotCases[evalCase.id] = {
        query: evalCase.query,
        candidates: result.candidates,
        failures,
      };
      return { ...toRun(evalCase, 'live', results, latencyMs, failures, qidByPage), requests };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toRun(evalCase, 'live', [], performance.now() - start, [`retrieve:${message}`]);
    }
  }

  for (const [index, evalCase] of casesFor('live').entries()) {
    if (index > 0) await sleep(PAUSE_BETWEEN_CASES_MS);
    runs.push(await runCase(evalCase));
    onCase();
    if (SNAPSHOT) writeSnapshot(SNAPSHOT_PATH, snapshotCases, wikiquoteQids);
  }

  // Wikimedia throttles bursts (HTTP 429), which leaves a case with missing providers. Re-run only
  // those cases after a cooldown, slower, and replace their entry, so a baseline is not rate-limit noise.
  for (let pass = 0; pass < RETRY_PASSES; pass++) {
    const degraded = runs.flatMap((run, index) => (run.failures.length > 0 ? [index] : []));
    if (degraded.length === 0) return;
    await sleep(RETRY_COOLDOWN_MS);
    for (const index of degraded) {
      runs[index] = await runCase((runs[index] as CaseRun).evalCase);
      onCase();
      if (SNAPSHOT) writeSnapshot(SNAPSHOT_PATH, snapshotCases, wikiquoteQids);
      await sleep(RETRY_PAUSE_MS);
    }
  }
}

it('benchmarks search against the labelled set and writes a report', async () => {
  const startedAt = new Date().toISOString();
  const file = `${REPORT_DIR}search-eval-${startedAt.slice(0, 10)}${TAG ? `-${TAG}` : ''}${LOCAL_ONLY ? '-local' : ''}.md`;
  const sections: { mode: EvalMode; runs: CaseRun[] }[] = [{ mode: 'local', runs: runLocal() }];
  // Rewritten after every live case: a timeout or Ctrl-C leaves a partial report, not none.
  const writeReport = () => writeFileSync(file, renderReport(new Date().toISOString(), sections));
  mkdirSync(REPORT_DIR, { recursive: true });
  writeReport();

  if (!LOCAL_ONLY) {
    const live: CaseRun[] = [];
    sections.push({ mode: 'live', runs: live });
    await runLive(live, writeReport);
  }

  for (const { mode, runs } of sections) expect(runs).toHaveLength(casesFor(mode).length);
});
