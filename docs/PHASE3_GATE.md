# Phase 3 gate checklist (draft, 2026-11-16)

Spec §5 Phase 3 gate: *validate 30-case corpus, provenance, model fallback, consent, persistence and
errors.* Every phase also needs: code committed, actual commands and results, a mobile visual
walkthrough, a changed-file summary, `BUILD_PROGRESS.md`, `DECISIONS.md`, unresolved issues, and
**STOP FOR OWNER REVIEW**. Draft prepared while step 3's benchmark runs; fill the open rows at the
gate.

## Gate criteria

| Criterion | Evidence | Status |
|---|---|---|
| **30-case corpus** | `src/test/search-eval/queries.ts`: 109 cases, 98 scored, 22 ambiguous, 25 Indian, 11 misremembered. `queries.test.ts` checks unique IDs, size targets, an answer for every scored case and two meanings for every ambiguous case, well-formed QIDs, seed IDs. Baseline and step 4 live runs in `docs/SEARCH_RANKING.md` | ✅ |
| **Provenance** | Deterministic curator (D36, D38): every claim cites its sources; missing source → `unverified` + "Not verified:"; a claim citing nothing is never supported; a year without its source is dropped (and cleared on write). Cache eligibility: supported may resolve offline, unverified never, loses eligibility when its source goes (`curate.test.ts`) | ✅ |
| **Model fallback** | The app works fully without the model: it is unreachable for users (nothing outside `src/features/dev/` imports `src/services/llm/`). `detectSupport` refuses no WebGPU, no adapter, low memory, small GPU limits; status stream off → loading → ready → off, failure → unavailable with no retry (`llm.test.ts`) | ✅ code; ⏳ **not verified on a device** |
| **Consent** | Online search asks first (Phase 2, e2e `retrieval.spec.ts`); the model refuses to load without consent for that exact model and byte count and starts no worker; "Delete downloaded files" no longer downloads (step 5 review fix) | ✅ |
| **Persistence** | Real v1→v2→v3→v4 upgrade tests; favourites and settings survive reopen; cached results stored as structured records without the query; history records, expires and clears (`db.test.ts`) | ✅ |
| **Errors** | One failed provider is named while others still show; total failure explained with Retry; offline states; 429 retries honour Retry-After, then `rate_limited`; settings save failure reverts; model crash, timeout and context overflow terminate the worker without a retry loop (`app.test.tsx`, `http.test.ts`, `llm.test.ts`) | ✅ |

## Phase 3 build items

| Item | Status |
|---|---|
| Deterministic, evidence-based curator | ✅ D36, D38 |
| On-device model benchmarked on ≥30 queries incl. Indian pop culture | ⏳ Harness and dev bench built (D39); **not run on a phone**. If no device passes, ship the curator and mark the model **not achieved** (spec wording) |
| Model enabled only if quality, compatibility, size, memory and latency pass | ✅ Not enabled |
| Consent before large downloads; lazy load; weights out of IndexedDB | ✅ Cache API, worker after consent |
| LLM contract: output has meaning, context, example, spoiler label, uncertainty, support IDs | ✅ Fixed 2026-11-16: structured fields with support IDs; example only when quoted from evidence; spoiler fails closed; uncertainty never counts as verification; `toInterpretation()` always gives `model_suggested` (D39). Unit tests pass; typecheck and lint to rerun |
| Search: baseline, reranker, MiniSearch, sound-alike typos (steps 1, 4) | ✅ D40, D41; live: Recall@5 78.6% → 80.6%, wrong first 32.7% → 29.6% |
| Query rewriting without AI (step 3) | ⏳ Built; benchmark pending |
| Session cache and shared lookups (step 2) | ✅ |
| Comics and games (step 6) | ✅ D38 |

## Owner decisions that change the spec (to confirm at the gate)

- **Search history ON by default** (D37). Spec §4 says no query history in any phase; the owner made
  the explicit product decision the spec requires. Disclosed in the consent card and Settings.
- **Website-only until a backend phase**: wider web search, Genius, Comic Vine, IGDB, Supabase,
  Parallel are deferred.
- **Speed over measured order**: first results show immediately; later batches wait behind
  "N new results" (D40).
- **Online reranker keeps Wikipedia's first hit on top** (Rule 1 rewritten, D40).
- **Provider names removed** from privacy wording; citations still name sources (licence).

## Still to do before STOP FOR OWNER REVIEW

1. Step 3 numbers recorded and reviewed; full checks rerun.
2. Phone run of `/dev/llm-bench` (owner): or mark the model **not achieved** for Phase 3.
3. Mobile visual walkthrough at 360 px and 390 px of the Phase 3 features: comics/games cards, fact
   sentences, "N new results", "Saved <date>" + Refresh, "Not what I meant", history chips,
   "Your regulars", fallback notes. Anything not tested marked **not verified**.
4. Commands and results, changed-file summary.
5. Commit (owner says when).
6. Owner decisions still open: `Api-User-Agent` project contact, the 20 demo entries, deleting
   `.cache/` (176 MB, git-ignored).
