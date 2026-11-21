# Packs — requirement

Hand this file to the implementing agent. Do not treat `docs/PHASE5_PLAN.md` step 5 ("Tonight list", pin up to five) as still open. This requirement replaces that step. Do not build a second pin list.

Glance lines already exist on `Interpretation` (`gist`, `socialMove`, `reply`) and render in `src/components/glance-card/GlanceCard.tsx`. Reuse them. Do not invent a second card model. (`usageExample` describes a situation, not a line to say back; it stays with the full meaning below the glance card. Updated 2026-11-17.)

## Goal

The reader files existing reference cards into named folders (packs), reorders them, and searches either the open pack or every pack. Pack search reads only those memberships. It never calls the network and never scans the unfiled online cache.

Worked example, not seed data: a pack named "Before X-Men" holds Xavier, Magneto, Wolverine. Searching inside that pack for "magneto" returns that card. Searching all packs for "x-men" returns the pack. A Doctor Doom card filed only in "Before the Doom movie" does not appear in the X-Men search.

## Locked product rules

1. A pack is a folder. A card is an existing `Reference`. Membership is a join row. Filing never copies card text.
2. One reference may be in many packs. One reference appears once per pack.
3. Order inside a pack is manual (`position`, dense, 0-based).
4. At most one pack has `now: true`. Setting Now clears the previous flag in the same transaction.
5. Pack ceiling is `before_watching` or `open`. Default for a new pack is `before_watching`.
6. Favourites stay a bookmark (`favourites` table). Pack search does not treat a favourite as a member.
7. A reference with `editorialState` `retrieved` or `source_curated` is invisible to pack search until it is filed into a pack.
8. Seed and other curated references are invisible to pack search until filed. "All packs" means every filed card, not the whole library and not the web.
9. The existing `/search` page, online retrieval, and wider-web search stay as they are. Pack search must not call `useRetrieval` or `api/web-search`.
10. One folder level. No nested packs. No scores, streaks, or done counts. "Got it" (D52, worded D60) keeps the card filed and folds it under "Cards you've got"; it is per pack. Removing a member never deletes the reference. Deleting a pack deletes only that pack and its member rows.
11. Copy stays plain. Do not write "catch up", "you missed", or "beginner".

## Search

Pure function, `src/domain/packs.ts`. Ranking of a card reuses `rankReferences` in `src/domain/ranking.ts`. Pack names use `normalizePhrase` from `src/domain/normalize.ts`.

```ts
export type PackSearchScope = { kind: 'pack'; packId: string } | { kind: 'all' };

export interface PackSearchHit {
  pack: Pack;
  /** Set when a member card matched. Absent when only the pack name matched. */
  member?: { reference: Reference; kind: MatchKind; matchedPhrase: string };
}
```

Empty query: do not rank. The open pack lists its members by `position`. The pack list shows packs with the Now pack first, then `updatedAt` descending.

Scope `pack` (the open folder):

- Rank that pack's members with `rankReferences`.
- A pack-name match (exact, then prefix, then substring on `normalizedName`) is its own hit with no `member`.
- Show a name match even when no card matches, so "x-men" opens the folder.
- Drop every card that is not a member of this pack.
- Order card hits by `MATCH_RANK`, then `position`.

Scope `all`:

- Run the same rules per pack.
- Drop a pack with neither a name match nor a card match.
- Order groups: Now pack first, then the best card `MATCH_RANK` in the group, then name-match rank, then pack name.
- Equal card matches in two packs both stay visible. Do not auto-open one. Now only wins the sort.

Fuzzy tiers (`typo`, `sound`) may appear under the stricter hits. They must not set `needsRetrieval` and must not start an online lookup.

No pagination. Return every hit. The library is small.

## Spoiler ceiling

When a card is opened from a pack with ceiling `before_watching`:

- Pass `revealSpoilers={false}` into the existing interpretation UI.
- Show `gist`, `socialMove`, and `reply` when present.
- Hide any interpretation whose `spoiler` is `major`. Do not show its `summary`.
- If those three glance strings are empty and every interpretation is `major`, show: "No spoiler-free line filed for this card yet."
- If a `spoiler: 'none'` summary exists and the glance strings are empty, show that summary.
- One button, "Show the ending anyway", reveals major spoilers for this visit only (component state). It does not change the global spoilers setting and it does not change the pack ceiling.
- A line on the page: "Filed for before you watch. The ending stays hidden."

