import { describe, expect, it } from 'vitest';
import snapshotJson from '../../test/search-eval/snapshot/candidates.json';
import type { Snapshot } from '../../test/search-eval/snapshot';
import { buildEvidence } from '../../services/llm/evidence';
import type { CaseScore } from '../../test/search-eval/metrics';
import {
  referenceCases,
  rewriteCases,
  type BenchResults,
  type ExplainRow,
  type RewriteRow,
} from './llmBench';
import { criteria, renderBenchReport, rewriteGain, summarizeFormat } from './llmBenchReport';

const snapshot = snapshotJson as unknown as Snapshot;

describe('bench inputs', () => {
  it('takes one right-answer candidate with evidence per eval case, without repeats', () => {
    const cases = referenceCases(snapshot, 94);
    expect(cases.length).toBeGreaterThan(10);
    expect(new Set(cases.map((c) => c.reference.id)).size).toBe(cases.length);
    for (const c of cases) expect(buildEvidence(c.reference, c.sources).length).toBeGreaterThan(0);
    expect(referenceCases(snapshot, 3)).toHaveLength(3);
  });

  it('pairs every misremembered case with its correctly typed base case as a control', () => {
    const cases = rewriteCases();
    const misremembered = cases.filter((c) => c.group === 'misremembered');
    expect(misremembered.length).toBeGreaterThan(0);
    expect(misremembered.every((c) => c.evalCase.misremembered)).toBe(true);
    const variants = new Set(misremembered.map((c) => c.evalCase.id.replace(/-v\d*$/, '')));
    for (const c of cases.filter((c) => c.group === 'control')) {
      expect(c.evalCase.misremembered).toBe(false);
      expect(variants.has(c.evalCase.id)).toBe(true);
    }
  });
});

const score = (rank: number | null): CaseScore => ({
  rank,
  incorrectTop: rank !== 1,
  noResults: false,
  meaningsInTopK: rank !== null && rank <= 5 ? 1 : 0,
  ambiguityScored: false,
});

const run = {
  text: '',
  promptTokens: 100,
  completionTokens: 20,
  firstTokenMs: 800,
  totalMs: 4000,
  decodeTokensPerSecond: 15,
  finishReason: 'stop',
};

const explainRow: ExplainRow = {
  caseId: 'X1',
  kind: 'reference',
  question: 'Explain “Doctor Doom”.',
  evidence: [
    {
      id: 'E1',
      from: 'Wikipedia',
      text: 'Doctor Doom is a supervillain.',
      sourceIds: ['s'],
      plot: false,
    },
  ],
  runs: [
    {
      format: 'json',
      run,
      check: {
        valid: true,
        meaning: [
          {
            text: 'Doctor Doom is a supervillain.',
            evidenceIds: ['E1'],
            sourceIds: ['s'],
            plot: false,
          },
        ],
        context: [],
        spoiler: 'none',
        uncertainty: 'low',
        dropped: [{ field: 'context', text: 'x', reason: 'ungrounded' }],
      },
    },
    {
      format: 'toon',
      run: { ...run, promptTokens: 70 },
      check: {
        valid: true,
        meaning: [],
        context: [],
        spoiler: 'major',
        uncertainty: 'high',
        dropped: [],
      },
    },
  ],
};

const rewrite = (
  caseId: string,
  group: RewriteRow['group'],
  before: number | null,
  after: number | null,
): RewriteRow => ({
  caseId,
  group,
  query: caseId,
  rewrites: [],
  run,
  original: score(before),
  merged: score(after),
  degraded: false,
});

