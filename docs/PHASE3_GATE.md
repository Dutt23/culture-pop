# Phase 3 gate (2026-11-16): approved by the owner

**Approved 2026-11-16.** The owner approved Phase 3 and Phase 4 to start. No phone run is needed
for the model, which is not achieved and off; installing and offline use on the phone are checked
in Phase 5.

Spec §5 Phase 3 gate: _validate 30-case corpus, provenance, model fallback, consent, persistence and
errors._ Every phase also needs: code committed, actual commands and results, a mobile visual
walkthrough, a changed-file summary, `BUILD_PROGRESS.md`, `DECISIONS.md`, unresolved issues, and
**STOP FOR OWNER REVIEW**.

Phase 3 commits: `0edb998` (phase 3 done), `0bd8b3d` (test queries), `9eb28a3`, `5ac3779` (phase 3
and Parallel), `86eaaef` (favourites from cards, saved links). All committed by the owner.

## Gate criteria

| Criterion          | Evidence                                                                                                                                                                                                                                                                                            | Status                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **30-case corpus** | `src/test/search-eval/queries.ts`: 109 cases, 98 scored, 22 ambiguous, 25 Indian, 11 misremembered, 4 question rows. `queries.test.ts` checks IDs, size targets, answers, ambiguity, QIDs. Live runs in `docs/SEARCH_RANKING.md`; offline runs in `docs/eval/`                                      | ✅                                 |
| **Provenance**     | Deterministic curator (D36, D38): every claim cites its sources; missing source → `unverified` + "Not verified:"; a claim citing nothing is never supported; a year without its source is dropped. Seen live: Doctor Doom's page cites Wikidata for each fact and quotes Wikipedia with its licence | ✅                                 |
| **Model fallback** | The app works fully without the model; nothing outside `src/features/dev/` imports `src/services/llm/` (`check:dist` clean). The model is **not achieved** for Phase 3 (below)                                                                                                                      | ✅ fallback; ❌ model not achieved |
| **Consent**        | Online search asks first (e2e `retrieval.spec.ts`, seen live); wider web search has its own consent card and access code (seen live); the model never loads without consent for the exact download                                                                                                  | ✅                                 |
| **Persistence**    | Dexie v1→v6 upgrade tests; favourites, saved links and settings survive reopen; history expires and clears; saved online results show "Saved <date>" with Refresh (seen live)                                                                                                                       | ✅                                 |
| **Errors**         | One failed provider is named while others show; total failure has Retry; offline states; 429 honours Retry-After; settings save failure reverts; model crash/timeout ends the worker without retry; wider web: locked, daily cap, provider failure each have a message                              | ✅                                 |

## Phase 3 build items

| Item                                                                                | Status                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic, evidence-based curator                                               | ✅ D36, D38                                                                                                                                                                                                                                                                                                                                                      |
| On-device model benchmarked on ≥30 queries incl. Indian pop culture                 | ❌ **Not achieved** (D47). Mac smoke run, Qwen3 0.6B: fast, but 30% of sentences grounded (target 70%), spoiler judging always "unsure", rewrites echo the prompt (`docs/eval/llm-bench-2026-11-16-mac-qwen3-0.6b.md`). Research says an LLM isn't needed for "what is this" (`docs/research/explainer-products.md`). Not run on a phone; the owner chose not to |
| Model enabled only if it passes                                                     | ✅ Not enabled                                                                                                                                                                                                                                                                                                                                                   |
| Consent before large downloads; lazy load; weights out of IndexedDB                 | ✅                                                                                                                                                                                                                                                                                                                                                               |
| LLM output contract                                                                 | ✅ D39 (code kept, off)                                                                                                                                                                                                                                                                                                                                          |
| Search: baseline, reranker, MiniSearch, sound-alike typos                           | ✅ D40, D41                                                                                                                                                                                                                                                                                                                                                      |
| Query rewriting without AI                                                          | ✅ D43; small gain (Recall@5 80.4% → 81.4% offline), `docs/eval/rewrite-offline.md`                                                                                                                                                                                                                                                                              |
| Session cache and shared lookups                                                    | ✅                                                                                                                                                                                                                                                                                                                                                               |
| Comics and games                                                                    | ✅ D38                                                                                                                                                                                                                                                                                                                                                           |
| Question-style searches                                                             | ✅ D44                                                                                                                                                                                                                                                                                                                                                           |
| Wider web search through our server (Parallel), access code, best-sentence snippets | ✅ D45; live-tested with a real key                                                                                                                                                                                                                                                                                                                              |
| Favourite from cards, saved web links                                               | ✅ D46; live-tested                                                                                                                                                                                                                                                                                                                                              |

