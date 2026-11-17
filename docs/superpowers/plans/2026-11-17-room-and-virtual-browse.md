# Discover room and virtual Browse: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Make Discover's first screen the mascot's room and turn Browse into a virtual list whose
cards deal in as they reach the screen.

**Architecture:** `MascotDen` becomes a wrapper: a full-bleed decorative backdrop (lights, floor) and
the furniture SVG around the page's header and search bar, which `Page` passes in through a render
prop. Browse rows (headings and card rows) are built by a pure function and rendered with
`useWindowVirtualizer`; cards animate with Motion `whileInView`.

**Tech Stack:** React 19, CSS modules, motion/react, `@tanstack/react-virtual` 3.14.26 (new),
vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-room-and-virtual-browse-design.md`

## Global Constraints

- Transform/opacity animation only; `still` / reduced motion stops all of it.
- Decorative parts `aria-hidden`; the den furniture keeps `data-testid="mascot-den"`.
- The room keeps the dark theme's colours in both themes.
- Agents don't run installs, builds or tests (CLAUDE.md rule 8): the owner runs the commands.

## Review Focus

- Light theme: heading, intro and search bar inside the room stay readable.
- jsdom has no IntersectionObserver or layout: tests must still see every card (setup stubs IO as
  "on screen"; virtualizer measures 0 and renders all rows).
- Scrolling back up past seen cards: no second deal-in.
- Width change (rotate phone, resize window): columns recount, no row overlaps.
- Content above the list changing height (regulars load, chips wrap): list offset follows.

---

### Task 1: The room

**Files:** Modify `src/components/mascot/MascotDen.tsx`, `MascotDen.module.css`,
`src/components/ui/Page.tsx`, `src/features/discovery/DiscoverPage.tsx`,
`src/app/AppShell.module.css` (header above the room; `overflow-x: clip` on the shell).

**Interfaces:** `MascotDen({ still, children })`. `Page` props: `scene?: (top: ReactNode) =>
ReactNode` wraps the header and `lead`; `lead?: ReactNode` is shown right under the header.

- [ ] Backdrop `inset-inline: calc(50% - 50vw)`, top far above the page, bottom at the den's bottom,
      `z-index: -1`; fairy lights drawn from one `droop()` curve; floor height = furniture height ×
      60/250.
- [ ] Furniture: absolute bottom-right from 64rem, in flow under the search bar below that.
- [ ] Scroll drift with `useScroll`/`useTransform`, off when `still`.

### Task 2: Virtual Browse

**Files:** Create `src/features/discovery/browseRows.ts` (+ `browseRows.test.ts`),
`src/features/discovery/VirtualBrowse.tsx`, `VirtualBrowse.module.css`. Modify `DiscoverPage.tsx`
(drop `Shelf`), `DiscoverPage.module.css`, `src/motion/presets.ts` (`deal` variants),
`src/test/setup.ts` (IntersectionObserver stub), `src/app/app.test.tsx` (type view has no region
per type), `e2e/app.spec.ts` (scroll to Bazinga!; virtual list keeps few cards in the page).

**Interfaces:** `browseRows(groups: readonly BrowseGroup[], columns: number): BrowseRow[]`,
`BrowseGroup = { key: string; title: string; references: readonly Reference[] }`,
`BrowseRow = { kind: 'heading'; key; title } | { kind: 'cards'; key; references }`;
`columnsFor(width: number, cardMin: number, gap: number): number`.

- [ ] Tests: headings before their cards; cards chunked by columns with a short last row; one
      column; `columnsFor` never below 1.
- [ ] Owner installs: `npm install @tanstack/react-virtual@3.14.26`.
- [ ] `VirtualBrowse`: `useWindowVirtualizer` with `scrollMargin` = list's page offset (re-measured
      after each render and on resize), `measureElement` per row, overscan 2; seen ids in a ref so a
      re-mounted card skips the deal.

### Task 3: Docs and handoff

- [ ] `docs/PHASE5_PLAN.md` status line; owner runs install, checks, then the phone.
