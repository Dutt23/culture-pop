import { firstValueFrom } from 'rxjs';
import { stripDisambiguator } from '../../domain/normalize';
import type { Reference, Source } from '../../domain/types';
import {
  errorMessage,
  type LlmClient,
  type RunResult,
  type Support,
} from '../../services/llm/client';
import {
  checkExplanation,
  keptSentences,
  checkRewrites,
  decideSpoiler,
  mergeResults,
  parseJson,
  type ExplanationCheck,
  type SpoilerDecision,
} from '../../services/llm/check';
import {
  buildEvidence,
  fetchStory,
  type EvidenceFormat,
  type EvidenceItem,
} from '../../services/llm/evidence';
import { explainJob, rewriteJob, spoilerJobs } from '../../services/llm/jobs';
import type { ModelFamily, ModelVariant } from '../../services/llm/models';
import { retrieve } from '../../services/retrieval/retrieve';
import { candidateToReference } from '../../services/retrieval/toReference';
import type { GetJson } from '../../services/retrieval/types';
import { SPOILER_CASES, STORY_TITLES } from '../../test/llm-eval/cases';
import { percentile, type CaseScore } from '../../test/search-eval/metrics';
import {
  casesFor,
  meaningIds,
  parseWikibaseItems,
  scoringIds,
  toRun,
  wikiquotePageIds,
  type RankedResult,
} from '../../test/search-eval/report';
import type { EvalCase } from '../../test/search-eval/queries';
import type { Snapshot } from '../../test/search-eval/snapshot';

/**
 * Development-only benchmark of the on-device model on the three Phase 3 jobs
 * (docs/research/ondevice-llm.md). Runs in the browser because WebGPU only exists there.
 * Explanations use the recorded eval snapshot (no network); stories, rewrites and their search
 * scoring go online, one request at a time with pauses, like the live search eval.
 */

export const FORMATS: readonly EvidenceFormat[] = ['json', 'toon'];
/** Same spacing as the live search eval, so Wikimedia doesn't throttle the run. */
const LIVE_PAUSE_MS = 3000;

export interface DeviceInfo {
  userAgent: string;
  deviceMemoryGB?: number;
  cores: number;
  support: Support;
}

export interface ModelInfo {
  family: string;
  modelId: string;
  downloadBytes: number;
  vramMB: number;
  fromCache: boolean;
  loadMs: number;
  /** `navigator.storage.estimate()` before and after the load: what the download really stored. */
  storageBeforeBytes?: number;
  storageAfterBytes?: number;
  /**
   * Peak JS heap while loading, main thread and worker (Chromium's `performance.memory`; the page
   * isn't cross-origin isolated, so `measureUserAgentSpecificMemory` is unavailable). The weights
   * sit in GPU memory, which no web API reports: see the research doc for `dumpsys meminfo`.
   */
  loadPeakMainBytes?: number;
  loadPeakWorkerBytes?: number;
}

export interface MemoryPeaks {
  mainPeakBytes?: number;
  workerPeakBytes?: number;
}

export interface Responsiveness {
  /** The Long Tasks API exists (Chromium). */
  longTaskSupported: boolean;
  longTasks: number;
  longestTaskMs: number;
  frames: number;
  frameGapP95Ms: number;
  frameGapMaxMs: number;
}

export interface FormatRun {
  format: EvidenceFormat;
  run?: RunResult;
  error?: string;
  check: ExplanationCheck;
}

export interface ExplainRow {
  caseId: string;
  kind: 'reference' | 'story';
  question: string;
  evidence: EvidenceItem[];
  runs: FormatRun[];
}

export interface SpoilerRow {
  caseId: string;
  spoiler: boolean;
  first?: unknown;
  second?: unknown;
  decision: SpoilerDecision;
  totalMs: number;
  error?: string;
}

export interface RewriteRow {
  caseId: string;
  group: 'misremembered' | 'control';
  query: string;
  rewrites: string[];
  run?: RunResult;
  original: CaseScore;
  merged: CaseScore;
  /** A provider failed in one of the lookups: rerun before trusting this row. */
  degraded: boolean;
  error?: string;
}

