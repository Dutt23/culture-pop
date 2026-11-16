# Build progress

## Phase 1 — offline foundation

**Status: approved by owner 2026-11-15.** Owner-reported results: typecheck, lint, 90+ unit/integration tests and Playwright e2e at 360/390 px passing (CSP fix re-run not separately reported).
Nothing has been installed, compiled, linted, tested or built by the agent (see DECISIONS D1).
Phase 2 must not start until the owner runs the checks below and approves.

### Phase 1 plan (as executed)

1. Scaffold Vite + React + strict TS + vite-plugin-pwa + Vitest + Playwright + ESLint/Prettier.
2. Domain: types, normalization, deterministic ranking, cache eligibility (§4/§6), helpers.
3. Data: Dexie v1 schema (6 stores), first-open seeding, repositories.
4. Design tokens/themes, Motion for React presets (reveal/expand + reduced) — D22.
5. Components: ReferenceCard (compact/feature), InterpretationCard (spoiler gate, expand),
   SearchBar, FavouriteButton, Chip, SegmentedControl, EmptyState, ExternalSearchLinks, Page, Section.
6. Routes: `/discover` (default), `/search` (+ disambiguation state), `/references/:id`,
   `/favourites`, `/settings`, dev-only `/dev/components`, not-found.
7. Tests: unit, integration, Playwright mobile. Docs.

### Phase 1 build checklist

| Requirement | Where | State |
|---|---|---|
| Installable PWA (manifest, 192/512/maskable icons, service worker, offline navigation fallback) | `vite.config.ts`, `public/` | Written, not run |
| ≥12 original demo references | `src/data/seed.ts` (16) | Written |
| ≥2 ambiguous queries → different references | "hakuna matata", "let it go" | Written + test |
| ≥1 spoiler-gated interpretation | Titanic door, Avengers snap | Written + test |
| Title/alias search, deterministic ranking, multiple interpretations | `src/domain/ranking.ts` | Written + test |
| Cache-eligibility decision (per interpretation) | `src/domain/eligibility.ts` | Written + test |
| Favourites toggle + persistence | `favouriteRepository`, `ReferencePage` | Written + test |
| Spoiler-free default + reveal + setting | `InterpretationCard`, `settings.ts` | Written + test |
| Light/dark/system theme | `themes.css`, `SettingsContext` | Written + test |
| Reduced motion (setting + device preference) | `tokens.css`, `motion/` | Written + test |
| Local discovery (eras, categories, surprise) | `DiscoverPage` | Written + test |
| Offline shell, offline notice | `AppShell`, PWA config | Written + test |
| Empty / error / not-found states | Search, StorageGate, NotFound | Written + test |
| User-initiated external search link | `ExternalSearchLinks` | Written + test |
| Settings + reset | `SettingsPage` | Written + test |
| Versioned Dexie schema via repositories | `src/data/` | Written + test |
| No network search calls, no query history | Whole app | Written + test |

### Gate checks — owner to run (results: NOT RUN)

| Check | Command | Result |
|---|---|---|
| Install | `npm install && npx playwright install chromium` | not run |
| Lint | `npm run lint` | not run |
| Typecheck (strict) | `npm run typecheck` | not run |
| Unit + integration | `npm test` | not run |
| Production build | `npm run build` | not run |
| Playwright mobile 360px + 390px | `npm run test:e2e` | not run |
| Mobile visual walkthrough | `npm run preview`, open on a phone / devtools at 360 & 390 | not done |
| Real mid-range Android device | — | **not verified** |
| iOS Safari / Firefox | — | **not verified** |
| Desktop browsers | — | **not verified** (Phase 5) |

### Known limitations

- Demo content only; no sources, no years.
- Theme can flash once on cold start when a non-system theme is chosen (D14).
- No showpiece effect yet (D5); Motion bundle size not yet measured.
- `prefers-reduced-motion` e2e relies on Playwright's `reducedMotion` emulation.

### Next phase (needs approval)

