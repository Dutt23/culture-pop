# Phase 5 plan: polish and release (started 2026-11-16; full plan to follow)

Spec §5 Phase 5: _refine visual identity, mobile layout, animations, offline/online transitions,
accessibility, error recovery, cache metrics, import/export, PWA installation and documentation.
Profile before optimising; no unsupported performance claims._ Final gate: lint, strict typecheck,
unit/integration, production build, Playwright mobile and desktop, offline/online, citations,
disambiguation, persistence/migrations, backup validity, spoilers, reduced motion, accessibility,
installability; README, architecture, source/licence inventory, model benchmark/fallback, test
results, deployment steps, honest limitations. **STOP for final owner review.**

This file starts with what the owner has already asked for. The full plan is written after a review
of the current state and goes to the owner for approval before building.

## Agreed so far

1. **Polish the UI and make it faster** (owner, 2026-11-16). Measure first (load, smoothness,
   memory), then change; claims only from measurements. Starting point: first load 534 KB, gzip
   176 KB (D48).
2. **"Linked to N in your library"** (owner, 2026-11-16, from `docs/research/related-graph-ui.md`):
   an honest "important" highlight from the reader's own library (how many saved references connect
   to it through shared works or creators, plus favourites). Works offline; never labelled "popular"
   or "trending". About half a day.
   - Not now: a graph view (the demo library has no links to draw; revisit as the library grows,
     as a small no-library SVG view on the unfolded screen); Wikidata language count (optional,
     about a day; biased to Western, older topics); Wikipedia page views (not worth it).
3. **Install and offline on the phone** (owner, Phase 3 sign-off): checked on the vivo once deployed.

## Also from the spec (to plan)

- Import/export backup of favourites, saved links and settings, with a validity check.
- Accessibility pass (keyboard, screen reader names, contrast, reduced motion), desktop Playwright.
- README, architecture, source and licence inventory, deployment steps, honest limitations.
- Cache metrics shown to the reader; LRU eviction only if measured need, never evicting favourites.

## Ideas parked (need an owner decision against the spec's "no hosted inference")

- "Explain with AI" on wider-web results; photo/meme explainer (server vision AI, ~$0.0001–0.0002
  per photo).