## Commands and results

Run by the agent at the owner's request on 2026-11-16 (Node 22.21.1), on `86eaaef` plus the fixes
for issues 1–3 below (not yet committed):

| Command              | Result                                                                           |
| -------------------- | -------------------------------------------------------------------------------- |
| `npx tsc -b`         | No errors                                                                        |
| `npm run lint`       | 0 errors, 5 warnings (react-refresh export warnings in context files, unchanged) |
| `npm test`           | 43 files, **767 passed**                                                         |
| `npm run test:e2e`   | **24 passed** (360 px and 390 px projects); build warns the main chunk is 635 KB |
| `npm run check:dist` | Clean: 18 files, no test code, fixtures, dev pages or source maps                |
| `npx vitest run api` | 84 passed (backend)                                                              |

Not run this time: `npm run audit:gate`, `npm run format:check` (fails only on
`docs/DECISIONS.md`, which was never fully Prettier-aligned; formatting it would pad the file to
~430 KB).

## Mobile walkthrough (agent, built-in browser, dev server with API, 2026-11-16)

At **360 × 780** and **390 × 844**; no page scrolls sideways at either width.

| Screen                                     | Result                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discover                                   | Hero, search, "Surprise me", Browse by era ✅                                                                                                                |
| Search, empty                              | Recent searches chip, suggestion chips ✅                                                                                                                    |
| Search "doctor doom", first time           | Online consent, then results; "5 new results, tap to show" ✅; hearts on all 8 cards once saved ✅; **issue 1** below                                        |
| Doctor Doom page                           | Comics card: creators, first appearance, quote with licence, Fandom / Comic Vine / Marvel.com links ✅; **issue 2** below                                    |
| Search "doctor doom", again                | Doctor Doom first, "Saved 16 Nov 2026", Refresh, "Not what I meant" ✅                                                                                       |
| Search "harley quin joker"                 | "Also searched 'harley quinn joker', Wikipedia's suggestion" ✅; **issue 3** below                                                                           |
| Wider web "why are ferrari fans depressed" | Consent card, access code, 10 real results with best-sentence snippets, heart saves title + URL only, shows under Favourites → Saved web links, removable ✅ |
| Favourites, Settings                       | Hearts, saved links section, updated privacy text ✅                                                                                                         |

Not verified: "Your regulars" (needs repeated searches over days), offline mode on a real phone, the
app on the vivo X Fold5 itself, the production build on Vercel.

## Issues found in the walkthrough

1. **Fixed: main answer below quote pages.** "doctor doom": Wikiquote answered first, so three quote
   pages showed before the Doctor Doom page, which arrived in "N new results" and then landed 4th.
   Now the button names the late answer ("5 new results, including “Doctor Doom”, tap to show",
   seen live), and tapping it puts held pages named like the search on top; the cards already shown
   keep their order and other new ones go below them (`useHeldResults`, `SearchPage`,
   `OnlineResults`). Cards still never move without a tap (D37). A first try re-sorted the whole list
   on tap; a test showed that can push a correct card already on screen down, so only pages named
   like the search move up. The wrong-order case depends on which site answers first, so it is
   covered by unit and app tests, not forced live.
2. **Fixed: repeated works.** "From: Fantastic Four, Fantastic Four, Fantastic Four" and the same in
   the "Appears in" sentence: different Wikidata items share the name (comic, films). Each name now
   shows once (`distinctWorks` in `domain/labels.ts`, used by the card and the curator). Seen live:
   "From: Fantastic Four" and "Appears in “Fantastic Four” (Wikidata)." Explanations saved before
   the fix are rebuilt on their next successful save (Refresh).
3. **Fixed: spelling fix ranked low.** For "harley quin joker", Wikipedia's first hit is Harlequin
   and its suggestion "harley quinn joker" gives Harley Quinn; both scored as first place and the
   tie went to the misspelled search. Rule 4 in `rerank.ts`: a "did you mean" search's hits win
   ties. Seen live: Harley Quinn first, then Harlequin. Not re-measured on the offline eval.
4. **Open:** main JavaScript chunk 635 KB (build warning); splitting would speed up the first load.

## Owner decisions still open

- A project contact for the `Api-User-Agent` header (D29).
- Keep or remove the 20 demo entries.
- Delete `.cache/` (176 MB, embedding experiment, git-ignored, unused).
- Optionally email Parallel about keeping results on the searcher's device.

## STOP FOR OWNER REVIEW

Phase 3 is ready for review with the model **not achieved**, issues 1–3 fixed (all checks above
pass with the fixes) and issue 4 open.