Phase 2 — permitted multi-source retrieval: verify Wikipedia/Wikidata/Wiktionary terms and CORS,
record in `SOURCE_INVENTORY.md`, then build replaceable adapters with consent disclosure.

### Owner requests to fold into Phase 2+ (2026-11-15)

- **Works, not just quotes:** searching a show/film/cartoon itself (e.g. "The Matrix", "SWAT Kats")
  must return the work. Likely needs a `kind` field on references (work / quote / character / meme /
  phrase) → Dexie schema v2 with an upgrade test. Wikidata suits works (type, dates, aliases).
- **Search filters:** category (cartoon / TV / film / meme …) on search results in Phase 2; year or
  decade filter once years come from a source (Wikidata), never from unsourced seed data.
- **Memes:** encyclopedic evidence from Wikipedia when an article exists; otherwise link-out only
  (Know Your Meme, Urban Dictionary stay link-only per §2/§7).
- **Where to watch / streaming:** owner decided **not** to build it (no link-out, no availability data).
- **UI/UX:** the app has not been visually reviewed yet. Do a rendered walkthrough at 360/390px in
  light and dark themes before approving the Phase 1 gate.

### Planned for after the Phase 5 gate

- **Native wrap with Capacitor** (Android + iOS) around the built `dist/`. Skip service-worker
  registration on native, open external links via `@capacitor/browser`, add the top safe-area inset,
  generate icons/splash with `@capacitor/assets`. Risk: Apple guideline 4.2 ("minimum
  functionality") review for web-wrapped apps. Needs owner approval before starting.
- **Backend phase (owner, 2026-11-15): website-only until then.** Candidates: a Vercel Function proxy
  for wider web search (Brave/Mojeek key in a non-`VITE_` env variable, per-visitor rate limit, query
  length cap, no query logging, consent wording); optionally Supabase for cross-device sync of
  favourites and history (needs accounts, so a privacy decision) and a shared cache of curated
  results. Moves Phase 3 step 7 here. Also **"which song has this line"**: Genius's search matches
  lyric text but needs an access token (401 without one, checked 2026-11-16), so it waits for a
  server; show title, artist and link only, never lyrics (copyright). LRCLIB is open (CORS `*`, no
  key) but its `q` search matches titles, not lyric lines ("we're no strangers to love" → 0 results),
  so it only helps when the line is the title. Shazam identifies audio, not typed text.
  **Parallel (parallel.ai)** is another web-search candidate (owner, 2026-11-16): its own index,
  Search/Extract/Task APIs with cited output. Needs an API key, so backend only. Its "Basis"
  confidence scores are model-generated and never count as verification (spec §5): use only its
  links and quoted text as pointers, verified against permitted sources. Pricing, rate limits,
  storage/display terms and Reddit/Hinglish coverage are unread; compare with Brave/Mojeek on the
  eval's misremembered and Indian cases before choosing.
- **Backend step 1 built, not run (agent, 2026-11-16):** wider-web search through Parallel (D45,
  `docs/BACKEND_PLAN.md`). `api/web-search.ts` + tests, `services/retrieval/webSearch.ts` + tests,
  "Search the wider web" on a local miss with a consent card, the Wider web search setting, an
  access code (`api/unlock.ts`, `api/lock.ts`, signed HttpOnly cookie) and storage levels
  (`none`/`device`/`shared`; Parallel is `device`): results are text only, kept in their own
  device-only store (Dexie v5, 30 days, only with history on), never in the library or sent anywhere.
  Needs the owner's Parallel key, `ACCESS_CODE`, `ACCESS_COOKIE_SECRET` and the Firewall rule before
  it works; no checks have been run.


## Current phase: 2 — permitted multi-source retrieval (started 2026-11-15, owner approved)

### Plan
1. Verify sources (done, see `SOURCE_INVENTORY.md`): Wikipedia + Wiktionary Action APIs, Wikidata Query Service.
2. Schema v2: `kind` (work / phrase / quote / meme / character / other), sourced `year` + `yearSourceId`,
   `sourceIds` on references, `retrieved` editorial state, `other` category, richer `Source` records.
   Real v1→v2 upgrade test.
3. `src/services/retrieval/`: HTTP client (timeout, cancellation, 429/5xx retry with `Retry-After`,
   typed failures), adapters with validated parsing of untrusted JSON, class-hierarchy type mapping,
   orchestrator (Wikipedia → Wikidata + Wiktionary), de-duplication by Wikidata ID / canonical URL.
4. Retrieval consent setting (ask / on / off) and first-use disclosure; offline, no-results,
   provider-failed and blocked states; retry.
5. Cache retrieved candidates and citations in IndexedDB (provenance `unverified`, never cache-eligible);
   reuse offline. No query history: the query itself is never stored.
6. Search filters: category and era (era from sourced years only). Citations on the reference page.
7. CSP `connect-src` for the three hosts. Tests use recorded fixtures; no live network in CI.

### Phase 2 build status — code complete, NOT VERIFIED. STOP FOR OWNER REVIEW.

| Gate item | Where | State |
|---|---|---|
| Live, browser-compatible retrieval: movie ("the matrix"), cartoon ("swat kats"), ambiguous ("hakuna matata") | Endpoints probed live 2026-11-15 with browser `Origin` and preflight; responses recorded as fixtures; orchestrator tests run on them | Probed live by agent; **in-app live run: owner to do** |
| Meme/slang: encyclopedic evidence if available, else link-out | "ok boomer" has a Wikipedia article and Wikidata meme class; KYM/UD stay link-only | Fixture-tested |
| No-results vs offline vs provider-failed vs blocked states | `OnlineResults`, typed `RetrievalFailure` | Unit + integration + e2e written |
| Citations and safe fallback | `SourceList` on the reference page; external links | Written + tested |
| Adapter failures | `http.test.ts`, `retrieve.test.ts`, e2e outage test | Written |
| Privacy consent | Consent card, Settings option, "no requests before consent" e2e | Written |
| Cache never satisfies cache-only resolution; no query stored | `db.test.ts` retrieval cache tests | Written |
| Schema v1→v2 upgrade | `db.test.ts` | Written |

All tests: **written, not run** (agent does not run tests).

### Phase 2 open items for the owner
- Supply a project URL or contact for the `Api-User-Agent` string (D29).
- Run the live walkthrough: Settings → Online search: On, then search "the matrix", "swat kats",
  "hakuna matata song", "ok boomer" and open a result to see its citations.
- Decide which extra sources to verify next (owner asked 2026-11-15): Fandom wikis (cartoon/show
  detail, MediaWiki API), Wikiquote, TVmaze, MusicBrainz; plus tap-only links for Know Your Meme,
  Fandom and TV Tropes. Each needs the §7 check before any adapter.

- Search ranking plan (owner input): see `docs/SEARCH_RANKING.md`. Next steps after the current
  sessions finish: match-reason labels, then a ≥30-query evaluation set with Recall@5 / MRR@10
  baseline before any MiniSearch adoption.

### Phase 2 status update (end of build)
Done in code (all tests **written, not run**): streaming results, curated answers protected from
cached results, cache hygiene (Discover, reset, URL de-dup), session-long "Not now", MediaWiki
error and body-timeout handling, exact-page links from Wikidata, grouped tap-only search links,
match-reason labels, consent prompt fixes. Known, not fixed (latent): a re-created page could delete
a source that curated content also cites; no curated content cites sources yet.


### Owner direction for Phase 3 (2026-11-15)
- **No hand-curated lists.** The 16 seeds are demo content only. Coverage comes from retrieval;
  plain-language meanings come from automatic, evidence-grounded curation (deterministic curator,
  optional on-device LLM), plus user-authored notes for inside jokes. Nothing is written by hand.
- **Layered meanings.** One phrase can be an original work, a quote/reference inside another work,
  a parody, a meme remix, or an everyday phrase (e.g. "point break": the 1991 film, and Tony Stark's
  nickname for Thor in *The Avengers*). Phase 2 labels each online result with its role (original
  work / quoted in / dictionary / related) from what the source says. Phase 3 adds a persisted
  relation between interpretations (origin ↔ referenced in ↔ parody ↔ common phrase), set only when
  evidence supports it; otherwise both pieces of evidence are shown side by side.

### Proposed long-tail architecture: pointer → verify → curate (owner idea, 2026-11-15; needs approval)
1. Search permitted sources (Wikimedia, TVmaze, MusicBrainz, Wikiquote).
2. Community pointers from a **licensed web-search API** called from a small backend (result titles +
   snippets, e.g. Reddit threads, Know Your Meme, forums). The app never calls Reddit's API or scrapes
   pages: Reddit's Data API requires an agreement (anonymous access returned 403; new access reported
   closed). **Requires owner approval of a backend, API key, cost and privacy disclosure (spec §2/§7
   change).** Provider choice, pricing and terms: NOT VERIFIED yet.
