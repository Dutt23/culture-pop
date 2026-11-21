# Phase 5 plan: measured polish and release (owner approved 2026-11-17)

Spec §5 Phase 5: _refine visual identity, mobile layout, animations, optional signature
dust/scatter/morph effects, offline/online transitions, accessibility, error recovery, cache
metrics, import/export, PWA installation and documentation. Profile before optimising: bundle size,
render smoothness, memory, battery, model download footprint and storage. LRU only if measured need
warrants it; never evict favourites silently. No unsupported performance claims._

Final gate: lint, strict typecheck, unit/integration, production build, Playwright mobile **and
desktop**, offline/online, citations, disambiguation, persistence/migrations, backup validity,
spoilers, reduced motion, accessibility, installability. Deliver README, architecture,
source/licence inventory, model benchmark/fallback, test results, deployment steps, honest
limitations. **STOP for final owner review.**

## Already agreed

1. **Polish the UI and make it faster** (owner, 2026-11-16). Measure first, change second, claim
   only what was measured. Starting point: first load 534 KB, gzip 176 KB (D48).
2. **"Linked to N in your library"** (owner, 2026-11-16, `docs/research/related-graph-ui.md`).
3. **Install and offline on the phone** (owner, Phase 3 sign-off): checked on the vivo once deployed.
4. **Parked, not in this phase:** "Explain with AI", the photo/meme explainer, YouTube results, a
   graph view. They need an owner decision against the spec's "no hosted inference" or more library
   links first. The README lists them under limitations.

## What exists today (checked 2026-11-17)

- Playwright runs two **mobile** projects (360 and 390 wide); **no desktop project**.
- **No backup export/import.**
- **No storage or cache numbers** for the reader; Settings only clears or resets.
- Docs: `README.md`, `SOURCE_INVENTORY.md`, `BACKEND_PLAN.md`, `SEARCH_RANKING.md`, eval reports,
  an LLM bench. **No `ARCHITECTURE.md`**; the README predates Phases 3 and 4.
- The on-device model is off (not good enough on a phone, D47 bench); only its bench and the
  "off" fallback need documenting.
- Online/offline is detected (`useOnlineStatus`), but going offline or coming back mid-search has
  no clear on-screen change beyond per-section notes.

## Re-planned 2026-11-17 (owner agreed): the product slice comes first

A product review (pasted by the owner, 2026-11-17) pointed at the real moment of use: someone drops
a line in conversation, the reader has about ten seconds, and needs enough to stay in the joke. A
Wikipedia-style card doesn't do that. Checked against the code: the interpretation fields for it
already exist (`summary`, `context`, `usageExample`), but the curator writes `usageExample: ''`
(`src/services/curation/curate.ts`), so everything found online has no line to say back; only the 16
demo entries have one. There is no share-from-WhatsApp entry. The owner agreed to make this the
main body of Phase 5.

**Done before the re-plan:** step 1 measure and step 2 speed (`docs/eval/perf-baseline-2026-11.md`);
a first batch of search polish (empty gap under "0 matches", meme links no longer listed twice,
shorter "Search online?" card that says the library had nothing, outside links hidden offline with
one clear note, offline empty-state wording).

### Steps, in order

1. **Glance card (½ day).** The first screen of a reference is four lines: the line heard, what it
   means (one sentence), the social move ("they're joking the plan is doomed"), and one line to say
   back. Year, story, sources sit behind "More". Spoiler-safe by default (step 3).
2. **"You'll hear this" pack, ~100 hand-written cards (2–3 days).** Lines this circle still quotes:
   Disney and Pixar, spoiler-safe Marvel and Harry Potter, The Office and Friends, 2012–2020 memes,
   Indian films and forwards (3 Idiots, Sholay, DDLJ, WhatsApp jokes). Each card has the four glance
   lines and a real usage line, marked as curated the way demo entries are now. Drafted in batches of
   about 30; **the owner checks each batch before it ships**.
3. **Safe-before-watching as the answer (½ day, with the pack).** For spoiler-heavy lines (the snap,
   the Titanic door) the default answer is how people use it and where it's from, with "save the
   scene until you've seen it"; the spoiler stays behind the existing veil.
