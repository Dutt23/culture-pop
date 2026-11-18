# Backend plan: wider-web search through Parallel

Status (2026-11-16): **built, not run.** Server, client and tests are written (D45). No build, test
or deploy has been run. The owner's steps are in section 10.

Owner decisions so far (2026-11-16):

- **A. Storage: "device only"** (revised 2026-11-16). Parallel results may be kept on the
  searcher's own device, for that person only, for 30 days while search history is on. Never on a
  server, never shared (section 1).
- **B. Access:** an **access code** protects only `/api/web-search`; the rest of the app is public, so
  friends can use it. This replaces the earlier plan of Vercel Authentication. Vercel
  Authentication stays **off**.
- **Text only, small answers, JSON** (sections 3 and 4).

Sources read on 2026-11-16: Parallel Search API reference (`docs.parallel.ai/api-reference/search/search`),
search quickstart and modes pages, rate-limits page, pricing page (`parallel.ai/pricing`), Customer
Terms and Conditions (`parallel.ai/customer-terms`, no date on the page), Vercel docs for Deployment
Protection (updated 2026-09-15) and WAF Rate Limiting (updated 2026-08-28).

---

## 1. Parallel's terms: show to the searcher, keep on their device only

| Question                                                    | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Where                              |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Can the app show search results to the person who searched? | **Yes.** The licence lets us make our app available to end users and put Output into material for them, as long as the Output of one query is "primarily for the use of one End Customer only".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Customer Terms 2(b), 2(b)(i), 4(b) |
| Can the app keep results on the phone for offline use?      | **Ambiguous; the owner's reading is "yes, on that person's device only".** 2(b) lets the customer "modify, adapt, or create derivative works based on Customer Output", provided output from one query is "primarily for the use of one End Customer only, and shall not be copied, cached, stored, or made available to **other** End Customers or other third parties". Read as a whole, the ban is on keeping or sharing it for _other_ people: a copy on the searcher's own device, for them alone, fits. A stricter reading (no copy at all) is possible, and 2(c)(xi) still bans reusing old output to avoid paying for new searches as a business practice. **A written confirmation from Parallel would settle it.** | 2(b), 2(b)(i), 2(c)(xi)            |
| Who owns the results?                                       | We do ("Customer IP"), but Parallel gets a licence to it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 1(e), 4(b)                         |
| AI use                                                      | Using Output to make training data for a model is banned. Summarising on the phone at the moment of reading is not training, and the terms don't forbid it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 2(c)(vi)                           |
| What Parallel does with our queries                         | Parallel may use "Customer IP" (our queries and results) to improve its services and "to train and improve" its models. Zero data retention is only on the $1,000/month Scale plan. So **queries are kept and may train Parallel's models**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 4(b), pricing page                 |
| Selling, reselling, building a database from results        | Banned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2(b)(ii), 2(c)(iv), 2(c)(vi)       |

Brave (the backup) is stricter: its ToS 3(b)(i) bans storing results beyond what the app needs while
it runs, so Brave would be `none`. Only Mojeek's Business plan sells storage rights
(`docs/research/web-search-providers.md`).

### Storage levels

"How far may this be kept?" travels with the data, so no screen can save a result in the wrong place:

| Level    | Meaning                                                            | Who uses it                |
| -------- | ------------------------------------------------------------------ | -------------------------- |
| `none`   | Shown once, never saved                                            | Brave, if it is ever added |
| `device` | Kept in this device's IndexedDB, for this person only, for 30 days | Parallel                   |
| `shared` | May be cached for everyone                                         | Reserved, unused           |

- **Server:** one table in `api/web-search.ts`, keyed by provider (`STORAGE = { parallel: 'device' }`).
  Every answer carries it: `{ "storage": "device", "results": [{ …, "storage": "device" }] }`. A
  future provider with different terms sets it once there. The server stores nothing at any level.
- **Client parsing:** a result is `device` only when both the answer and the result say `device` (or
  `shared`, which this side still keeps on the device only). Missing, malformed or unknown values
  count as `none`.
- **Two kinds, two types:** `EphemeralResult` (`storage: 'none'`) and `DeviceResult`
  (`storage: 'device'`), literal types.
