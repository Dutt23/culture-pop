# Search ranking and reranking plan

Owner input 2026-11-15, checked against spec §4–§6. A plan, not yet implemented beyond step 0.

## Pipeline (each layer its own module, replaceable)

| Layer | Job | Today | Next |
|---|---|---|---|
| **Retrieval** | Find possibly relevant references | Local: in-memory scan (`src/domain/ranking.ts`). Online: Wikipedia, Wikidata, Wiktionary adapters (`src/services/retrieval/`) | MiniSearch for local full-text, **only if the benchmark below shows a gain** |
| **Ranking** | Order candidates | Deterministic tiers: exact title > exact alias > title prefix > alias prefix > partial; tie-break title, then ID | Unchanged contract: exact-match priority must survive any engine swap |
| **Reranking** | Separate similar phrases, memes, works and plain sayings | Online: `rerankCandidates` (Wikipedia's order, corrected by a dictionary-entry rule and an exact-title nudge, D40). Local: tiers, then typo and sound-alike matches (D40, D41) | Transparent scoring function (signals below); no LLM score until Phase 3, never as verification |
| **Presentation** | Show why a result is there | "Matched “…”" note; curated and online results in separate sections | Match-reason label on every card; highlight matched words without altering quotes |

## Rules
- **Local search:** exact title and exact alias matches always win. The tiers run first and keep their
  order; typo and sound-alike matches (MiniSearch) are only ever added after them, labelled "Similar
  spelling" / "Sounds like your search", and never count as resolving a query, so such a search
  still goes online.
- **Online results** (owner-visible rule change, 2026-11-16, D40): Wikipedia's own order is kept, so
  Wikipedia's first hit stays on top even when another candidate is named exactly like the query
  (for "cash me outside", Bhad Bhabie stays above "Cash Me Outside (song)", and that is the right
  order). An exact title reorders everything *below* the first hit. A Wiktionary entry for exactly
  the query goes first unless some Wikipedia page is named exactly like the query. This replaces the
  earlier wording "exact matches always outrank", which was measured to be wrong online.
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

**Outcome (2026-11-16, D40):** of these signals only two survived tuning, in a changed form: the
exact title (as a small nudge that never beats Wikipedia's first hit) and a dictionary-entry
bonus. Lexical closeness, word order and the category/phrase-kind fit did not help on the tuning
half and were left out. See "Results after the baseline".

## Match reasons shown to users

| `MatchKind` | Label |
|---|---|
| `exact_title` | Exact title |
| `exact_alias` | Also known as “…” |
| `title_prefix` / `alias_prefix` | Starts with your search |
| `partial` | Possible match |
| `typo` | Similar spelling |
| `sound` | Sounds like your search |
| online candidate | Found online · unverified |

## Evaluation before any algorithm change
- Labelled set of **≥30 queries** in `src/test/search-eval/` (data file plus a deterministic
  test): exact quotes, misremembered quotes ("that cartoon where someone says what's up doc"),
  ambiguous phrases, memes, slang, cartoons, films, Indian pop culture.
- Each query lists the acceptable reference IDs and whether ambiguity must be shown.
- Metrics: **Recall@5, MRR@10, incorrect-top-result rate, ambiguity coverage, latency**.
- Record the current ranker's numbers as the baseline in this file; a candidate engine is adopted
  only if it beats the baseline without regressing exact-match cases.

## Evaluation set

Code: `src/test/search-eval/`. Written and first run 2026-11-15 (numbers in "Baseline").

| File | What it is |
|---|---|
| `queries.ts` | 109 labelled cases (98 scored) |
| `metrics.ts` | Pure metrics, unit-tested in `metrics.test.ts` (part of `npm test`) |
| `queries.test.ts` | Data checks: unique IDs, size targets, QID format, local IDs exist in the seed (part of `npm test`) |
| `report.ts` | Maps cases to result IDs, builds the markdown report |
| `live.eval.ts` + `vitest.eval.config.ts` | The benchmark; never part of `npm test` |

### How cases were labelled

- **Demand rows** (60: IDs M, S, Q, T, F, B, A, I): one per row of `docs/research/query-demand.md`,
  with its query as typed, canonical reference, category and evidence link.
- **Variants** (12, `-v` IDs): the misremembered and reworded forms tested in that research, with
  the same answers. `misremembered` marks a typed form that is a misquote, mishearing or
  misspelling (e.g. "bilkul ricks", "luke i am your father"), not a mere rewording.
- **Coverage rows** (37, X and L IDs): added to reach ≥30 ambiguous or Indian cases and to give the
  local mode something to score. They have **no demand evidence**. L rows also exist in the seeded
  demo library.
- **Acceptable answers** are grouped into *meanings*. A meaning lists Wikidata QIDs, exact
  Wiktionary titles and/or seed reference IDs. Accepted: the reference's own item or entry; when
  it has none, the single work it comes from or is about (e.g. Breaking Bad for "waltuh", the film
  for a Bollywood dialogue). Not accepted: person pages for a person's line (I7, I8), parent
  concepts (Chad for "gigachad"), disambiguation pages, Wikiquote pages.
- `ambiguous` means several distinct meanings must be shown (e.g. "hera pheri": 1976 and 2000
  films; "show me the money": Jerry Maguire and the Korean rap show).
- **Verification:** every QID came from a live anonymous lookup on 2026-11-15 (enwiki `pageprops`
  for the page's `wikibase_item`, then Wikidata `wbgetentities` labels; five items without an
  enwiki page via `wbsearchentities`), header `Api-User-Agent: PopCultureDecoder-dev/0.2`.
  Wiktionary titles were checked with `prop=info`. Not scored: 5 `unverified` cases (canonical
  unresolved or resting on one Reddit comment: T2, T3, I9, I10, I11) and 6 `no_target` cases
  (verified reference with no item or entry to match: M4, M5, S4, S5, I7, I8).

| Scored cases | Count |
|---|---|
| quote / meme / film / music / slang / tv / anime_game | 40 / 20 / 12 / 11 / 6 / 6 / 3 |
| misremembered | 11 |
| ambiguous (live-scorable: 21) | 22 |
| Indian pop culture | 25 |
| ambiguous or Indian | 36 |
| local mode (also in the seed) | 14 |

### Metric definitions

For each case, the result list is `retrieve()` candidates in returned order, before the search
page merges them with local matches (live), or `rankReferences` matches (local). A result is *acceptable* if its ID is in any
meaning (`wd:<QID>`, `enwiktionary:<title>`, or the seed ID). `rank` = 1-based position of the
first acceptable result. All rates are over the scored cases in the group.

| Metric | Definition |
|---|---|
| Recall@5 | Share of cases with `rank ≤ 5` (one relevant item per case, so this is success@5) |
| MRR@10 | Mean of `1/rank` when `rank ≤ 10`, else 0 |
| Incorrect-top-result rate | Share of cases whose list is non-empty and whose first result is not acceptable |
| No-result rate | Share of cases with an empty list (with the two above and "correct top", sums to 100%) |
| Ambiguity coverage | Over cases flagged `ambiguous` that have ≥2 meanings with IDs in this mode: share with ≥2 distinct meanings in the top 5 |
| Latency | Nearest-rank p50 / p90 / p95 / max of wall-clock ms per query (live: whole `retrieve()` call including retries; local: the `rankReferences` call) |

A Wikiquote candidate (`enwikiquote:<pageid>`) is scored as the Wikidata item of its page. The
live benchmark asks en.wikiquote.org for each page's `wikibase_item` (`prop=pageprops`, batched
50 at a time, cached for the run, outside the latency timer), and the candidate is acceptable when
that item is in one of the case's meanings. So the Wikiquote page "Sholay" is correct for "kitne
aadmi the". A Wikiquote page with no item, or whose lookup failed (the case is then listed as
degraded), stays unacceptable. Wikipedia pages without a Wikidata item (`enwiki:<pageid>`) are
never acceptable. The report still shows the candidate's own ID. Mapping code: `scoringIds` in
`report.ts`, tested in `report.test.ts`.

