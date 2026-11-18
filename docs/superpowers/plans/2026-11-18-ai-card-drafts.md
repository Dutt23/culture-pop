# AI Card Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reader ticks search results and app cards on a film strip, picks up to two tone cards, reviews them, and gets one AI-curated, server-checked card they can keep on their phone.

**Architecture:** A new Vercel function `api/draft-card.ts` validates the picked sources, reads ticked web links with Parallel Extract, runs our curation rules, asks OpenAI `gpt-6-luna` (falling back to Cloudflare Llama 3.3 70B) with the cached `card-draft-v6` prompt, checks the answer and returns only a checked card. Pure rules shared by server and app (types, curation flags, grounding) live in `api/_lib/` and the app imports them with `.js`-suffixed relative paths; nothing in `api/` imports from `src/`. The app adds a film-strip curation flow on the search page and a `draftCards` table for kept cards.

**Tech Stack:** Vercel Node functions (TypeScript, `.js` imports), `@toon-format/toon`, OpenAI Responses API (fetch), Cloudflare Workers AI REST (fetch), Parallel Extract (fetch), React 19, `motion/react` (`LazyMotion` + `domAnimation`, no layout), Dexie 4, vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-ai-card-drafts-design.md` (read its "Decisions after the trial", "Reader flow" and "Motion" sections). The prompt text and curation rules come from `docs/research/ai-card-trial/prompt.mjs` (card-draft-v5) and `curate.mjs`.

## Global Constraints

- Owner rules (CLAUDE.md): no git command unless the owner says so; no build, test, lint or format command unless the owner asks in that message. Every "Run" step below is handed to the owner (or run only on their "Run it for me"). Every "Commit" step means: tell the owner what to commit and the message; don't commit.
- Never read, print or log `.env` or any key. The server reads `OPENAI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `PARALLEL_API_KEY`.
- `api/` imports are relative with `.js` suffixes and never reach into `src/`.
- Limits: at most **6 sources** per card, at most **3 web links**, at most **2 tone cards**; search ≤ **200** characters; source text ≤ **1,200** characters, total evidence ≤ **6,000**; tone card fields ≤ 280 characters each.
- Providers: OpenAI `gpt-6-luna` first (`store: false`, `reasoning.effort: "none"`, `temperature: 0.2`, `max_output_tokens: 800`, explicit cache breakpoint on the prefix, `ttl: "30m"`, `prompt_cache_key` = the prompt version); Cloudflare `@cf/meta/llama-3.3-70b-instruct-fp8-fast` second (`max_tokens: 800`, JSON mode). A provider without keys is skipped.
- Prompt is sent as: fixed prefix (instructions + six worked examples) first, then the request in TOON (`search`, `about`, `evidence[n]{id,role,from,title,text}`, `tone_example`). The answer is strict JSON, never streamed.
- Kept cards stay on the device only (Parallel's terms). The AI never sees URLs.
- Copy rules: sentence case, plain words, no lyrics, no real IP art.
- Every animation has a reduced-motion version (short fade), read from `useMotionPresets().reduced`.

## Review Focus

1. The reader goes offline or leaves the page while a draft is running → the request is cancelled, no half card appears, the picked frames are still in the tray. (Task 13 test.)
2. The same link appears twice (wider web and an app card citing it) → it can be ticked once only. (Task 11 test.)
3. Every source is cut out in the splice check → Make a card stays disabled. (Task 13 test.)
4. OpenAI returns an incomplete or refused answer → Cloudflare is tried; if both fail the reader sees an error and keeps the tray. (Task 6 and Task 13 tests.)
5. Parallel can't read one of the ticked links → that link is listed "Not used: couldn't be read" and the card is made from the rest. (Task 8 test.)

---

### Task 1: Shared text and query helpers move to `api/_lib`

**Files:**
- Create: `api/_lib/text.ts`, `api/_lib/text.test.ts`
- Modify: `api/web-search.ts` (remove the moved code, import it), `api/_lib/devFlags.ts`, `.env.example`

**Interfaces:**
- Produces: `validQuery(raw: string | null): string | undefined`, `validAbout(raw: unknown): string[]`, `cut(text: string, max: number): string`, `plainText(markup: string): string`, `objective(q: string, kind?: SearchKind, about?: readonly string[]): string`, `type SearchKind` — all moved unchanged from `api/web-search.ts`, which re-exports them so its tests stay green.
- `DevFlag` gains `'CARD_DRAFT_FAKE'`.

- [ ] **Step 1:** Move the five functions and `SearchKind` with their constants into `api/_lib/text.ts`; `api/web-search.ts` imports them from `./_lib/text.js` and re-exports `validQuery`, `validAbout`, `objective`.
- [ ] **Step 2:** In `api/_lib/text.test.ts`, test `cut('😀'.repeat(5), 3)` returns two emoji plus `…`, and `plainText('![a](b) [x](y) <i>z</i> **w**')` returns `'x z w'`.
- [ ] **Step 3:** Add `CARD_DRAFT_FAKE` to `DevFlag`; add `OPENAI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CARD_DRAFT_FAKE` (names only, with a one-line comment each) to `.env.example`.
- [ ] **Step 4: Run** `npm test -- api` — expected: all existing `api/web-search.test.ts` tests pass unchanged, plus the new text tests.
- [ ] **Step 5: Commit** "refactor: move web-search text helpers to api/_lib".

### Task 2: Card types and curation rules, shared by server and app

**Files:**
- Create: `api/_lib/cardTypes.ts`, `api/_lib/cardCurate.ts`, `api/_lib/cardCurate.test.ts`, `src/features/drafts/sharedImport.test.ts`

**Interfaces:**
- Produces (`cardTypes.ts`, types only):
  - `type SourceKind = 'wiki' | 'web' | 'app'`
  - `interface DraftSourceInput { kind: SourceKind; from: string; title: string; text?: string; url?: string }` (web: `url` required, `text` is the visible snippet; wiki/app: `text` required)
  - `interface ToneCard { label: string; gist: string; means: string; reply: string; summary: string }`
  - `interface DraftRequestBody { search: string; about?: string[]; sources: DraftSourceInput[]; tones?: ToneCard[] }`
  - `type EvidenceRole = 'meaning' | 'origin' | 'usage'`
  - `interface EvidenceItem { id: string; role: EvidenceRole; from: string; title: string; text: string; source: number }` (`source` = index into `sources`)
  - `interface CitedLine { text: string; sources: number[] }`
  - `interface DraftCard { label: string; gist: string; means: string; reply: string; summary: CitedLine[]; context: CitedLine[]; example: CitedLine | null; spoiler: 'none' | 'major' }`
  - `interface NotUsed { source: number; why: string }`
  - `interface DraftResponse { card: DraftCard; notUsed: NotUsed[]; provider: 'openai' | 'cloudflare' | 'fake'; promptVersion: string }`
  - `const LIMITS = { sources: 6, webSources: 3, tones: 2, searchChars: 200, itemChars: 1200, totalChars: 6000, toneFieldChars: 280 } as const`
- Produces (`cardCurate.ts`, pure, no imports beyond `cardTypes.js`):
  - `roleOf(from: string, kind: SourceKind): EvidenceRole` — app cards: built-in → `meaning`, the reader's own → `usage` (pass `from: 'app card'` / `'your card'`)
  - `type FlagReason = 'off_topic' | 'other_language' | 'duplicate'`
  - `flagSources(sources: readonly DraftSourceInput[], search: string): (FlagReason | null)[]` — the app's ⚠ check before sending
  - `curateEvidence(items: readonly Omit<EvidenceItem, 'id' | 'role'>[], search: string): { items: EvidenceItem[]; dropped: NotUsed[] }` — port of `docs/research/ai-card-trial/curate.mjs` (boilerplate strip, <40 chars dropped, other script dropped, near-duplicate >0.7 overlap dropped, mentions-none-of-the-search-words dropped, rank by relevance with a second source before a second item from one source, caps `meaning 2 / origin 2 / usage 3`, order meaning → origin → usage, ids `E1…`)

- [ ] **Step 1: Write the failing tests** in `api/_lib/cardCurate.test.ts`:
  - `drops a page in another script for a Latin search` (Chinese text item → `dropped[0].why === 'different language'`)
  - `drops an item that mentions none of the search words` (stonks text for search "ok boomer")
  - `keeps a second source before a second item from the same source` (two wiktionary + one merriam-webster meaning items → kept `from` = `['wiktionary', 'merriam-webster.com']`)
  - `caps and orders meaning, origin, usage` (3/3/4 items in → 2/2/3 out, roles in that order, ids `E1`–`E7`)
  - `flagSources marks off-topic, other-language and duplicate sources and leaves good ones null`
- [ ] **Step 2: Write** `src/features/drafts/sharedImport.test.ts`: imports `flagSources` from `../../../api/_lib/cardCurate.js` and asserts it returns `[null]` for one on-topic source — proves the app can import the shared module.
- [ ] **Step 3: Run** `npm test -- cardCurate sharedImport` — expected FAIL (module missing).
- [ ] **Step 4: Implement** both files.
- [ ] **Step 5: Run** the same — expected PASS.
- [ ] **Step 6: Commit** "feat: shared card types and curation rules".

### Task 3: Grounding check moves to `api/_lib` (one copy for phone AI and server)

**Files:**
- Create: `api/_lib/grounding.ts`
- Modify: `src/services/llm/check.ts` (import `isGrounded` from the new module), `src/domain/normalize.ts` and `src/services/retrieval/validate.ts` (re-export what moved)

**Interfaces:**
- Produces: `isGrounded(sentence: string, cited: string): boolean`, `normalizePhrase(text: string): string`, `tokenize(text: string): string[]`, `containsPhrase(haystack: string, phrase: string): boolean`, `COMMON_WORDS: ReadonlySet<string>` (exported for Task 5) — moved with every private helper and constant they use (`COMMON_WORDS`, `NEGATIONS`, `POSSESSIVE`, `MIN_SHARED_WORDS`, `STEM_CHARS`, `SHORT_SENTENCE_WORDS`, `MIN_CONTENT_CHARS`).
- `src/domain/normalize.ts` and `validate.ts` keep their export names by re-exporting from `../../api/_lib/grounding.js`, so no other `src/` importer changes.

- [ ] **Step 1:** Move the code; keep behaviour identical.
- [ ] **Step 2: Run** `npm test -- llm normalize validate` — expected: every existing test passes unchanged (the move is proven by the old tests).
- [ ] **Step 3: Commit** "refactor: grounding check shared with the server".

### Task 4: The prompt, `card-draft-v6`

**Files:**
- Create: `api/_lib/cardPrompt.ts`, `api/_lib/cardPrompt.test.ts`

**Interfaces:**
- Produces: `PROMPT_VERSION = 'card-draft-v6'`, `PREFIX: string`, `ANSWER_SCHEMA: object`, `requestText(input: { search: string; about?: string[]; evidence: EvidenceItem[]; tones?: ToneCard[] }): string`
- Answer type (also exported): `interface ModelAnswer { main_use: string; label: string; gist: string; means: string; reply: string; summary: { t: string; ids: string[] }[]; context: { t: string; ids: string[] }[]; example: { t: string; ids: string[] } | null; ignored: { id: string; why: string }[]; spoiler: 'none' | 'major'; unclear: boolean }`

- [ ] **Step 1:** Port `INSTRUCTIONS`, the six worked examples and `request()` from `docs/research/ai-card-trial/prompt.mjs` verbatim, with two changes that make v6: add the field line after `unclear`:
  `- ignored: the ids of items that are about something else, each with a why of at most 8 words, such as "about stonks, not ok boomer". Empty if every item was relevant.`
  and add `"ignored":[]` to every worked example's answer (example 5 gets `[{"id":"E1","why":"the surfing term, not the film"}]`). `tone_example` accepts up to two cards as a list `tone_examples[n]{label,gist,means,reply,summary}` with the note field kept.
- [ ] **Step 2: Write tests:** `PREFIX is identical on every call` (string equality of two imports); `PREFIX is over the 1,024-token cache minimum` (`PREFIX.length >= 4200`); `requestText puts search, about, evidence, then tone examples, in TOON` (snapshot of a 2-item request); `ANSWER_SCHEMA lists every property as required and allows nothing extra` (deep check incl. nested `cited`).
- [ ] **Step 3: Run** `npm test -- cardPrompt` — expected PASS.
- [ ] **Step 4: Gate: re-run the trial on v6** (spends about $0.07; ask the owner first). Copy the v6 instructions and examples into `docs/research/ai-card-trial/prompt.mjs`. Run `gather.mjs` with the five answer-key searches and the three messy searches (see that folder's README), then `run.mjs` with `ONLY=luna,llama TONE_ALL=1`, then `judge.mjs`. **Pass:** Luna overall ≥ 3.8 on the five clean answer keys and 0 wrong points, the injection search still yields a stonks card, and on the "ok boomer + stonks page" pick (if curation lets it through) `ignored` lists it. If it fails, fix the prompt before Task 7.
- [ ] **Step 5: Commit** "feat: card-draft-v6 prompt".

### Task 5: Server checks for a model answer

**Files:**
- Create: `api/_lib/cardCheck.ts`, `api/_lib/cardCheck.test.ts`

**Interfaces:**
- Consumes: `isGrounded` (Task 3), `EvidenceItem`, `DraftCard`, `NotUsed`, `ToneCard` (Task 2), `ModelAnswer` (Task 4).
- Produces: `checkAnswer(answer: unknown, items: readonly EvidenceItem[], search: string, tones: readonly ToneCard[]): { card: DraftCard; notUsed: NotUsed[] } | { card: null; reason: 'unreadable' | 'unclear' | 'nothing_left' }`

Rules (from the spec's "The checks" section and the trial):
1. Not an object matching `ModelAnswer` → `unreadable`. `unclear: true` → `unclear`.
2. Each summary/context line: ids must exist; `isGrounded(t, citedTexts)`; over 280 characters dropped; keep at most 2 summary and 3 context lines. Ids become request indices via `item.source`.
3. Example: dropped unless it appears word for word (quotes and `’` normalised) in a cited item **and** contains the search or its leading words (≥ 4 characters).
4. `gist`, `means`, `reply`: replaced by fallbacks (`gist` → first kept summary line, `means` → `"Ask what they mean."`, `reply` → `"What do you mean?"`) when they hold a name or number that's in no item — a name is a capitalised word that isn't the line's first word and isn't in `COMMON_WORDS` — or share 4 words in a row with a tone card, or `reply` matches the generic list `/^(nice( one)?|good luck( with that)?|fair (point|enough)|got it|cool|classic|same|sounds (wild|good|fun)|bring it on|nice move)[.!? ,]*$/i`.
5. `spoiler` stays as given (`major` wins).
6. No summary line left → `nothing_left`.
7. `notUsed` = `ignored` entries mapped to request indices (unknown ids skipped).

- [ ] **Step 1: Write the failing tests**, one per rule, names: `refuses an answer that isn't a card`, `returns unclear when the model says so`, `drops a sentence citing an unknown id`, `drops a sentence whose name isn't in its cited items`, `keeps at most 2 summary and 3 context lines`, `drops an example that isn't copied word for word`, `drops an example without the searched words`, `replaces a reply that copies the tone card`, `replaces a generic reply`, `does not treat a reply's first word or "Bas" as a name` (`"Bas teen, Gabbar!"` with Gabbar in the items survives), `maps ids and ignored to source indices`, `returns nothing_left when every summary line fails`.
- [ ] **Step 2: Run** `npm test -- cardCheck` — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** "feat: server checks for drafted cards".

### Task 6: Providers with fallback

**Files:**
- Create: `api/_lib/cardProviders.ts`, `api/_lib/cardProviders.test.ts`

**Interfaces:**
- Produces:
  - `class ProviderError extends Error { constructor(readonly kind: 'out_of_credit' | 'rate_limited' | 'failed' | 'format', message: string) }`
  - `interface DraftProvider { name: 'openai' | 'cloudflare' | 'fake'; draft(input: { prefix: string; user: string; schema: object }, signal: AbortSignal): Promise<unknown> }`
  - `openAiProvider(deps: { fetch: typeof fetch; apiKey: string }): DraftProvider`
  - `cloudflareProvider(deps: { fetch: typeof fetch; accountId: string; token: string }): DraftProvider`
  - `fakeProvider(): DraftProvider` (local dev: returns a fixed valid `ModelAnswer` citing `E1`)
  - `providersFromEnv(env: NodeJS.ProcessEnv, doFetch: typeof fetch): DraftProvider[]` (OpenAI then Cloudflare, each only if its keys are set; `[fakeProvider()]` when `devFlag('CARD_DRAFT_FAKE')`)
  - `draftWithFallback(providers: readonly DraftProvider[], input, signal): Promise<{ answer: unknown; provider: DraftProvider['name'] }>` — tries in order; moves on for any `ProviderError`; throws the last one if all fail; throws `ProviderError('failed')` for an empty list.

Request shapes (copy the trial's `run.mjs`):
- OpenAI: `POST https://api.openai.com/v1/responses`, `Authorization: Bearer`, body `{ model: 'gpt-6-luna', store: false, reasoning: { effort: 'none' }, temperature: 0.2, max_output_tokens: 800, prompt_cache_options: { mode: 'explicit', ttl: '30m' }, prompt_cache_key: PROMPT_VERSION, text: { format: { type: 'json_schema', name: 'card', schema, strict: true } }, input: [developer input_text = prefix with prompt_cache_breakpoint { mode: 'explicit' }, user input_text = user] }`. Answer = all `output_text` parts joined, `JSON.parse`d. `status === 'incomplete'` or a refusal part → `format`. 402 → `out_of_credit`, 429 → `rate_limited`, other non-OK or network → `failed`. `redirect: 'error'`.
- Cloudflare: `POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`, body `{ max_tokens: 800, response_format: { type: 'json_schema', json_schema: schema }, messages: [{ role: 'system', content: prefix }, { role: 'user', content: user }] }`. Answer = `result.response` (object, or string to parse) or `result.choices[0].message.content`. `success: false` or a JSON-mode error → `format`; 429 → `rate_limited`; daily allowance used up (4006 / 429 with that message) → `out_of_credit`.

- [ ] **Step 1: Write the failing tests:** `sends the OpenAI request with store false, no thinking, the cache breakpoint and the prompt version as cache key`; `reads output_text across output items`; `maps 402 to out_of_credit and 429 to rate_limited`; `treats an incomplete answer as a format error`; `reads Cloudflare's response field and its chat-shaped answer`; `falls back to Cloudflare when OpenAI is out of credit`; `throws the last error when every provider fails`; `skips a provider whose keys are missing`; `never sends the key in the body or URL`.
- [ ] **Step 2: Run** `npm test -- cardProviders` — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** "feat: draft providers with fallback".

### Task 7: Parallel Extract for ticked web links

**Files:**
- Create: `api/_lib/parallelExtract.ts`, `api/_lib/parallelExtract.test.ts`

**Interfaces:**
- Produces: `extractPages(urls: readonly string[], search: string, deps: { fetch: typeof fetch; apiKey: string; timeoutMs?: number }): Promise<Map<string, string | null>>` — `POST https://api.parallel.ai/v1/extract`, header `x-api-key`, body `{ urls, objective: objective(search, 'meaning') }` (facts-focused, as decided after the trial), 10 s timeout, `redirect: 'error'`, response read with `readCapped` (256 KB). Text = the URL's `excerpts` joined, through `plainText`. A URL in `errors` or missing → `null`. A failed call → every URL `null` (the handler then falls back to the reader's snippet). Under `WEB_SEARCH_FAKE`, use `fakeParallelFetch`-style canned text.

- [ ] **Step 1: Write the failing tests:** `asks Extract with the facts objective and the key header`; `returns plain text per url`; `returns null for a url Parallel couldn't read`; `returns null for every url when the call fails or times out`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS): `npm test -- parallelExtract`.
- [ ] **Step 5: Commit** "feat: Parallel Extract helper".

### Task 8: `api/draft-card.ts`

**Files:**
- Create: `api/draft-card.ts`, `api/draft-card.test.ts`

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: `createDraftHandler(options?: { fetch?; now?; checkAccess?; dailyCap?; providers?: DraftProvider[] }): (request: Request) => Promise<Response>` and `export const POST = createDraftHandler()`. Responses: `200 DraftResponse`; errors as `{ error }` with `403 cross_site`, `401 locked`, `503 not_configured` (no provider), `400 bad_request`, `429 daily_cap` (`DAILY_DRAFT_CAP = 50`, per instance, same pattern as web-search), `503 out_of_credit` (every provider out of credit), `502 provider_failed`, `422 no_card` (with `reason`).

Order inside the handler: cross-site → access → read body (cap **48 KB**) → validate (search via `validQuery`, `about` via `validAbout`, 1–6 sources, ≤3 `web` with `https:` URLs, wiki/app text required, ≤2 tones, field length caps; anything else → `bad_request`) → daily cap → Extract the web URLs (a `null` result uses the reader's snippet if it has 40+ characters, else that source goes to `notUsed` with `"couldn't be read"`) → `curateEvidence` (its `dropped` join `notUsed`) → no items left → `422 no_card` `nothing_left` → `requestText` + `draftWithFallback` (20 s overall abort) → `checkAnswer` → 200 or 422. Never logs bodies, keys or answers.

- [ ] **Step 1: Write the failing tests** (same helpers as `api/web-search.test.ts`, provider injected): `refuses a cross-site request`; `asks for the access code when locked`; `refuses 7 sources, 4 web links, 3 tone cards, an http link and a 201-character search`; `extracts only web sources and sends no URL to the model` (assert the user text contains no `http`); `lists a link Parallel couldn't read as not used and drafts from the rest`; `drops an off-topic source before the model and reports it`; `returns the checked card with source indices and the provider name`; `returns no_card when the model says unclear`; `returns out_of_credit when every provider is out of credit`; `counts toward its own daily cap`.
- [ ] **Step 2: Run** `npm test -- draft-card` — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** "feat: draft-card server function".

### Task 9: Client call

**Files:**
- Modify: `src/services/retrieval/webSearch.ts`, `src/services/retrieval/webSearch.test.ts`, `src/test/fakeRetrieval.ts`

**Interfaces:**
- Produces: `DRAFT_CARD_PATH = '/api/draft-card'`; `WebSearchClient.draftCard(body: DraftRequestBody, signal?: AbortSignal): Promise<DraftResponse>` (reuses the private `call`/`post`, so offline, timeout (raise to 25 s for this call), abort, same-origin and size guard behave the same); `WebSearchFailure` gains `'no_card'`; `failureFor` maps `422 no_card` → `'no_card'`. `parseDraftResponse(body: unknown): DraftResponse` re-validates types and caps (unknown provider, non-array lines or out-of-range source indices → `failed`). `unusedWebSearch().draftCard` rejects like the others.

- [ ] **Step 1: Write the failing tests:** `posts the picks to /api/draft-card, never in the URL`; `maps 422 no_card, 429 daily_cap and 503 out_of_credit`; `rejects a response with a source index that wasn't sent`; `never calls the network when offline`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS): `npm test -- webSearch`.
- [ ] **Step 5: Commit** "feat: client call for card drafts".

### Task 10: Kept cards on the device

**Files:**
- Modify: `src/data/db.ts` (version 13), `src/data/repositories/index.ts`, `src/data/db.test.ts`
- Create: `src/data/repositories/draftRepository.ts`, `src/data/repositories/draftRepository.test.ts`

**Interfaces:**
- Produces: table `draftCards: 'id, savedAt'`; `interface DraftCardRecord { id: string; search: string; card: DraftCard; sources: { from: string; title: string; url?: string }[]; promptVersion: string; savedAt: string }`; repository `drafts`: `list(): Promise<DraftCardRecord[]>` (newest first), `save(record): Promise<void>`, `remove(id): Promise<void>`, `clear(): Promise<void>`. `resetUserData()` clears it; Clear history does not (it's the reader's saved content, like saved links).

- [ ] **Step 1: Write the failing tests:** `upgrades a v12 database to v13 with an empty draftCards table and keeps saved links`; `lists kept cards newest first`; `reset clears kept cards`; `clear history keeps them`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS): `npm test -- db draftRepository`.
- [ ] **Step 5: Commit** "feat: keep drafted cards on the device".

### Task 11: Curation state

**Files:**
- Create: `src/features/drafts/useCurationTray.ts`, `src/features/drafts/frames.ts`, tests beside them

**Interfaces:**
- Produces:
  - `interface Frame { key: string; kind: SourceKind; from: string; title: string; line: string; url?: string; text?: string }`
  - `framesFrom(input: { candidates: RetrievedCandidate[]; webResults: WebResult[]; appCards: { reference: Reference; interpretation: Interpretation; own: boolean }[] }): Frame[]` — candidates use `sources[0].excerpt ?? title`; web results use their snippet; app cards use gist + summary + context; `key` is the URL when there is one, so duplicates collapse.
  - `useCurationTray(search: string): { picked: Frame[]; tones: ToneCard[]; flags: Record<string, FlagReason | null>; toggleFrame(frame): 'added' | 'removed' | 'limit_total' | 'limit_web'; toggleTone(card): 'added' | 'removed' | 'limit'; keepFlagged(key); body(about?: string[]): DraftRequestBody; canMake: boolean }` — `flags` from `flagSources`; `canMake` false while any flag is unanswered or nothing is picked.

- [ ] **Step 1: Write the failing tests:** `refuses a 7th frame and a 4th web frame`; `refuses a 3rd tone card`; `collapses the same URL from two places into one frame`; `flags an off-topic frame and blocks Make until kept or removed`; `builds a request body within the limits`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS): `npm test -- drafts`.
- [ ] **Step 5: Commit** "feat: curation tray state".

