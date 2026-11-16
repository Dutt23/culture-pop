# Duplication review: culture-pop

Read-only review. Nothing edited, nothing built or run. Every finding below was confirmed by reading every copy. Paths are relative to `/Users/sdutt/Documents/practice/culture-pop/`.

Out of scope (read for context only, no findings reported inside): `src/services/retrieval/rerank*`, `src/domain/ranking*`, `src/test/search-eval/**`, `src/services/llm/**`, `src/workers/**`.

Severity key (the owner's): HIGH = copies already disagree or are likely to; MEDIUM = real duplication; LOW = small tidy-up. Confidence is how sure I am that the finding is real and worth fixing.

## Summary

| # | Sev | Conf | Finding |
|---|-----|------|---------|
| H1 | HIGH | HIGH | Two disambiguator regexes, and they strip different things |
| H2 | HIGH | HIGH | Two date formatters: different locale, and one can crash on bad data |
| H3 | HIGH | HIGH | `safeUrl` and `safeHref` are two https checks that disagree on credentials |
| H4 | HIGH | MEDIUM | "A year needs its source" is checked in 2 of the 4 places that show a year |
| M1 | MEDIUM | HIGH | Publisher names and source-ID prefixes are string literals shared by convention across 4 modules |
| M2 | MEDIUM | HIGH | Each setting's allowed values are written three times |
| M3 | MEDIUM | HIGH | `CATEGORY_ORDER` and `CATEGORIES` are the same list twice |
| M4 | MEDIUM | HIGH | "A, B and C" list joining written twice (hand-rolled and `Intl.ListFormat`) |
| M5 | MEDIUM | HIGH | The safe external `<a>` is built three times; the visually-hidden CSS four times |
| M6 | MEDIUM | HIGH | Community links copy the "Memes and slang" group by site name and re-render `ExternalSearchLinks` by hand |
| M7 | MEDIUM | HIGH | `miniSearchExtras` re-implements `compareReferences` |
| M8 | MEDIUM | MEDIUM | Candidate `role` and curated `relation` are the same idea with two rules and two label maps |
| M9 | MEDIUM | HIGH | `source()` and `candidate()` test factories copied across test files |
| L1-L16 | LOW | mixed | Smaller tidy-ups (listed below) |

---

## HIGH

### H1. Two disambiguator regexes, and they strip different things

- `src/domain/normalize.ts:29-35`: `DISAMBIGUATOR` plus exported `stripDisambiguator()`. Strips a trailing bracket only when it holds a year or a keyword from a fixed list (`film|series|show|programme|...`). Brackets that belong to the title, such as "(Part 2)", are kept.
- `src/services/retrieval/retrieve.ts:47-48`: private `DISAMBIGUATOR = /\s*\([^)]*\)$/`, used at `retrieve.ts:359` to build the TVmaze lookup name. Strips any trailing bracket.

What differs: the retrieve copy removes every trailing parenthetical. The normalize copy misses common TV disambiguators because of its keyword list and `\b` boundaries: "(miniseries)" (no word boundary inside "miniseries"), "(TV serial)", "(sitcom)", "(soap opera)", "(telenovela)", "(docuseries)". So for "Chernobyl (miniseries)", TVmaze is asked about "Chernobyl", but curate writes "“Chernobyl (miniseries)” is a TV programme" (`curate.ts:119`), and `related.ts:21` keys it as "chernobyl miniseries".

Smallest fix: keep `stripDisambiguator` in `normalize.ts` as the only copy. Add the missing TV words to its list (`miniseries|serial|sitcom|soap opera|telenovela|docuseries`). In `retrieve.ts`, delete the local regex and call `stripDisambiguator(candidate.title)` at line 359. Add the missing forms to `normalize.test.ts`.

Behaviour risk: a series whose disambiguator still isn't in the list would keep its bracket in the TVmaze query. `parseTvmazeSearch` then needs the whole name in the show name (`containsPhrase`), so the lookup finds nothing and the card is not enriched. That fails safe (no wrong merge), but it is a lost enrichment. The display side (curate, related) gets better.

### H2. Two date formatters: different locale, and one can crash on bad data

- `src/features/search/OnlineResults.tsx:73-79`: `SAVED_DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })`. `savedOn()` returns `undefined` for an invalid date. The comment says en-GB "like the rest of the copy".
- `src/components/source-list/SourceList.tsx:9,34`: `new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })`, so it uses the browser locale, and it calls `DATE_FORMAT.format(new Date(source.retrievedAt))` with no guard.

What differs: (1) Locale. A US browser shows "Saved 15 Nov 2026" on a card and "Retrieved Nov 15, 2026" on the reference page. (2) Invalid input. `Intl.DateTimeFormat#format` throws `RangeError: Invalid time value` on an invalid Date. `retrievedAt` is read back from IndexedDB, which `safeHref.ts:2-4` itself treats as possibly tampered or legacy. There is no error boundary in `src/` (grep found none), so one bad row would unmount the reference page.

Smallest fix: move `savedOn`'s logic into one shared helper, for example `formatDate(iso): string | undefined` in `src/domain/labels.ts` or a small `src/components/ui/formatDate.ts`, using en-GB with the NaN guard. `OnlineResults` returns `` `Saved ${formatDate(...)}` ``, and `SourceList` renders "Retrieved …" only when the helper returns a value.

Behaviour risk: SourceList dates switch to en-GB order for non-GB browsers. No test asserts the SourceList date text (grep for "Retrieved " found only the component).

### H3. `safeUrl` and `safeHref` are two https checks that disagree on credentials

- `src/services/retrieval/validate.ts:25-34`: `safeUrl(value: unknown, host)` accepts https URLs on exactly `host`. It does not reject `username`/`password`.
- `src/components/ui/safeHref.ts:6-13`: `safeHref(value: string)` accepts https on any host and rejects URLs with credentials.

What differs: `https://user:pw@en.wikipedia.org/wiki/A` passes `safeUrl`, so it can be stored as `Source.url`, and is then dropped at render by `safeHref` (`SourceList.tsx:19`, `InterpretationCard.tsx:117`). Impact today is low, because the render-time check catches it. But these are two hand-written versions of one rule that have already drifted.

Smallest fix: move `safeHref` to a React-free module, for example `src/domain/url.ts`, since `services/` should not import from `components/`. Then write `safeUrl` as `typeof value === 'string' ? (h => h && new URL(h).hostname === host ? h : undefined)(safeHref(value)) : undefined`. Keep `components/ui/safeHref.ts` as a one-line re-export, or update its 3 importers.

Behaviour risk: provider URLs with embedded credentials are now refused at parse time instead of at render. That is the intended direction. `adapters.test.ts:434-438` still passes.

### H4. "A year needs its source" is checked in 2 of the 4 places that show a year

- Checked: `src/features/references/ReferencePage.tsx:47-51` (shows the year only if `yearSourceId` is among the loaded sources) and `src/services/curation/curate.ts:110-115` (drops the year claim when its source is gone).
- Not checked: `src/components/reference-card/ReferenceCard.tsx:44-45` (shows `reference.year` whenever it is set) and `src/domain/discovery.ts:23-30` (`eraOf`, used by the search filters, buckets by `year` whenever it is set).

When they disagree: `retrievalRepository.ts:31-55` deletes "replaced" sources (same URL, new ID) and re-curates the other references that cited them. Those references keep `year`/`yearSourceId`. After that, the card and the era filter show "1999", while the detail page and the curated text drop it. Confidence is MEDIUM only because the trigger (a provider re-issuing a page under a new ID) is rare.

Smallest fix: enforce the rule once, on write, so readers can trust `year`. In the `affected` branch of `retrievalRepository.saveCandidates`, or in `storeCuration`, clear `year` and `yearSourceId` when `yearSourceId` is not in that reference's remaining sources. The ReferencePage and curate checks can then stay as cheap defence.

Behaviour risk: affected references lose their year on cards and in era filters. That is correct per spec §4 ("A year is only kept when a source backs it").

---

## MEDIUM

### M1. Publisher names and source-ID prefixes are string literals shared by convention across 4 modules

- Written: `src/services/retrieval/retrieve.ts:74` 'Wikipedia', `:87` 'Wikidata', `:154` 'Wiktionary', `:178` 'Wikiquote', `:194` 'TVmaze'.
- Matched by string: `src/services/curation/curate.ts:37-39` (re-declares `WIKTIONARY`/`WIKIQUOTE`, with a comment saying they mirror the adapters), used by `relationOf` at `:94-98` and `draftFor` at `:149,164`. Also `src/features/references/ReferencePage.tsx:58` (`s.publisher === 'Wikipedia'`).
- Display map: `src/features/search/OnlineResults.tsx:21-27` `PROVIDER_NAME`, the same five strings keyed by `ProviderId`.
- ID convention: `retrieve.ts:84` builds `src:wd:${qid}` and `:119` builds `wd:${qid}`. `curate.ts:88-91` rebuilds the source ID as `` `src:${reference.id}` ``, relying on both. `retrieve.ts:353` and `:361` each repeat `c.id.slice('wd:'.length)`.

Risk if they drift: renaming a publisher in retrieve.ts makes curate silently stop producing "quoted_in" and "dictionary" interpretations, and drops the Wikipedia story link. Changing the `src:wd:` scheme makes curate silently stop producing type claims. Nothing fails loudly.

Smallest fix: export `PUBLISHER: Readonly<Record<ProviderId, string>>` from `src/services/retrieval/types.ts`. Use it in retrieve.ts, in curate.ts (delete lines 37-39), in OnlineResults (`PROVIDER_NAME = PUBLISHER`) and in ReferencePage. Export `wikidataSourceId(qid)` and `qidOf(candidateId)` from retrieve.ts or wikidata.ts, and use them in retrieve.ts:84/353/361 and curate.ts:90.

Behaviour risk: none while the values stay the same. Add a comment that `publisher` is persisted in IndexedDB `sources` rows, so a future rename needs a migration as well as the constant change.

Not the same thing: `src/domain/externalSearch.ts:20-21,36` also says 'Wikipedia', 'Wikiquote' and 'TVmaze', but those are link-out site labels, not publisher identity. Leave them.

### M2. Each setting's allowed values are written three times

- Type unions: `src/domain/settings.ts:3-9`.
- Validation list: `src/domain/settings.ts:29-35` `ALLOWED_VALUES`.
- UI options: `src/features/settings/SettingsPage.tsx:16-42` (`THEME_OPTIONS`, `MOTION_OPTIONS`, `SPOILER_OPTIONS`, `RETRIEVAL_OPTIONS`, `HISTORY_OPTIONS`).

What differs: nothing today. But neither list is checked for completeness. `ALLOWED_VALUES` is typed `readonly Settings[K][]` and the options are `SegmentedOption<T>[]`, so leaving a value out compiles. A value added to the type and the page but not to `ALLOWED_VALUES` is saved, then silently reset to the default by `parseSettings` on the next load.

Smallest fix: in SettingsPage, replace each options array with a label map typed `Record<ThemePreference, string>` (TypeScript then requires every value) and build the options with `Object.entries`. In settings.ts, declare the value arrays `as const` and derive both the unions and `ALLOWED_VALUES` from them.

Behaviour risk: option order follows key order, so keep the keys in today's order.

### M3. `CATEGORY_ORDER` and `CATEGORIES` are the same list twice

- `src/domain/discovery.ts:3-14` `CATEGORY_ORDER` (10 entries, ends with 'other').
- `src/domain/labels.ts:31-41` `CATEGORIES` (the same 9 in the same order, without 'other').

Smallest fix: export `CATEGORY_ORDER` from discovery.ts and set `CATEGORIES = CATEGORY_ORDER.filter((c) => c !== 'other')` in labels.ts. labels.ts already imports from discovery.ts. Behaviour risk: none.

### M4. "A, B and C" list joining written twice

- `src/services/curation/curate.ts:126-129` `listOf()`, hand-rolled.
- `src/features/search/OnlineResults.tsx:48-50` `NAME_LIST = new Intl.ListFormat('en-GB', { type: 'conjunction' })`.

Same output today for 0, 1, 2 and n items (en-GB has no serial comma). Smallest fix: export `listOf` from a domain module (for example `src/domain/labels.ts`) and have OnlineResults call it at lines 50 and 160. Keep the pure hand-rolled version: curate's output is stored and tested (`curate.test.ts:130`), and this avoids an ICU dependency. Delete `NAME_LIST`. Behaviour risk: none.

### M5. The safe external `<a>` is built three times; the visually-hidden CSS four times

- Anchor with `target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"` + `safeHref` + an sr-only "(opens a new tab)" span: `src/components/ui/ExternalLinks.tsx:17-35`, `src/components/source-list/SourceList.tsx:19-31` (which also calls `safeHref` twice), and `src/components/interpretation-card/InterpretationCard.tsx:117-134`. The last two fall back to plain text when the href is unsafe.
- Identical `.srOnly` rules: `ExternalLinks.module.css:26-33`, `SourceList.module.css:32-39`, `InterpretationCard.module.css:134-141`, and the same rule as `.label` in `src/components/search-bar/SearchBar.module.css:5-12`.

Why it matters: this is a security-relevant link policy kept consistent by copy. A fourth link site could easily drop `referrerPolicy` or `safeHref`.

Smallest fix: add `ExternalAnchor({ href, children })` in `src/components/ui/`. It runs `safeHref`, renders the anchor with the sr-only suffix, and renders plain `children` when the href is unsafe. Use it in all three places. Add one global `.sr-only` utility to `src/design/global.css` and delete the four module copies.

Behaviour risk: CSS-module class names change. Tests query by text and role, so they are unaffected.

### M6. Community links copy the "Memes and slang" group by site name and re-render `ExternalSearchLinks` by hand

- `src/services/retrieval/community.ts:37-41` `COMMUNITY_SITES` = 'Know Your Meme', 'Urban Dictionary', 'Reddit', matched by name against `src/domain/externalSearch.ts:25-30` (the 'Memes and slang' group).
- `src/features/search/OnlineResults.tsx:204-224` `CommunityLinks` repeats `ExternalSearchLinks.tsx`: the same `{ label: link.site, href: link.href }` mapping (`OnlineResults.tsx:217` vs `ExternalSearchLinks.tsx:19`) and the same note text (`OnlineResults.tsx:220` vs `ExternalSearchLinks.tsx:25`).

Risk if they drift: renaming a site in `GROUPS` silently removes it from the community fallback.

Smallest fix: in externalSearch.ts, export the group's label (or give each group an id) and have `communitySearchLinks` select that group instead of listing names. Give `ExternalSearchLinks` an optional `groups` prop, and have `CommunityLinks` render `<ExternalSearchLinks query={query} isOnline groups={[community]} />`.

Behaviour risk: CommunityLinks would also show the "Memes and slang" group heading. Accept that, or add a prop to hide it.

### M7. `miniSearchExtras` re-implements `compareReferences`

- `src/domain/miniSearchExtras.ts:77-82`: `compareStrings(a.reference.normalizedTitle, b.reference.normalizedTitle) || compareStrings(a.reference.id, b.reference.id)`. Its own comment says it must match "the tiers' own tie-break".
- `src/domain/ranking.ts:24-26` (out of scope, read only): `compareReferences` is exactly that.

Smallest fix: call `compareReferences(a.reference, b.reference)`. ranking.ts already imports `fuzzyMatches` from miniSearchExtras, so importing back would make a runtime import cycle. Cleaner: move `compareReferences` into `src/domain/collections.ts` and have both files import it. This needs the ranking session's agreement, because ranking.ts is being edited. Behaviour risk: none.

### M8. Candidate `role` and curated `relation` are the same idea with two rules and two label maps (confidence MEDIUM: may be intentional)

- Rule 1: `src/services/retrieval/retrieve.ts:123,147,171` sets `role` from the provider (`work` / `definition` / `quoted_in` / `topic`).
- Rule 2: `src/services/curation/curate.ts:94-98` `relationOf` re-derives the same split from stored publisher strings (`original` / `dictionary` / `quoted_in` / `related`). It must re-derive, because `candidateToReference` doesn't persist `role`.
- Labels: `src/features/search/OnlineResults.tsx:29-35` `ROLE_LABEL` ('Work', 'Dictionary', 'On Wikiquote', 'Related') and `curate.ts:67-72` `LABEL` ('The work', 'Dictionary meaning', 'Related page').

What differs: the same card says "Dictionary" before it is saved and "Dictionary meaning" after. The two rules agree today (both use `kind === 'work'` and the provider), but they are kept in step by hand.

Smallest fix: put one `RELATION_LABEL: Record<Relation, string>` in `src/domain/labels.ts`, plus a `ROLE_RELATION: Record<CandidateRole, Relation>` mapping. OnlineResults shows `RELATION_LABEL[ROLE_RELATION[role]]` and curate uses `RELATION_LABEL`. Behaviour risk: card wording changes, so check it with the owner. The out-of-scope `rerank.ts:67-90` reads `role`, so keep the field.

### M9. `source()` and `candidate()` test factories copied across test files

- `source(id, publisher, fields)` is identical in `src/features/references/ReferencePage.test.tsx:10-21` and `src/services/curation/curate.test.ts:10-21`. A Wikidata variant appears at `curate.test.ts:23-24` and `src/data/db.test.ts:475-485`.
- `candidate(fields)` is identical in `ReferencePage.test.tsx:23-35` and `db.test.ts:487-499`. A variant is at `src/services/retrieval/community.test.ts:6-17`.

Smallest fix: add `makeSource(id, publisher, overrides)` and `makeCandidate(fields)` to `src/test/factories.ts` (next to `makeReference`), with `retrievedAt` defaulting to `FIXED_NOW`, and delete the local copies. Behaviour risk: none. ReferencePage.test and curate.test each define `NOW` with the same value as `FIXED_NOW`, so they don't need the local constant either.

---

## LOW

- **L1. `failureOf` written twice.** `src/services/retrieval/retrieve.ts:65-67` and inline at `src/features/search/retrievalPipeline.ts:93` (`error instanceof RetrievalError ? error.failure : 'bad_response'`). Export it from `services/retrieval/types.ts` next to `RetrievalError`, and call it in both.
- **L2. Host strings repeated despite `hosts.ts` claiming "one edit here".** List at `src/services/retrieval/hosts.ts:17-23`. Repeated at `wikipedia.ts:4`, `wikiquote.ts:12`, `wiktionary.ts:4`, `tvmaze.ts:11`, `wikidata.ts:6` (endpoint), `src/test/fakeRetrieval.ts:83-87`, `src/services/retrieval/retrieve.test.ts:9-13` and `e2e/retrieval.spec.ts:6-12`. Drift fails closed (the http allowlist blocks the call). Fix: export named host constants from hosts.ts (it stays import-free) and import them. Behaviour risk: none.
- **L3. MediaWiki URL building repeated.** The page URL `` `https://${HOST}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` `` appears at `wikiquote.ts:63-66` (wrapped in a `safeUrl` that can never fail) and at `wiktionary.ts:77` (not wrapped). The base params `action/format/formatversion/origin` appear at `wikipedia.ts:20-23`, `wikiquote.ts:31-34` and `wiktionary.ts:22-25`. Fix: `wikiPageUrl(host, title)` and `mediaWikiApiUrl(host, params)` in `validate.ts`.
- **L4. Search links built four times; chip lists three times.** `` `/search?q=${encodeURIComponent(...)}` `` appears at `DiscoverPage.tsx:60,71` and `SearchPage.tsx:125,137`. Only `DiscoverPage.tsx:60` trims. Chip lists: `DiscoverPage.tsx:69-75` (div) and `SearchPage.tsx:121-129` and `133-141` (ul/li). Fix: export `searchPath(q)` from `useSearchQuery.ts` and add a small `SearchChips({ queries })` component. Risk: the regulars' markup becomes a list.
- **L5. Pluralisation by ternary, three times.** `ReferenceCard.tsx:56`, `SearchPage.tsx:147`, `OnlineResults.tsx:276` (plus a variant at `ReferencePage.tsx:107-109`). Fix: a `countOf(n, singular, plural)` helper.
- **L6. Two identical related-card lists.** `ReferencePage.tsx:145-155` and `157-167` differ only in title and items. Fix: a local `RelatedList({ title, references })`. The wider `<ul><AnimatedItem><ReferenceCard/>` pattern elsewhere varies too much in props to be worth abstracting.
- **L7. Three link shapes and three mapping glues.** `ExternalSearchLink {site, href}` (`domain/externalSearch.ts:1-4`), `ExternalLinkItem {label, href}` (`ExternalLinks.tsx:4-7`) and `ExternalLink {label, url}` (`domain/types.ts:48-51`). They are mapped at `OnlineResults.tsx:217`, `ExternalSearchLinks.tsx:19` and `ReferencePage.tsx:70`. Fix: rename `ExternalSearchLink.site` to `label` (not persisted), which removes two of the mappings. Keep `ExternalLink.url`, because it is stored.
- **L8. Near-identical history hooks.** `useRecentSearches` and `useRegulars` (`src/features/search/useSearchHistory.ts:28-47`) differ only in the repository method. Fix: a private `useHistoryList(load)` helper.
- **L9. Inline object guards beside an existing `isRecord`.** `src/domain/storageErrors.ts:3-13` hand-writes `typeof error === 'object' && error !== null` twice. `isRecord` lives in `services/retrieval/validate.ts:5-7`, which the domain shouldn't import. Fix: move `isRecord` to `src/domain/` and re-export it from validate.ts, so the out-of-scope `llm/check.ts` import keeps working.
- **L10. Alias ID format written twice.** `src/data/seed.ts:423-427` and `src/test/factories.ts:26-29` both build `` { id: `${referenceId}:${normalizedPhrase}`, ... } ``. Fix: export an `aliasOf(referenceId, phrase)` and have the factory call it, so tests can't drift from the real ID format.
- **L11. The same "first source excerpt" teaser rule, twice.** `OnlineResults.tsx:193` (`candidate.sources.find((s) => s.excerpt)?.excerpt`) and `useSearch.ts:54-57`. They agree today. Fix (optional): one helper over `Source[]`.
- **L12. "Cites ≥1 source and all are present" written twice.** `src/domain/eligibility.ts:14-17` and `src/services/curation/curate.ts:183-186`. They agree today. Fix: one `citesOnly(sourceIds, presentIds)` helper in eligibility.ts, called from curate.
- **L13. Repeated `reveal` motion props.** `variants={reveal} initial="hidden" animate="visible" exit="exit"` appears at `InterpretationCard.tsx:56-61,70-75`, `DiscoverPage.tsx:87-93` and `DevComponentsPage.tsx:123-129`. Fix: expose `revealProps` from `motion/presets.ts`, as is already done for `expand`.
- **L14. Production code used only by tests and eval.** The promise wrapper `retrieve()` and `OnRetrievalUpdate` (`src/services/retrieval/retrieve.ts:62-63,446-484`) have no production caller. Callers: `app.test.tsx:24`, `db.test.ts:295`, `retrieve.test.ts` and the out-of-scope `search-eval/live.eval.ts:14`. Leftover from before RxJS. Fix: move it to `src/test/fakeRetrieval.ts` once the eval session agrees. Keep its abort semantics, which `retrieve.test.ts:550` tests.
- **L15. Unused dependency.** `@toon-format/toon` (`package.json:22`) is imported nowhere in `src/`, `scripts/`, `e2e/` or `vite.config.ts`. `docs/BUILD_PROGRESS.md:200` plans a TOON-vs-JSON benchmark. Remove it until used, unless the LLM session is adding it now. Risk: lockfile change only.
- **L16. Other duplicated test helpers.**
  - `withConsent()` is defined twice in `src/app/app.test.tsx:269-274` and `640-645`. Hoist it to module scope or `src/test/renderApp.tsx`.
  - Cache seeding is written three times: `app.test.tsx:23-26` `cacheOnlineResults`, `db.test.ts:292-301` `cacheMatrix` and `ReferencePage.test.tsx:60-65` `withCached`. Put one `cacheOnlineResults(db, query)` in `fakeRetrieval.ts`.
  - `sessionCache.test.ts:13-25` `controllable()` re-implements `controllableRetrievalService` (`fakeRetrieval.ts:140-157`) with per-index lookups. Generalising the shared one to keep every lookup would serve both.
  - The "nothing found" bodies in `fakeRetrieval.ts:36-39` and `retrieve.test.ts:17-22` overlap. The Wikiquote body differs only by `batchcomplete`, which is harmless.

---

## Checked and clean (or intentionally different)

- **Edit distance:** there is one Levenshtein (`src/domain/history.ts:137-148`) and no other edit-distance code anywhere in `src/`, out-of-scope folders included.
- **`isRecord` / validators:** there is one `isRecord` (`validate.ts:5-7`), used by every adapter. The only other hand-written guard is L9.
- **Normalisation:** `normalizePhrase` and `tokenize` are single implementations and used everywhere matching happens (session cache key, `containsPhrase`, community, history, ranking extras). The disambiguator (H1) is the only split.
- **Online vs library (`isFromOnline`):** used consistently in `useSearch.ts:49-50`, `useDiscovery.ts:23`, `retrievalRepository.ts:29,50,83` and `ReferencePage.tsx:53`. `db.ts:81` compares to `'retrieved'` on purpose (v2 data could not be `source_curated`). `ReferenceCard.tsx:59-65` needs the per-state badge.
- **Cache rules:** `retrievalPipeline.ts:48-50` `isCacheable` (persist unless Wikidata failed) and `sessionCache.ts:46` (keep in memory only if no provider failed) are deliberately different and each is documented. `isCacheEligible` is a separate concept: whether a stored interpretation resolves a lookup. Not duplicates. See L12 for the one shared sub-rule.
- **Label maps:** `CATEGORY_LABEL`, `CATEGORY_PLURAL_LABEL`, `ERA_LABEL` and `PROVENANCE_LABEL` are each defined once in `labels.ts` and reused. Exceptions: M3, and the role/relation labels in M8.
- **UI primitives:** `Chip`, `Section`, `ExternalLinks`, `ExternalSearchLinks`, `AnimatedItem` and `Page` are reused across pages. The exceptions are M5, M6, L4 and L6. `candidateToReference` is correctly shared by the cache and the UI.

## Notes for the sessions editing out-of-scope files (not findings)

- `src/services/llm/check.ts:42-45` `normalizedWords` re-implements `tokenize` (`normalized ? normalized.split(' ') : []`) and could call it.
- `src/domain/ranking.ts:24-26` `compareReferences` is copied in miniSearchExtras (M7). Moving it to `collections.ts` would let both share it without an import cycle.
- `@mlc-ai/web-llm` is imported only by `src/services/llm/models.ts`, and nothing imports that yet. Expected while the LLM work is in progress.

Not checked: CSS beyond the sr-only rule, `docs/`, and `scripts/`. No lsp_diagnostics or builds were run (read-only brief, and the user's rule against running builds or tests).