### How to run

```bash
npm test
npx vitest run --config vitest.eval.config.ts
EVAL_MODE=local npx vitest run --config vitest.eval.config.ts
```

The first runs the metric unit tests and data checks. The second runs the local mode and the live
benchmark: real `retrieve()` with `createGetJson({ fetch, sleep, isOnline: () => true })` (Node has
no `navigator.onLine`), one case at a time with a 3 s pause (~10 min), and writes
`docs/eval/search-eval-<date>.md` with per-category, per-flag and per-case tables. The third skips
the network and writes `…-local.md`. The report is rewritten after every live case, so an
interrupted run leaves a partial report marked "partial run". A live report lists "degraded" cases (any provider failed,
e.g. HTTP 429); rerun before recording a baseline if that count is not 0.

Two things about running from Node, found on the first run (95 of 98 cases degraded):
- The eval sends `User-Agent: PopCultureDecoder/0.2` (no contact details), because
  `query.wikidata.org` answers 403 to Node's default User-Agent and ignores `Api-User-Agent`.
  Browsers always send a User-Agent, so the app itself is not affected.
- Wikimedia answers some bursts with HTTP 429. After the main pass, the eval re-runs only the
  degraded cases (up to 2 passes, 2 min cooldown, 10 s between cases) and replaces their entry. A
  re-run case's latency is that of its last attempt, and it still includes any 429 waits inside
  that attempt, so p95 reflects throttling as well as search speed.