3. On-device LLM (Phase 3) extracts candidate pointers from those snippets, each tied to its snippet.
4. Each pointer is verified against permitted sources; unconfirmed ones are shown as
   "Community suggests… (unverified)" with a link, never as fact.
5. Curator/LLM writes plain-language meanings only from verified evidence, with citations; model
   output is never auto-marked `source_supported`.
6. Cached on device as today.
Without step 2 the rest still works; step 2 is what reaches long-tail memes and inside jokes automatically.

### Orchestration library (owner preference: RxJS; decided 2026-11-15, pending Phase 3 approval)
- Phase 3 opens by moving the retrieval orchestration to **RxJS**: `debounceTime` + `switchMap`
  (cancel on new query) + per-provider streams merged with `scan` snapshots + `timeout`/`retry`
  (honouring `Retry-After`) + per-provider `catchError`. Phase 3's LLM token streaming, model
  download progress and any pointer → verify flow compose onto the same pipeline.
- Unchanged by the refactor: provider adapters (plain promise functions), merge/dedupe/evidence
  rules, UI components. Changed: `services/retrieval/retrieve.ts` (stream pipeline) and
  `features/search/useRetrieval.ts` (subscribes via one small hook).
- Tests use RxJS `TestScheduler` (virtual time, deterministic). Measure the bundle delta.
- Not adding TanStack Query alongside it (one orchestration approach only); Dexie stays the
  authoritative cache.
