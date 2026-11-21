# Pop Culture Decoder

A mobile-first, installable, offline PWA that explains pop-culture references — quotes, memes,
shows, cartoons, catchphrases and sayings — in plain language, spoiler-free by default.

**Status:** Phase 1 (offline foundation) code written. See `docs/BUILD_PROGRESS.md` for what has
and has not been verified. All library content is clearly marked **demo** content.

## Requirements

- Node.js 22.12+ or 24+ (Node 23 is not supported by Vitest 4) and npm 10+. The project pins
  `nodejs 22.21.1` in `.tool-versions`, which asdf, mise and CI all read.

## Setup

```bash
npm install
npx playwright install chromium
```

## Run

```bash
npm run dev        # http://localhost:5173 — dev server (service worker disabled)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173 (service worker active)
```

The component gallery lives at `/dev/components` in the dev server only; it is not part of
production builds.

## Checks

```bash
npm run lint
npm run typecheck
npm test           # Vitest unit + integration (jsdom + fake-indexeddb)
npm run test:e2e   # Playwright at 360px and 390px (builds and previews automatically)
npm run format:check
npm run audit:gate # dependency vulnerability gate (see SECURITY.md)
npm run check:dist # after a build: proves no tests, fixtures or source maps shipped
```

## Architecture (short)

| Layer | Folder | Responsibility |
|---|---|---|
| Routing / shell / providers | `src/app/` | Routes, layout, storage gate, DI context |
| Design tokens & themes | `src/design/` | Only reset, fonts, a11y base and tokens are global |
| Motion presets | `src/motion/` | Motion for React: `reveal` (enter/stagger/exit), `expand`, reduced variants via `MotionPreferenceProvider` |
| Presentational components | `src/components/` | No data access, no network |
| Feature hooks + pages | `src/features/*` | Coordinate repositories and domain functions |
| Domain | `src/domain/` | Types, normalization, ranking, cache eligibility, pure helpers |
| Persistence | `src/data/` | Dexie schema (`db.ts`), seed, repositories (only layer touching IndexedDB) |

Persisted stores: `references`, `interpretations`, `aliases`, `sources`, `favourites`, `settings`,
`searchHistory`. Search history is on by default, stays on the device, and can be switched off or
cleared in Settings (D37). No browsing history is stored.

## Sign-in

The app needs an account: every page except `/sign-in` sends a signed-out visitor to sign in, then
back to where they were going, and someone already signed in skips the sign-in page (D66). Signing
out, a sign-in that ends mid-use, or signing out in another tab all go back to the sign-in page.
This is a convenience; the server checks the account on every `/api` call. Offline, a device that signed in before keeps working with
what's saved on it and checks again when it's back online; a device that never signed in shows the
sign-in page.
`npm run dev` has no `/api`, so it stops at the sign-in page on a device that never signed in; use
`npm run dev:full` (local Vercel functions, see `docs/BACKEND_PLAN.md`) to sign in locally.

## Privacy

When a search isn't answered by what's saved on the device, the app can look it up on Wikipedia,
Wikidata, Wiktionary and Wikiquote (TVmaze is asked only about TV series they find, never your
search text), but only after you agree (Settings → Online search: Ask first / On / Off).
Only the search text is sent, with no cookies or referrer. Search history stays on the device. Results
and their citations are cached on the device for offline use. External search links open only when
you tap them. When nothing explains a search, a "Search the wider web" button can send the search
text through our own server to Parallel, a paid web-search service that may keep it (Settings →
Wider web search: Ask first / On / Off). It needs you to sign in, and the owner to turn it on for
your account; the app keeps only a sign-in cookie from our server, never a password or token. Those results are links only and
unverified. They can be kept on this device, for you only, for 30 days while search history is on;
they are never sent anywhere, and Clear history deletes them. Sources and their terms: `docs/SOURCE_INVENTORY.md`.
Voice search (the talking TV button in the search box, shown only where the browser supports the Web
Speech API) is turned into text by the browser's own speech service (Google for Chrome, Apple for
Safari), never by our server; the app gets only the text, which is then treated like typed search.
