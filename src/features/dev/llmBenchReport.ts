import { keptSentences } from '../../services/llm/check';
import { percentile } from '../../test/search-eval/metrics';
import { formatMegabytes } from '../../services/llm/models';
import type { BenchResults, ExplainRow, FormatRun, RewriteRow } from './llmBench';
import type { EvidenceFormat } from '../../services/llm/evidence';

/**
 * Pass criteria and the Markdown report for `/dev/llm-bench` (docs/research/ondevice-llm.md,
 * "Pass criteria"). Pure, so it is unit-tested without a model.
 */

export const PASS = {
  maxDownloadMB: 1000,
  maxVramMB: 2000,
  /** Share of proposed sentences that survive the citation and grounding checks. */
  minKeptShare: 0.7,
  /** Share of explanation cases that end with at least one shown sentence. */
  minCasesExplained: 0.8,
  maxFirstTokenP50Ms: 3000,
  maxExplainP95Ms: 20000,
  maxSpoilersShown: 0,
  minSafeShown: 0.5,
  maxSpoilerP95Ms: 4000,
  /** Net misremembered cases in the top 5 after rewrites (after − before), out of 11. */
  minRewriteGain: 2,
  /** Correctly typed cases that rewrites push out of the top 5. */
  maxControlLoss: 0,
  maxRewriteP95Ms: 5000,
  maxWarmLoadMs: 30000,
  /** Main thread while the model generates: no task this long, and smooth frames. */
  maxLongTaskMs: 100,
  maxFrameGapP95Ms: 50,
} as const;

export interface Criterion {
  name: string;
  value: string;
  target: string;
  /** Null: not measured in this run, or needs a person (human faithfulness labels). */
  pass: boolean | null;
}

const pct = (value: number) => (Number.isNaN(value) ? '–' : `${(value * 100).toFixed(1)}%`);
const ms = (value: number) => (Number.isNaN(value) ? '–' : `${Math.round(value)} ms`);
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export interface FormatSummary {
  format: EvidenceFormat;
  cases: number;
  validJson: number;
  proposed: number;
  kept: number;
  casesExplained: number;
  plotSentences: number;
  /** Answers cut off at `maxTokens`. */
  truncated: number;
  /** Runs that failed (error or timeout): they make the timing criteria fail, not vanish. */
  failed: number;
  promptTokensMean: number;
  firstTokenP50: number;
  totalP50: number;
  totalP95: number;
  decodeTokensPerSecondP50: number;
  dropped: Record<string, number>;
  /** Kept examples (each an exact quote from its evidence). */
  examples: number;
  /** Answers marked `major` (model said so, was unsure, or cited story text). */
  markedMajor: number;
}

function runsOf(rows: readonly ExplainRow[], format: EvidenceFormat): FormatRun[] {
  return rows.flatMap((r) => r.runs.filter((run) => run.format === format));
}

export function summarizeFormat(
  rows: readonly ExplainRow[],
  format: EvidenceFormat,
): FormatSummary {
  const runs = runsOf(rows, format);
  const timed = runs.flatMap((r) => (r.run ? [r.run] : []));
  const dropped: Record<string, number> = {};
  for (const r of runs)
    for (const d of r.check.dropped) dropped[d.reason] = (dropped[d.reason] ?? 0) + 1;
  const kept = runs.reduce((n, r) => n + keptSentences(r.check).length, 0);
  return {
    format,
    cases: runs.length,
    validJson: runs.filter((r) => r.check.valid).length,
    proposed: kept + runs.reduce((n, r) => n + r.check.dropped.length, 0),
    kept,
    casesExplained: runs.filter((r) => r.check.meaning.length > 0).length,
    plotSentences: runs.reduce(
      (n, r) => n + keptSentences(r.check).filter((s) => s.plot).length,
      0,
    ),
    examples: runs.filter((r) => r.check.example).length,
    markedMajor: runs.filter((r) => r.check.valid && r.check.spoiler === 'major').length,
    truncated: timed.filter((r) => r.finishReason === 'length').length,
    failed: runs.filter((r) => r.error !== undefined).length,
    promptTokensMean:
      timed.length === 0
        ? Number.NaN
        : timed.reduce((n, r) => n + r.promptTokens, 0) / timed.length,
    firstTokenP50: percentile(
      timed.map((r) => r.firstTokenMs),
      50,
    ),
    totalP50: percentile(
      timed.map((r) => r.totalMs),
      50,
    ),
    totalP95: percentile(
      timed.map((r) => r.totalMs),
      95,
    ),
    decodeTokensPerSecondP50: percentile(
      timed.map((r) => r.decodeTokensPerSecond),
      50,
    ),
    dropped,
  };
}

