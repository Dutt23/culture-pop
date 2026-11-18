# Asking for a ready-made pack

Copy a prompt, fill in the blanks, and paste it to Claude in this project. Claude researches it
online, writes spoiler-safe cards in the app's card format, files them in a new ready-made pack,
and runs the checks. Nothing ships until you've read the cards.

## Before a concert

> Make a concert pack for **[artist]**. I'm going to their show **[city, month, or "soon"]** and I
> don't know their music well.
>
> Research online and check facts against Wikipedia or the artist's official pages. Include:
> 1. Who they are: members, where they're from, how they started, what kind of music, anything
>    people bring up about them.
> 2. Their **[8]** best-known songs: the ones the crowd will sing back. For each: what it's about in
>    plain words, the year and album, who's featured, and what happens when it plays live.
> 3. **[2–3]** hidden gems fans love but radio didn't play, and say they're fan picks.
> 4. Anything a newcomer would hear at the show or in the group chat: nicknames, in-jokes, a famous
>    moment, the newest release.
>
> Don't quote lyrics. Don't state tour dates. Order the pack: who they are, the big sing-alongs,
> then the deep cuts. Use the Chainsmokers pack (`docs/PACK_CHAINSMOKERS.md`) as the model.

Optional lines to add:
- "Their opener is **[act]**; add 2 cards on them too."
- "I only have 10 minutes: keep it to **[6]** cards."
- "Include songs in **[Hindi / Punjabi / Spanish …]** with a one-line translation of the title."

## Before a film or show

> Make a "before you watch" pack for **[film or show]**, out **[date]**. Research what a viewer
> should know first: the characters, earlier films or seasons it follows, ideas and lines people
> will reference. Keep every card spoiler-safe; put anything that gives away an earlier ending
> behind the spoiler tap. Mix new cards with ones already in the app. Use the Doomsday pack
> (`docs/PACK_DOOMSDAY.md`) as the model.

## What you get back

- A source note in `docs/` listing every fact and where it was checked.
- The cards in `src/data/`, a database update that adds the pack once (a deleted pack stays
  deleted), and tests.
- A list of anything that couldn't be confirmed, for you to keep, change or cut.