Live numbers drift as Wikipedia changes, so compare engines in runs made the same day.

## Baseline

First full run, 2026-11-15, before any search engine change. Any new engine is compared against
these rows, in a run made the same day (live numbers drift as Wikipedia changes).

| Date | Mode | Engine | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage | p50 ms | p95 ms | Report |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-15 | live | Phase 2 `retrieve()` | 98 | 78.6% | 0.701 | 31.6% | 6.1% | 76.2% (21) | 1798 | 22063 | `docs/eval/search-eval-2026-11-15.md` |
| 2026-11-15 | local | `rankReferences` (tiers) | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.05 | 0.39 | `docs/eval/search-eval-2026-11-15-local.md` |

The live run had 0 degraded cases, but only after fixes (see "How to run"): the first two runs had
95 and 37 degraded cases and were thrown away. Live latency includes Wikimedia's own throttling
waits (the 3 s pause and retries after HTTP 429), so read p95 as "sometimes very slow when
throttled", not as normal app speed; p50 is the better guide.

What the live numbers say, in plain words:

- **The local number is not a quality measure.** All 14 local cases are queries the demo library was
  built to answer, so 100% is expected. The live row is the real baseline.
- **Right answer in the top 5 about 4 times in 5; wrong first result about 1 time in 3.** Of 98
  cases, 31 put something wrong first and 6 returned nothing at all.
- **Misremembered queries are the worst group by far:** only 36.4% have the right answer in the top
  5 (11 cases), and 27.3% return nothing. Example: "catch me outside" (for "cash me outside") puts
  an unrelated item called "Catch Me Outside" first and never shows Bhad Bhabie. "bilkul ricks nahi
  lene ka" returns nothing, and so does "oh my yo wa moo shin dae doo hee yun knee".
- **Worst categories:** slang (66.7% Recall@5, half of first results wrong), quotes (67.5%, and 12.5%
  return nothing), then films (91.7% Recall@5, yet 41.7% wrong first, because a remake, a character
  or a sequel often comes before the right film). Example: "gigachad" shows the generic word "Chad"
  first and the real meme sixth; "no cap" shows "Cap" first.
- **Indian pop culture is not worse on average than the rest** (80.0% vs 78.1% Recall@5), but its
  failures are stark: "paisa hi paisa hoga" returns the song "Bewafa" and "babu bhaiya paisa hi paisa
  hoga" returns the singer Hemlata, never the Hera Pheri scene; "utha le re baba" puts the shop
  "Myntra" first.
- **Ambiguous queries almost always show one valid meaning, but only 76.2% show two.** Quote
  queries are weakest (40.0%, 5 cases). Example: "devdas" and "dune" show two of three films.
- **Scoring is strict.** A few "wrong" firsts are arguably fine: "winter is coming" first returns the
  Game of Thrones episode of that name, but only the series counts as correct.

## Results after the baseline (2026-11-16)

Everything here was measured against the baseline above. Live numbers drift, so the "before" rows
are a fresh live run made the same day with the same code, not the 2026-11-15 baseline row.

How to repeat each measurement (the live runs take a long time because Wikimedia throttles bursts):

