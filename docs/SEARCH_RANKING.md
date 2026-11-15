# Search ranking and reranking plan

Owner input 2026-11-15, checked against spec §4–§6. A plan, not yet implemented beyond step 0.

## Pipeline (each layer its own module, replaceable)

| Layer | Job | Today | Next |
|---|---|---|---|
| **Retrieval** | Find possibly relevant references | Local: in-memory scan (`src/domain/ranking.ts`). Online: Wikipedia, Wikidata, Wiktionary adapters (`src/services/retrieval/`) | MiniSearch for local full-text, **only if the benchmark below shows a gain** |
| **Ranking** | Order candidates | Deterministic tiers: exact title > exact alias > title prefix > alias prefix > partial; tie-break title, then ID | Unchanged contract: exact-match priority must survive any engine swap |
| **Reranking** | Separate similar phrases, memes, works and plain sayings | None beyond tiers; online order follows Wikipedia's rank | Transparent scoring function (signals below); no LLM score until Phase 3, never as verification |
| **Presentation** | Show why a result is there | "Matched “…”" note; curated and online results in separate sections | Match-reason label on every card; highlight matched words without altering quotes |

## Rules
- Exact title and exact alias matches always outrank lexical-relevance or fuzzy scores.
- Source credibility is not textual relevance: a verified but irrelevant result must never outrank an
  exact, relevant one.
- No popularity signal until there is a sourced popularity metric (none today).
- Curated and unverified results stay visually separate; reranking happens within each section.
- Never use a model-generated confidence as factual verification (spec §5 Phase 3).
- Don't add two search libraries that do the same job without a measured benefit.

## Starting reranker signals (heuristics, not validated weights)

| Signal | Starting weight |
|---|---|
| Exact title or quote match | +100 |
| Exact alias match | +90 |
| Lexical relevance (engine score, normalised) | +0 to 50 |
| Category or context match (e.g. the query says "cartoon" and the type is Cartoon) | +20 |
| Supported evidence | +15 |
| Weak fuzzy match | lowest |

Tune only against the evaluation set.

## Match reasons shown to users

| `MatchKind` | Label |
|---|---|
| `exact_title` | Exact title |
| `exact_alias` | Also known as “…” |
| `title_prefix` / `alias_prefix` | Starts with your search |
| `partial` | Possible match |
| online candidate | Found online · unverified |

## Evaluation before any algorithm change
- Labelled set of **≥30 queries** in `src/test/search-eval/` (data file plus a deterministic
  test): exact quotes, misremembered quotes ("that cartoon where someone says what's up doc"),
  ambiguous phrases, memes, slang, cartoons, films, Indian pop culture.
- Each query lists the acceptable reference IDs and whether ambiguity must be shown.
- Metrics: **Recall@5, MRR@10, incorrect-top-result rate, ambiguity coverage, latency**.
- Record the current ranker's numbers as the baseline in this file; a candidate engine is adopted
  only if it beats the baseline without regressing exact-match cases.

## Order of work
Owner decision 2026-11-15: only step 1 is in Phase 2; steps 2–5 start in Phase 3.

0. Plan recorded (this file).
1. **Phase 2:** match-reason labels (small, no new dependency).
2. **Phase 3:** evaluation set and metrics harness; record the baseline. The same labelled set is
   reused for the Phase 3 curation/LLM benchmark (spec §5).
3. **Phase 3:** MiniSearch spike behind the same `rankReferences`-style interface; compare against
   the baseline.
4. **Phase 3:** domain reranker with the signals above, tuned on the set.
5. **Phase 3+:** Transformers.js semantic matching, then Orama only if hybrid search is needed;
   all benchmark-gated.

## Library roles (owner question, 2026-11-15)

| Library | Role | Decision |
|---|---|---|
| MiniSearch | Local full-text: typo/prefix tolerance, relevance within tiers | Adopt if it beats the baseline on the eval set |
| Fuse.js | Typo tolerance | Skip: duplicates MiniSearch |
| Orama | Full-text + vector/hybrid | Later, as a *replacement* for MiniSearch if hybrid search proves worth it |
| Transformers.js | On-device embeddings for meaning-based matching | Phase 3 trial, benchmark-gated |
| WebLLM | On-device explanation generation from retrieved evidence (curation) | Phase 3 trial, benchmark-gated, consent before download |

None of these decides which cultural reference is correct; the domain reranker still does.

## WebAssembly
- No hand-written WASM: today's latency is network-bound (Wikimedia round trips), and local search
  over hundreds of records is sub-millisecond in JS.
- WASM enters only via Phase 3 ML libraries (ONNX Runtime Web, WebLLM). Run them in a Web Worker,
  lazy-load after consent, keep weights out of IndexedDB records, and add `'wasm-unsafe-eval'` to
  the CSP only then. Multithreaded WASM needs COOP/COEP headers on the host.
- Revisit only if Phase 5 profiling shows a measured JS hotspot.
