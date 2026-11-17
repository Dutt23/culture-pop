# Cards shaped like their type (short design)

Owner picked option B from a side-by-side demo on 2026-11-17 ("B, objects").

## Why

Cards were all the same purple tile; random colours were rejected earlier. The room on Discover made
every prop a reference, and the cards should carry the same idea: a card looks like the thing its
reference comes from, so the type reads at a glance and the page has a theme instead of clutter.

## What gets built

Every compact reference card (Browse, search, favourites, packs) takes the shape of its type:

| Type | Object |
| --- | --- |
| Film | cinema ticket: notches on both sides, a dashed tear line above the footer |
| TV | a screen in a thick bezel |
| Meme | a phone with a notch |
| Anime | a manga panel: ink border, speed lines in a corner |
| Cartoon | a comic panel: thick ink border, inner coloured line, halftone dots |
| Comics | a comic book: ink border and a coloured band across the top |
| Games | a cartridge: ridges along the bottom |
| Music | a record sleeve with the grooves of a record showing |
| Catchphrase | a speech bubble with a tail |
| Saying | a paper note with tape |
| Other | unchanged |

Rules: the feature card ("Surprise me") keeps its own ticket look; a card whose type is still being
checked stays plain; both themes work (tints mix each type's colour into the theme's surface; the
saying note is paper in both); no clipping that would hide the keyboard focus ring; no text added
by decoration.

## Approaches

- **Option B, objects (picked).** Matches the room's theme; busier than A.
- Option A, colour by type: calm and scannable, less personality.
- Era tints: say little about the card.

## Left to the builder

Exact tints and sizes; done in CSS on a `data-kind` attribute, no new components.
