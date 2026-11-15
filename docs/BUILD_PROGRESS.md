# Build progress

## Current phase: 1 — offline foundation

**Status: code complete, NOT VERIFIED. STOP FOR OWNER REVIEW.**
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
