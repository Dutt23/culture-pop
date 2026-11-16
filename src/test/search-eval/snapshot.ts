/**
 * Test-only snapshot of what live `retrieve()` returned for every scored case, so rerankers can be
 * tuned offline and deterministically instead of hitting Wikimedia on every try.
 * Capture: `EVAL_SNAPSHOT=1 npx vitest run --config vitest.eval.config.ts`.
 *
 * The candidates keep their `sources` (url, title, publisher, license, retrieval time): the text
 * in them comes from Wikipedia, Wikidata, Wiktionary and Wikiquote (CC BY-SA 4.0 / CC0), so the
 * attribution travels with it. Nothing in the app imports this file; it lives under `src/test/`,
 * which `scripts/check-dist.js` forbids in `dist/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { RetrievedCandidate } from '../../services/retrieval/types';

export interface SnapshotCase {
  query: string;
  /** In the order `retrieveRaw()` returned them: the providers' order, before any reranking. */
  candidates: RetrievedCandidate[];
  /** Providers that failed for this capture; non-empty means the case is degraded. */
  failures: string[];
}

export interface Snapshot {
  capturedAt: string;
  note: string;
  /** Wikiquote page ID to Wikidata item, for scoring `enwikiquote:` candidates (null: none). */
  wikiquoteQids: Record<string, string | null>;
  cases: Record<string, SnapshotCase>;
}

/** Relative to the repo root, where vitest runs (a file URL is not available under jsdom). */
export const SNAPSHOT_PATH = resolve('src/test/search-eval/snapshot/candidates.json');

const NOTE =
  'Raw retrieve() candidates per eval case (Wikipedia, Wikidata, Wiktionary, Wikiquote, TVmaze). ' +
  'Text is CC BY-SA 4.0 / CC0; each candidate carries its sources for attribution. Test data only.';

export function writeSnapshot(
  path: string,
  cases: Record<string, SnapshotCase>,
  wikiquoteQids: ReadonlyMap<string, string | null>,
): void {
  const snapshot: Snapshot = {
    capturedAt: new Date().toISOString(),
    note: NOTE,
    wikiquoteQids: Object.fromEntries(wikiquoteQids),
    cases,
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot));
}