### Task 12: Film strip, colour filters and reel

**Files:**
- Create: `src/features/drafts/FilmStrip.tsx`, `FilmStrip.module.css`, `ToneFilters.tsx`, `CurationTray.tsx`, `CurationTray.module.css`, `filmStrip.test.tsx`

**Interfaces:**
- Consumes: Task 11.
- Produces: `FilmStrip({ frames, pickedKeys, onToggle })`, `ToneFilters({ cards, picked, onToggle })`, `CurationTray({ count, tones, onOpen, shakeKey })`.

Look and motion as the spec's "Motion" section and the approved demo: vertical strip, frames with the source on the film edge (`BBC.CO.UK … 03A`), "✂ cut" tag, exposure flash on tick, mini frame flying into the reel (Web Animations API on a clone, as the demo did), reel spin, one tray shake at a limit with the hint text ("A card takes up to 6 frames.", "Up to 3 web frames per card.", "Up to 2 colour filters."). Sprocket rails beside the visible strip move at 1.6× the scroll and settle on the nearest 20 px hole in 160 ms when scrolling stops. Colour filters set `--grade-1` / `--grade-2` on the flow root; the reel splits into both colours, the tray, cut frames, beam and card border use them. Reduced motion: fades only, rails move 1:1, no settle. Frames are buttons with `aria-pressed`; the tray announces "3 of 6 frames" in a polite live region.

