# Room of references: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Every prop in Discover's room is a pop-culture reference; tapping one makes the mascot
explain it.

**Architecture:** The room's drawings move into `src/components/mascot/room/` (one file per area).
Each prop is wrapped in `<RoomProp id>`, an SVG `<g role="button">` that reads a small context from
`MascotDen` (which prop is open, which holds the roving tab stop). The 28 explanations live in one
data file. The bubble renders through a portal to `document.body` (the page's `main` is a
containment box, so `position: fixed` inside it would not be the screen).

**Tech Stack:** React 19, CSS modules, motion/react (existing scroll drift), vitest + Testing
Library.

**Spec:** `docs/superpowers/specs/2026-11-17-room-of-references-design.md`. Drawings follow the
approved demo (`scratchpad/demo-room/index.html` in this session).

## Global Constraints

- Original drawings of each work's famous object; text only for the four band names and "1976".
- Props are secret: no pointer cursor, no hover glow, no tour; focus glow on keyboard focus only.
- Prop accessible names describe the object, never the title.
- Reduced motion (`still`): no animation anywhere in the room, no spelling.
- Agents don't run builds or tests unless the owner asks (CLAUDE.md rule 8).

## Review Focus

- Tab from the search bar reaches the room once, then "Surprise me": not 28 stops.
- The bubble at the bottom of the screen on a scrolled page, above the bottom bar.
- Tapping a second prop while the bubble is open swaps the text; the first prop stops glowing.
- Phones: hidden wide-screen props never get the roving tab stop.
- Short wide screens: the low row never covers the search bar.

---

### Task 1: Data and the prop wrapper

**Files:** Create `src/components/mascot/room/roomProps.ts` (`RoomPropId`, `ROOM_PROPS:
Record<RoomPropId, { thing: string; title: string; line: string }>`, `WIDE_ONLY`),
`RoomProp.tsx` (`RoomContext`, `RoomProp({ id, children })`, `useRoomKeys()`), `PropBubble.tsx` +
`.module.css`.

### Task 2: Drawings

**Files:** Create `room/Furniture.tsx`, `room/UpperWall.tsx`, `room/LowRow.tsx`,
`room/ToyScenes.tsx`, `room/room.module.css`. Modify `MascotDen.tsx` (compose, state, spelling
timer) and `MascotDen.module.css` (drop the top string of lights; place the upper wall, low row and
toys).

### Task 3: Tests

**Files:** Create `src/components/mascot/MascotDen.test.tsx`: tapping a prop shows that prop's
title and line and nothing else; "Got it" and Escape close it and focus returns; a second tap swaps
it; props are named by the thing, not the answer; one tab stop and arrow keys move between props.
Modify `src/app/app.test.tsx` (the den test).

### Task 4: Docs and handoff

- [ ] `docs/PHASE5_PLAN.md` status; owner runs checks, reviews the 28 lines, checks the phone.