```bash
EVAL_SNAPSHOT=1 EVAL_TAG=before-rerank npx vitest run --config vitest.eval.config.ts src/test/search-eval/live.eval.ts
EVAL_TAG=reranked npx vitest run --config vitest.eval.config.ts src/test/search-eval/live.eval.ts
npx vitest run --config vitest.eval.config.ts src/test/search-eval/rerank.eval.ts   # offline, seconds
npx vitest run --config vitest.eval.config.ts src/test/search-eval/embed.eval.ts    # offline, needs the models
EVAL_MODE=local EVAL_LOCAL_ENGINE=tiers|typo|minisearch EVAL_TAG=<name> npx vitest run --config vitest.eval.config.ts src/test/search-eval/live.eval.ts
```

`EVAL_TAG` is added to the report file name. Without it, two runs on the same UTC day write the
same file and the later one overwrites the earlier (that happened once, and the 2026-11-15
baseline report had to be rebuilt by hand; see the note at the top of that file).

### Step 4a: the reranker for online results

`src/services/retrieval/rerank.ts`, called from `retrieve.ts`, so the order users see is the order
the benchmark scores. It keeps Wikipedia's own order and applies two general rules:

1. A Wiktionary entry for exactly the query goes first, unless some Wikipedia page is named exactly
   like the query (then the Wikipedia page stays ahead).
2. An exact title match (after dropping a Wikipedia disambiguator such as "(2015 film)") moves
   ahead of the lower hits, but never ahead of Wikipedia's first hit.

Ties keep arrival order. No popularity signal and no rule for any single query. Cards already on
screen still stay put (`useHeldResults`); each batch is ordered as it arrives.