const share = (part: number, whole: number) => (whole === 0 ? Number.NaN : part / whole);
const atMost = (value: number, max: number) => (Number.isNaN(value) ? null : value <= max);
const atLeast = (value: number, min: number) => (Number.isNaN(value) ? null : value >= min);

function top5(score: RewriteRow['original']): boolean {
  return score.rank !== null && score.rank <= 5;
}

export function rewriteGain(rows: readonly RewriteRow[], group: RewriteRow['group']) {
  const inGroup = rows.filter((r) => r.group === group);
  return {
    cases: inGroup.length,
    before: inGroup.filter((r) => top5(r.original)).length,
    after: inGroup.filter((r) => top5(r.merged)).length,
    gained:
      inGroup.filter((r) => top5(r.merged)).length - inGroup.filter((r) => top5(r.original)).length,
    lost: inGroup.filter((r) => top5(r.original) && !top5(r.merged)).length,
    degraded: inGroup.filter((r) => r.degraded).length,
    failed: inGroup.filter((r) => r.error !== undefined).length,
  };
}

/** The better evidence format: more kept sentences, then fewer prompt tokens. */
export function bestFormat(rows: readonly ExplainRow[]): FormatSummary | undefined {
  const summaries = (['json', 'toon'] as const)
    .map((f) => summarizeFormat(rows, f))
    .filter((s) => s.cases > 0);
  const keptRate = (s: FormatSummary) => (s.proposed === 0 ? -1 : s.kept / s.proposed);
  return summaries.sort(
    (a, b) => keptRate(b) - keptRate(a) || a.promptTokensMean - b.promptTokensMean,
  )[0];
}