- [ ] **Step 1: Write the failing tests:** `ticking a frame marks it pressed and updates the tray count`; `a 7th frame keeps the count at 6 and shows the limit hint`; `a picked filter grades the reel` (`--grade-1` set on the root); `renders without motion when reduced motion is on`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS): `npm test -- filmStrip`.
- [ ] **Step 5: Commit** "feat: film strip, filters and reel".

### Task 13: Splice check, drafting, reveal, and the search-page entry

**Files:**
- Create: `src/features/drafts/SpliceCheck.tsx`, `DraftingProjector.tsx`, `DraftReveal.tsx`, `CurateFlow.tsx`, `drafts.module.css`, `curateFlow.test.tsx`
- Modify: `src/features/search/SearchPage.tsx` (a "Make a card from these" button under the online and wider-web results when online search or wider-web results exist and the wider-web preference isn't `off`; it opens `CurateFlow`)

**Interfaces:**
- Consumes: Tasks 9–12, `useRetrievalService().webSearch.draftCard`, `useMotionPresets`, `useRepositories().drafts`.
- Produces: `CurateFlow({ search, about, candidates, webResults, onClose })`.

Behaviour (spec "Reader flow"): the splice check lists every pick with site, title and first line; a flagged pick shows `⚠ <reason>` with **Keep** / **Cut it out** and a wiggle; when no pick is `usage` it hints "Add a web result to show how people use it."; **Make a card** is disabled until every flag is answered and at least one pick remains. Same consent card and access code as wider-web search (reuse the existing consent/access phases from `WiderWebSearch.tsx`; the disclosure text comes from Task 15). Drafting shows the mascot, spinning reel and graded beam with rotating lines ("Threading your frames…", "Checking every fact…", "Grading it with your filters…", "Cutting it into one card…"); leaving or going offline aborts the call and returns to the tray with picks intact. The reveal flips the card in with an "AI draft · check the sources" stamp, source chips per line (link to the URL for web, title for others), and a "Not used: <site> (<why>)" row. **Keep** saves a `DraftCardRecord` and flies the card out; **Drop** folds it; **Edit** turns gist, means, reply and the lines into text fields (edited text is saved as typed). Errors use the existing `FAILURE_TEXT` plus `no_card: "These results don't explain it. Try ticking others."`.

- [ ] **Step 1: Write the failing tests:** `Make a card stays disabled until a flagged pick is kept or cut`; `cutting every pick keeps Make disabled`; `shows the usage hint when no pick shows everyday use`; `sends the picks and tone cards and shows the checked card with its sources`; `lists not-used sources with their reason`; `Keep saves the card on the device and Drop saves nothing`; `going offline mid-draft cancels it and keeps the tray`; `shows the no_card message and keeps the tray`; `asks first under "Ask first" and sends nothing before consent`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS): `npm test -- curateFlow SearchPage`.
- [ ] **Step 5: Commit** "feat: curate a card from search results".

