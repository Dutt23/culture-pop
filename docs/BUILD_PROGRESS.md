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