export function criteria(results: BenchResults): Criterion[] {
  const { model, explain, spoilers, rewrites } = results;
  const best = bestFormat(explain);
  const spoilerShown = spoilers.filter((s) => s.spoiler && s.decision.show).length;
  const safe = spoilers.filter((s) => !s.spoiler);
  const misremembered = rewriteGain(rewrites, 'misremembered');
  const control = rewriteGain(rewrites, 'control');
  const ran = {
    spoilers: spoilers.length > 0,
    rewrites: rewrites.length > 0,
    explain: best !== undefined,
  };
  const spoilerP95 = percentile(
    spoilers.map((s) => s.totalMs).filter((v) => !Number.isNaN(v)),
    95,
  );
  const rewriteP95 = percentile(
    rewrites.flatMap((r) => (r.run ? [r.run.totalMs] : [])),
    95,
  );
  const keptShare = best ? share(best.kept, best.proposed) : Number.NaN;
  // A job with failed runs fails its criteria: timeouts must not drop out of the percentiles.
  const explainOk = (pass: boolean | null) =>
    pass === null ? null : pass && (best?.failed ?? 0) === 0;
  const spoilersFailed = spoilers.filter((s) => s.error !== undefined).length;
  const rewritesFailed = misremembered.failed + control.failed;
  const unless = (failed: number, pass: boolean | null) =>
    pass === null ? null : pass && failed === 0;
  const probe = results.responsiveness;
  const smallDevice =
    results.device.deviceMemoryGB !== undefined && results.device.deviceMemoryGB <= 4;
  const explained = best ? share(best.casesExplained, best.cases) : Number.NaN;
  return [
    {
      name: 'Download size',
      value: formatMegabytes(model.downloadBytes),
      target: `≤ ${PASS.maxDownloadMB} MB`,
      pass: model.downloadBytes / 1e6 <= PASS.maxDownloadMB,
    },
    {
      name: 'GPU memory (WebLLM estimate)',
      value: `${model.vramMB} MB`,
      target: `≤ ${PASS.maxVramMB} MB`,
      pass: model.vramMB <= PASS.maxVramMB,
    },
    {
      name: 'Load time from cache',
      value: model.fromCache
        ? ms(model.loadMs)
        : `cold load ${ms(model.loadMs)} (rerun to measure)`,
      target: `≤ ${PASS.maxWarmLoadMs / 1000} s`,
      pass: model.fromCache ? model.loadMs <= PASS.maxWarmLoadMs : null,
    },
    {
      name: `Explanations: sentences kept by the checks (${best?.format ?? '–'})`,
      value: pct(keptShare),
      target: `≥ ${pct(PASS.minKeptShare)}`,
      pass: ran.explain ? atLeast(keptShare, PASS.minKeptShare) : null,
    },
    {
      name: 'Explanations: cases with at least one sentence',
      value: pct(explained),
      target: `≥ ${pct(PASS.minCasesExplained)}`,
      pass: ran.explain ? atLeast(explained, PASS.minCasesExplained) : null,
    },
    {
      name: 'Explanations: shown sentences supported (human labels)',
      value: 'label the appendix',
      target: '≥ 95%',
      pass: null,
    },
    {
      name: 'Explanations: time to first token, p50',
      value: ms(best?.firstTokenP50 ?? Number.NaN),
      target: `≤ ${PASS.maxFirstTokenP50Ms / 1000} s`,
      pass: ran.explain
        ? explainOk(atMost(best?.firstTokenP50 ?? Number.NaN, PASS.maxFirstTokenP50Ms))
        : null,
    },
    {
      name: 'Explanations: total time, p95',
      value: `${ms(best?.totalP95 ?? Number.NaN)}${best?.failed ? ` (${best.failed} failed)` : ''}`,
      target: `≤ ${PASS.maxExplainP95Ms / 1000} s`,
      pass: ran.explain
        ? explainOk(atMost(best?.totalP95 ?? Number.NaN, PASS.maxExplainP95Ms))
        : null,
    },
    {
      name: 'Spoilers: spoiler lines shown',
      value: String(spoilerShown),
      target: `${PASS.maxSpoilersShown}`,
      pass: ran.spoilers ? spoilerShown <= PASS.maxSpoilersShown : null,
    },
    {
      name: 'Spoilers: safe lines shown',
      value: `${pct(share(safe.filter((s) => s.decision.show).length, safe.length))} of ${safe.length}`,
      target: `≥ ${pct(PASS.minSafeShown)}`,
      pass: ran.spoilers
        ? atLeast(share(safe.filter((s) => s.decision.show).length, safe.length), PASS.minSafeShown)
        : null,
    },
    {
      name: 'Spoilers: time per line (two runs), p95',
      value: `${ms(spoilerP95)}${spoilersFailed ? ` (${spoilersFailed} failed)` : ''}`,
      target: `≤ ${PASS.maxSpoilerP95Ms / 1000} s`,
      pass: ran.spoilers ? unless(spoilersFailed, atMost(spoilerP95, PASS.maxSpoilerP95Ms)) : null,
    },
    {
      name: 'Rewrites: misremembered cases newly in top 5',
      value: `${misremembered.gained} (${misremembered.before} → ${misremembered.after} of ${misremembered.cases})`,
      target: `≥ ${PASS.minRewriteGain}`,
      pass: ran.rewrites
        ? unless(rewritesFailed, misremembered.gained >= PASS.minRewriteGain)
        : null,
    },
    {
      name: 'Rewrites: correctly typed cases pushed out of top 5',
      value: `${control.lost} of ${control.cases}`,
      target: `${PASS.maxControlLoss}`,
      pass: ran.rewrites ? unless(rewritesFailed, control.lost <= PASS.maxControlLoss) : null,
    },
    {
      name: 'Main thread during generation: longest task',
      value: probe?.longTaskSupported
        ? `${ms(probe.longestTaskMs)} (${probe.longTasks} over 50 ms)`
        : 'Long Tasks API not available',
      target: `≤ ${PASS.maxLongTaskMs} ms`,
      pass: probe?.longTaskSupported ? probe.longestTaskMs <= PASS.maxLongTaskMs : null,
    },
    {
      name: 'Main thread during generation: frame gap p95',
      value: probe
        ? `${ms(probe.frameGapP95Ms)} (max ${ms(probe.frameGapMaxMs)}, ${probe.frames} frames)`
        : '–',
      target: `≤ ${PASS.maxFrameGapP95Ms} ms`,
      pass: probe && probe.frames > 0 ? probe.frameGapP95Ms <= PASS.maxFrameGapP95Ms : null,
    },
    {
      name: 'No model errors or crashes',
      value: String(results.errors.length),
      target: '0',
      pass: results.errors.length === 0,
    },
    {
      name: 'No out-of-memory crash on a 4 GB-class device',
      value: `device reports ${results.device.deviceMemoryGB ?? '?'} GB, ${results.errors.length} errors`,
      target: '0 errors on a device reporting ≤ 4 GB',
      pass: smallDevice ? results.errors.length === 0 : null,
    },
    {
      name: 'Rewrites: model time, p95',
      value: ms(rewriteP95),
      target: `≤ ${PASS.maxRewriteP95Ms / 1000} s`,
      pass: ran.rewrites ? unless(rewritesFailed, atMost(rewriteP95, PASS.maxRewriteP95Ms)) : null,
    },
  ];
}

