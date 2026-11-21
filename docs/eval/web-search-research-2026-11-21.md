# Web search research for card curation (2026-11-21)

Follows `curation-live-2026-11-20.md` and `passage-methods-2026-11-20.md`. This round asks two things. What do Parallel's docs and other engineers recommend for web search that feeds an LLM? And do any of those settings change what our current search returns for curation cases? Only search results were compared. No drafts were made and nothing was sent to OpenAI.

- **Harness:** `.cache/live-tools/web-research/run.mjs` (live, paid, gitignored) and `analyze.mjs` (offline scorer). Raw request and response pairs are in `.cache/live-tools/web-research/*.json`, scores are in `scores.json` and `scores.txt`, spend is in `ledger.json`.
- **Spend: $0.040** (cap $0.05, enforced in code before each call). That was 32 searches: 30 `fast` at $0.001 and 2 `basic` at $0.005. No extract calls. Every response reported `usage: sku_search ×1`.
- **"Current style"** copies `objective()` and `searchQueries()` from `shared/text.ts` and `api/web-search.ts` as of today, with the same request: `mode: fast`, `max_chars_total: 6000`, `max_results: 10`, and `question` set for every kind except `reference`.

## A. What the docs and others say

### Parallel's own docs (free to read)

| Setting | What the docs say | Where we stand |
|---|---|---|
| `objective` + `search_queries` | Send both. The objective is the goal plus any source or freshness needs (up to 5,000 chars). Send 1 to 5 queries of 3 to 6 words each, and 2 or 3 when the task has several angles. Keep the key entity in every query. The most common mistake is sending the raw question as both fields. ([best practices](https://docs.parallel.ai/search/best-practices)) | We send both. But when an anime or cartoons tag is set, `searchQueries` sends **one** query, `"<words> anime fictional characters"`, and drops the raw words. |
| `mode` | `turbo` about 200 ms, $1 per 1k. `fast` about 700 ms, $1 per 1k, the recommended default. `basic` about 1 s, $5 per 1k, returns "extended snippets per result" and works best with 2 or 3 queries. `advanced` about 3 s, $5 per 1k. ([modes](https://docs.parallel.ai/search/modes)) | `fast`. Correct. |
| `max_chars_total` | Caps the total excerpt length across all results. When unset, the default depends on the queries, the objective and `client_model`. The old `excerpt_settings` is deprecated and ignored. ([API reference](https://docs.parallel.ai/api-reference/search-beta/search)) | 6,000 across 10 results, so about 600 chars per page. |
| `source_policy` | `include_domains` / `exclude_domains` accept domains, path prefixes (`site.com/blog`, segment-bounded and case-sensitive, not in `turbo`) and bare suffixes (`.gov`). There are no wildcards, and the limit is 200 entries in total. An apex domain matches all its subdomains. The docs warn that policies "can significantly reduce result quality". Use them only for compliance or must-block cases, and steer preference through the objective. ([source policy](https://docs.parallel.ai/resources/source-policy), [advanced settings](https://docs.parallel.ai/search/advanced-search-settings)) | Used only for videos (YouTube). |
| Freshness | Only `after_date` filters by date. Otherwise, state the time window in the objective. | Not needed for us. |
| `session_id`, `client_model` | Reuse one session across the search and extract calls of a task. `client_model` tunes the defaults to the model that reads the results. | We send no session on purpose (privacy, D45). `client_model` is unused. |
| Evals | Score list tasks by recall and precision against a gold list. Score factual tasks by correctness plus citation support. ([how to eval](https://parallel.ai/blog/how-to-eval-web-search), [eval guide](https://docs.parallel.ai/search/evaluating-search)) | `curation-score.mts` already does this. |

### Other engineers (Parallel searches limited to Reddit, Medium and dev blogs)

`include_domains` covered reddit.com, medium.com, dev.to, substack.com, parallel.ai and a few engineering blogs (Weaviate, Pinecone, LangChain, LlamaIndex, Cohere, Eugene Yan, jxnl and others). Apex matching let subdomains such as `docs.cohere.com` and `developers.llamaindex.ai` through. **Reddit returned nothing in 12 searches.** Medium returned a handful of results, and dev.to dominated. The techniques that apply to us:

1. **Split the question into 2 or 3 short keyword sub-queries, then merge results by source quality, not by order.** ([dev.to/pstayet](https://dev.to/pstayet/grounding-ai-agents-with-web-search-retrieval-best-practices-that-cut-down-hallucination-c7o), [dev.to/gabrielanhaia](https://dev.to/gabrielanhaia/query-rewriting-before-retrieval-the-cheap-recall-win-most-skip-11g1), [LangChain query transformations](https://blog.langchain.com/query-transformations/), [Cohere parallel queries](https://docs.cohere.com/docs/generating-parallel-queries)). This matches Parallel's own advice. Our scoped path sends one query.
2. **Filter in three layers:** an allow or block list in the request, your own trusted/neutral/blocked tiers in code, then the model grades each source before using it. ([dev.to/cloro](https://dev.to/cloro/how-do-i-filter-spam-and-low-quality-sites-out-of-web-search-results-for-an-llm-3aeb)). Layer 2 is the cheap one. It is also where a fix belongs when the bad text sits *inside* a good domain, which is our case (see B).
3. **Attach source details to each passage** (source type: official, forum, blog, fan) so the model can weigh it. ([dev.to/izgorodin](https://dev.to/izgorodin/can-retrieval-tell-which-source-to-trust-2af0), [Medium infinitgraph credibility rubric](https://medium.com/infinitgraph/how-good-is-your-web-search-comparing-three-approaches-for-llm-agents-886ec4821af9))
4. **Respect page structure when cutting long pages.** Keep headings with their text, split by section before you split by size, and track *unique evidence coverage* rather than passage count. ([dev.to/stackandcraft](https://dev.to/stackandcraft/chunking-documents-keep-the-evidence-together-22ed), [dev.to/hussnainoffical](https://dev.to/hussnainoffical/why-your-rag-system-misses-the-answer-a-2026-evidence-based-guide-to-chunking-hybrid-search-and-29kf), [jxnl](https://jxnl.co/writing/2025/09/11/text-chunking-strategies-for-rag-applications/)). This bears on the 1,200-char budget. If a section heading such as "Fan Works" were kept, it could cut that section out.
5. **Deduplicate by underlying source, not by URL.** ([dev.to/cloudsway](https://dev.to/cloudsway/how-to-build-an-agentic-rag-pipeline-with-real-time-web-search-2k1l)). This applies to us: `tropedia.fandom.com` mirrors TV Tropes and showed up next to it in 7 of 7 genocidal arms.
6. **Check each claim against its quoted snippet and drop claims with no support.** ([dev.to/pstayet](https://dev.to/pstayet/grounding-ai-agents-with-web-search-retrieval-best-practices-that-cut-down-hallucination-c7o), [Substack lesson 7.5](https://vivedhaelango.substack.com/p/lesson-75-what-is-a-rag-answer-citation), [dev.to/rudratosh](https://dev.to/rudratosh/a-correct-answer-and-a-confident-lie-look-identical-heres-how-i-made-rag-tell-them-apart-2n45)). We already do this (`cardCheck`, grounding).
7. **Route by query type** (lookup vs list vs ambiguous) to different retrieval settings. ([dev.to/mrclaw207](https://dev.to/mrclaw207/the-rag-pattern-i-keep-rebuilding-dynamic-routing-instead-of-one-shot-retrieval-32mh), [TDS routing](https://towardsdatascience.com/rags-with-query-routing-5552e4e41c54)). We already have `kind`, so settings could vary by kind at no extra cost.

## B. Our cases: A/B search comparison

Arms: **A** current; **B** A plus `exclude_domains` for fan-fiction and UGC hosts (AO3, fanfiction.net, Wattpad, DeviantArt, fanon wikis, TV Tropes `FanFic`/`FanWorks` path prefixes, Amino, Pinterest, TikTok, Quora); **C** A plus `include_domains` for authoritative sites of that kind (anime: Wikipedia, MAL, AniList, ANN, Fandom, TV Tropes, CBR, Screen Rant, Crunchyroll; music: Wikipedia, MusicBrainz, AllMusic, Discogs, Pitchfork, Rolling Stone, Britannica, NME, KYM). The extra arms are labelled in the table.

"Core" means the expected core entries from `cases.json` that are matched (all patterns) anywhere in the titles and excerpts. "Off-scope" means `mustNotInclude` terms found. "Fan text" is whether the TV Tropes Fan Works text (Weaver and similar) appears.

| Case | Arm | Core | Off-scope / fan terms | Results, notable hosts | Chars |
|---|---|---|---|---|---|
| genocidal maniacs (list) | A current | 1/13 | Deadpool (fandomwire), **Weaver (TVT Main/OmnicidalManiac "Fan Works")** | 10: TVT Main ×3, tropedia mirror, *Genocidal Organ* film pages ×3, Purdue paper | 6.4k |
| | B exclude fan | 1/13 | same | **identical to A**: no fan host was ever returned | 6.4k |
| | C include auth | 2/13 | Weaver | 10, Deadpool gone | 6.4k |
| | D basic + exclude ($0.005) | 1/13 | Deadpool, Weaver | capped by 6k, so no longer excerpts | 6.5k |
| | E 3 angle queries + "skip fan works" objective | 1/13 | Hitler, Thanos (both from `villains.fandom.com/Category:Genocidal`); **no Weaver** | **TVT `OmnicidalManiac/AnimeAndManga`** in place of Main, gamerant, villains wikis | 6.4k |
| | F A with `max_chars_total` 20k | 3/13 | Hitler, Thanos, Deadpool, Weaver | same URLs as A, longer excerpts | 20.4k |
| | G basic + 20k ($0.005) | 4/13 | Deadpool, Weaver | TVT `/AnimeAndManga` (4.9k chars, **no fan-works text**), Main/OmnicidalManiac | 20.4k |
| itachi uchiha (name) | A current | 2/2 | – | Wikipedia, naruto.fandom, MAL, giantbomb, dictionary.com, newikis | 6.4k |
| | B exclude fan | 2/2 | – | identical to A | 6.4k |
| | C include auth | 2/2 | – | 5 results only: Wikipedia, MAL, naruto.fandom, Screen Rant, CBR | 6.4k |
| | D raw name + scoped query | 2/2 | – | adds **naruto-official.com** and shikimori, drops newikis | 6.6k |
| radiohead (music) | A current | 2/2 | – | Britannica, AllMusic, Pitchfork, Stereogum, Far Out, one Korean blog, a dictionary | 6.6k |
| | B exclude fan | 2/2 | – | ~identical | 6.6k |
| | C include auth | 2/2 | – | 6: Britannica, Pitchfork, AllMusic, Wikipedia, Rolling Stone, NME | 6.4k |
| avatar (scope trap) | A current | 2/2 | James Cameron (Britannica franchise page) | 10, 6 of them Wikipedia ATLA pages | 6.6k |
| | B exclude fan | 2/2 | James Cameron, Netflix live-action | same hosts | 6.5k |
| | C include auth | 2/2 | Netflix live-action | Wikipedia + Screen Rant only | 6.5k |
| famous assassins (scope trap) | A current | 4/4 | John Wick | 10 anime listicles + Wikipedia | 6.4k |
| | B exclude fan | 4/4 | John Wick | identical to A | 6.4k |
| | C include auth | 4/4 | John Wick (Wikipedia "fictional assassins" list) | 5 results | 6.2k |

What this shows:

- **A domain blocklist does nothing for us.** No fan-fiction or fanon host came back for any case, with or without the list. Every fan-made name (Weaver, plus the "Fan Works" folder) came from one page: `tvtropes.org/pmwiki/pmwiki.php/Main/OmnicidalManiac`. A domain filter can't remove a section of an allowed page, and path prefixes have no wildcards, so `*/FanWorks` can't be written.
- **TV Tropes' per-medium subpages are the clean source.** `OmnicidalManiac/AnimeAndManga` came back in arms E and G with 4.9k chars of anime-only examples (Digimon, Buu, Gundam SEED and others) and no fan-works text. The Main page carries the fan works. This is the most useful finding of this round, and it isn't tied to a Parallel setting.
- **An allowlist trims off-scope hosts but halves the result count** (10 down to 5 or 6) and gained no core entries. It cut Deadpool and Cameron, but Netflix live-action and John Wick came in through Wikipedia anyway. That matches Parallel's warning: steer through the objective rather than an allowlist.
- **Separate angle queries change *which* pages come back.** They brought the medium subpage and dropped the fan text, but also brought a villains-wiki category page that lists Hitler and Thanos. On its own this is mixed. Our real-history and wrong-medium filters downstream would have to catch those.
- **A bigger excerpt budget raises recall at the search level** (1 → 3 with fast at the same price, 1 → 4 with basic at 5× the price). It also raises off-scope text. Curation keeps only the 300-char snippet from search and then extracts pages, so this mainly matters if search excerpts ever feed the draft directly. Not recommended now.
- **The targeted name was already fine at search level.** Adding the raw name as a second query brought the official site (`naruto-official.com`). That is cheap, and it follows Parallel's "key entity in every query" advice.

Caveat: these are single runs with no repeats, scored on search excerpts only. The genocidal key was built from *extracted* pages, so a low core count here is expected and is not a verdict on the page set.

## Changes to try (smallest first)

1. **For anime/cartoon scope, swap a TV Tropes `Main/<Trope>` URL for its medium subpages before extract.**
   - Change: `<Trope>/AnimeAndManga` for anime, `<Trope>/WesternAnimation` for cartoons. Do this where URLs go to `extractPages` (`api/_lib/parallelExtract.ts` or its caller in `api/draft-card.ts`). Keep `Main/` as the fallback when the extract returns no excerpts for the subpage, because not every trope is split by medium.
   - Expected effect: fan-made names from TV Tropes drop to zero. The 1,200-char item fills with in-scope examples instead of other media, which also works around the "long list page hides key facts" limit.
   - Cost: up to +$0.001 per swapped URL when the subpage is missing.
   - Measure: rerun `.cache/live-tools/curation-live.test.mts` with `ONLY=list-genocidal-maniacs,list-fourth-wall,rank-anime-rivals` and score with `node .cache/live-tools/curation-score.mts`. Look for `fan-created` mustNotInclude hits going to 0 and core recall at least the 11-20 figure.
   - Unverified: I couldn't confirm that every Main page leaves fan works off its subpages (TV Tropes returned 403 to a direct fetch). The excerpts saw for one trope only.
2. **Scoped searches: send the raw words as a first query, plus the scoped query** (`searchQueries` in `api/web-search.ts`: return `[q, scoped]` in the scoped branch as well).
   - Expected effect: targeted names pick up official and primary pages (itachi: naruto-official.com) at no extra cost, since price is per request. This follows Parallel's 2–3 queries advice and addresses "the fixed search hurt targeted-name cards".
   - Risk: a bare ambiguous word ("avatar") pulls more of the off-scope meaning. Check `scope-avatar` and `scope-assassins` specifically.
   - Measure: the same curation-live pass over the `targeted-name` and `scope-trap` categories. Look for core recall up or level and wrong-medium hits not up. Update the `searchQueries` unit tests in `api/web-search.test.ts`.
3. **Steer source preference through the objective, not `source_policy`, and dedupe mirrors.**
   - Change: add a sentence to `objective()` for anime and cartoons, such as "Prefer Wikipedia, official sites, MyAnimeList and TV Tropes medium pages; skip fan works and fan wikis." Also treat `tropedia.fandom.com` as a copy of `tvtropes.org` in `pageKey` / dedupe.
   - Expected effect: fewer fandomwire-style listicles and a freed result slot. No coverage loss of the kind the allowlist caused (5 results instead of 10).
   - Measure: the same pass and scorer. Count distinct core entries per selected source, and the off-scope rate.
   - Untested: the objective sentence was not run in isolation.

Dropped: `exclude_domains` fan lists (no-op on every case), `include_domains` allowlists (halve results, no recall gain), `basic` mode (5× price, its gain came from the budget and not the mode), and a bigger `max_chars_total` (helps excerpts we discard).

## C. Live test of changes 1 and 2 (2026-11-21)

Both changes are now in the code:

1. **TV Tropes subpage swap.** When a search is tagged anime or cartoons, `extractPages` reads a TV Tropes `Main/<Trope>` link through its `/AnimeAndManga` or `/WesternAnimation` page in the same call. The result stays keyed by the link the reader picked, and falls back to the Main page's text if the subpage has none.
2. **Raw words kept.** `searchQueries` now sends `[q, scoped]` instead of only the scoped query.

How the test ran:
- **Harness:** `.cache/live-tools/subpage-test/subpage.test.mts`. It runs the baseline arm only, with a fresh search and extract each time. The cap is $0.05 for Parallel and OpenAI together, checked before each call, with at most one retry.
- **Scoring:** `node .cache/live-tools/curation-score.mts`, comparing against the saved 11-20 baseline files in `.cache/live-tools/curation-live/`.
- **Actual spend: $0.0438** over 17 calls, with no retries or failures. The cap stopped the pass before `scope-assassins`, so genocidal ×3, assassins, Miyazaki, anime rivals and avatar did not run. Five runs completed: genocidal ×2, Itachi, Light Yagami and fourth wall.
- **Confound:** these runs also include the new `cardCheck` source-words retry, which the 11-20 baseline did not have. Differences in *kept* entries may come partly from that. Differences in which pages were picked and what text was extracted come only from changes 1 and 2.

| Case | Run | Fan-made entries | Expected kept / in evidence | Wrong-scope (card/raw) | Citations ok | TV Tropes pages | Est. $ | Path ms |
|---|---|---|---|---|---|---|---|---|
| genocidal maniacs | 11-20 baseline | **Weaver etc. (card marked not useful)** | 4/5 (Eren, King Fritz, Galaxia, Joker) | 1/1 (fan-created) | 5/5 | Main/OmnicidalManiac (fan text), Main/GenocideBackfire | 0.0087 | 8,299 |
| | new r1 | **none** | 1/3 (Frieza; Galaxia and Fibrizo in evidence) | 0/0 | 6/6 | Main/OmnicidalManiac → **subpage used**, plus OmnicidalManiac/AnimeAndManga picked directly | 0.0087 | 9,966 |
| | new r2 | **none** | 1/3 (same) | 0/0 | 7/7 | same as r1 | 0.0085 | 7,943 |
| itachi uchiha | 11-20 baseline | – | 3/4 | 0/0 | 3/3 | – | 0.0083 | 5,543 |
| | new r1 | – | 2/4 ("wiped out the clan" in evidence, not kept) | 0/0 | 2/2 | – | 0.0087 | 5,309 |
| light yagami | 11-20 baseline | – | 4/4 | 0/0 | 5/5 | – | 0.0083 | 6,992 |
| | new r1 | – | 4/4 | 0/0 | 2/2 | – | 0.0083 | 5,347 |
| fourth wall (cartoons) | 11-20 baseline | – | 2/2 (Bugs, Animaniacs) | 0/0 | 4/4 | – | 0.0084 | 7,035 |
| | new r1 | – | 2/2 (Bugs, Daffy) | 0/0 | 3/3 | – | 0.0084 | 5,835 |

What happened:

- **Subpage swap (change 1):** it was used in both genocidal runs, and the fallback was never needed. The extracted text had no "Fan Works", Weaver or Nazo text. The fan-created wrong-scope hit went from 1 to 0, and the card went from *not useful* to *useful*. Cost was at most one extra extract URL (8 instead of 7, +$0.001; in these runs the request was deduped because the subpage was already selected) and no measurable extra time.
  - New problem: the search also returned `OmnicidalManiac/AnimeAndManga` directly. The rewritten Main link therefore carried **the same 10,476 chars under two URLs**, using 2 of the 7 evidence slots on identical text.
- **Raw words kept (change 2):**
  - Targeted names got more primary sources: Itachi picked up `naruto-official.com` and `naruto.fandom.com` in place of newikis and nintenderos. Light Yagami picked up MyAnimeList in place of inverse.com. Neither case had a wrong-scope hit.
  - Genocidal maniacs: the extra raw query reshuffled the list pages. It added villains.fandom and Polygon and **lost `Main/GenocideBackfire`**, the page that carried Eren, King Fritz and Patry. That is the main reason fewer expected entries were kept.
  - Fourth wall did not change in substance.
- **Citations:** all citations checked out in every run, though the counts were lower on the new runs (2–7 against 3–5). Path time fell 0.2–1.7 s on 4 of 5 runs. That is within run-to-run variance and not a result.

### Recommendation

1. **Change 1 (subpage swap): keep**, with one small follow-up. Skip the swap, or drop the Main link, when that trope's medium subpage is already among the selected URLs, so the same text doesn't take two evidence slots. It removed the fan-made leak it was meant to fix, at no real cost. The fallback path is covered by unit tests only.
2. **Change 2 (raw words kept): keep for reference (name) searches, revert to the scoped query alone for list, topic and ranking kinds** until more runs say otherwise. Names gained primary sources with no scope cost. On the one list case it displaced the page holding most of the expected entries. Evidence is thin: 5 runs, single repeats, and the cardCheck change mixed in. Rerunning the cut runs (genocidal r3, assassins, avatar, anime rivals, Miyazaki) would cost about $0.045.

Note: the first scoring call wrote its rows into `.cache/live-tools/curation-live/scores.json`. That file was regenerated from all saved `curation-live/*-*.json` runs. Scores for the new runs are in `.cache/live-tools/subpage-test/scores.json`.
