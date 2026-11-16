# Security

## Dependency vulnerabilities

`npm run audit:gate` (also run in CI on every push, pull request and weekly):

- **Shipped code** (`npm audit --omit=dev`): any advisory fails the gate unless it is reviewed.
- **Dev tooling**: high and critical advisories fail; moderate and low are printed as warnings.
- **Reviewed exceptions** live in [`security/audit-allowlist.json`](security/audit-allowlist.json).
  Each one needs a reason explaining why it can't be exploited here, and an expiry date. Expired
  entries fail the gate, so an exception can't quietly become permanent.
- A registry or network error fails the gate instead of passing on an empty report.

Dependabot (`.github/dependabot.yml`) opens weekly update PRs for npm packages and GitHub Actions.
Enable Dependabot alerts and security updates in the GitHub repository settings after the first
push.

**Adding an allowlist entry:** confirm the vulnerable code path is unreachable in this app, write
down why, set an expiry of at most about three months, and plan the upgrade. Never run
`npm audit fix --force` blindly; it can jump major versions.

## Code-level guards

- **ESLint** bans `eval`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML`/`outerHTML`
  assignment, `insertAdjacentHTML`, `document.write`, `javascript:` URLs, and `target="_blank"`
  without `rel="noopener"`. Network globals (`fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`) are allowed only under `src/services/`.
- **Content Security Policy** (production builds): same-origin scripts, styles, images, workers
  and connections; no plugins. The one inline exception is the hash of an *empty* `<style>`, which
  Motion's `popLayout` creates before inserting its rule through the CSSOM; inline CSS with content
  is still blocked. An e2e test fails on any CSP violation. `connect-src` lists only `'self'` and the
  retrieval hosts in `hosts.ts`; the wider-web search is our own `/api/web-search`, so `'self'`
  covers it.
- **Untrusted provider data:** every Wikimedia response is validated field by field; links are kept
  only if they are `https` on the expected host; Wikidata IDs are checked before going into SPARQL;
  excerpts are capped and rendered as plain text.
- **Wider-web search (D45):** Vercel Functions (`api/web-search.ts`, `api/unlock.ts`,
  `api/lock.ts`) hold the Parallel key and the access-code settings in server-only environment
  variables (never `VITE_`). Search needs a signed, HttpOnly access cookie; the code is compared in
  constant time and never stored on the device. The functions validate input, log nothing, return
  text only (no media), cap sizes (256 KB in, 16 KB out) and answer with `Cache-Control: no-store`.
  Results carry a storage level from a per-provider table; Parallel's is `device`: kept only in this
  device's own IndexedDB store (30 days, only while search history is on, deleted by Clear history
  and Reset), never in the library, never sent to any server or sync (type, run-time and source
  checks). Two local-testing switches (`WEB_SEARCH_FAKE`, `ACCESS_COOKIE_INSECURE_DEV`) are ignored
  whenever `VERCEL_ENV` is `production` or `preview` (tested).
  See `docs/BACKEND_PLAN.md`.
- **Privacy:** nothing leaves the device until the user agrees to online search (tests check this).
  Requests send no cookies or referrer. Search history (on by default, D37) stays on the device
  and is never sent. External links open only on
  tap with `noopener noreferrer`, and stored settings are validated before use.

## External data and links (threat model)

| Risk | Guard | Where |
|---|---|---|
| A bug or hostile data makes the app call another host | HTTP client refuses any host not in `hosts.ts` (Wikipedia, Wikidata, Wiktionary, Wikiquote, TVmaze; https only) before `fetch`. CSP `connect-src` is built from the same list, so the two can't drift (unit-tested) | `services/retrieval/hosts.ts`, `http.ts`, `vite.config.ts` |
| Identifying header sent where it isn't wanted, or forcing a failing preflight | `Api-User-Agent` goes to Wikimedia hosts only; TVmaze gets a plain GET with no custom header | `hosts.ts`, `http.ts` |
| Redirect to another host, or a redirect loop | `redirect: 'error'`: redirects are never followed | `http.ts` |
| Recursive crawling / link-following | None exists: a fixed, bounded set per search. Wikipedia, Wiktionary and Wikiquote first, then one Wikidata query, then at most 2 TVmaze title lookups for series Wikidata identified. Lookups use article titles, never URLs. URLs found in responses are never fetched; external pages are only ever linked | `retrieve.ts` |
| Huge or endless response exhausts memory | Body read with a 1 MB cap (declared length checked first, then streamed bytes); per-request timeout; ≤2 retries with capped back-off | `http.ts` |
| Someone else spends the paid search key | Access code → signed HttpOnly cookie (HMAC, expiry, code version) checked before anything else; constant-time code check, code at least 12 characters, 1 s delay on a wrong code, 429 after 10 wrong codes a minute (per instance), Firewall limit of 5 unlock attempts per 10 minutes per IP; per-day cap of 150; Parallel's own spend limit; `Sec-Fetch-Site` other than `same-origin` refused; missing settings answer 503, never open | `api/_lib/access.ts`, `api/unlock.ts`, `api/web-search.ts`, Vercel and Parallel dashboards |
| Search text, the code, the cookie or the key leaks | The functions never log; secrets are read only from the server environment and never returned; the client never stores the code (unit-tested) | `api/`, `WiderWebSearch.tsx` |
| Results kept against the provider's terms | Storage level (`none`/`device`/`shared`) set per provider on the server; missing or unknown → `none`. Wider-web results can't be passed to `saveCandidates` (type) and are skipped there at run time; `device` results go only to the device store, which no network code may import (tested) | `api/web-search.ts`, `webSearch.ts`, `retrievalRepository.ts`, `webResultRepository.ts` |
| Media or huge answers from the provider | Text only (three fields rebuilt, images and HTML stripped), 256 KB read cap, 16 KB answer cap; result URLs are only links | `api/web-search.ts`, `WiderWebSearch.tsx` |
| Injected script or HTML from provider text | Text only, never HTML. Wikiquote snippets and TVmaze summaries arrive as HTML: tags are stripped and entities decoded into plain text, which React renders as text. Lint bans HTML sinks and `eval`; CSP `script-src 'self'`, no inline scripts | `validate.ts` (`htmlToText`), lint config, CSP |
| `javascript:`/`data:`/non-https link from provider data or a tampered cache | Validated on the way in (`safeUrl`, per-site ID patterns) **and** again at render (`safeHref`); unsafe links are not rendered | `validate.ts`, `externalLinks.ts`, `components/ui/safeHref.ts` |
| SPARQL injection via IDs | Only `Q<digits>` IDs are interpolated | `wikidata.ts` |
| Leaking context to sites the user opens | Links open in a new tab with `noopener noreferrer` and `referrerPolicy="no-referrer"`; API requests send no cookies or referrer | link components, `http.ts` |
| App embedded by another site (clickjacking) | `frame-ancestors 'none'` + `X-Frame-Options: DENY` (hosting headers); CSP `frame-src 'none'` so the app embeds nothing | `vercel.json`, CSP |
| Downloads | The app never triggers downloads, has no `download` links, blocks plugins (`object-src 'none'`) and media | CSP |

**What the app cannot control:** once someone taps an external link, that site runs in its own
tab under the browser's rules, including its download prompts and Safe Browsing checks. That's
why links are tap-only, labelled as opening outside the app, and limited to https.

## Code and supply-chain integrity

**Production build contents:** `vite build` bundles only code reachable from `src/main.tsx`, in
production mode (React production build, minified, no source maps). Tests, test helpers, recorded
fixtures and the dev-only component gallery are excluded; `npm run check:dist` fails the build in CI
if any test file, fixture, source map or test-only string appears in `dist/`.

In place: lockfile + `npm ci` in CI, the audit gate, Dependabot, CSP `script-src 'self'` (no
third-party or inline scripts), same-origin service worker that only caches the app's own build.
`vercel.json` adds HSTS, `nosniff`, `no-referrer`, `Permissions-Policy` (camera, mic, location,
payment, USB off) and COOP; these apply only when deployed there (not on `vite preview`).

Recommended once the repository is on GitHub (owner settings, not code):
- Protect `main`: require pull requests, the CI check and at least one review; block force-pushes.
- Pin GitHub Actions to commit SHAs (Dependabot keeps them updated).
- Turn on Dependabot alerts, secret scanning and push protection.
- Consider `ignore-scripts=true` in `.npmrc` after checking no dependency needs install scripts.

Not done (deliberately): Trusted Types would also guard DOM sinks, but it requires a policy for
the service-worker registration script; revisit in Phase 5. Subresource Integrity adds little
for same-origin assets.

## Reporting

This is a personal project; report issues to the repository owner directly.