- Not done mid-Phase 2: the current code is unverified; refactor after the Phase 2 gate passes.
- Owner confirmed 2026-11-15: do it at the start of Phase 3. Use RxJS **7.8.2** (current stable;
  9.x is beta). New Phase 2 sources stay plain promise adapters, so the later port stays small.

### Data format notes for Phase 3 (owner questions, 2026-11-15)
- Data stays native structured objects (IndexedDB via Dexie, immutable typed objects in memory).
  JSON exists only at the network boundary (parsed once, validated into types) and in Phase 5
  backup files. No JSON string manipulation anywhere.
- Structural sharing: not needed at current sizes (≤ ~20 cards per snapshot, keyed by id). If Phase 5
  profiling shows wasted re-renders, reuse unchanged candidate objects in the RxJS `scan` merge
  (small helper; no Immer/Immutable.js).
- **TOON for LLM input:** benchmark evidence-as-TOON vs evidence-as-JSON on the Phase 3 eval set
  (accuracy, prompt tokens, time-to-first-token on a mid-range phone). Keep model **output** as JSON
  with schema-constrained decoding (validated by the existing evidence rules). Verify the TOON
  package's current name, version and licence before adopting.

### Coverage evidence (2026-11-15; `docs/research/query-demand.md`, `docs/research/web-search-providers.md`)
- 60 real questions (42 Reddit threads). Right answer in top 5: Wikipedia 53%, Wikipedia+Wiktionary 60%,
  all five free sources 67%. Indian pop culture 30%. Sound-alike misremembering misses everywhere.
- Gaps: Indian film *lines* (Wikipedia indexes titles, not dialogue), memes without a Wikipedia page,
  brainrot characters. These are the case for the Phase 3 web-search pointer trial.
