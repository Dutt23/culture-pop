import { latencySummary, scoreCase, summarize, type CaseScore, type Summary } from './metrics';
import { wikiquotePageId } from '../../domain/sources';
import { LOCAL_ONLY_CASES } from './localCases';
import { EVAL_CASES, type EvalCase, type Meaning } from './queries';

/** `live` scores `retrieve()` candidates; `local` scores `rankReferences` over the seeded library. */
export type EvalMode = 'live' | 'local';

/** IDs a result can carry for this meaning in this mode. */
export function meaningIds(meaning: Meaning, mode: EvalMode): Set<string> {
  if (mode === 'local') return new Set(meaning.local ?? []);
  return new Set([
    ...(meaning.qids ?? []).map((qid) => `wd:${qid}`),
    ...(meaning.wiktionary ?? []).map((title) => `enwiktionary:${title}`),
  ]);
}

/**
 * Scored cases with at least one acceptable ID in this mode. The local mode also runs the
 * local-only typo cases (`localCases.ts`), which have no live answers.
 */
export function casesFor(mode: EvalMode): EvalCase[] {
  const pool = mode === 'local' ? [...EVAL_CASES, ...LOCAL_ONLY_CASES] : EVAL_CASES;
  return pool.filter(
    (c) => c.status === 'scored' && c.meanings.some((m) => meaningIds(m, mode).size > 0),
  );
}

export interface RankedResult {
  id: string;
  title: string;
}

export interface CaseRun {
  evalCase: EvalCase;
  results: RankedResult[];
  latencyMs: number;
  /** Providers that failed for this query, as `provider:failure`. Non-empty means degraded. */
  failures: string[];
  score: CaseScore;
  /** HTTP requests the search made (live runs only; retries inside one request are not counted). */
  requests?: number;
}

/** The `enwikiquote:` page IDs among `ids`, without the prefix. */
export function wikiquotePageIds(ids: readonly string[]): string[] {
  return ids.flatMap((id) => wikiquotePageId(id) ?? []);
}

/**
 * Pulls `pageid → wikibase_item` out of a Wikiquote `prop=pageprops` response (formatversion 2).
 * Pages with no Wikidata item are left out.
 */
export function parseWikibaseItems(json: unknown): Map<string, string> {
  const items = new Map<string, string>();
  const pages = (json as { query?: { pages?: unknown } } | null)?.query?.pages;
  if (!Array.isArray(pages)) return items;
  for (const page of pages) {
    const qid = page?.pageprops?.wikibase_item;
    if (typeof page?.pageid === 'number' && typeof qid === 'string') {
      items.set(String(page.pageid), qid);
    }
  }
  return items;
}

/**
 * Scoring IDs for a live result list: a Wikiquote candidate counts as the Wikidata item of its
 * page (`wd:<QID>`), so the Wikiquote page of the right work is acceptable. `qidByWikiquotePage`
 * maps page ID to QID; a page without an entry (no item, or lookup failed) keeps its own ID and
 * so stays unacceptable. `enwiki:` pages are never mapped.
 */
export function scoringIds(
  ids: readonly string[],
  qidByWikiquotePage: ReadonlyMap<string, string> = new Map(),
): string[] {
  return ids.map((id) => {
    const page = wikiquotePageId(id);
    const qid = page === undefined ? undefined : qidByWikiquotePage.get(page);
    return qid ? `wd:${qid}` : id;
  });
}