### Task 14: Your cards, as sources and tone

**Files:**
- Modify: `src/features/favourites/FavouritesPage.tsx` (a "Your cards" section listing `drafts.list()` with Remove), `src/features/drafts/CurateFlow.tsx` (app-card frames and tone filters come from favourites via `useFavouriteReferences()` plus kept drafts)
- Test: `src/features/favourites/yourCards.test.tsx`

- [ ] **Step 1: Write the failing tests:** `lists kept cards newest first and removes one`; `offers favourites and kept cards as tone filters and as frames marked "Your card"`.
- [ ] **Step 2–4:** Run (FAIL), implement, run (PASS): `npm test -- yourCards`.
- [ ] **Step 5: Commit** "feat: kept cards in Saved, usable as sources and tone".

### Task 15: Privacy text, docs, end-to-end, full check

**Files:**
- Modify: `src/features/search/WiderWebSearch.tsx` (`WEB_SEARCH_DISCLOSURE`), `src/features/settings/SettingsPage.tsx` (short version), `docs/BACKEND_PLAN.md` (a section for `/api/draft-card`, env names, providers, limits), `docs/DECISIONS.md` (append D63 by hand, never run Prettier on it), `api/_lib/fakeParallel.ts` (Extract shape under `WEB_SEARCH_FAKE`)
- Create: `e2e/curate.spec.ts`