- Web-search providers: Mojeek (cheapest; AI use allowed; caching on Business) and Brave (strong index;
  no storage beyond transient use, so store only verified facts, never snippets) to be trialled on free
  allowances; owner creates the keys. Bing API retired; Google CSE closed to new customers; scrapers
  (Serper/SerpApi) excluded. The backend needs owner approval (spec §2/§7).
- The 60 queries seed the Phase 3 evaluation set.

### Phase 2 gate results (run by the agent at the owner's request, 2026-11-15, Node 22.21.1, npm 11.21)
| Check | Result |
|---|---|
| Clean install (`npm install`, npm 11) | ✅ 548 packages, no peer conflicts |
| `npm run audit:gate` | ✅ passed; 0 shipped advisories; 3 upstream dev-only warnings (deepmerge, glob, minimatch) |
| `npm run typecheck` (strict) | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 5 warnings (react-refresh notice on context files; dev-only) |
| `npm test` (Vitest) | ✅ 247/247 in 15 files; re-run 247/247. Fixed during the run: one stale "Searching…" expectation |
| `npm run test:e2e` (Playwright, 360 and 390 px, production build) | ✅ 24/24; then 72/72 with `--repeat-each=3` (no flakes). Fixed during the run: a loose locator that matched two different cards |
| `npm run check:dist` | ✅ 18 files, no tests, fixtures, dev pages or source maps |
| Bundle | Main JS 169.8 KB gzipped (single chunk); measure and split in Phase 5 |
| Not verified | Real devices (Android/iOS), Safari/Firefox, live Wikimedia/TVmaze in the running app (tests use recorded responses), Prettier `format:check` |


### Phase 2 live walkthrough (agent, built-in browser, production build, 375 px, 2026-11-15)
Works live: Discover; curated disambiguation + match-reason labels (no network for curated hits);
consent card; live online search (only en.wikipedia.org, query.wikidata.org, en.wiktionary.org,
en.wikiquote.org contacted for "the matrix"); streaming cards with Film · 1999 and role labels;
reference page with quoted excerpt, licences, retrieval dates, Wikidata exact links (TV Tropes,
Fandom) and grouped search links; layered "point break" (films as Original work; Thor: Ragnarok,
Hot Fuzz, Robot Chicken as Quoted in; Wiktionary surfing slang); "catch me outside" fallback block
first; dark-mode Settings.

Found, to address:
- Search placeholder truncated at 375 px: fixed ("Quote, meme or show…").
- "point break" also returns the Indian docuseries *Break Point* (Wikipedia fuzzy match): Phase 3
  reranker should demote reordered-word titles.
- The Avengers (2012) "Point Break" quote doesn't surface (Thor: Ragnarok's does): Phase 3 tuning of
  Wikiquote limits/ranking.
- Service worker would not register **in the embedded browser pane only** (`sw.js` served 200 and
  JS; secure context). The same build passed the offline/SW e2e test 72/72 in Playwright Chromium.
  Verify once on a real phone.

---

## Phase 2: approved and committed by owner (2a289f1), 2026-11-15

## Current phase: 3: grounded curation and local model feasibility (owner approved 2026-11-15)

### Plan (spec §5 Phase 3, owner decisions D22–D34 and the notes above)
1. **RxJS orchestration refactor** (`retrieve.ts`, `useRetrieval`), RxJS 7.8.2.
2. **Evaluation set** from `docs/research/query-demand.md` (≥30 labelled queries incl. Indian pop
   culture, misremembered forms) + metrics harness (Recall@5, MRR@10, wrong-top-result, ambiguity
   coverage, latency) + recorded baseline for local and online search.
3. **Deterministic curator** (`src/services/curation/`): builds plain-language candidate
   interpretations only from retrieved evidence, with source IDs; layered relations (origin ↔ quoted
   in ↔ dictionary sense) persisted only when sources state them. Schema v3 with an upgrade test.
4. Query rewriting (Wikipedia spelling suggestion, Wiktionary+Wikipedia together, variants).
5. MiniSearch trial vs baseline; domain reranker (demote reordered-word titles like *Break Point*).
6. On-device LLM benchmark (WebLLM / Transformers.js) in a Web Worker, consent before download,
   schema-validated output with support IDs, TOON vs JSON evidence input; enable only if it passes.