**How it was tuned.** The scored live cases that were captured cleanly (97 of 98; case X3 had a
Wikidata timeout) were split by a fixed rule: cases are grouped by base row (`Q3` and `Q3-v` stay
together), and the 1st, 3rd, 5th… group is the tuning half (50 cases) while the 2nd, 4th… group is
held out (47). Settings were chosen on the tuning half only. The raw `retrieve()` lists were
captured once from the live providers (`src/test/search-eval/snapshot/candidates.json`, test-only,
with each source's licence and attribution kept) and the reranker was tuned offline on that.

| Order (offline, captured lists) | n | Recall@5 | MRR@10 | Incorrect top | Ambiguity coverage |
|---|---|---|---|---|---|
| Tuning half, Wikipedia order | 50 | 80.0% | 0.735 | 28.0% | 80.0% |
| Tuning half, reranked | 50 | 80.0% | 0.745 | 26.0% | 90.0% |
| Held-out half, Wikipedia order | 47 | 76.6% | 0.651 | 38.3% | 72.7% |
| Held-out half, reranked | 47 | 80.9% | 0.686 | 34.0% | 72.7% |
| Full set, Wikipedia order | 97 | 78.4% | 0.694 | 33.0% | 76.2% |
| Full set, reranked | 97 | 80.4% | 0.716 | 29.9% | 81.0% |

| Live, same day, today's code | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage | p50 ms | p95 ms | Report |
|---|---|---|---|---|---|---|---|---|---|
| Before the reranker | 98 | 78.6% | 0.697 | 32.7% | 6.1% | 76.2% (21) | 2416 | 22140 | `docs/eval/search-eval-2026-11-15-before-rerank.md` (1 degraded case, X3) |
| With the reranker | 98 | 80.6% | 0.719 | 29.6% | 6.1% | 81.0% (21) | 2140 | 21140 | `docs/eval/search-eval-2026-11-15-reranked.md` (2 degraded: only the Wikiquote lookup used for scoring failed in X21 and L14; no search provider failed) |

The live confirmation agrees with the offline result: Recall@5 78.6% to 80.6%, MRR@10 0.697 to 0.719,
wrong first result 32.7% to 29.6%, ambiguity coverage 76.2% to 81.0%, with the same number of empty
lists (6.1%). The two degraded cases may score slightly worse than they should (a Wikiquote page
could not be matched to its Wikidata item). Latency is Wikimedia's, and p95 includes throttling waits.

Adoption rule: held-out half improves, and no exact-title case gets worse. Both hold (0 of 36
exact-title cases worse; `rerankSnapshot.test.ts` keeps checking it as part of `npm test`).

**Order on screen can differ from the scored order (owner chose speed, 2026-11-16).** The benchmark
scores the order `retrieve()` returns once every provider has answered. On the search page each
batch is ordered on its own, and the first batch that arrives paints at once; the page then freezes
those cards (`useHeldResults`, D37), and later batches wait behind "N new results, tap to show".
When the user taps, the held cards are appended below, in the reranker's order among themselves;
cards already on screen never move. So when a fast provider answers first the order can differ: for
"dune" the dictionary entry (Wiktionary is fast) paints first and Wikipedia's pages follow it, and
for "gigachad" the order on screen is Wiktionary first only if Wiktionary beats Wikipedia. The
alternatives that were considered and not chosen: waiting for Wikipedia before the first paint,
and re-sorting the visible list until the user touches it. Both cost speed or motion; speed was
preferred. The benchmark numbers are therefore the order of the settled list, a ceiling for what
the page shows. `retrieveRaw` returns the providers' order (what the snapshot stores) and
`retrieve` is `retrieveRaw` plus `rerankCandidates` (a test checks they agree). The exact-title
guard in `rerankSnapshot.test.ts` also covers Wikiquote candidates.

What changed, in plain words:
- **"gigachad"**: before, the page "Chad (slang)" came first and the dictionary entry "gigachad"
  sixth. Now the dictionary entry is first. **"no cap"**: the plain word page "Cap" came first,
  the dictionary entry sixth; now the entry is first. **"nani"**: a footballer came first; now the
  dictionary entry does.
- **"catch me outside"** (for "cash me outside"): no change. The song "Catch Me Outside" is still
  first because the real answer, Bhad Bhabie, is not in the list at all, and no reordering can show
  something that was never found.
- **That is the main limit.** In 80.4% of cases the right answer is somewhere in the list, and
  that is the best Recall@5 any reordering could reach. 13.4% have a list with no right answer and
  6.2% have no list. The reranker reaches that ceiling on Recall@5. The wrong-first-result rate is
  still 29.9% against a floor of 13.4% (the lists with no right answer); the gap is lists where
  Wikipedia's first hit is wrong and no rule above fixes it. Closing the rest needs better
  retrieval (spelling suggestions, more queries) as well as better ordering.
- **Tried and dropped** because they made the tuning half worse or no better: word order
  (so "Break Point" does not beat "Point Break"), how many words a title shares with the query, and
  a bonus for meme, quote and phrase pages. The labelled set has no "point break" case, so that
  example is covered only by a unit test of the exact-title rule.
- **One honest caveat.** The first version let the dictionary entry beat Wikipedia pages named
  exactly like the query, which pushed three right answers down a place ("devdas", "panchayat",
  "dune"). That was found after the held-out result was seen, and the conditional rule above was
  the fix, so the held-out numbers are not a fully clean test of that last rule.

### Step 4b: MiniSearch for local search (adopted)

Added behind the same signature as `rankReferences`. The tier ranking runs first and keeps its
order, so an exact title or alias always wins; MiniSearch only adds references the tiers missed.
The 14 original local cases are all exact queries, so the tiers already scored 100% on them and
could show no gain. 28 local-only cases (`localCases.ts`: typos, swapped letters and 5 exact controls)
were added; they are scored by the local mode only.

| Local engine, 42 cases | Recall@5 | MRR@10 | Incorrect top | No results | p50 ms |
|---|---|---|---|---|---|
| Tiers only | 50.0% | 0.500 | 0.0% | 50.0% | 0.04 |
| Tiers + MiniSearch typo matching | 95.2% | 0.952 | 0.0% | 4.8% | 0.17 |
| Tiers + typo matching + sound-alike matching (adopted) | 100.0% | 1.000 | 0.0% | 0.0% | 0.19 |

- All 14 original cases and all 5 exact controls still rank first in every engine: no exact-match
  regression, and no wrong first results.
- Typing "bazingaa", "ok bomer", "winter is comming" or "hakuna matatta" used to find nothing; each
  now finds the right entry (the last one shows both meanings).
- Cost (all three passes): building the index takes 2.7 ms for 16 references (7 ms for 480, 19 ms
  for 1,600); a search takes 0.06 ms with 16 references, 0.85 ms with 480 and 2.8 ms with 1,600
  (the tiers alone: 0.03, 0.7 and 2.4 ms).
- A lone three-letter word is not allowed a typo ("zzz" otherwise matches "izz"); unrelated
  queries ("pizza recipe", "xylophone", "bazaar") return nothing (tested).
- **Review fixes (2026-11-16).** A review found that the sound pass matched short words ("ice",
  "out", "eat" sounded like "is", "it") and that those matches counted as answering the query, so
  the online search never ran. Fixed: a lone word of three letters or fewer is never matched by
  sound (a short word in a longer query still may, since the other words anchor it, so "lte it go"
  works); typo and sound matches have their own match kinds, ranked last, which `needsRetrieval`
  ignores (a test shows a misspelling still goes online). The index was also being rebuilt twice
  per keystroke because `useSearch` re-filtered the library on every query; it is now filtered once
  per library load and a test checks the index is not rebuilt while typing. Index build time for 304
  references and 741 aliases: about 3.7 ms warm, 9.7 ms on the very first call in a process, under
  the 16 ms frame budget, so it can stay on the main thread at this library size; revisit when the
  library is in the thousands.

### Step 4c: sound-alike matching for swapped letters (adopted)

Edit distance counts two letters swapped ("bzainga") as two typos, so short words missed. Each
title and alias word now also gets its Double Metaphone codes (the `double-metaphone` package
already used for search history) in an extra MiniSearch field; a query word matches when its code
equals one of the stored codes. The sound pass runs after the typo pass, so sound-alike matches
come last. It fixed the two remaining misses ("this is fien", "lte it go") and the four swap cases
added on top ("bzainga", "distarcted boyfriend", "wintre is coming", "thnaos snap"). The
character-trigram field was not needed, since no miss remained.

### Step 3: query rewriting without AI (D43)

Two fallbacks, each only when the plain search misses, at most one per search, so a miss costs at
most two extra requests. The code is `src/services/retrieval/rewrite.ts` and the fallback stage in
`retrieve.ts`.

- **What counts as a miss (one rule):** no candidate is named by the query. A candidate counts when
  its page title, with a Wikipedia disambiguator removed, holds the query's words in order (so it
  equals or contains the query), or when it is a Wiktionary entry (those are looked up by the exact
  query). "Hera Pheri (2000 film)" answers "hera pheri"; "Hemlata" does not answer a line of
  dialogue. A search where Wikipedia, Wiktionary or Wikiquote failed never runs a fallback, so an
  outage is not made worse.