Ceiling `open` uses the global spoilers setting, unchanged.

Opening a card from a pack passes `packId` in React Router location state. Also write the pack id to `sessionStorage` under `culture-pop:open-pack` so a refresh still applies the ceiling. Clear that key when the reader opens the card from `/search`, Discover, or Favourites.

## Organize

One domain function does the filing, used by every control:

`fileCard(referenceId, packId, index, fromPackId?)` inserts or moves the membership to `index` and rewrites that pack's positions so they stay dense. Already-a-member is a move, not a second row. With `fromPackId` (another pack) the card also leaves that pack, in the same transaction. (Owner decision 2026-11-17.)

Phone is the device that matters (`docs/PHASE5_PLAN.md`). Drag is not the only path.

- Every card in a pack has a **Move** button. It opens a sheet of pack names plus "Remove from this pack". Tapping a pack moves the card there: it leaves the open pack. **File in pack…** on a reference page opens the same sheet with no open pack, so there a tap only adds.
- **Up** and **Down** on each card call the same reorder path.
- A fine pointer (`matchMedia('(pointer: fine)')`) may drag a card. Drag data is the reference id, type `application/x-culture-pop-ref`. Dropping on a pack row or on the open pack list calls `fileCard`. A card dragged out of a pack also carries that pack's id (type `application/x-culture-pop-from-pack`), so dropping it on another pack row moves it, like the sheet. Dropping on a row uses that row's index. Dropping on the pack uses the end.
- No new dependency. Do not add a drag-and-drop library.
- The Move button is keyboard-reachable. A drag-only action is a failed requirement.

"Add from library" on the open pack: a text field ranked with the existing curated-library search (the `curated` split in `src/features/search/useSearch.ts`, references that are not `isFromOnline`). Choosing a row calls `fileCard` at the end. This field does not search the online cache and does not go online.

There is no card editor in this change. Characters must already be references.

## Data

Packs shipped as Dexie version 8 in `src/data/db.ts` (`SCHEMA_V8_CHANGES`). The current schema is version 13; later versions belong to other features. Never edit the `SCHEMA_V1` … v8 blocks.

```ts
export type PackCeiling = 'before_watching' | 'open';

export interface Pack {
  id: string;
  name: string;
  normalizedName: string;
  ceiling: PackCeiling;
  now: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PackMember {
  id: string;
  packId: string;
  referenceId: string;
  position: number;
  addedAt: string;
  /** Set by "Got it" (D52). The card stays filed; done rows sort after the cards still to learn. */
  doneAt?: string;
}
```

Indexes:

```ts
packs: 'id, normalizedName, now, updatedAt'
packMembers: 'id, packId, referenceId, [packId+position], &[packId+referenceId]'
```

`&[packId+referenceId]` is the uniqueness constraint.

Ids: `pack:` + `crypto.randomUUID()`, `pm:` + `crypto.randomUUID()`.

`src/data/repositories/packRepository.ts`, same shape as `favouriteRepository.ts`:

- `list()`
- `get(packId)`
- `create({ name, ceiling })`
- `rename(packId, name)`
- `setCeiling(packId, ceiling)`
- `setNow(packId)` and `clearNow()`
- `deletePack(packId)`
- `members(packId)` in position order
- `fileCard(referenceId, packId, index, fromPackId?)`
- `markDone(packId, referenceId)` ("Got it")
- `removeMember(packId, referenceId)`
- `memberships()` for the all-packs search (pack, member, reference id)
- `packsOf(referenceId)` for the "In your packs" chips

`setNow` is one readwrite transaction: every pack `now = false`, then the target `now = true`.

Wire the repository in `src/data/repositories/index.ts`. `resetUserData()` clears `packs` and `packMembers` in that same transaction. It still must not delete curated references.

If a reference row is deleted anywhere, delete its `packMembers` in that same transaction. If no delete path exists, do not invent a broad delete. Do hook whatever path already removes a reference.

v7 → v8 upgrade: empty new tables, existing references untouched. Test that with a real v7 database, the way `src/data/db.test.ts` tests earlier upgrades.

Backup includes packs, their members in order, and their "Got it" state (D54). Search history, the online cache, and the consents are never in it.