- **Library lock (type):** `RetrievalRepository.saveCandidates` takes
  `LibraryCandidate<RetrievedCandidate>` (`T & { storage?: never }`), so no wider-web result of any
  level compiles there (`@ts-expect-error` tests).
- **Library lock (run time):** `saveCandidates` keeps only `isLibraryCandidate` items: well-formed
  (`id`, `sources`) with no `storage` field. Anything else is skipped silently.
- **Device store:** `WebResultRepository` (`src/data/repositories/webResultRepository.ts`), its own
  Dexie table `webResults` (schema v5), apart from the library and Wikimedia references.
  - `save` takes only `DeviceResult[]` (a `none` result doesn't compile) and also skips anything
    that fails `isDeviceResult` at run time.
  - One row per normalized query: `{ key, savedAt, results }`. Rows expire after **30 days**
    (expired rows are never returned and are pruned on the next save).
  - **Saved only while search history is on**, because rows are keyed by the query. With history
    off, nothing is saved and kept rows aren't shown.
  - **Clear history and Reset delete them** (`SearchHistoryRepository.clear`, `resetUserData`).
  - Shown as "Community suggests… (unverified)" with "Saved <date>" and **Refresh**, which asks
    Parallel again (through consent if the setting is still Ask first) and replaces the row.
- **Never leaves the device:** nothing kept is sent to `/api` or anywhere else; the search sends only
  `{ q }`. A test checks that no network code (`src/services/**`, `api/**`) touches the store. A
  future cross-device sync (Supabase) must skip the `webResults` table; comments at the table and
  the repository say so.
- Wikimedia candidates carry no storage level: their licences allow caching (D31).

Results never reach the session cache (`withSessionCache` wraps only the Wikimedia lookup), search
history's reference IDs, favourites or the library.

---

## 2. Architecture

```
Phone or friend's browser (the app is public)
  │  POST /api/unlock {code}        → sets an HttpOnly cookie (30 days)
  │  POST /api/web-search {q}       → cookie checked first
  │  POST /api/lock                 → clears the cookie ("Forget access code")
  ▼
Vercel edge ── Firewall rate limit (per IP)
  │
  ▼
api/unlock.ts, api/web-search.ts, api/lock.ts   (Vercel Functions, Node.js runtime)
  api/_lib/access.ts   access code + signed cookie   (the one swappable access piece)
  api/_lib/http.ts     JSON answers, cross-site check, capped body reader
  api/_lib/snippet.ts  best sentence per result, duplicate-page key (no AI)
  api/_lib/devFlags.ts, fakeParallel.ts   local-only test switches (never on a deployment)
  │  POST https://api.parallel.ai/v1/search   (x-api-key header, 8 s timeout)
  ▼
Parallel Search API  (mode "fast": $1 per 1,000, about 700 ms)
```

- Files under `api/_lib/` are helpers, not routes (Vercel skips names starting with `_`).
  `.vercelignore` keeps `api/**/*.test.ts` from being deployed as functions.
- No database, no accounts. The only state is the in-memory daily counter.
- Environment variables, server only (no `VITE_` prefix, so Vite never bundles them), never logged:
  `PARALLEL_API_KEY`, `ACCESS_CODE`, `ACCESS_COOKIE_SECRET`.
- The function never forwards the visitor's IP, cookies, User-Agent or anything else. Parallel sees
  only the query text and our key.

### Why `mode: "fast"`

Parallel's default mode is `advanced`, which costs **$5 per 1,000**. `fast` and `turbo` cost **$1 per
1,000**. `turbo` supports English and Japanese only, and our Hinglish queries need more than that.
So the function always sends `"mode": "fast"`. With the "$5 free monthly" credit, that is the "up to
5,000 free requests per month" the pricing page mentions.

### Why JSON, not MessagePack

The answer is at most 16 KB and usually 3–5 KB of mostly text, about 1–2 KB once Vercel compresses
it (brotli/gzip, automatic for `Content-Type: application/json`). MessagePack would save almost
nothing after compression and add a library on both ends. **Revisit MessagePack if responses ever
carry numeric-heavy data such as embedding vectors.**

---

## 3. Request and response

### Access (`api/_lib/access.ts`)

- `POST /api/unlock` with `{ "code": "…" }` (body at most 1 KB, code 1–200 characters).
  - The code is compared in constant time: SHA-256 of both sides, then `crypto.timingSafeEqual`.
  - Right code: **200**, and the cookie
    `pcd_access=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=2592000` (30 days).
  - Wrong code: a fixed 1 s delay, then **401** `{ "error": "wrong_code" }`, no cookie.
  - After 10 wrong codes in a minute (per function instance), every attempt gets **429**
    `too_many_attempts` until the minute is over. The Firewall rule is the shared limit.
  - Bad body: **400** `bad_request`. Cross-site: **403**. Settings missing or weak: **503**.
- The token is `<expiry>.<code version>.<signature>`:
  - expiry: Unix seconds, 30 days ahead;
  - code version: HMAC-SHA256(`ACCESS_COOKIE_SECRET`, "code-version:" + `ACCESS_CODE`), first 16
    characters. Keyed with the secret, so the cookie never holds a plain hash someone could test code
    guesses against. **Changing `ACCESS_CODE` changes the version, so every old cookie stops working.**
  - signature: HMAC-SHA256 with `ACCESS_COOKIE_SECRET` over `<expiry>.<version>`, compared in
    constant time.
- `api/web-search.ts` checks the cookie before anything else: signature, expiry, version.
- `POST /api/lock` answers with the same cookie and `Max-Age=0`, which clears it.
- **Never open by default:** if `ACCESS_CODE` is missing or shorter than 12 characters, or
  `ACCESS_COOKIE_SECRET` is missing or shorter than 32, unlock and search answer **503**.
- The access check is one function passed into the search handler (`checkAccess`), so switching to
  another scheme later means replacing `_lib/access.ts` only.

### Phone → search

`POST /api/web-search` with the JSON body `{ "q": "<text>" }` and the cookie. The query is never
in the URL, so it can't end up in Vercel's request logs (which record URLs); our code logs nothing
either. In order:

1. `Sec-Fetch-Site` present and not `same-origin` → **403** `cross_site`.
2. Access settings missing → **503** `not_configured`; no valid cookie → **401** `locked`.
3. Body read with a **1 KB cap**; it must be JSON with a string `q` (a `q` in the URL is ignored).
   `q` trimmed, whitespace collapsed, 2 to 200 characters, no control characters (`\p{Cc}`).
   Otherwise **400** `bad_query`.
4. `PARALLEL_API_KEY` missing → **503** `not_configured`.
5. Daily cap reached → **429** `daily_cap`.

### Function → Parallel

```json
POST https://api.parallel.ai/v1/search
x-api-key: <PARALLEL_API_KEY>
Content-Type: application/json

{
  "objective": "Explain \"<q>\": what it means or refers to in pop culture or internet culture (films, TV, comics, games, music, memes, slang), and where it comes from.",
  "search_queries": ["<q>"],
  "mode": "fast",
  "max_chars_total": 6000,
  "advanced_settings": { "max_results": 10 }
}
```

The `objective` asks for meaning and origin, so Parallel's excerpts explain rather than just
mention the words (2026-11-16; `objective()` in `api/web-search.ts`). No `session_id`, so Parallel
can't link one search to the next. Redirects are refused. Parallel's answer is read with a
**256 KB cap**; anything bigger is a 502.

### Function → phone

**200**

```json
{
  "storage": "device",
  "results": [{ "title": "…", "url": "https://…", "snippet": "…", "storage": "device" }]
}
```

**Text only.** Every result is rebuilt from three fields; everything else Parallel sends (images,
favicons, media, HTML, page content, dates) is dropped:

- at most **10** results; copies dropped: the same page under another URL form (`www.`, `m.`,
  `old.`, trailing slash, `#fragment`, `utm_` tags; other query parameters count) and the same
  snippet text on another site;
- `url`: must parse, `https:`, no username or password, at most 2,048 characters; otherwise dropped;
- `title`: tags and Markdown removed, cut to **120** characters; if missing, the URL's host name;
- `snippet`: every excerpt with Markdown images removed, links reduced to their words, HTML tags and
  Markdown marks removed, a few entities decoded, whitespace collapsed; then, without AI
  (`api/_lib/snippet.ts`), it starts at the sentence sharing most words of the search (other forms
  count, "depressing" for "depressed"; "means", "refers to", "comes from" and similar add weight) and
  runs to the end of that excerpt; the first excerpt when no sentence matches; cut to **300**
  characters with "…";
- the whole answer stays **under 16 KB**: results are dropped from the end until it fits.

The server never fetches, proxies or embeds a result's page or media. The phone shows each URL only
as a link (new tab, no referrer); never as an `<img>`, `<video>` or frame (tested). CSP also blocks
media (`media-src 'none'`, `frame-src 'none'`).

### Errors

| Status | Body `error`                | When                                                                                   |
| ------ | --------------------------- | -------------------------------------------------------------------------------------- |
| 400    | `bad_query` / `bad_request` | Bad or oversized search body / bad unlock body                                         |
| 401    | `locked`                    | No valid access cookie                                                                 |
| 401    | `wrong_code`                | Unlock with the wrong code                                                             |
| 403    | `cross_site`                | `Sec-Fetch-Site` present and not `same-origin`                                         |
| 429    | `daily_cap`                 | The function's own per-day cap is used up                                              |
| 429    | `rate_limited`              | Parallel answered 429                                                                  |
| 502    | `provider_failed`           | Parallel's other errors, network failure, 8 s timeout, over 256 KB, or unexpected JSON |
| 503    | `not_configured`            | `ACCESS_CODE`, `ACCESS_COOKIE_SECRET` or `PARALLEL_API_KEY` missing or too weak        |

Every answer carries `Cache-Control: no-store` and `Content-Type: application/json`. No
`Access-Control-Allow-Origin` header, so only same-origin pages can read the answers. The Firewall's
own 429 blocks before the function runs.

---

## 4. Limits

| Limit               | Value                                       | Enforced by                                |
| ------------------- | ------------------------------------------- | ------------------------------------------ |
| Query length        | 2–200 characters, in a body of at most 1 KB | function                                   |
| Results per search  | 10                                          | function and `max_results`                 |
| Parallel's answer   | 256 KB                                      | function (capped reader)                   |
| Our answer          | 16 KB                                       | function (drops results from the end)      |
| Upstream timeout    | 8 s                                         | function                                   |
| Unlock body         | 1 KB                                        | function                                   |
| Wrong code          | 1 s delay                                   | function                                   |
| Wrong codes         | 10 per minute, then 429                     | function (per instance)                    |
| Unlock attempts     | 5 per 10 minutes per IP                     | Vercel Firewall rule (section 6)           |
| Searches per IP     | 20 per 60 s                                 | Vercel Firewall rule, Pro only (section 6) |
| Searches per day    | 150 per UTC day                             | function (best effort, section 5)          |
| Parallel's own rate | 600 per minute                              | Parallel                                   |

**150 a day** keeps a full month (31 × 150 = 4,650) under the ~5,000 free `fast` searches.

---

## 5. Cost guard

1. **Access code:** only people with the code can search at all.
2. **In the function (best effort):** a counter in memory, reset at UTC midnight. At 150 the
   function answers 429 `daily_cap` without calling Parallel. Each warm instance has its own counter
   and a cold start resets it, so serverless can let more through. It is a brake, not a guarantee.
   (Exact needs a shared store such as Upstash Redis: not built.)
3. **In Parallel's dashboard (the real backstop):** turn **auto-reload off** and set a **monthly
   spend limit** of a few dollars (the Build plan lists "Auto-reload and spend limits"). The exact
   menu path was **not verified** (no account was used); look under billing or usage settings.

---

## 6. Access and the firewall (owner's clicks)

### Vercel Authentication: leave it off

Vercel dashboard → project → **Settings** → **Deployment Protection** → **Vercel Authentication**:
**off** (or scope "Standard Protection", which leaves the production domain public). The access
code protects only `/api/web-search`.

### Firewall rules

Vercel's **Hobby plan allows one rate-limit rule per project** (Pro allows 40). With one rule, put
it on `/api/unlock`: guessing the code is the risk only the firewall can slow. Searches already need
a valid cookie and are capped per day and by Parallel's spend limit.

**Rule 1 (all plans): unlock attempts**

1. Vercel dashboard → select the project → **Firewall** (sidebar).
2. **Configure** (top right) → **+ New Rule**.
3. Name: `unlock attempts`.
4. **If**: `Request Path` · `Equals` · `/api/unlock`.
5. **Then**: **Rate Limit** (the first time, read the pricing dialog and select **Continue**).
6. Strategy **Fixed Window**, **Time Window** `600s` (10 minutes, Hobby's maximum), **Request Limit**
   `5`, key **IP**.
7. Action: **Too Many Requests (429)**.
8. **Save Rule** → **Review Changes** → **Publish**.

**Rule 2 (Pro only): searches**
Same steps, name `web-search`, path `Equals` `/api/web-search`, window `60s`, limit `20`, key **IP**.
The rules match on path only, so the search moving from GET to POST changes nothing in them.

Vercel counts per region, so traffic from two regions can exceed a limit in total.

### Choosing and rotating the code

- `ACCESS_CODE`: at least 12 characters (shorter answers 503); prefer 4 random words, since the
  firewall allows 5 guesses per 10 minutes per IP and many IPs can guess at once.
- `ACCESS_COOKIE_SECRET`: at least 32 characters, random. Make one with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` (run it in your
  own terminal, paste it straight into Vercel, and don't save it anywhere else).
- **To rotate the code:** change `ACCESS_CODE` in Vercel (Settings → Environment Variables) and
  redeploy. Every existing cookie stops working at once, and friends enter the new code.
- **To sign everyone out without changing the code:** change `ACCESS_COOKIE_SECRET` and redeploy.

---

## 7. Changes outside `api/`

| File                | Change                                                                                                 | Why                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vercel.json`       | SPA rewrite source `/((?!api/)(?!@)(?!.*\\.).*)`                                                       | Keeps `/api/*` out of the app-page rewrite (the reviewer notes Vercel checks functions first anyway). `(?!@)` keeps Vite dev paths (`/@vite/client`, `/@react-refresh`) out under `vercel dev`; no production path starts with `@` |
| `.vercelignore`     | `api/**/*.test.ts`                                                                                     | Test files next to the functions must not deploy as functions                                                                                                                                                                      |
| `vite.config.ts`    | `api/**/*.test.ts` in `test.include`; `navigateFallbackDenylist: [/^\/api\//]`; `useCredentials: true` | Run the server tests; never answer an API URL with the app shell; manifest fetched with cookies (harmless now the app is public, kept in case protection returns)                                                                  |
| `tsconfig.json`     | `"api"` in `include`                                                                                   | Typecheck the functions                                                                                                                                                                                                            |
| `eslint.config.js`  | `api/**/*.ts`: Node globals, `fetch` allowed                                                           | Server code                                                                                                                                                                                                                        |
| `src/test/setup.ts` | skip DOM cleanup when there is no `document`                                                           | The server tests run in the Node environment                                                                                                                                                                                       |
| `package.json`      | `dev:full` and `dev:phone` (`npx --yes vercel@65.9.0 dev --local …`)                                   | Run app and functions together locally (section 10a)                                                                                                                                                                               |
| `.env.example`      | names of every variable, no values                                                                     | Template for `.env` (git-ignored; `vercel dev` reads only `.env`, not `.env.local`)                                                                                                                                                |

No new dependencies. Functions use the Web-standard `export function POST(request: Request)`
signature that Vercel supports for `api/` files. Relative imports in `api/` end in `.js`, as Node's
ES modules need at run time (the project is `"type": "module"`).

---

## 8. Tests (mocked, no real secrets)

- `api/web-search.test.ts`: access (no cookie → 401, valid cookie → 200, missing settings → 503,
  access checked before the query); validation, including non-JSON, empty, non-string `q`, a body
  over 1 KB and a `q` sent only in the URL; the upstream request (fast mode, key header, no
  session ID); text-only results with `storage: "device"` from the policy table; media fields and images/HTML stripped;
  caps (10 results, 120/300 characters); our answer under 16 KB with long multi-byte text; Parallel's
  answer over 256 KB → 502; repeated and unsafe URLs dropped; errors (500 → 502, 429 → 429, network,
  bad JSON, timeout); daily cap; headers; nothing logged (query, key, cookie).
- `api/devMode.test.ts`: dev flags off unless `1` and always off on production and preview; the fake
  provider answers cleaned, capped, `device` results without a key or calling Parallel, still needs
  the cookie, and is ignored in production; the insecure dev cookie drops `Secure` only locally.
- `api/access.test.ts`: right and wrong code, the 1 s delay, `timingSafeEqual` used, cookie flags,
  bad bodies, missing or weak settings → 503, cross-site, nothing logged; tampered, expired,
  wrong-secret and old-version cookies rejected; lock clears the cookie.
- `src/services/retrieval/webSearch.test.ts`: the query sent as a POST body and never in the URL,
  same-origin call options, CSP coverage, offline,
  status mapping, timeout, cancel, unlock/lock calls, and storage parsing (missing, malformed,
  unknown or one-sided `device` → `none`; `shared` → `device`).
- `src/data/repositories/retrievalRepository.test.ts`: `@ts-expect-error` proving `saveCandidates`
  refuses `EphemeralResult`, `DeviceResult` and a candidate with a `storage` level; run-time skip;
  ordinary candidates still saved.
- `src/data/repositories/webResultRepository.test.ts`: device results saved and read back by
  normalized query; `none` refused by type and skipped at run time; mixed batches; 30-day expiry and
  pruning; malformed rows dropped; Clear history and Reset delete them; the v4 → v5 upgrade; and the
  rule that no file in `src/services/**` or `api/**` touches the store.
- `src/features/search/WiderWebSearch.test.tsx`: consent, results shown and kept only in the device
  store (every other table compared before and after, online lookup never run); nothing kept with
  history off or for `none` results; kept results shown with "Saved <date>" and Refresh calling the
  API again; kept results hidden with history off; no media elements, "On"/"Off", library
  hit, failure and retry; 401 → code form → unlock → retry, the code never in IndexedDB,
  localStorage, sessionStorage or `document.cookie`; wrong code; Settings wording; "Forget access
  code".

---

## 9. Client

- `src/services/retrieval/webSearch.ts`: `search`, `unlock`, `lock`, all same-origin POSTs with a
  JSON body (the query never goes in a URL), with a timeout,
  a size cap, `credentials: 'same-origin'` (the cookie goes along), no redirects, typed failures.
  CSP `connect-src 'self'` already covers `/api/*` (checked in `hosts.ts` and tested).
- `src/features/search/WiderWebSearch.tsx`: "Search the wider web" only on a local miss (in "Look it
  up elsewhere", or under "Not what I meant" when online results are shown), only after a tap.
  - Setting **Wider web search** (Ask first / On / Off, default Ask first): Ask first shows the
    consent card; agreeing stores On; Off hides the button.
  - On 401 `locked`: an "Enter access code" form (password field, cleared on submit, never stored),
    then the search runs again.
  - Results: **"Community suggests… (unverified)"**, each a title link, the site name and the
    snippet as plain text, with a line saying whether they are kept on this device.
  - Kept results (history on, under 30 days old) show first with "Saved <date>" and **Refresh**;
    they also show offline, where Refresh is disabled.
- Settings: the wording below in short, and **Forget access code** (calls `/api/lock`).
- Known limit: if online results arrive while a wider-web search is on screen, the block moves into
  the collapsed "Not what I meant" area. Fresh results are then shown again only from the device
  store (if kept), otherwise after a new tap.

### Privacy wording (consent card)

> **Search the wider web?** Your search text goes through our server to Parallel (parallel.ai), a
> paid web-search service. Nothing else is sent: no account, no device details, no location.
> Parallel keeps searches and may use them to improve its service. Results are links to other
> sites, and nobody has checked them. Results from the wider web can be kept on this device, for
> you only, for 30 days while search history is on. They are never sent anywhere else, and Clear
> history deletes them.

---

## 10. Owner to-do list

1. **Sign up at parallel.ai**, add a card, create an API key. Keep it out of chat, code and files.
2. In Parallel's dashboard: **auto-reload off**, **monthly spend limit** of a few dollars.
3. **Link the Vercel project** from the repo folder, if not linked yet.
4. **Set three Production environment variables in Vercel** (the CLI asks for each value, so it
   doesn't land in shell history; mark them **Sensitive** in the dashboard if offered):
   `PARALLEL_API_KEY`, `ACCESS_CODE` (12+ characters, ideally 4 random words, see section 6),
   `ACCESS_COOKIE_SECRET` (32+ random characters).
5. **Vercel Authentication: off** (section 6).
6. **Firewall (do this before sharing the code):** the unlock rule (5 per 10 minutes per IP). On
   Pro, also the search rule.
7. Run the checks, deploy, and test from the phone.
8. Share the code with friends in person or a private message, never in the repo.

### Commands (for the owner to run)

```bash
rtk npx --yes vercel@65.9.0 link
```

```bash
rtk npx --yes vercel@65.9.0 env add PARALLEL_API_KEY production
```

```bash
rtk npx --yes vercel@65.9.0 env add ACCESS_CODE production
```

```bash
rtk npx --yes vercel@65.9.0 env add ACCESS_COOKIE_SECRET production
```

Check, then deploy. `deploy:check` runs every gate check in order and stops at the first failure:
the security audit gate, typecheck, lint, code formatting (`src`, `api`, `scripts`, `e2e`; docs are
not checked), unit tests, browser tests on a fresh build (`CI=1`, so a stale preview server is never
reused) and the bundle scan. `deploy:preview` and `deploy` run it first and deploy only if it
passes; Vercel then builds the app itself from the uploaded source. Keys live only in Vercel.

```bash
rtk npm run deploy:check
```

Optional: a preview deployment (its own URL, production data untouched) to try first:

```bash
rtk npm run deploy:preview
```

Production:

```bash
rtk npm run deploy
```

If a deployment misbehaves, put the previous one back (Vercel keeps them):

```bash
rtk npx --yes vercel@65.9.0 rollback
```

Then on the phone: search "why are ferrari fans depressed", tap **Search the wider web**, agree,
enter the code, and check the "Community suggests… (unverified)" list. In Settings, tap **Forget
access code** and search again: the code form should come back.

---

## 10a. Run it locally

`npm run dev` (Vite alone) does not serve `/api`. `npm run dev:full` runs `vercel dev`, which serves
the Vite app and the `api/` functions together on one origin. The Vercel CLI is pinned
(`vercel@65.9.0`, published 2026-10-31) and run with `--local`, so **no Vercel login and no
`vercel link` are needed**; settings come from `vercel.json` and `.env`.

Two local-only switches (`api/_lib/devFlags.ts`), honoured only when set to `1` and **ignored on any
Vercel deployment** (`VERCEL_ENV` `production` or `preview`; tested):

- `WEB_SEARCH_FAKE=1`: the function answers with three canned results ("Local test result 1–3",
  `https://example.com/local-test/…`) in Parallel's own shape. They go through the same cleaning,
  caps and `storage: "device"` level as real answers. Parallel is never called, so no key and no
  spending. The access code still applies, so the whole flow can be tested.
- `ACCESS_COOKIE_INSECURE_DEV=1`: the access cookie is set without `Secure`, for a phone on plain
  http (below). Everything else about the cookie stays the same.

### On this computer

1. Install dependencies:

   ```bash
   rtk npm install
   ```

2. Create `.env` (git-ignored) from the template, then open it and fill in `ACCESS_CODE`
   (12+ characters) and `ACCESS_COOKIE_SECRET` (32+ random characters; the template shows a command
   that makes one). Keep `WEB_SEARCH_FAKE=1` and leave `PARALLEL_API_KEY` empty.

   ```bash
   cp .env.example .env
   ```

3. Start the app and the functions together:

   ```bash
   rtk npm run dev:full
   ```

4. Open http://localhost:3000. Browsers accept `Secure` cookies on `http://localhost`, so no switch
   is needed here.
5. Search **why are ferrari fans depressed**. Under "Look it up elsewhere", tap **Search the wider
   web**, agree in the card, then type your `ACCESS_CODE` in **Enter access code** and tap
   **Unlock**. Three "Local test result" links appear under "Community suggests… (unverified)",
   marked "Kept on this device for 30 days, for you only."
6. **Device-only saving:**
   - Reload the page: the same block comes back with "Saved <date>" and **Refresh**. Refresh asks
     the function again.
   - DevTools → Application → IndexedDB → `pop-culture-decoder` → `webResults` shows one row. The
     `references` and `sources` tables gain nothing.
   - Settings → Search history **Off**, then search a new question: the block says "Not saved on
     this device." and `webResults` gains no row. Saved rows are not shown while history is off.
   - Settings → **Clear history** (history back On first, if you like): the `webResults` row is gone.
7. **Offline:** with the page open, DevTools → Network → **Offline**, then search the same question
   again from the search box (no reload: the dev server has no service worker). The saved block
   shows, and Refresh is disabled. Switch back to **No throttling** afterwards.
8. **Access code:** Settings → **Forget access code**, then tap Refresh: the code form comes back.
9. **Real Parallel, optional:** put the key in `PARALLEL_API_KEY`, set `WEB_SEARCH_FAKE=` (empty)
   and restart. This spends Parallel credit.

If the search answers "The wider web search isn't set up on the server yet", `vercel dev` did not
read `.env`: the file must be named `.env` (`vercel dev` ignores `.env.local`); check the names and
values, then restart.

### On the phone over Wi-Fi

The phone reaches the Mac at `http://<Mac's address>:3000`, which is not `localhost`, so it is plain
http. Whether Chrome accepts a `Secure` cookie there, even with the "Insecure origins treated as
secure" flag, is **not verified** (no source confirms it). So use the local-only switch.

1. In `.env`, set `ACCESS_COOKIE_INSECURE_DEV=1`.
2. Find the Mac's Wi-Fi address:

   ```bash
   ipconfig getifaddr en0
   ```

3. Start the server listening on the network:

   ```bash
   rtk npm run dev:phone
   ```

   If macOS asks whether `node` may accept incoming connections, allow it. `--listen 0.0.0.0:3000`
   is **not verified** with this CLI version; if it errors, use `--listen 3000` and check what it
   binds to with `lsof -iTCP:3000 -sTCP:LISTEN`.

4. On the phone (same Wi-Fi), optional but useful for features that need a secure page: Chrome →
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → add `http://<Mac's address>:3000` →
   **Enabled** → **Relaunch**.
5. Open `http://<Mac's address>:3000` on the phone and repeat steps 5–8 above.
6. When done, set `ACCESS_COOKIE_INSECURE_DEV=` (empty) again. It is ignored on Vercel anyway.

## 11. Not done, on purpose

- No database, accounts, or exact global counter. Parallel's spend limit is the backstop.
- No response caching anywhere (terms).
- No Brave fallback in code. If Parallel's coverage of Reddit and Indian pop culture is poor in the
  phone test, swap the upstream call; the contract above stays the same.
- Parallel's Reddit and Hinglish coverage: **not verified** (needs the key).
- An exact cross-device rule for `device` results: there is no sync yet; when one is built it must
  skip the `webResults` table.
- The browser may still offer to remember the code in its own password manager; the app itself never
  stores it.

---

## 12. Card drafts: `/api/draft-card`

Spec: `docs/superpowers/specs/2026-11-18-ai-card-drafts-design.md`; decision D63. Status: **built, not run against real providers.**

**What it does.** Takes the search, up to 6 picked sources (at most 3 web links) and up to 2 tone cards. Parallel Extract reads the picked web pages, then a model writes one card from them. The model curates only; the prompt (`card-draft-v7`) says to invent no facts. The AI never sees a URL. Same access-code cookie as `/api/web-search`.

**Environment** (Vercel project settings; never in the repo):

| Name                                            | Use                                                   |
| ----------------------------------------------- | ----------------------------------------------------- |
| `OPENAI_API_KEY`                                | OpenAI, first provider (`gpt-6-luna`)                 |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI, fallback (Llama 3.3 70B fast)  |
| `PARALLEL_API_KEY`                              | Parallel Extract (and Search)                         |
| `CARD_DRAFT_FAKE`                               | `1` on a local machine only: a canned answer, no cost |

With `WEB_SEARCH_FAKE=1` Extract also answers locally (inline in `api/_lib/parallelExtract.ts`).

**Providers and fallback.** OpenAI first; if it fails, Cloudflare is tried. A cancelled request does not start the next provider.

**Limits.** Request body 48 KB; 50 drafts a day per server instance (the providers' spend limits are the real cap); model call aborted after 20 s; Vercel `maxDuration` 30 s (`vercel.json`); at most 800 output tokens.

**Caching.** OpenAI: explicit prompt cache, 30 m, breakpoint after the fixed prefix, `prompt_cache_key` = the prompt version. Drafts themselves are never cached on the server.
