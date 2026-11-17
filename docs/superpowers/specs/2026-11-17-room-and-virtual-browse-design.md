# Discover as a room, and Browse as a virtual list (short design)

Owner agreed 2026-11-17 after a throwaway demo ("Yes, build it"), and asked for a real virtual list
("remember to use virtual lists").

## Why

The den from the first round was a small framed picture above the page; on a wide screen most of
the screen stayed empty. The owner wants to feel inside the room, like Lettra. They also want cards
to come in as you scroll, slowly enough to notice, without rendering the whole library at once.

## What gets built

1. **The room is Discover's first screen.** The wall, a string of twinkling fairy lights and the
   floor run edge to edge, behind the app's name at the top. The den's furniture (window, radio,
   posters, sofa with the mascot, TV, chai, plant) stands on the floor:
   - wide screens (64rem+): the furniture fills the right side, the heading and search bar sit on
     the wall at the left, and the room fills the screen down to the bottom bar;
   - narrower screens: heading and search bar at the top, the room right under them, the first
     cards peeking in below.
   The TV's glow spills onto the room. As you scroll, the furniture drifts back and the heading
   fades.
2. **Browse is a virtual list.** All era (or type) headings and cards are one list; only the rows
   near the screen exist in the page, and rows that scroll far away are removed. Cards are laid out
   in as many columns as fit (one on a phone), so the phone's sideways shelves go away.
3. **Cards deal in.** The first time a card reaches the screen it rises, grows and settles over
   about 0.9 s; cards reaching the screen together come one after another. Scrolling back up to a
   card already seen shows it at once.

## Rules

- The room is always the night room, also in the light theme: inside it, text uses the dark
  theme's colours so it stays readable.
- Decorative parts are `aria-hidden`; the heading and search bar are ordinary page content.
- Reduced motion (app setting or device): the room is a still picture, no drift or fade, cards
  appear with the short fade every other list uses.
- Movement and fades only (transform/opacity).

## Approaches

- **Room as the whole background (picked).** Immersive, keeps the search bar on the first screen.
- Search bar inside the TV: most playful, harder to read and riskier on small phones.
- Bigger banner: safer but still a picture you look at.

For the list:

- **Virtual list with `@tanstack/react-virtual` (picked, owner asked for virtual).** Small, handles
  rows of changing height and scrolling with the window. One new dependency.
- Hand-written windowing: no dependency, but re-solving row measuring and scroll jumps.
- Load in batches and keep everything loaded: simplest; not a virtual list.

Trade-off accepted: cards far from the screen aren't in the page, so the browser's find-in-page
and a screen reader's list of links only reach cards near the screen. Headings stay real headings;
each row of cards is its own small list, so a screen reader hears "list, 3 items" per row rather
than one list per era. The row holding keyboard focus stays in the page when scrolled away.

## Left to the builder

- Row heights are measured; estimates only seed the first layout.
- Column count follows the width of the list (card min `--size-card-row`, gap `--space-3`).

## Not in this

Card colours (next brainstorm), a daytime room, sounds.