export function toRun(
  evalCase: EvalCase,
  mode: EvalMode,
  results: RankedResult[],
  latencyMs: number,
  failures: string[] = [],
  qidByWikiquotePage?: ReadonlyMap<string, string>,
): CaseRun {
  const meanings = evalCase.meanings.map((m) => meaningIds(m, mode));
  const score = scoreCase(
    scoringIds(
      results.map((r) => r.id),
      qidByWikiquotePage,
    ),
    meanings,
    evalCase.ambiguous,
  );
  return { evalCase, results, latencyMs, failures, score };
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const ms = (value: number) =>
  Number.isNaN(value) ? '–' : value < 10 ? value.toFixed(2) : String(Math.round(value));
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function summaryRow(label: string, runs: readonly CaseRun[]): string {
  const s: Summary = summarize(runs.map((r) => r.score));
  const latency = latencySummary(runs.map((r) => r.latencyMs));
  const ambiguity =
    s.ambiguityCoverage === null ? '–' : `${pct(s.ambiguityCoverage)} (${s.ambiguityCases})`;
  return `| ${label} | ${s.cases} | ${pct(s.recallAt5)} | ${s.mrrAt10.toFixed(3)} | ${pct(s.incorrectTopRate)} | ${pct(s.noResultRate)} | ${ambiguity} | ${ms(latency.p50)} | ${ms(latency.p90)} | ${ms(latency.p95)} | ${ms(latency.max)} |`;
}

const SUMMARY_HEADER = [
  '| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
];

function groupRows(runs: readonly CaseRun[], key: (c: EvalCase) => string): string[] {
  const groups = new Map<string, CaseRun[]>();
  for (const run of runs) {
    const k = key(run.evalCase);
    groups.set(k, [...(groups.get(k) ?? []), run]);
  }
  return [...groups.keys()].sort().map((k) => summaryRow(k, groups.get(k) ?? []));
}

function flagRows(runs: readonly CaseRun[]): string[] {
  const flags: [string, (c: EvalCase) => boolean][] = [
    ['misremembered', (c) => c.misremembered],
    ['ambiguous', (c) => c.ambiguous],
    ['indian', (c) => c.indian],
    ['ambiguous or indian', (c) => c.ambiguous || c.indian],
  ];
  return flags.flatMap(([name, has]) => [
    summaryRow(
      `${name}: yes`,
      runs.filter((r) => has(r.evalCase)),
    ),
    summaryRow(
      `${name}: no`,
      runs.filter((r) => !has(r.evalCase)),
    ),
  ]);
}

function caseRows(mode: EvalMode, runs: readonly CaseRun[]): string[] {
  return [
    '| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |',
    '|---|---|---|---|---|---|---|',
    ...runs.map((r) => {
      const top = r.results[0];
      const usable = r.evalCase.meanings.filter((m) => meaningIds(m, mode).size > 0).length;
      const meanings = r.score.ambiguityScored
        ? `${r.score.meaningsInTopK}/${usable}`
        : String(r.score.meaningsInTopK);
      return `| ${r.evalCase.id} | ${cell(r.evalCase.query)} | ${r.score.rank ?? '–'} | ${top ? cell(`${top.title} (${top.id})`) : '–'} | ${meanings} | ${ms(r.latencyMs)} | ${r.failures.join(', ') || '–'} |`;
    }),
  ];
}

/** Total and average HTTP requests per search, when the run counted them. */
function requestLine(runs: readonly CaseRun[]): string[] {
  const counted = runs.flatMap((r) => (r.requests === undefined ? [] : [r.requests]));
  if (counted.length === 0) return [];
  const total = counted.reduce((sum, n) => sum + n, 0);
  return [
    `HTTP requests: **${total}** over ${counted.length} searches (${(total / counted.length).toFixed(2)} per search).`,
    '',
  ];
}

function modeSection(mode: EvalMode, runs: readonly CaseRun[]): string[] {
  const degraded = runs.filter((r) => r.failures.length > 0).length;
  return [
    `## ${mode === 'live' ? 'Live retrieval' : 'Local ranker (seeded library)'}`,
    '',
    `Cases run: **${runs.length} of ${casesFor(mode).length}**${runs.length < casesFor(mode).length ? ' (partial run: do not record as a baseline)' : ''}.`,
    '',
    ...requestLine(runs),
    ...(mode === 'live'
      ? [
          `Degraded cases (a provider failed): **${degraded}** of ${runs.length}. Rerun before recording a baseline if this is not 0.`,
          '',
        ]
      : []),
    '### By category',
    '',
    ...SUMMARY_HEADER,
    ...groupRows(runs, (c) => c.category),
    '',
    '### By flag and origin',
    '',
    ...SUMMARY_HEADER,
    ...flagRows(runs),
    ...groupRows(runs, (c) => `origin: ${c.origin}`),
    '',
    '### Per case',
    '',
    ...caseRows(mode, runs),
    '',
  ];
}

export function renderReport(
  generatedAt: string,
  sections: readonly { mode: EvalMode; runs: readonly CaseRun[] }[],
): string {
  const excluded = EVAL_CASES.filter((c) => c.status !== 'scored');
  return [
    `# Search evaluation, ${generatedAt.slice(0, 10)}`,
    '',
    `Generated ${generatedAt} by \`src/test/search-eval/live.eval.ts\`. Definitions: \`docs/SEARCH_RANKING.md\` ("Evaluation set").`,
    `Set: ${EVAL_CASES.length} cases, ${EVAL_CASES.length - excluded.length} scored. Live runs hit real providers, so numbers drift as Wikipedia changes.`,
    '',
    '## Summary',
    '',
    ...SUMMARY_HEADER,
    ...sections.map(({ mode, runs }) => summaryRow(mode, runs)),
    '',
    ...sections.flatMap(({ mode, runs }) => modeSection(mode, runs)),
    '## Excluded from scoring',
    '',
    '| ID | Query | Status | Note |',
    '|---|---|---|---|',
    ...excluded.map(
      (c) => `| ${c.id} | ${cell(c.query)} | ${c.status} | ${cell(c.note ?? c.reference)} |`,
    ),
    '',
  ].join('\n');
}