4. **Paste the whole message, and share from WhatsApp (1 day).** Search accepts a sentence ("this is
   such a red pill moment") and finds the known line inside it by matching the library's phrases and
   aliases, no AI. The installed app registers as a share target (Android PWA Web Share Target), so
   WhatsApp's Share sends text straight in.
5. **Packs, not a pin-five list.** Replaced by `docs/PACKS_REQUIREMENT.md`: folders of cards, search inside one folder or across all folders, no web. Do not also build a five-pin list.
6. **"I get this now" (¼ day).** Mark a pack card done so it leaves the pack. No score, no streak,
   no count.
7. **Same-world chips (½ day).** Three chips at the top of a reference from the Phase 4 groups
   ("Also in The Matrix": red pill, there is no spoon, glitch).
8. **Kept from the first plan:** the rest of the phone polish (cards, selection style, settings
   text, loading slots), "Linked to N in your library" (only if still useful after 7), backup
   export/import, accessibility pass, one small signature effect, docs, the owner's phone check,
   final gate.
9. **Security review (owner, 2026-11-17), after the accessibility pass and before the final gate.**
   Covers the server endpoint (`api/web-search.ts`) and the access-code cookie, what leaves the
   device (search text, messages shared in from WhatsApp, wider-web queries), the backup file as an
   untrusted input on restore, the content-security policy and the share target.

**Status, 2026-11-17 (end of day):** every build step is done and merged on master: glance card,
pack batches 1–2, paste a message and the share target, packs, "Got it" (D52, D60), same-world
chips, backup, phone polish (D55), accessibility (D56), the opening intro, tours, the wide layout,
search tags, the room on Discover with a virtual Browse list (D57), the room of references (D58),
cards shaped like their type (D59) and the security review with its fixes (D61). Left before
release, all the owner's: do the deploy checklist in `docs/BACKEND_PLAN.md` §10 before
`npm run deploy` to the new Vercel account (link that account, env vars, auth off, spend caps);
run the final `npm run deploy:check`; read the 28 room explanations
(`src/components/mascot/room/roomProps.ts`); check the phone (vivo: smoothness of the room and
cards, install, offline, WhatsApp share); review pack batch 3 (`docs/PACK_BATCH_3_DRAFT.md`).

**Dropped or paused:** "Linked to N" is now optional. (Desktop layout and the type tags were first
paused here; the owner brought both back on 2026-11-17 and they are done.)

Leave alone (the review agrees): the on-device model, the wider-web button, streaming lookups.

## Owner answers (2026-11-17)

- **A:** asked whether a new look is needed; answer given: no, refining is enough (the app's look
  is consistent and themed; the gaps are spacing, loading and empty states, offline cues). Refine.
- **B:** favourites with their references, saved links and settings; history only if ticked.
- **C:** one small effect, built last, dropped if it stutters on the phone.
- **D:** run the experiment in its own session so Phase 5 isn't blocked (started 2026-11-17,
  session "Experiment: HF query classifier vs rules"; report lands in
  `docs/eval/query-classifier-2026-11.md`).

## Decisions for the owner (as asked)

- **A. Visual identity.** Refine the current look (spacing, type, cards, states), or a new identity
  (new colours, type and illustration style)? Recommended: refine. A new identity is a design
  project of its own.
- **B. What a backup holds.** Recommended: favourites with the references they point to (so an
  imported favourite of an online-found reference still opens), saved web links, and settings.
  Search history only if you tick "Include search history" when exporting; off by default.
- **C. Signature effect.** None, or one small cancellable effect (for example, a card that scatters
  into dust when removed from favourites, off with reduced motion). Recommended: one, built last,
  dropped if it costs smoothness on the phone.
- **D. Hugging Face query classifier.** Research (2026-11-17) found no model that tells fiction from
  real history; the smallest thing worth trying is a 23 MB English embedding model
  (`Xenova/all-MiniLM-L6-v2`) as a backup for queries the rules can't sort, with no help for memes,
  quotes or Hinglish. Recommended: not in Phase 5. If wanted, an experiment first: 100 labelled
  queries from real searches, rules vs model, ship only if it clearly wins.
