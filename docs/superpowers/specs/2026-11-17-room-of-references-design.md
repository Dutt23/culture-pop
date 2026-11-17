# The room of references (short design)

Owner agreed 2026-11-17 after several rounds on a throwaway demo ("Yes, build it").

## Why

The room on Discover's first screen felt empty on wide screens, and its props were generic. The
owner wants every prop in the room to be a pop-culture reference, arranged with a theme rather than
random clutter, and a quiet way to find out what each one is. That is the app's job in miniature:
decode a reference.

## What gets built

1. **Every prop is a reference** (original drawings of each work's famous object; no logos, posters,
   characters' likeness or titles, except the four band names in plain lettering and "1976"):
   - window: a hero signal shaped like the mascot; E.T.'s bike crossing the moon;
   - shelf: Star-Lord's Walkman with orange headphones (radio replaced);
   - posters: Interstellar, Gundam, Rush, Memento; second row Friends' yellow door frame, Inception's
     top, Back to the Future's fire trails, Jaws;
   - TV: The Ring (a well in flickering static); couch: The Big Bang Theory (brown leather); coffee
     table: a Central Perk mug and Sholay's coin; plant: Baby Groot dancing in his pot;
   - above the window: the Stranger Things alphabet wall (wallpaper, three rows of painted letters,
     a bulb over each; now and then the bulbs spell a word) and four band posters (Metallica,
     Linkin Park, Queen, Daft Punk). The string of lights across the top of the screen goes;
   - under the search bar, one low row: DDLJ, Gangs of Wasseypur, Dus, Dune, a cowboy six-shooter;
     on the floor: KITT with its sweeping red light, the Dhoom superbike, and the small costumed toys
     acting out genre scenes (kept, small).
2. **A secret way to decode them.** Nothing says the props can be tapped: no pointer, no hover glow,
   no tour. Tapping one makes it glow and the mascot pops up at the bottom of the screen with what
   it references (a title and one spoiler-free line) and a "Got it" button. One prop at a time; no
   "next", no count.
3. **Wide screens only for the extra wall and low row** (64rem and up). On phones the room keeps its
   own props (window, shelf, posters, TV, couch, table, plant), which are tappable the same way.

## Rules

- Keyboard: the props are one stop in the tab order; arrow keys move between them; Enter or Space
  opens one. Focus shows a glow (keyboard only). Escape or "Got it" closes the bubble and focus
  returns to the prop.
- Screen readers hear each prop as a button named by what it looks like ("Poster of a black hole"),
  never by the answer, so the secret holds for everyone.
- Reduced motion: no prop animation, no spelling, the bubble appears without its hop.
- Movement and fades only; the room's existing scroll drift and focus rules stay.
- The explanations are the owner's to review before release.

## Approaches

- **Props as SVG `<g role="button">` inside the room's drawings (picked).** Tappable exactly where
  they're drawn; one roving tab stop keeps keyboard order sane.
- An invisible grid of HTML buttons laid over the picture: easier focus styling, but every prop's
  box has to be kept in line with the drawing at every size.
- Tour-only (a "Show me around" walk): rejected by the owner; the props should be a secret.

## Left to the builder

- File split (drawings per area, a data file of the 28 explanations, the bubble).
- Exact positions; the low row hides when the screen is too short for it.

## Not in this

Tapping a prop to open a reference card in the library, sounds, a daytime room.