const results: BenchResults = {
  startedAt: '2026-11-16T12:00:00.000Z',
  device: {
    userAgent: 'test',
    cores: 8,
    deviceMemoryGB: 4,
    support: {
      ok: true,
      shaderF16: true,
      adapter: 'gpu',
      maxBufferSize: 2 ** 31,
      maxStorageBufferBindingSize: 2 ** 30,
      memoryBudgetMB: 1638,
    },
  },
  model: {
    family: 'qwen3-0.6b',
    modelId: 'Qwen3-0.6B-q4f16_1-MLC',
    downloadBytes: 358_000_000,
    vramMB: 1403,
    fromCache: true,
    loadMs: 5000,
  },
  explain: [explainRow],
  spoilers: [
    { caseId: 'S1', spoiler: true, decision: { show: true, reason: 'both_safe' }, totalMs: 500 },
    { caseId: 'N1', spoiler: false, decision: { show: true, reason: 'both_safe' }, totalMs: 500 },
  ],
  rewrites: [
    rewrite('M1-v', 'misremembered', null, 2),
    rewrite('Q2-v', 'misremembered', 8, 3),
    rewrite('Q3-v', 'misremembered', null, null),
    rewrite('M1', 'control', 1, 1),
    rewrite('Q2', 'control', 4, 6),
  ],
  responsiveness: {
    longTaskSupported: true,
    longTasks: 1,
    longestTaskMs: 180,
    frames: 600,
    frameGapP95Ms: 17,
    frameGapMaxMs: 190,
  },
  runMemory: { mainPeakBytes: 40_000_000, workerPeakBytes: 90_000_000 },
  errors: [],
};

describe('bench report', () => {
  it('summarizes each evidence format: kept share, prompt tokens and drop reasons', () => {
    expect(summarizeFormat([explainRow], 'json')).toMatchObject({
      cases: 1,
      proposed: 2,
      kept: 1,
      casesExplained: 1,
      promptTokensMean: 100,
      dropped: { ungrounded: 1 },
    });
    expect(summarizeFormat([explainRow], 'toon')).toMatchObject({ kept: 0, promptTokensMean: 70 });
  });

  it('counts misremembered cases gained and control cases lost from the top 5', () => {
    expect(rewriteGain(results.rewrites, 'misremembered')).toMatchObject({
      cases: 3,
      before: 0,
      after: 2,
      gained: 2,
      lost: 0,
    });
    expect(rewriteGain(results.rewrites, 'control')).toMatchObject({
      cases: 2,
      before: 2,
      after: 1,
      gained: -1,
      lost: 1,
    });
  });

  it('fails a spoiler shown or a correct search pushed out, and leaves human labels unmeasured', () => {
    const byName = new Map(criteria(results).map((c) => [c.name, c.pass]));
    expect(byName.get('Spoilers: spoiler lines shown')).toBe(false);
    expect(byName.get('Rewrites: misremembered cases newly in top 5')).toBe(true);
    expect(byName.get('Rewrites: correctly typed cases pushed out of top 5')).toBe(false);
    expect(byName.get('Explanations: shown sentences supported (human labels)')).toBeNull();
    expect(byName.get('Download size')).toBe(true);
    expect(byName.get('Main thread during generation: longest task')).toBe(false);
    expect(byName.get('Main thread during generation: frame gap p95')).toBe(true);
    expect(byName.get('No out-of-memory crash on a 4 GB-class device')).toBe(true);
    const failedRewrite = {
      ...results,
      rewrites: [
        ...results.rewrites,
        { ...rewrite('Q5-v', 'misremembered', null, null), error: 'timeout' },
      ],
    };
    expect(
      new Map(criteria(failedRewrite).map((c) => [c.name, c.pass])).get(
        'Rewrites: misremembered cases newly in top 5',
      ),
    ).toBe(false);
    const crashed = new Map(
      criteria({ ...results, errors: ['N1: Device lost'] }).map((c) => [c.name, c.pass]),
    );
    expect(crashed.get('No out-of-memory crash on a 4 GB-class device')).toBe(false);
    const bigDevice = { ...results, device: { ...results.device, deviceMemoryGB: 8 } };
    expect(
      new Map(criteria(bigDevice).map((c) => [c.name, c.pass])).get(
        'No out-of-memory crash on a 4 GB-class device',
      ),
    ).toBeNull();
  });

  it('renders every section and lists shown sentences for labelling', () => {
    const report = renderBenchReport(results);
    for (const heading of [
      '## Pass criteria',
      '## Reference explanations',
      '## Spoiler judgement',
      '## Search rewrites',
      '## Appendix',
    ]) {
      expect(report).toContain(heading);
    }
    expect(report).toContain(
      '| X1 | json | Doctor Doom is a supervillain. | E1: Doctor Doom is a supervillain. | no | |',
    );
  });
});