Disclosure addition (exact copy): "If you make a card from results, the search, the results you picked and any style cards go through our server to OpenAI (or Cloudflare if OpenAI is busy) to write a draft, and Parallel reads the web pages you picked. They don't use it to train their models. The card is kept only on this device."

- [ ] **Step 1:** Update the texts and docs.
- [ ] **Step 2: Write** `e2e/curate.spec.ts` with `CARD_DRAFT_FAKE=1` and `WEB_SEARCH_FAKE=1`: search, tick two frames and one filter, open the splice check, Make a card, see the AI draft stamp, Keep, find it under Saved → Your cards.
- [ ] **Step 3: Run** `npm run deploy:check` — expected: audit, types, lint, format, all unit tests, all e2e tests and the dist check pass.
- [ ] **Step 4: Commit** "docs: AI card drafts privacy text and decision D63".

---

## Self-review notes

- Spec coverage: reader flow (Tasks 11–13), limits (2, 8, 11), strict wrong-link handling before (2, 11, 13) and after the AI (4 `ignored`, 5, 13), tone cards from demo/favourites/own drafts (14), app cards as sources (11, 14), motion and film strip (12, 13), v5→v6 prompt with a trial gate (4), curation in code (2), checks (3, 5), provider order and fallback (6), Extract (7), caching (6), privacy (15), device-only storage (10).
- Not in this plan (spec "Later ideas"): images from Parallel image search; sharing cards between readers; the phone AI.