function formatRow(s: FormatSummary): string {
  const drops =
    Object.entries(s.dropped)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ') || '–';
  return `| ${s.format} | ${s.cases} | ${s.validJson} | ${s.truncated} | ${s.failed} | ${s.kept}/${s.proposed} (${pct(share(s.kept, s.proposed))}) | ${s.casesExplained} | ${s.examples} | ${s.markedMajor} | ${s.plotSentences} | ${Number.isNaN(s.promptTokensMean) ? '–' : Math.round(s.promptTokensMean)} | ${ms(s.firstTokenP50)} | ${ms(s.totalP50)} | ${ms(s.totalP95)} | ${Number.isNaN(s.decodeTokensPerSecondP50) ? '–' : s.decodeTokensPerSecondP50.toFixed(1)} | ${drops} |`;
}

export function renderBenchReport(results: BenchResults): string {
  const { device, model, explain, spoilers, rewrites } = results;
  const mb = (bytes?: number) => (bytes === undefined ? '–' : formatMegabytes(bytes));
  const formatHeader = [
    '| Format | Cases | Valid JSON | Cut off | Failed | Kept / proposed | Cases explained | Examples | Marked major | Plot sentences | Prompt tokens (mean) | First token p50 | Total p50 | Total p95 | Decode tok/s p50 | Dropped |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  const kinds: [string, ExplainRow['kind']][] = [
    ['Reference explanations (eval snapshot)', 'reference'],
    ['Character stories (live Wikipedia)', 'story'],
  ];
  return [
    `# On-device model benchmark: ${model.modelId}`,
    '',
    `Run ${results.startedAt}. ${device.userAgent}`,
    `Device memory ${device.deviceMemoryGB ?? '–'} GB, ${device.cores} cores. WebGPU: ${device.support.ok ? `yes (${device.support.adapter || 'adapter'}; shader-f16 ${device.support.shaderF16 ? 'yes' : 'no'})` : `no (${device.support.reason})`}.`,
    '',
    '## Pass criteria',
    '',
    '| Criterion | Value | Target | Pass |',
    '|---|---|---|---|',
    ...criteria(results).map(
      (c) =>
        `| ${cell(c.name)} | ${cell(c.value)} | ${cell(c.target)} | ${c.pass === null ? 'not measured' : c.pass ? 'yes' : '**no**'} |`,
    ),
    '',
    '## Model and memory',
    '',
    `Download ${formatMegabytes(model.downloadBytes)} (pinned files); storage used before/after load ${mb(model.storageBeforeBytes)} / ${mb(model.storageAfterBytes)}; ${model.fromCache ? 'loaded from cache' : 'downloaded this run'} in ${ms(model.loadMs)}.`,
    `GPU memory (WebLLM estimate at 4096 tokens; this app caps context at 3072) ${model.vramMB} MB. GPU limits: maxBufferSize ${device.support.ok ? mb(device.support.maxBufferSize) : '–'}, maxStorageBufferBindingSize ${device.support.ok ? mb(device.support.maxStorageBufferBindingSize) : '–'}; budget ${device.support.ok ? `${device.support.memoryBudgetMB} MB` : '–'}.`,
    `Peak JS heap while loading: main ${mb(model.loadPeakMainBytes)}, worker ${mb(model.loadPeakWorkerBytes)}. While running: main ${mb(results.runMemory.mainPeakBytes)}, worker ${mb(results.runMemory.workerPeakBytes)}. (Weights live in GPU memory, which no web API reports; use \`adb shell dumpsys meminfo\`.)`,
    ...(results.errors.length > 0 ? ['', 'Errors:', ...results.errors.map((e) => `- ${e}`)] : []),
    '',
    ...kinds.flatMap(([title, kind]) => {
      const rows = explain.filter((r) => r.kind === kind);
      if (rows.length === 0) return [];
      return [
        `## ${title}`,
        '',
        ...formatHeader,
        ...(['json', 'toon'] as const).map((f) => formatRow(summarizeFormat(rows, f))),
        '',
      ];
    }),
    ...(spoilers.length > 0
      ? [
          '## Spoiler judgement',
          '',
          '| Case | Labelled spoiler | Run A | Run B | Shown | Reason | ms |',
          '|---|---|---|---|---|---|---|',
          ...spoilers.map(
            (s) =>
              `| ${s.caseId} | ${s.spoiler ? 'yes' : 'no'} | ${cell(JSON.stringify(s.first ?? s.error ?? null))} | ${cell(JSON.stringify(s.second ?? null))} | ${s.decision.show ? 'yes' : 'no'} | ${s.decision.reason} | ${ms(s.totalMs)} |`,
          ),
          '',
        ]
      : []),
    ...(rewrites.length > 0
      ? [
          '## Search rewrites',
          '',
          '| Case | Group | Typed | Rewrites | Rank before | Rank after | Degraded | Model ms |',
          '|---|---|---|---|---|---|---|---|',
          ...rewrites.map(
            (r) =>
              `| ${r.caseId} | ${r.group} | ${cell(r.query)} | ${cell(r.rewrites.join(' · ') || '–')} | ${r.original.rank ?? '–'} | ${r.merged.rank ?? '–'} | ${r.degraded ? 'yes' : 'no'} | ${ms(r.run?.totalMs ?? Number.NaN)} |`,
          ),
          '',
        ]
      : []),
    '## Appendix: shown sentences to label',
    '',
    'Mark each "supported" only if the cited evidence states everything in the sentence.',
    '',
    '| Case | Format | Sentence (meaning, context, then example) | Cited evidence | Plot | Supported? |',
    '|---|---|---|---|---|---|',
    ...explain.flatMap((row) =>
      row.runs.flatMap((run) =>
        keptSentences(run.check).map((s) => {
          const cited = s.evidenceIds
            .map((id) => `${id}: ${row.evidence.find((e) => e.id === id)?.text ?? ''}`)
            .join(' / ');
          return `| ${row.caseId} | ${run.format} | ${cell(s.text)} | ${cell(cited.slice(0, 400))} | ${s.plot ? 'yes' : 'no'} | |`;
        }),
      ),
    ),
    '',
  ].join('\n');
}
