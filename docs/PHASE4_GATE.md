# Phase 4 gate (2026-11-16): approved by the owner

**Approved 2026-11-16.** The owner approved Phase 4; Phase 5 is next.

Spec §5 Phase 4 gate: _browse all supported decades/categories; test favourites, related links,
offline, determinism where needed and accessible interactions._ Plan and owner decisions:
`docs/PHASE4_PLAN.md`; decision record D49. Not committed yet.

## Gate criteria

| Criterion                              | Evidence                                                                                                                                                                                                                                                                                                                   | Status                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Browse every decade and category**   | "By era" (category chips filter the era groups: Before 1990, 1990s, 2000s, 2010s & later, Timeless) and "By type" (one section per type with a count). App tests switch views and check every section; empty types each get their own hint; empty era-view categories say how to find one                                  | ✅                                                 |
| **What appears is real and explained** | Library entries plus online references the reader opened or favourited, explained from sources; never unexplained ones, never Wikiquote quote pages (`discoverable`, unit and app tests). Online cards say "Found online · Saved <date>"                                                                                   | ✅                                                 |
| **Favourites**                         | Hearts on Discover cards and the Surprise card; favouriting from Discover shows on Favourites; a failed save shows an alert (app tests)                                                                                                                                                                                    | ✅                                                 |
| **Related links**                      | "Also in", "Also inspired by", "Also by", "More from the <era>", each titled with its reason, at most 3 cards, a reference in one group only, works matched by Wikidata ID then name; "Same phrase, different meaning" unchanged (`related.test.ts`, `ReferencePage.test.tsx`). Seen live on Doctor Doom and Hakuna Matata | ✅                                                 |
| **Offline**                            | Playwright: load Discover, go offline, the offline banner and the single offline hint show, switch to "By type", open a reference page. App test: offline hint replaces search hints                                                                                                                                       | ✅                                                 |
| **Determinism**                        | Seeded shuffle gives the same order for the same seed, filtered or not; both browse views order cards by title                                                                                                                                                                                                             | ✅                                                 |
| **Accessible interactions**            | View switch is a labelled radio group ("Browse by"); category chips are a labelled group with `aria-pressed`; every section has a heading; hearts have unique names ("Favourite <title>") and are siblings of card links                                                                                                   | ✅ (by tests and markup; no screen-reader session) |
| **Explain why a suggestion appears**   | Surprise me says where its pick came from ("A random pick from Comics…", "Nothing in Games yet, so this is a random pick from everything."); related groups are titled with their reason                                                                                                                                   | ✅                                                 |
| **No browse history; not trending**    | Nothing new is recorded; "opened" reuses the existing search history (D37). Surprise text says "not a trend" (app test)                                                                                                                                                                                                    | ✅                                                 |

## Commands and results

`npm run deploy:check`, run by the agent at the owner's request on 2026-11-16:

| Step                             | Result                                                   |
| -------------------------------- | -------------------------------------------------------- |
| Audit gate                       | Passed (3 dev-tool warnings)                             |
| Typecheck                        | No errors (after fixing 4 type errors in new test files) |
| Lint                             | 0 errors, 5 warnings (unchanged)                         |
| Code formatting                  | All files pass                                           |
| `npm test`                       | 44 files, **816 passed**                                 |
| `npm run test:e2e` (fresh build) | **26 passed** (360 px and 390 px)                        |
| Bundle scan                      | Clean, 32 files                                          |

Two problems found by the run and fixed: the new Discover tests looked up the Browse section before
the app had opened its database (they now wait for it); and hiding unexplained results from "Same
phrase, different meaning" broke "point break" (films and dictionary sense side by side), so that
part of the review fix was undone.

## Mobile walkthrough (agent, built-in browser, dev server, 2026-11-16)

At **360 × 780** and **390 × 844**, no page scrolls sideways.

| Screen                    | Result                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover, By type         | 8 sections with counts (Comics · 1 = Doctor Doom, opened earlier); "No games yet. Search a game, like Among Us, to find one."; hearts on every card |
| Discover, By era + Comics | Surprise note "A random pick from Comics and what you've opened online, not a trend."                                                               |
| Discover, By era + Games  | "Nothing in Games yet, so this is a random pick from everything."                                                                                   |
| Doctor Doom               | "Also in Fantastic Four", "Also by Jack Kirby"; card "Found online · Saved 16 Nov 2026"                                                             |
| Hakuna Matata (demo)      | "Same phrase, different meaning", "More from the 1990s"                                                                                             |

Not verified: animations. The built-in browser's pane was hidden, so the browser ran **0 animation
frames per second** and every Motion animation stayed at its start (faded cards, the old Surprise card
not leaving). Not an app bug: Playwright runs real frames and passes, and app tests skip animations.
Screen-reader use, the app on the phone.

## Known limits

- "Opened" comes from search history, which expires; an opened online reference that was never
  favourited eventually leaves Discover. Favourite what you want to keep.
- Unfavouriting an online reference you never opened removes it from Discover at once.
- The hint examples (SpongeBob SquarePants, Among Us, Breaking Bad, 6-7, Hasta la vista baby,
  Bohemian Rhapsody, Break a leg) were not each searched live to confirm their type.

## STOP FOR OWNER REVIEW

Phase 4 is ready for review. Next per spec: Phase 5 (visual polish, measured performance,
import/export, accessibility, installability, docs), which also holds the owner's "polish the UI and
make it faster" request.