- **Did you mean:** Wikipedia's own spelling suggestion, asked for in the plain search's request
  (`gsrinfo=suggestion`, read from `query.searchinfo.suggestion`), so learning it costs nothing. If
  it differs from the query, search it. Cost: that search plus one Wikidata lookup for its hits.
- **Shorter phrase:** for a query of 4 or more words, search its first 2 words ("babu bhaiya" for
  the whole dialogue line). Same cost.
- **Order:** suggestion first, then shorter phrase, chosen on the tuning half (a tie, 0.752 against
  0.748 MRR). Only one runs.
- **On screen:** fallback results stream like any other batch (behind "N new results" if cards are
  already shown), the reranker orders them, and a small line above the results says what was
  searched ("Also searched “hakuna matata”, Wikipedia's suggestion for your spelling." / "Also
  searched “babu bhaiya”, the start of your search."). The line shows only once the fallback added
  something.

**Tried and dropped: a looser Wikiquote search** (the same search without quotes, accepting a
sentence that holds 60% of the query's words). It ran on 40 searches, added a page to only 5, and
changed no rank, for 40 extra requests, so it is not in the code.

How it was measured: the fallbacks were captured live once for the 51 of 97 cases that count as a
miss (`snapshot/fallbacks.json`, test-only, with sources and licences kept; each fallback's extra
requests counted exactly), then compared offline with the same tuning / held-out split as the
reranker. Report: `docs/eval/rewrite-offline.md`.

| Offline, reranked | n | Recall@5 | MRR@10 | Incorrect top | No results |
|---|---|---|---|---|---|
| Tuning half, no fallback | 50 | 80.0% | 0.745 | 26.0% | 4.0% |
| Tuning half, suggestion then shorter | 50 | 82.0% | 0.752 | 28.0% | 2.0% |
| Held-out half, no fallback | 47 | 80.9% | 0.697 | 31.9% | 8.5% |
| Held-out half, suggestion then shorter | 47 | 83.0% | 0.707 | 36.2% | 4.3% |
| Full set, no fallback | 97 | 80.4% | 0.722 | 28.9% | 6.2% |
| Full set, suggestion then shorter | 97 | 82.5% | 0.730 | 32.0% | 3.1% |

| Each fallback alone, held-out half | Recall@5 | MRR@10 | Exact-title cases worse | Extra requests (97 searches) | Adopted |
|---|---|---|---|---|---|
| Suggestion | 80.9% to 83.0% | 0.697 to 0.707 | 0 of 36 | 25 | yes |
| Shorter phrase | 80.9% to 83.0% | 0.697 to 0.704 | 0 of 36 | 52 | yes |
| Loose Wikiquote | no change | no change | 0 of 36 | 40 | no |

LIVE_REWRITE_PENDING

What it did, in plain words:
- **A small gain for a real cost.** About 2 more cases in 100 now have the right answer in the top 5
  (80.4% to 82.5%; in the other order, shorter phrase first, 83.5%, which the held-out half
  preferred but was not used to choose). The price is 59 extra requests over 97 searches (0.61 per
  search, 1.16 per missed search) for those 2 to 3 rescued cases.
- **Fixed:** "waltuh breaking bad" returned nothing; Wikipedia's suggestion "walter breaking bad" now
  finds Walter White and Breaking Bad. "neutral milk hotel meme" first showed "In the Aeroplane Over
  the Sea" and "4chan"; searching "neutral milk" now brings up the band Neutral Milk Hotel. "hakuna
  matatta" is rescued by its suggestion "hakuna matata" (and by typo matching locally).
- **Not fixed: misremembered queries.** The group that motivated this stays at 36.4% Recall@5, and
  its wrong-first-result rate goes from 54.5% to 72.7%, because two searches that returned nothing
  now return something wrong. "bilkul ricks nahi lene ka" still finds nothing ("bilkul risk" brings
  up "Cadbury"). "babu bhaiya paisa hi paisa hoga" now also shows Baburao Ganpatrao Apte and Phir
  Hera Pheri, which the owner's live check suggested, but the labelled answer is still not in the
  list. "catch me outside" is not a miss by the rule (a page called "Catch Me Outside" exists), so
  no fallback runs and Bhad Bhabie still does not appear.
- **A bad suggestion or cut can add noise.** "utha le re baba" got worse (2nd to 3rd) because
  Wikipedia suggested "utah le re baba" and the results are about Utah. Cutting a line to its first
  two words picks generic openings for "that was his mistake big hero 6" ("that was") and "oh my yo
  wa moo shin dae doo hee yun knee" ("oh my"). Skipping leading small words before cutting is an
  idea that was not tried.
- **Rule used to adopt:** a fallback stays only if the held-out half improves and no exact-title
  case gets worse. Suggestion and shorter phrase pass; the gain is about one held-out case each,
  so treat it as small.

### Embeddings: offline trial (not adopted)

Offline, on the captured lists, with Transformers.js 4.3 in Node (q8 files, no new fetches of
Wikimedia data): the query and each candidate's title plus the first source text we already hold,
cut to 300 characters. Models downloaded from Hugging Face, official files only: all-MiniLM-L6-v2
(`Xenova/all-MiniLM-L6-v2`, 23.0 MB quantised model) and paraphrase-multilingual-MiniLM-L12-v2
(`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 118.3 MB, for the Hindi and Hinglish cases). Report:
`docs/eval/embedding-offline.md`. Embedding one query takes about 0.6 ms (English) and 1.2 ms
(multilingual) in Node on this machine, so time is not the issue.

| Held-out half (47 cases) | Recall@5 | MRR@10 | Incorrect top |
|---|---|---|---|
| Reranker alone | 80.9% | 0.686 | 34.0% |
| + English model as tie-break | 80.9% | 0.683 | 34.0% |
| + English model, weight 40 | 80.9% | 0.672 | 34.0% |
| + multilingual model as tie-break | 80.9% | 0.686 | 34.0% |
| + multilingual model, weight 40 | 80.9% | 0.686 | 31.9% |
| Embeddings only (English / multilingual) | 78.7% / 78.7% | 0.579 / 0.504 | 48.9% / 59.6% |

- **Verdict: do not adopt for online results.** On the tuning half the best weight for both models
  is 0 (no cosine at all). A non-zero weight changes the held-out half by at most one case
  (multilingual, weight 40: one fewer wrong first result out of 47, MRR unchanged) and the English
  model makes MRR slightly worse. That is noise, and not worth a 118 MB download.
- The reason is the ceiling above: the reranker already puts the right answer in the top 5 as often
  as any ordering can. Embeddings order the right answer fine (78.7% Recall@5 alone) but put it
  first less often than Wikipedia's own order does.
- By kind of query (misremembered, descriptive, Indian, ambiguous) nothing improves; the
  multilingual model did not help the Hinglish cases (they fail because nothing relevant was
  retrieved).
- **Semantic local search looks promising, but it is a small hand test, not a benchmark.** Ranking
  the 16 seed references plus one invented "The Matrix" entry by cosine, all 7 descriptive queries
  found the right entry first with both models (for example "dog sitting in a burning room" found
  "This is fine", and "red pill" found The Matrix once its description mentions the red pill:
  cosine 0.40 English, 0.31 multilingual). Queries that match nothing ("pizza recipe", "weather
  tomorrow") topped out at 0.17 to 0.25, so a cut-off near 0.3 separates them; the English model
  leaves the wider gap (0.21 against at least 0.40). If this is pursued, the 23 MB English model
  would be the starting point, running in a Comlink worker after consent like the other
  on-device models. Nothing was wired into the app.

## Order of work
Owner decision 2026-11-15: only step 1 is in Phase 2; steps 2–5 start in Phase 3.

0. Plan recorded (this file).
1. **Phase 2:** match-reason labels (small, no new dependency).
2. **Phase 3:** evaluation set and metrics harness; record the baseline. The same labelled set is
   reused for the Phase 3 curation/LLM benchmark (spec §5).
3. **Phase 3, done 2026-11-16:** MiniSearch behind the same `rankReferences` interface, with
   sound-alike matching; adopted (see "Results after the baseline").
4. **Phase 3, done 2026-11-16:** domain reranker for online results, tuned on half the set and
   adopted after the held-out half improved. The signals table above was the starting point; two
   of its signals survived (see D40).
5. **Phase 3+:** Transformers.js semantic matching: offline trial done, not adopted for online
   results (see D42); a local semantic search needs its own benchmark. Orama only if hybrid search
   is needed; all benchmark-gated.

## Library roles (owner question, 2026-11-15)

| Library | Role | Decision |
|---|---|---|
| MiniSearch | Local full-text: typo/prefix tolerance, relevance within tiers | **Adopted** (2026-11-16): tiers first, MiniSearch only adds typo and sound-alike matches; local Recall@5 50% to 100% on the typo set |
| Fuse.js | Typo tolerance | Skip: duplicates MiniSearch |
| Orama | Full-text + vector/hybrid | Later, as a *replacement* for MiniSearch if hybrid search proves worth it |
| Transformers.js | On-device embeddings for meaning-based matching | Offline trial 2026-11-16: no gain for online results, not adopted. Promising for local description search; needs a benchmark |
| WebLLM | On-device explanation generation from retrieved evidence (curation) | Phase 3 trial, benchmark-gated, consent before download |

None of these decides which cultural reference is correct; the domain reranker still does.

## WebAssembly
- No hand-written WASM: today's latency is network-bound (Wikimedia round trips), and local search
  over hundreds of records is sub-millisecond in JS.
- WASM enters only via Phase 3 ML libraries (ONNX Runtime Web, WebLLM). Run them in a Web Worker,
  lazy-load after consent, keep weights out of IndexedDB records, and add `'wasm-unsafe-eval'` to
  the CSP only then. Multithreaded WASM needs COOP/COEP headers on the host.
- Revisit only if Phase 5 profiling shows a measured JS hotspot.