export interface BenchResults {
  startedAt: string;
  device: DeviceInfo;
  model: ModelInfo;
  explain: ExplainRow[];
  spoilers: SpoilerRow[];
  rewrites: RewriteRow[];
  /** Main thread while the model generated (explanations and spoilers; rewrites also search). */
  responsiveness?: Responsiveness;
  runMemory: MemoryPeaks;
  /** Every failed model call or lookup; after a worker failure the model is unloaded, not retried. */
  errors: string[];
}

export interface BenchJobs {
  explain: boolean;
  stories: boolean;
  spoilers: boolean;
  rewrites: boolean;
}

export interface BenchDeps {
  client: LlmClient;
  getJson: GetJson;
  now: () => string;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
  signal: AbortSignal;
}

/** Collects errors as `caseId: message` and logs them. */
function errorSink(deps: BenchDeps, errors: string[]) {
  return (caseId: string, error: unknown) => {
    const line = `${caseId}: ${errorMessage(error)}`;
    errors.push(line);
    deps.log(line);
  };
}

export function deviceInfo(support: Support): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: nav.userAgent,
    deviceMemoryGB: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    support,
  };
}

export async function storageUsage(): Promise<number | undefined> {
  return (await navigator.storage?.estimate?.())?.usage;
}

export function jsHeapBytes(): number | undefined {
  return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    ?.usedJSHeapSize;
}

const largest = (values: readonly number[]) => values.reduce((a, b) => Math.max(a, b), 0);

/** Long tasks and frame gaps on the main thread until the returned stop function is called. */
export function startResponsivenessProbe(): () => Responsiveness {
  const tasks: number[] = [];
  const gaps: number[] = [];
  const longTaskSupported = PerformanceObserver.supportedEntryTypes?.includes('longtask') ?? false;
  const observer = longTaskSupported
    ? new PerformanceObserver((list) => list.getEntries().forEach((e) => tasks.push(e.duration)))
    : undefined;
  observer?.observe({ type: 'longtask' });
  let last = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    gaps.push(now - last);
    last = now;
    frame = requestAnimationFrame(tick);
  });
  return () => {
    observer?.disconnect();
    cancelAnimationFrame(frame);
    return {
      longTaskSupported,
      longTasks: tasks.length,
      longestTaskMs: largest(tasks),
      frames: gaps.length,
      frameGapP95Ms: percentile(gaps, 95),
      frameGapMaxMs: largest(gaps),
    };
  };
}

/** Samples main-thread and worker heap once a second; the stop function returns the peaks. */
export function startMemorySampler(client: LlmClient, everyMs = 1000): () => MemoryPeaks {
  const peaks: MemoryPeaks = {};
  const raise = (key: keyof MemoryPeaks, value: number | undefined) => {
    if (value !== undefined) peaks[key] = Math.max(peaks[key] ?? 0, value);
  };
  const timer = setInterval(async () => {
    raise('mainPeakBytes', jsHeapBytes());
    raise('workerPeakBytes', await client.heapBytes());
  }, everyMs);
  return () => {
    clearInterval(timer);
    return { ...peaks };
  };
}

export function modelSummary(
  family: ModelFamily,
  variant: ModelVariant,
): Pick<ModelInfo, 'family' | 'modelId' | 'downloadBytes' | 'vramMB'> {
  return {
    family: family.key,
    modelId: variant.modelId,
    downloadBytes: variant.downloadBytes,
    vramMB: variant.vramMB,
  };
}

// ── Inputs ──────────────────────────────────────────────────────────────────

interface ReferenceCase {
  caseId: string;
  question: string;
  reference: Reference;
  sources: Source[];
}

function qidMap(snapshot: Snapshot): Map<string, string> {
  return new Map(
    Object.entries(snapshot.wikiquoteQids).flatMap(([page, qid]) => (qid ? [[page, qid]] : [])),
  );
}

