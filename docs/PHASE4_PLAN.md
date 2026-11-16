# Phase 4 plan: discovery and editorial depth (owner approved 2026-11-16)

**Owner answers, 2026-11-16:** decision A yes (Discover shows found-online references explained
from sources); decision B keep the 16 demo entries; the six steps approved as written. UI polish and
performance work were asked for "later": they belong to Phase 5 (spec: refine visual identity,
animations, profile before optimising).

**Owner refinement of decision A, 2026-11-16** (after the first build put 16 side results and
Wikiquote quote pages into Discover from four searches): Discover shows an online reference only if
the reader **opened it from a search or favourited it**, never a Wikiquote quote-page hit, never an
unexplained one. "Opened" comes from the search history already kept on the device (D37); with
history off, only favourites count. Nothing new is recorded for browsing.

**Changes from review, 2026-11-16:** online cards carry "Found online · Saved <date>"; Surprise me
says where its pick came from, including when an empty category falls back to everything; each empty
type gets its own hint, and offline the hints say to browse what's on the device; "Also in" (works it
appears in) and "Also inspired by" are separate groups; the era group uses the app's era buckets
("More from the 2010s & later"), not single years; hearts on Discover cards too.

Spec §5 Phase 4: _rich decade/category browsing, related-reference links, serendipitous discovery
from actually stored/seeded content, useful filters, meaningful empty states, graceful offline
discovery. Preserve spoiler defaults and explain why a suggestion appears. No query or browse history
(the owner kept search history, D37; browsing is still not recorded). Don't imply random picks are
trending._ Gate: browse all supported decades/categories; test favourites, related links, offline,
determinism where needed, accessible interactions; **STOP** for Phase 5 approval.

## What exists

- Discover: search box, "Your regulars", "Surprise me" (random from the library, "not a trend"),
  "Browse by era" with category chips.
- Reference page: "Same phrase, different meaning" and "More from the <decade>" (3 cards).
- Search: category and era filters.

## What is missing (found 2026-11-16)

1. **Discover shows only the built-in library** (16 demo entries: cartoons, films, memes, sayings,
   catchphrases, TV, music; 1990s and 2000s only). References found online and explained from
   sources (Doctor Doom, Galactus, Harley Quinn…) never appear, so **Comics and Games are always
   empty** and 2010s & later is nearly empty.
2. **Related links are thin for online references:** "More from the <decade>" needs an editorial
   decade, which online references don't have (they have a sourced `year`). Stored Wikidata facts
   (works it appears in, creators) are not used to link references.
3. **Browsing is by era only;** category is a filter on top, with no counts.
4. Empty states say "Nothing here yet" without saying how to add something.

## Proposed steps

1. **Browse what you've found.** Discover also shows online references that are **explained from
   sources** (`source_curated`), marked "Found online" with the date. Unexplained ones (`retrieved`)
   stay out. Clearing online results in Settings removes them from Discover too. _(Owner decision A.)_
2. **Browse by category or by era.** A switch: "By era" (today's view) or "By type" (sections per
   category with a count, e.g. "Comics · 4"). Every supported decade and category is reachable; an
   empty one says how to fill it ("No comics yet. Search a character, like Doctor Doom, to add one").
3. **Richer related links, each saying why.** On a reference page, from stored facts only:
   "Also in Fantastic Four" (shares a work Wikidata names), "Also by Jack Kirby" (shares a creator),
   "More from 2016" or "More from the 2000s" (sourced year or decade), "Same phrase, different
   meaning" (kept). Each card shows its reason; spoiler defaults unchanged; at most 3 per group.
4. **Surprise me, explained.** It can follow the chosen category; the note says where the pick came
   from ("Random pick from your library and what you've found online, not a trend"). Order stays
   deterministic per seed (tested).
5. **Offline and empty states.** Discover and reference pages work fully offline from the device
   (checked in a browser test with the network off); empty and offline states say what to do next.
6. **Gate:** unit tests (grouping, related reasons, deterministic shuffle), app tests (browse every
   decade and category, favourites from Discover, related links), a Playwright offline browse test,
   keyboard and screen-reader checks (names, focus order, chips as a group), 360/390 px walkthrough.

## Owner decisions

- **A. Show found-online, sourced references in Discover?** Recommended: yes (step 1).
- **B. The 16 demo entries** (earlier notes said 20; the seed has 16): keep (Discover has a base before you search anything), or remove
  (Discover shows only what you found). Recommended: keep for now, labelled "Demo entry" as today.

Not in Phase 4: trending (needs an authorised current source), any server AI.
