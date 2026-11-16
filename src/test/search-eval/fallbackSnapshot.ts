/**
 * Test-only capture of what each query-rewriting fallback returned for the cases the plain search
 * missed (D43), so the fallbacks can be compared offline. Capture:
 *   npx vitest run --config vitest.eval.config.ts src/test/search-eval/fallbacks.eval.ts
 * Like `snapshot.ts`, the candidates keep their sources (url, title, publisher, licence), and
 * nothing in the app imports this file.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { RetrievedCandidate, Rewrite, RewriteKind } from '../../services/retrieval/types';

export interface FallbackRun {
  /** What the fallback searched for. */
  rewrite: Rewrite | { kind: 'loose_quotes'; text: string } | undefined;
  /** The whole raw list with this fallback allowed (plain search plus fallback, tagged `via`). */
  candidates: RetrievedCandidate[];
  /** HTTP requests this fallback made on top of the plain search (0: it did not apply). */
  extraRequests: number;
}

export interface FallbackCase {
  query: string;
  /** The plain search, captured in the same session as the fallbacks. */
  primary: RetrievedCandidate[];
  failures: string[];
  /** Keyed by fallback kind; `loose_quotes` is only in the capture, from the fallback that was tried and dropped. */
  fallbacks: Partial<Record<RewriteKind | 'loose_quotes', FallbackRun>>;
}

export interface FallbackSnapshot {
  capturedAt: string;
  note: string;
  /** Wikiquote page ID to Wikidata item for the Wikiquote pages in these lists (null: none). */
  wikiquoteQids?: Record<string, string | null>;
  cases: Record<string, FallbackCase>;
}

export const FALLBACK_SNAPSHOT_PATH = resolve('src/test/search-eval/snapshot/fallbacks.json');

const NOTE =
  'Raw retrieve() candidates per missed eval case, plain and with each fallback. Text is CC BY-SA 4.0 / CC0; ' +
  'each candidate carries its sources for attribution. Test data only.';

export function writeFallbackSnapshot(path: string, cases: Record<string, FallbackCase>): void {
  const snapshot: FallbackSnapshot = { capturedAt: new Date().toISOString(), note: NOTE, cases };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot));
}

export function loadFallbackSnapshot(path: string = FALLBACK_SNAPSHOT_PATH): FallbackSnapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as FallbackSnapshot;
}
