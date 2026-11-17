# Mascot den, genre places and the search peek (short design)

Owner agreed 2026-11-17, after two demos. Phase 5, "one small signature effect" (owner answer C)
grown into a little more life on screen.

## Why

The owner liked Lettra (landing.love) because an illustrated place made the whole screen feel
alive. Random card colours didn't do that and were dropped. What does it: a drawn place with depth
and small organic motion, and the mascot living in it. Real IP places (Hogwarts, Gundam) can't be
drawn; generic, genre-inspired ones can.

## What gets built

1. **The den, on top of Discover.** A night-time living room above "Decode any reference":
   - window onto a city skyline whose lights twinkle, crescent moon;
   - four posters taped up (star, rocket, comedy/tragedy masks, film clapper);
   - a radio on a shelf, dial needle drifting, music notes floating up;
   - an old TV with an aerial, screen slowly changing colour, a scan line rolling, its glow on the
     sofa;
   - the mascot on the sofa watching the TV, bobbing slightly; chai steaming on a table; a plant
     swaying.
     Decorative only (`aria-hidden`), the heading, search bar and everything below stay where they
     are. On wide screens the den keeps a set height and centres; it never pushes the search bar
     below the fold on a phone.
2. **Genre places in the opening flip-book.** Each costume panel gets a simple place behind the
   mascot: hero → city rooftops at night, wizard → castle towers under stars, villain → a lair with
   lightning, royal → a palace hall with curtains, outlaw → desert with a cactus and sun, meme → a
   phone screen with chat bubbles. Original drawings, no real characters or places. Panel timings
   stay as they are.
3. **The search peek, on the Search page only.**
   - Type 2+ letters: the mascot rises from behind the search bar's top edge at its right end, two
     hands gripping the edge; its eyes follow the typing.
   - When the first result shows: one arm reaches over the bar and points down at it, then about
     a second later it ducks back behind the bar. No result: it ducks at once. At most ~4 s up in
     total, whatever happens.
   - Once per search (clearing the box starts a new one), and only for the **first 3 searches each
     day**. After that, search looks exactly as it does today.
   - Never covers the text being typed, the Decode button or a result; never takes focus; nothing
     to tap.

## Rules for all three

- Drawn as SVG in code with CSS animation, in the app's own palette; no image files, no new
  libraries.
- Reduced motion (system or the app's setting): the den and places are still pictures, and the
  search peek doesn't happen.
- Animate only movement and fade (transform/opacity), so it stays smooth on the vivo. If anything
  stutters on the phone, it gets cut (owner answer C).
- Off during a tour, so it never competes with the tour's highlight.

## Approaches considered

- **Inline SVG + CSS animation (picked).** Matches the existing mascot and intro, tiny, themable,
  respects reduced motion, nothing to download.
- **Lottie or Rive files.** Richer motion, but a new runtime library (tens of KB) and needs an
  animator's files; too much for this.
- **Painted image (PNG/WebP).** Could look lush, but static, heavier, blurry on big screens, and
  can't react to typing.

## Left to the builder

- Where the den sits in `Page` (a slot above the title, or inside `DiscoverPage`), and the exact
  drawing sizes.
- How the TV's colour change is done within the transform/opacity rule (for example, stacked
  coloured screens that fade in turn).
- Where "searches today" is kept (a small per-day counter in localStorage is enough; losing it only
  means a few extra peeks).
- How the peek knows the first result has shown (SearchPage already knows when its results list
  has items).
- Tests: the counter and once-per-search rule, reduced motion off, tour off; e2e skips it the way it
  skips tours.

## Not in this

Card colours (brainstorm comes after this), sound, the mascot reacting anywhere else, a choice of
rooms.