/** For each scored eval case, the first recorded candidate that is a right answer and has evidence. */
export function referenceCases(snapshot: Snapshot, limit: number): ReferenceCase[] {
  const qids = qidMap(snapshot);
  const seen = new Set<string>();
  const cases: ReferenceCase[] = [];
  for (const evalCase of casesFor('live')) {
    const accepted = new Set(evalCase.meanings.flatMap((m) => [...meaningIds(m, 'live')]));
    const hit = snapshot.cases[evalCase.id]?.candidates.find((c) =>
      accepted.has(scoringIds([c.id], qids)[0] ?? ''),
    );
    if (!hit || seen.has(hit.id)) continue;
    const reference = candidateToReference(hit, snapshot.capturedAt);
    if (buildEvidence(reference, hit.sources).length === 0) continue;
    seen.add(hit.id);
    cases.push({
      caseId: evalCase.id,
      question: `Explain “${stripDisambiguator(hit.title)}”.`,
      reference,
      sources: hit.sources,
    });
    if (cases.length === limit) break;
  }
  return cases;
}

/** Misremembered cases, and as a control the correctly typed case each one varies. */
export function rewriteCases(): { evalCase: EvalCase; group: RewriteRow['group'] }[] {
  const scored = casesFor('live');
  const misremembered = scored.filter((c) => c.misremembered);
  const bases = new Set(misremembered.map((c) => c.id.replace(/-v\d*$/, '')));
  return [
    ...misremembered.map((evalCase) => ({ evalCase, group: 'misremembered' as const })),
    ...scored
      .filter((c) => !c.misremembered && bases.has(c.id))
      .map((evalCase) => ({ evalCase, group: 'control' as const })),
  ];
}

// ── Jobs ────────────────────────────────────────────────────────────────────

async function explainRow(
  deps: BenchDeps,
  onError: ReturnType<typeof errorSink>,
  caseId: string,
  kind: ExplainRow['kind'],
  question: string,
  evidence: EvidenceItem[],
): Promise<ExplainRow> {
  const runs: FormatRun[] = [];
  for (const format of FORMATS) {
    try {
      const run = await firstValueFrom(deps.client.run(explainJob(question, evidence, format)));
      runs.push({ format, run, check: checkExplanation(parseJson(run.text), evidence) });
    } catch (error) {
      onError(`${caseId} ${format}`, error);
      runs.push({
        format,
        error: errorMessage(error),
        check: checkExplanation(undefined, evidence),
      });
    }
  }
  deps.log(
    `${caseId}: ${runs.map((r) => `${r.format} kept ${keptSentences(r.check).length}/${keptSentences(r.check).length + r.check.dropped.length}`).join(', ')}`,
  );
  return { caseId, kind, question, evidence, runs };
}

async function spoilerRows(
  deps: BenchDeps,
  onError: ReturnType<typeof errorSink>,
): Promise<SpoilerRow[]> {
  const rows: SpoilerRow[] = [];
  for (const c of SPOILER_CASES) {
    if (deps.signal.aborted) break;
    const [jobA, jobB] = spoilerJobs(c.work, c.line);
    try {
      const a = await firstValueFrom(deps.client.run(jobA));
      const b = await firstValueFrom(deps.client.run(jobB));
      const first = parseJson(a.text);
      const second = parseJson(b.text);
      rows.push({
        caseId: c.id,
        spoiler: c.spoiler,
        first,
        second,
        decision: decideSpoiler(c.line, first, second),
        totalMs: a.totalMs + b.totalMs,
      });
    } catch (error) {
      onError(c.id, error);
      rows.push({
        caseId: c.id,
        spoiler: c.spoiler,
        decision: { show: false, reason: 'not_safe' },
        totalMs: Number.NaN,
        error: errorMessage(error),
      });
    }
    deps.log(`${c.id}: ${rows.at(-1)?.decision.show ? 'shown' : 'hidden'}`);
  }
  return rows;
}

/** Wikiquote page → Wikidata item, so a Wikiquote result scores like the live eval does. */
async function resolveWikiquote(
  deps: BenchDeps,
  ids: readonly string[],
  known: Map<string, string>,
) {
  const missing = wikiquotePageIds(ids).filter((page) => !known.has(page));
  if (missing.length === 0) return;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    prop: 'pageprops',
    ppprop: 'wikibase_item',
    pageids: missing.slice(0, 50).join('|'),
  });
  try {
    for (const [page, qid] of parseWikibaseItems(
      await deps.getJson(`https://en.wikiquote.org/w/api.php?${params}`),
    )) {
      known.set(page, qid);
    }
  } catch {
    // Unresolved pages stay unacceptable, as in the live eval.
  }
}

