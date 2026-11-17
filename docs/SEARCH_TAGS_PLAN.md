# Search tags and a taste lean: plan (owner-approved 2026-11-17, D51)

Part of Phase 5 (`docs/PHASE5_PLAN.md`). Nothing new leaves the device except a short hint added to
the wider-web request the reader already sends. No extra network requests.

## What the reader sees

A row of tags under the search box, shown before and after searching:

> Anime · Cartoons · Comics · Games · Films · TV · Memes · Catchphrases · Music · Sayings · + Add tag

- Tap a tag to turn it on, tap again to turn it off. The choice is remembered on this device.
- **Tags lift, never hide.** Results that match an "on" tag move up. Nothing is removed.
- **One row, not two.** Today's "All types / Cartoons / Film…" filter row after a search goes away.
  When at least one tag is on, the row ends with an **Only these** chip that hides the rest, like the
  old filter did. "Only these" is not remembered and resets with each new search, as today. The era
  row ("Any time / 1990s…") stays as it is.
- A taste note appears only when the taste lean actually moved a result, e.g.
  _"Anime ranked a little higher because of your favourites and what you've opened."_
- Settings gets **Lean to my taste: On / Off** (default On).

## The ranking rules (one place, pure code, tested)

1. **Likely answers stay first.** In the library, exact title and exact "also known as" matches keep
   the top. Online, a page named exactly like the search (or its topic) keeps the top.
2. **Then tagged results**, in their existing order.
3. **Then the rest**, in their existing order.
4. **Taste is a tie-breaker only.** It acts on the library list, among results that are equally good
   matches (the same match kind, such as several "Possible match" results). It never touches the
   online order, which is Wikipedia's own ranking. It never beats a tag.

Applied when the lists are shown, so the retrieval code and `rerank.ts` do not change.

## 1. Built-in type tags

One tag per real category. "Myths" is **not** in the list: there is no myths category, and Wikidata
results are never filed as myths today. Question searches already lean to myths through the
"Stories & myths" box (D50). See question 1.

A type tag matches a result whose category is that type. It also adds a hint to the wider-web
request (point 5).

## 2. Anime as its own type

Today anime is filed as Cartoon (Wikidata's "animated series" and "animated film" classes).

- Add a new category `anime`, checked before the cartoon classes: Wikidata's "anime" class (see the
  live check below). It comes back in the same Wikidata query the app already makes, so no extra
  request.
- **Existing data stays valid**: `cartoon` is still a valid category. A small Dexie upgrade (v7) moves
  only the demo library's own entries the seed now files as anime (e.g. "I choose you!" from
  Pokémon). Saved online results keep their old category until the next lookup of that search
  refreshes them; they can't be re-filed without asking Wikidata again. The upgrade gets a test.
- Manga stays under Comics.

## 3. Custom tags ("Marvel", "Bollywood")

The reader types a tag and it is saved on this device for later. Honest limits:

- A custom tag can't map to a category. It only **lifts results that mention it** in their title,
  creators, "From:" works, library tags or the first source sentence. "Bollywood" will miss a page
  that only says "Indian Hindi-language film".
- It **adds a hint to the wider-web request**.
- It **never changes the Wikipedia query**: that would change the results in ways the reader can't
  see or predict.
- Caps: at most **8 saved custom tags**, each **2–30 characters** (letters, numbers, spaces, `&`, `'`,
  `-`). Removing one is a small × on the chip. Reset clears them, like every other setting.

## 4. Taste lean (device only)

- Read from favourites and from results the reader opened from a search (already kept in search
  history, D37). Nothing new is recorded and nothing is sent anywhere.
- The lean names **one** category: the most common among those references, only once it has at least
  **3** of them and at least **half** of them. Otherwise there is no lean.
- Search history off means only favourites count.
- The note shows only when the lean changed the order on screen.

## 5. Wider-web hint

When tags are on, the request to `/api/web-search` carries `about: ["anime", "Marvel"]` (at most 5).
The server checks them again (same character rules and caps; anything bad is dropped, never an
error) and adds one sentence to what it asks Parallel: _"Prefer results about anime, Marvel."_ The
search text itself is not changed. Turning a tag on or off does not re-run a wider-web search on its
own (that would cost a search); it applies to the next one. Kept wider-web results stay keyed by the
search text only.

## Files

New: `src/domain/searchTags.ts` (tags, matching, lift, taste, caps), `src/features/search/SearchTags.tsx`
(+ CSS), `src/features/search/useSearchTags.ts`, a small tag store on the existing settings table.

Changed, kept small: `types.ts`, `labels.ts`, `discovery.ts` (new `anime` category),
`classify.ts`, `db.ts` (v7), `seed.ts` (Pokémon → anime), `settings.ts` (`taste`), `webSearch.ts`,
`api/web-search.ts`, `WiderWebSearch.tsx` (one `about` prop), `SettingsPage.tsx` (one switch),
`SearchPage.tsx` (the tag row, the lift, the note, and passing no categories to `SearchFilters` so its
category row hides). **No changes** to `SearchFilters.tsx`, `OnlineResults.tsx` or
`ExternalSearchLinks.tsx`. `docs/SEARCH_RANKING.md` gets a short "Tags and taste" section.

## Tests (written, not run; the owner runs them)

Ranking (lift order, answers stay first, taste only breaks ties, the "did it move" check), custom
tag matching and caps, saved-tag parsing of bad stored data, anime classing, the v7 upgrade, the
`taste` setting, the `about` field on client and server (bad values dropped), and the tag row UI
(tap on/off, add, remove, cap, "Only these").

## Owner answers (2026-11-17)

1. **Myths:** left out; "Stories & myths" covers questions.
2. **One row with "Only these"** replacing today's category filter chips: yes.
3. **Taste lean on by default**, with the note and the Settings switch: yes.

## What the live check found (2026-11-17)

One Wikidata class, "anime" (Q1107), covers both anime series and anime films: Pokémon, Dragon Ball
Z, Evangelion, Cowboy Bebop, Akira, Your Name and My Neighbor Totoro are under it; SpongeBob, Toy
Story and Avatar: The Last Airbender are not. No country-of-origin fallback was needed. Franchise
pages Wikidata files as manga (Naruto, Death Note, Attack on Titan, One Piece) match "comic" and stay
under Comics; their anime series pages are separate Wikidata items and do file as anime.
