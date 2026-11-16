import { readFileSync } from 'node:fs';
import { isExactTitle } from '../../services/retrieval/rerank';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import { summarize, type Summary } from './metrics';
import type { EvalCase } from './queries';
import { casesFor, meaningIds, scoringIds, toRun, type CaseRun } from './report';
import { SNAPSHOT_PATH, type Snapshot } from './snapshot';

export type Order = (query: string, candidates: RetrievedCandidate[]) => RetrievedCandidate[];

export const keepOrder: Order = (_query, candidates) => candidates;

export function loadSnapshot(path: string = SNAPSHOT_PATH): Snapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
}

/** Wikiquote page ID to Wikidata item, without the pages that have none. */
function wikiquoteItems(snapshot: Snapshot): Map<string, string> {
  return new Map(
    Object.entries(snapshot.wikiquoteQids).flatMap(([page, qid]) => (qid ? [[page, qid]] : [])),
  );
}

/** Live cases that were captured without a provider failing, in eval-set order. */
export function capturedCases(snapshot: Snapshot): EvalCase[] {
  return casesFor('live').filter((c) => {
    const captured = snapshot.cases[c.id];
    return captured !== undefined && captured.failures.length === 0;
  });
}

/** Scores `order` over each case's candidate list, exactly as the live benchmark scores `retrieve()`. */
export function scoreLists(
  items: ReadonlyMap<string, string>,
  cases: readonly EvalCase[],
  order: Order,
  candidatesOf: (evalCase: EvalCase) => readonly RetrievedCandidate[],
): CaseRun[] {
  return cases.map((evalCase) => {
    const ordered = order(evalCase.query, [...candidatesOf(evalCase)]);
    const results = ordered.map((c) => ({ id: c.id, title: c.title }));
    return toRun(evalCase, 'live', results, 0, [], items);
  });
}

/** Scores `order` over the snapshot's raw lists. */
export function scoreSnapshot(
  snapshot: Snapshot,
  cases: readonly EvalCase[],
  order: Order,
): CaseRun[] {
  return scoreLists(
    wikiquoteItems(snapshot),
    cases,
    order,
    (c) => snapshot.cases[c.id]?.candidates ?? [],
  );
}

export const summaryOf = (runs: readonly CaseRun[]): Summary => summarize(runs.map((r) => r.score));

/**
 * Cases where an acceptable candidate's title is exactly the query (disambiguator removed): the
 * reranker must never push such an answer further down than the arrival order had it.
 */
export function exactTitleCases(snapshot: Snapshot, cases: readonly EvalCase[]): EvalCase[] {
  const items = wikiquoteItems(snapshot);
  return cases.filter((evalCase) => {
    const accepted = new Set(evalCase.meanings.flatMap((m) => [...meaningIds(m, 'live')]));
    const candidates = snapshot.cases[evalCase.id]?.candidates ?? [];
    return candidates.some((c) => {
      const [id] = scoringIds([c.id], items);
      return accepted.has(id as string) && isExactTitle(evalCase.query, c);
    });
  });
}

export interface RankChange {
  id: string;
  query: string;
  before: number | null;
  after: number | null;
}

/** Cases whose rank got worse (null counts as worst) between two runs of the same cases. */
export function worsened(before: readonly CaseRun[], after: readonly CaseRun[]): RankChange[] {
  const worse = (a: number | null, b: number | null) => (b ?? Infinity) > (a ?? Infinity);
  return before.flatMap((run, index) => {
    const next = after[index] as CaseRun;
    return worse(run.score.rank, next.score.rank)
      ? [
          {
            id: run.evalCase.id,
            query: run.evalCase.query,
            before: run.score.rank,
            after: next.score.rank,
          },
        ]
      : [];
  });
}

export function improved(before: readonly CaseRun[], after: readonly CaseRun[]): RankChange[] {
  return worsened(after, before).map((c) => ({ ...c, before: c.after, after: c.before }));
}
