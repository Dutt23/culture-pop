/**
 * Adds the Wikidata item of every Wikiquote page in the fallback capture, so a Wikiquote page of the
 * right work can be scored as correct (see `scoringIds`). Run once after `fallbacks.eval.ts`:
 *   npx vitest run --config vitest.eval.config.ts src/test/search-eval/fallbackQids.eval.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { wikiquotePageId } from '../../domain/sources';
import { createEvalGetJson } from './evalHttp';
import { FALLBACK_SNAPSHOT_PATH, type FallbackSnapshot } from './fallbackSnapshot';
import { loadSnapshot } from './rerankEval';
import { resolveWikiquoteQids } from './wikiquoteItems';

it('resolves Wikiquote pages to Wikidata items', async () => {
  const snapshot = JSON.parse(readFileSync(FALLBACK_SNAPSHOT_PATH, 'utf8')) as FallbackSnapshot;
  // Pages the main snapshot already resolved are reused; only new ones cost a request.
  const cache = new Map<string, string | null>(Object.entries(loadSnapshot().wikiquoteQids));
  const pages = Object.values(snapshot.cases)
    .flatMap((c) => [c.primary, ...Object.values(c.fallbacks).map((f) => f.candidates)].flat())
    .flatMap((candidate) => wikiquotePageId(candidate.id) ?? []);
  const failures = await resolveWikiquoteQids(createEvalGetJson(), [...new Set(pages)], cache);
  writeFileSync(
    FALLBACK_SNAPSHOT_PATH,
    JSON.stringify({ ...snapshot, wikiquoteQids: Object.fromEntries(cache) }),
  );
  expect(failures).toEqual([]);
}, 600000);