## Screens

Routes, lazy like the others in `src/app/AppRoutes.tsx`:

- `/packs` — pack list and all-packs search
- `/packs/:packId` — one pack, its search, its cards

Add **Packs** to the nav in `src/app/AppShell.tsx`. Keep Discover, Search, and Favourites.

`/packs`:

- New pack: name field, ceiling control defaulting to `before_watching`, create button.
- Empty query: pack rows. The Now pack shows a "Now" chip.
- Search field always means scope `all` on this page. Placeholder: "Search all packs".
- A hit group shows the pack name and at most three cards, then "N more" which opens `/packs/:id` with the query kept in the `q` search param.

`/packs/:packId`:

- Rename, ceiling, "Pin to top" / "Pinned to top" (the stored flag stays `now`; owner 2026-11-17: "Now" read as a mystery, and pinning is all it does). One plain line under the spoiler control says what the chosen setting does, and one under the pin button says what pinning does. Pack rows and results show a "Pinned" chip.
- Segmented control: **This pack** | **All packs**. Default **This pack**.
- **All packs** stays on this page and groups hits from every pack. It does not navigate to `/search`.
- Empty query: members in `position` order, Move / Up / Down.
- Miss copy, this pack: "Nothing in this pack."
- Miss copy, all packs: "Nothing in your packs."
- Secondary link "Look up" goes to `/search?q=` with the query. Do not start online retrieval from the pack page.

Reference page (`src/features/references/ReferencePage.tsx`): **File in pack…** opens the same pack sheet.

**Which packs a card is in (owner, 2026-11-17).** A card filed in several packs shows them all: on the reference page, a row of chips "In your packs: Before X-Men · Before the Doom movie" under the glance card; on a card inside a pack or in all-packs results, the other packs it's in, as small chips. Tapping a chip opens that pack (`/packs/:packId`), whose header shows the pack's name, ceiling, Now state and card count. The chips read from the same `packMembers` rows (`memberships()` / a `packsOf(referenceId)` read); nothing is copied. A card in no pack shows no chip row.

Styles: CSS modules next to the feature, existing tokens. Usable at 360px wide. The sheet and the Up/Down controls must be usable without a mouse.

## Tests

Write them. Do not run them. Do not run git. At the end, give the owner this command from the repo root:

```bash
npm test -- src/domain/packs.test.ts src/data/repositories/packRepository.test.ts src/data/db.test.ts
```

Behavior the tests must pin:

- File two cards. List order is the file order.
- Filing the same card into the same pack twice leaves one member row.
- The same card can sit in two packs.
- Reorder keeps positions dense and unique.
- Remove member. The reference row remains.
- Delete pack. References and other packs remain.
- `setNow` leaves exactly one `now: true`.
- Search inside pack A does not return a card that is only in pack B.
- A pack-name query returns the pack when no card title matches.
- All-packs search returns both groups, Now first.
- A `retrieved` reference that was never filed is absent.
- A favourite that was never filed is absent.
- `linesForCeiling` (pure): `before_watching` keeps glance strings and drops a `major` summary; `open` does not drop it.
- A card filed in two packs shows both pack chips; tapping one opens that pack.
- v7 database upgrades to v8 with empty packs and the same references.
- `resetUserData` clears packs and members and leaves seed references.

One Testing Library test: the Move sheet files a card into the chosen pack. No Playwright requirement for this slice.

## Out of scope

- Seeding an X-Men pack or a Doom pack. The owner files those after the cards exist.
- Still parked: on-device model, streaming lookups. (Built since this doc was first written: the "you'll hear this" cards, WhatsApp share, same-world chips, backup.)
- Nested folders, multi-select, cross-device sync, pack sharing.
- A separate "pin five" list.

## Done when

- Create "Before X-Men", file two library cards, reorder with Up/Down, set Now. Reload. Order and Now are still there.
- Search on that folder finds one card and hides a card that lives only in another folder.
- "All packs" finds both, Now's group first.
- An unfiled cached web reference does not appear.
- Open a card from a `before_watching` pack: a major spoiler stays hidden until "Show the ending anyway".
- Remove from pack does not delete the reference.
- Mouse drag onto a pack calls the same `fileCard` as the Move sheet. Touch can file without dragging.