7. ~~Web-search pointer trial (Mojeek/Brave)~~: **moved to the backend phase after Phase 5** (owner,
   2026-11-15). Phase 3 stays website-only; the "Not what I meant" hook stays in place.
Gate: 30-case corpus validated, provenance, model fallback, consent, persistence, errors.

### Owner decisions, 2026-11-15 (to record as D37 when built)
- **Search history: ON by default** (owner overrides spec §4 "no history"), disclosed in the consent
  card, with a Settings switch and "Clear history". Stays on the device. Never exported without the user.
- **Two-tier history (2Q / segmented LRU):** a *Recent* list (~50, LRU, new searches) and a
  *Frequent* list (~150, ranked by decayed frequency; promoted after ≥2 searches, ideally on different
  days; demoted back to Recent rather than deleted). Discover's "Your regulars" reads Frequent only.
  Frequent's score is stored as a single time-invariant value (log score + decay rate × time) so an
  index gives top-k and eviction without recomputing. Items expire after 90 days untouched.
- **One entry per meaning, not per spelling:** merge on (1) normalized text, (2) Double Metaphone
  key + small edit distance ("point breakz", "catch/cash me outside"), (3) same resolved reference,
  (4) later, embedding similarity if Transformers.js passes its benchmark. Label = most-used spelling.
- **Other structures:** in-memory LRU of ~20 recent search results (session only); in-flight request
  sharing (RxJS `shareReplay`); hashed "didn't work" list with 7-day expiry (under the history switch);
  MiniSearch `autoSuggest` for type-ahead if MiniSearch passes its trial. Bloom filter, Count-Min Sketch
  and tries: not needed at this scale.
- **Libraries:** `double-metaphone` (MIT) for sound-alike keys. Frecency/LRU built in-house (~50 lines,
  tied to Dexie); check `frecency` (Mixmax) for async-storage support before ruling it out.
- **Search UX:** results stay in place with a "N new results, tap to show" note; every "Quoted in"
  line hidden behind Reveal until the LLM spoiler check passes (then it decides; unsure means hidden);
  saved answers show "Saved <date>" + Refresh button (no timed auto-refresh); "Not what I meant" →
  offer "Search the wider web" (Brave/Mojeek, after owner approves backend + keys).

### Phase 3 steps 1–3 built and checked (agent, 2026-11-15, at the owner's request)
Done: RxJS refactor, evaluation set (baseline **not run** yet), deterministic curator + schema v3.
Checks run by the agent: typecheck clean, lint 0 errors (5 react-refresh warnings), unit 313/313,
e2e 24/24, `check:dist` clean.

Independent review (opus) findings and what changed:
- Just-found results jumped into the library once saving explained them and the online section
  vanished. Fixed: online-derived references (`retrieved` and `source_curated`) never join the library
  list or Discover, and online mode is latched per query in `SearchPage` (test added).
- "Original work" claimed an origin no source states. Now "The work" (curator) / "Work" (online card).
- Wikiquote search snippets were shown as "Quoted in X". Now "Matching text on the “X” page"; card
  title "X on Wikiquote". Those interpretations are `spoiler: 'major'` (hidden behind Reveal, D37).
- Music noun narrowed to "musical work". A year whose own source is missing is dropped instead of
  marking the whole interpretation unverified.
- Saved online results are hidden when a library match already resolves the query.

