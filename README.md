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

Persisted stores: `references`, `interpretations`, `aliases`, `sources`, `favourites`, `settings`.
No search or browsing history is ever stored.

## Privacy

Phase 1 makes no network requests for searches. External search links (Wikipedia, DuckDuckGo)
open only when you tap them, in a new tab, with `noreferrer`.