async function lookup(
  deps: BenchDeps,
  query: string,
): Promise<{ results: RankedResult[]; degraded: boolean }> {
  const result = await retrieve(query, { getJson: deps.getJson, now: deps.now }, deps.signal);
  return {
    results: result.candidates.map((c) => ({ id: c.id, title: c.title })),
    degraded: result.outcomes.some((o) => o.status === 'failed'),
  };
}

async function rewriteRows(
  deps: BenchDeps,
  onError: ReturnType<typeof errorSink>,
  snapshot: Snapshot,
): Promise<RewriteRow[]> {
  const qids = qidMap(snapshot);
  const rows: RewriteRow[] = [];
  for (const { evalCase, group } of rewriteCases()) {
    if (deps.signal.aborted) break;
    try {
      const original = await lookup(deps, evalCase.query);
      const run = await firstValueFrom(deps.client.run(rewriteJob(evalCase.query)));
      const rewrites = checkRewrites(parseJson(run.text), evalCase.query);
      const lists = [original.results];
      let degraded = original.degraded;
      for (const rewrite of rewrites) {
        await deps.sleep(LIVE_PAUSE_MS);
        const found = await lookup(deps, rewrite);
        lists.push(found.results);
        degraded ||= found.degraded;
      }
      const merged = mergeResults(lists);
      await resolveWikiquote(
        deps,
        [...original.results, ...merged].map((r) => r.id),
        qids,
      );
      rows.push({
        caseId: evalCase.id,
        group,
        query: evalCase.query,
        rewrites,
        run,
        original: toRun(evalCase, 'live', original.results, 0, [], qids).score,
        merged: toRun(evalCase, 'live', merged, 0, [], qids).score,
        degraded,
      });
      deps.log(`${evalCase.id}: ${rewrites.join(' | ') || '(no rewrite)'}`);
    } catch (error) {
      onError(evalCase.id, error);
      // Kept as a row, so a failure can't make the rewrite criteria pass by leaving cases out.
      const none = toRun(evalCase, 'live', [], 0).score;
      rows.push({
        caseId: evalCase.id,
        group,
        query: evalCase.query,
        rewrites: [],
        original: none,
        merged: none,
        degraded: true,
        error: errorMessage(error),
      });
    }
    await deps.sleep(LIVE_PAUSE_MS);
  }
  return rows;
}

export async function runBench(
  deps: BenchDeps,
  jobs: BenchJobs,
  explainLimit: number,
): Promise<
  Pick<
    BenchResults,
    'explain' | 'spoilers' | 'rewrites' | 'responsiveness' | 'runMemory' | 'errors'
  >
> {
  const snapshot = (await import('../../test/search-eval/snapshot/candidates.json'))
    .default as unknown as Snapshot;
  const errors: string[] = [];
  const onError = errorSink(deps, errors);
  const stopMemory = startMemorySampler(deps.client);
  const stopProbe = startResponsivenessProbe();
  const explain: ExplainRow[] = [];
  if (jobs.explain) {
    for (const c of referenceCases(snapshot, explainLimit)) {
      if (deps.signal.aborted) break;
      explain.push(
        await explainRow(
          deps,
          onError,
          c.caseId,
          'reference',
          c.question,
          buildEvidence(c.reference, c.sources),
        ),
      );
    }
  }
  if (jobs.stories) {
    for (const { title, name } of STORY_TITLES) {
      if (deps.signal.aborted) break;
      try {
        const story = await fetchStory(deps.getJson, title, deps.now(), deps.signal);
        if (story) {
          explain.push(
            await explainRow(
              deps,
              onError,
              title,
              'story',
              `What has ${name} done?`,
              buildEvidence(undefined, [], story),
            ),
          );
        } else {
          deps.log(`${title}: no character-biography section`);
        }
      } catch (error) {
        onError(title, error);
      }
      await deps.sleep(1000);
    }
  }
  const spoilers = jobs.spoilers && !deps.signal.aborted ? await spoilerRows(deps, onError) : [];
  const responsiveness = stopProbe();
  const rewrites =
    jobs.rewrites && !deps.signal.aborted ? await rewriteRows(deps, onError, snapshot) : [];
  return { explain, spoilers, rewrites, responsiveness, runMemory: stopMemory(), errors };
}