Deferred (fix before recording the baseline or later in Phase 3):
- Eval counts `enwikiquote:*` / `enwiki:*` first results as wrong tops (e.g. *Sholay* for "kitne aadmi
  the"). Decide: accept Wikiquote page titles in meanings, or drop those candidates from the ranked list.
- A Wikiquote reference's title isn't the phrase, so a later search for the phrase won't find it locally.
- `selection: user_confirmed` survives re-curation that changes the text.
- The v3 upgrade calls today's curator, so later curator changes alter what a v3 upgrade produces.

### Search history and search UX built (agent, 2026-11-15) — NOT RUN
Built the owner decisions above as **D37** (see `DECISIONS.md`). Code and tests are written; the agent
ran no typecheck, lint, unit or e2e checks (owner's rule), so nothing here is verified yet.
- Pure rules in `src/domain/history.ts`; Dexie access in `src/data/repositories/searchHistoryRepository.ts`;
  schema v4 adds the `searchHistory` table (v1–v3 untouched). New dependency: `double-metaphone` 2.0.1.
- Settings: Search history On/Off (default On), Clear history; Reset also clears history.
- Search page: recent searches as chips on an empty query; records on submit and on opening a result.
- Discover: "Your regulars" (Frequent only, hidden when empty or when history is off).
- Search UX: "N new results, tap to show", "Saved <date>" + Refresh, "Not what I meant" toggle with a
  hook for the wider-web search.
- Tests written: `src/domain/history.test.ts`, v3→v4 upgrade and history store tests in
  `src/data/db.test.ts`, app tests in `src/app/app.test.tsx` (history off, Clear history, regulars,
  new results, Saved date + Refresh, Not what I meant).
- Still open from the owner list: session LRU of results, `shareReplay` sharing, hashed "didn't work"
  list, MiniSearch `autoSuggest`, embedding merges, wider-web search (needs owner approval and keys).

### Phase 3 remaining work, agreed with the owner (2026-11-15)
1. Finish the search baseline once a live run has no degraded cases.
2. Small pieces. **Written, not run (2026-11-16):** `withSessionCache` in
   `src/services/retrieval/sessionCache.ts`, wrapped around `retrieve$` in `createRetrievalService`:
   identical searches running at once share one lookup (RxJS `share`), and a finished search with no
   failed provider is replayed for 10 minutes, 20 queries max (least recently used dropped first),
   never persisted; cancelled or failed lookups are never kept, so Retry always goes online. Tests:
   `sessionCache.test.ts`. The hashed "didn't work" list is **moved to the backend phase**: its
   purpose was to switch to the wider web search after repeated misses.
3. Query rewriting, in this order (owner, 2026-11-15): (a) Wikipedia's own "did you mean"
   suggestion, no AI; (a2) no-AI fallbacks, only when the plain search finds nothing that matches
   well: a **shorter-phrase search** of a long query's first 2–3 words (checked live 2026-11-15:
   "babu bhaiya" alone returns Baburao Ganpatrao Apte, Phir Hera Pheri and Hera Pheri (2000 film);
   the full line "babu bhaiya paisa hi paisa hoga" returns singer and song-list pages), and a
   **looser Wikiquote search** (unquoted) after the exact-phrase one finds nothing (not verified:
   throttled). Each adds at most one request, on a miss only. Hindi Wikipedia via transliteration
   is a later option (Hinglish spellings vary; not verified); (b) read which misremembered cases
   still fail in the baseline (e.g. "bilkul ricks"); (c) AI-suggested rewrites only for those, only if the on-device model passes step 5:
   at most 2–3 variants, only when the plain search finds nothing good. The AI suggests search
   terms only, never answers.
4. MiniSearch trial against the baseline, plus a reranker ("Break Point" must not beat "point break").
5. On-device AI test: explanations and spoiler judgement. **Built, not run (2026-11-16, D39):** WebLLM in a
   worker, consent-checked download, three jobs with deterministic output checks, and the dev-only
   benchmark `/dev/llm-bench`. **Not enabled**: the owner runs the benchmark on a mid-range phone
   (`docs/research/ondevice-llm.md`, "How to run"); enable only if every criterion passes.
6. **Comics** (owner: important). Started: a Comics category from Wikidata's "comics character"
   (Q1114461, e.g. Doctor Doom, Spider-Man) and "comic" (Q1004: series, graphic novels, strips, manga)
   classes, with curator nouns "comics character" / "comics work". Tests written, not run. Next:
   the comics-source research (what can be fetched from the browser, what waits for the backend
   phase, what is link-out only), then "what has this character done?" summaries only if step 5
   passes, with plot behind Reveal.
7. Phase 3 gate review with the owner.

### Phase 3 step 4: reranker and MiniSearch trial (agent, 2026-11-16, at the owner's request)
Done and adopted: a reranker for online results (`src/services/retrieval/rerank.ts`, called from `retrieve$`)
and MiniSearch typo plus sound-alike matching behind `rankReferences` (D40, D41). Offline held-out half:
Recall@5 76.6% to 80.9%, wrong first result 38.3% to 34.0%; local typo set Recall@5 50% to 100%.
Embedding trial (Transformers.js, two models) found no gain for online results and was not adopted (D42).
Live confirmation (98 cases, 2 degraded only in the scoring lookup): Recall@5 78.6% to 80.6%, MRR@10 0.697 to 0.719, wrong first 32.7% to 29.6% (`docs/eval/search-eval-2026-11-15-reranked.md`, table in `SEARCH_RANKING.md`).
Checks run by the agent: `npm test`, typecheck (clean in these files), lint (0 errors). e2e not run (parent session).

### On-device model: how it loads once enabled (owner, 2026-11-16)
- Never on app start. Start the worker the first time a feature needs it, only with download consent;
  keep it warm 5 minutes (`IDLE_MS`), then terminate to free memory.
- Never block on it. Expose a status stream from the LLM client (RxJS `BehaviorSubject`: off,
  loading with %, ready, unavailable); today `loaded` is internal only. Screens read it:
  not ready means skip (search runs without AI rewrites; reference pages show the curator's
  sentences at once), ready means enhance (rewrites on a miss; a richer explanation replaces the
  curator's text in place, with a small "improving this explanation…" note while it runs).
- Today nothing outside `src/features/dev/` imports `src/services/llm/`, so users never load it.

### Phase 3 step 3: query rewriting without AI (agent, 2026-11-16, at the owner's request)
Built and measured (D43): Wikipedia's "did you mean" (free, from the plain search's request) and a
first-two-words search for long queries, each only on a miss, at most one per search (at most 2 extra
requests). An unquoted Wikiquote search was tried and dropped (no effect). Very small gain (Recall@5 80.4% to
81.4% offline, none live), misremembered queries unchanged; a one-line note on screen says what was searched.
Same pass: the three leftover duplicates from the duplication review (H1 `stripDisambiguator`, H3 `safeUrl`
built on `safeHref`, M1 one `src/domain/sources.ts` for publisher names and source-ID helpers).
Checks run by the agent: `npm test`, typecheck, lint, e2e (24 of 24) and `check:dist`, all passing.

### Question-style searches (agent, 2026-11-16, at the owner's request; D44)
"why are ferrari fans depressed" style queries are searched by their subject, show the community sites first
(Know Your Meme, Urban Dictionary, Reddit) when nothing online explains them, and fold related pages that
share no word with the question into a collapsed "Other pages found". Detection is one rule next to
`looksLikePhrase`; quotes like "what's up doc" and addressed phrases like "how you doin" are not questions.
Four unscored question rows (Z1 to Z4) added to the eval set. Tests: detection (positive and negative),
community-first rendering, folded vs visible hits, the searched-subject note.

### Wider web, favourites and the model decision (agent, 2026-11-16, at the owner's request)

- Wider web: Parallel is asked for the meaning and origin, copies of a page are dropped, and each snippet
  starts at the sentence that best answers the search (`api/_lib/snippet.ts`, no AI). Live-tested with a
  real key: "why are ferrari fans depressed" now returns explaining snippets.
- Favourites from cards and saved web links (title + URL only), D46. Live-tested.
- On-device model: Mac smoke run and research, then **not achieved** (D47). A real loader bug was fixed
  on the way. `vercel dev` reads `.env`, not `.env.local`; the SPA rewrite skips Vite's `/@` dev paths.
- Gate: `docs/PHASE3_GATE.md` (commands, 360/390 px walkthrough, unresolved issues). **STOP FOR OWNER
  REVIEW.**
