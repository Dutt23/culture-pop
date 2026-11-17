# Mascot den, genre places and search peek: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Discover, the intro and Search feel alive with the mascot's den, genre places
behind the intro costumes, and a short mascot peek on Search.

**Architecture:** Three decorative, `aria-hidden` SVG components in `src/components/mascot/`, drawn
in code like `Mascot.tsx`, animated with CSS (transform/opacity only). The peek's behaviour lives in
a small hook plus a per-day budget in localStorage, so it can be tested without drawings.

**Tech Stack:** React 19, CSS modules, vitest + Testing Library (fake timers for the peek).

**Spec:** `docs/superpowers/specs/2026-11-17-mascot-den-design.md`

## Global Constraints

- SVG in code, CSS animation, app palette hex values as in `Mascot.tsx`; no image files, no new
  dependencies.
- Animate transform and opacity only.
- Reduced motion (`useMotionPresets().reduced`, which covers the app setting and the device): no
  den/place animation, no peek.
- Peek: Search page only, 2+ letters, once per search, first **3** searches each day, up **~4 s**
  at most, points after the first result shows, ducks ~1.2 s after pointing, ducks at once when
  nothing is found. Off while the Search tour is open. Never covers typed text, the Decode button
  or a result; `pointer-events: none`; never focusable.
- Original genre drawings only; no real characters or places.
- Agents don't run tests or builds (CLAUDE.md rule 8): the owner runs the commands.

## Review Focus

- Typing fast past 2 letters, deleting to 1, typing again: one new peek for the new search, not a
  peek per keystroke. Test in Task 2.
- Results already on screen while still typing (local search is instant): the point waits until
  typing pauses (600 ms), not on every keystroke. Test in Task 2.
- Storage blocked (private mode): no peek rather than a peek on every search. Test in Task 1.
- Midnight: the budget is per calendar day (local date), so the next day starts at 3. Test in
  Task 1.
- Leaving Search mid-peek: timers are cleared on unmount, nothing fires later. Covered by the hook's
  effect cleanups; checked in Task 2's unmount test.

---

### Task 1: Daily peek budget

**Files:** Create `src/components/mascot/peekBudget.ts`, test `peekBudget.test.ts`.

**Interfaces — Produces:** `PEEKS_PER_DAY = 3`; `takePeek(now?: Date): boolean` (true and counts
one when today has peeks left; false when used up or storage is blocked). Key
`pcd:peeks:<YYYY-MM-DD>` in local time.

- [ ] Tests: `allows three peeks a day, then none`; `starts again the next day`;
      `refuses when storage is blocked` (spy `Storage.prototype.getItem` to throw).
- [ ] Implement.

### Task 2: Search peek

**Files:** Create `src/components/mascot/SearchPeek.tsx`, `SearchPeek.module.css`, `usePeek.ts`,
test `usePeek.test.ts`; wiring tests (typed search, reduced motion, tour) in `src/app/app.test.tsx`.
Modify `src/features/search/SearchPage.tsx` (wrap the `SearchBar`) and `e2e/returningReader.ts`
(e2e starts with today's peeks used).

**Interfaces — Consumes:** `takePeek`. **Produces:**
`usePeek(query: string, outcome: PeekOutcome, enabled: boolean): PeekPhase` and
`SearchPeek({ query, outcome, enabled, children })`, where
`type PeekOutcome = 'pending' | 'found' | 'none'` and `type PeekPhase = 'hidden' | 'watching' | 'pointing'`.
The wrapper sets `data-peek={phase}` on its root.

Timings: `SETTLE_MS = 600` (typing pause before pointing), `POINT_MS = 1200`, `MAX_UP_MS = 4000`.

- [ ] Tests (fake timers, `renderHook`/render with changing props):
  - `rises once a search has two letters` (1 letter: hidden; 2: watching).
  - `peeks once per search` (type more: still one `takePeek`; clear to 0 and type again: new peek).
  - `points once typing pauses on a result, then ducks` (found + 600 ms → pointing; +1200 → hidden).
  - `ducks at once when nothing is found`.
  - `never stays up longer than four seconds` (pending forever → hidden at 4000).
  - `stays hidden when disabled` and `after the day's three peeks`.
  - `clears its timers when unmounted` (unmount while watching, advance timers, no error/act warning).
- [ ] Implement the hook and drawing: a clip window above the bar's right end, the mascot sliding
      up with `translateY` (visible at ~22% still behind the bar), two hands on the bar's top edge, one
      arm that scales out rotated down-left while pointing; pupils shift with query length while
      watching. Keep it right of the input text, above the Decode button only.
- [ ] SearchPage: `outcome` = `found` when any local/online/saved result is shown, `none` when
      `showEmpty`, else `pending`; `enabled = !reduced && !tour.open`.

### Task 3: The den on Discover

**Files:** Create `src/components/mascot/MascotDen.tsx`, `MascotDen.module.css`. Modify
`src/components/ui/Page.tsx` (optional `scene?: ReactNode`, rendered above the header) and
`src/features/discovery/DiscoverPage.tsx` (`scene={<MascotDen still={reduced} />}`).

- [ ] Draw the demo's room (viewBox `0 0 300 250`): window with twinkling lights and moon, four
      posters, radio with drifting needle and rising notes, TV with stacked coloured screens fading in
      turn plus a rolling scan line and a glow, sofa with the mascot bobbing, chai steam, swaying plant.
- [ ] Rounded frame, centred, height `clamp(9rem, 30vh, 13rem)` so the search bar stays on a phone's
      first screen. `still` (and `prefers-reduced-motion`) stops every animation.
- [ ] Test in `DiscoverPage` tests: the den is present and hidden from screen readers.

### Task 4: Genre places in the intro

**Files:** Create `src/components/mascot/GenrePlace.tsx`. Modify
`src/components/intro-splash/IntroSplash.tsx` and `.module.css`.

**Interfaces — Produces:** `GenrePlace({ costume }: { costume: Exclude<Costume, 'plain'> })`.

- [ ] One static silhouette scene per costume (hero rooftops, wizard towers and stars, villain lair
      with lightning, royal hall with curtains, outlaw desert with cactus and sun, meme phone with chat
      bubbles), drawn in `currentColor` at low opacity so each panel's tone colours it; absolutely
      positioned behind the mascot. Timings unchanged.

### Task 5: Docs and handoff

- [ ] `docs/PHASE5_PLAN.md` status line; owner runs lint, unit tests, e2e, then checks on the phone.
