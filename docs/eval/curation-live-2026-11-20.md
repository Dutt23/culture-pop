# Live curation pass over the 17-case set (2026-11-20)

**Pilot, not a benchmark.** One live pass, one reader's answer key, word matching. Differences of one
or two entries are noise. No app code was changed and nothing was deployed.

Case set and scorer: `docs/eval/curation-set/` (README, `cases.json`). Runner:
`.cache/live-tools/curation-live.test.mts` (gitignored). Raw run files (evidence, model input and output,
call log without headers): `.cache/live-tools/curation-live/`. Per-arm scores: `curation-live/scores.json`.

## Method

- **Real server paths:** `api/web-search` handler for searches, `extractPages` for Parallel Extract, and
  `createDraftHandler` for drafting. Drafting runs the working-tree packing (`bestSnippet` anchored on
  search + picked snippet), the `topic-card-v1` / `card-draft-v8` prompts, the checks and the current
  `shared/grounding.ts`. Extraction runs once per page and is replayed into each arm's handler, as in
  the 2026-11-19 pilot.
- **Model:** OpenAI `gpt-6-luna` only, temperature 0.2, reasoning none. Cloudflare was not called. No
  style guidance was sent (the 11-19 pilot had some, so `genocidal maniacs` is not a like-for-like repeat).
- **Shared step per case:** one fast search (`question` set for list, topic and ranking cases), with the top 7 results taken as the reader's picks and extracted.
- **Arms:**
  - **Baseline:** one draft on the 7 picked pages.
  - **Fixed:** one fixed-template search (`<search> <tags> characters examples` for list kinds,
    `<search> <tags>` for a reference), plus up to 3 new URLs extracted and appended, then one draft.
  - **Planner:** one `live-evidence-planner-v2` call. If it says `needed`, one search plus up to 3 new
    URLs, then a draft; otherwise the baseline card is reused.
  - Targeted-name cases repeat the baseline and fixed drafts once on the same evidence (`-r2`).
- **Budget in code:** spend comes from actual usage before each call. Each call's worst case was checked
  against a $0.50 cap and a 200-call limit, with one retry per call counted in spend. Keys are loaded
  in-process from `.env` like the archived harness. They were never printed, and saved files contain
  no headers (checked).
- **Rates rechecked 2026-11-20 on the public pricing pages:** no change. OpenAI Luna Standard is $0.10 input,
  $0.01 cached, $0.125 30-minute cache write and $0.50 output per million tokens. Parallel is $0.001 per fast
  search and $0.001 per extracted URL. All figures are list-price estimates, not invoices.

## Spend and calls

**Actual spend: $0.2297** (cap $0.50), 124 calls, 0 failures, 0 retries, no budget stop. That is $0.0131
for a first one-case check (`control-doh`) plus $0.2166 for the other 16 cases.

| Phase | Calls | Spend | Mean call ms |
|---|---|---|---|
| Initial search | 17 | $0.0170 | 1,185 |
| Picked-page extraction (7 URLs each) | 17 | $0.1190 | 1,378 |
| Baseline draft | 17 | $0.0056 | 3,703 |
| Fixed search + extraction | 34 | $0.0680 | 1,084 / 1,123 |
| Fixed draft | 17 | $0.0057 | 3,714 |
| Planner call | 17 | $0.0039 | 1,776 |
| Planner search + extraction | 4 | $0.0080 | 1,027 / 1,064 |
| Planner draft (when research ran) | 2 | $0.0011 | 4,873 |
| Repeat drafts | 6 | $0.0015 | 3,624 / 2,817 |

Retrieval is 92% of spend. Prompt-cache hits were high: 43,140 of 71,764 baseline input tokens were cached.

## Results by arm

The cost columns count the shared search and extraction in every arm, as one reader's request would.
They do not add up to the actual spend.

| Arm | Cards (HTTP 200) | Useful | Kept / in evidence | Lost by checks | Wrong scope (card/raw) | Citations ok | Mean path | Tokens in / cached / out | Est. $ per card | Est. $ per useful card |
|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 16/17 | 14 | 38/48 | 3 | 0/0 | 54/54 | 6.3 s | 71,764 / 43,140 / 4,263 | 0.0083 | 0.0101 |
| fixed | 16/17 | 15 | 38/51 | 3 | 0/0 | 56/56 | 8.5 s | 76,975 / 48,325 / 4,687 | 0.0123 | 0.0140 |
| planner | 16/17 | 14 | 37/50 | 4 | 0/0 | 55/55 | 8.3 s | 107,779 / 45,125 / 5,322 | 0.0090 | 0.0110 |
| baseline-r2 | 3/3 | 3 | 11/12 | 0 | 0/0 | 6/6 | 6.1 s | — | — | — |
| fixed-r2 | 3/3 | 3 | 8/12 | 0 | 0/0 | 6/6 | 5.3 s | — | — | — |

"Useful" means HTTP 200, at least one answer-key entry kept and no wrong-scope hit. The planner said
`needed` on only 2 of 17 cases (both lists), so on 15 cases the planner arm is the baseline card plus a
planner call (about $0.0002 and 1.8 s).

## Results by category

| Category | Arm | Useful | Kept / in evidence | Lost by checks | Mean path |
|---|---|---|---|---|---|
| Targeted name (incl. repeats) | baseline | 6/6 | 22/24 | 0 | 6.0 s |
| | fixed | 6/6 | 16/24 | 0 | 6.4 s |
| | planner | 3/3 | 11/12 | 0 | 7.7 s |
| Vague character | all three | 3/3 | 7/9 | 0 | 5.4 / 8.3 / 7.0 s |
| Multi-character | baseline | 2/3 | 3/3 | 0 | 7.5 s |
| | fixed | 2/3 | 3/5 | 0 | 10.3 s |
| | planner | 2/3 | 2/5 | 1 | 10.7 s |
| Scope trap | all three | 3/3 | 10/10 | 0 | 6.6 / 9.1 / 8.2 s |
| Music | baseline | 2/3 | 4/8 | 0 | 5.6 s |
| | fixed | 3/3 | 7/9 | 0 | 7.9 s |
| | planner | 2/3 | 4/8 | 0 | 7.2 s |
| Sufficient-evidence control | all three | 1/2 | 3/6 | 3 | 7.0 / 7.7 / 9.1 s |

**Scope held everywhere.** There were no real-person, real-history or live-action hits in any final card or
raw answer, including `famous assassins`, `avatar` and `one piece`. Every kept line's names appeared in
the evidence it cited (165/165).

## Notable failures

- **`control-doh`: no card in any arm (422 `nothing_left`).** The raw answer was correct (Homer Simpson's
  catchphrase in The Simpsons, used for frustration or a blunder, citing E3/E5/E1). The checks removed
  every line. This is the clearest checker loss in the set. Diagnose it from the saved input and answer
  before relaxing anything.
- **`list-fourth-wall` planner:** research added pages and the checks dropped Animaniacs, leaving 1 answer-key entry against 2 in the baseline.
- **`music-radiohead` baseline/planner:** a thin card (name origin only, no "English" or members), so
  not useful. The fixed search added Wikipedia and produced a useful card (Abingdon School, Oxfordshire).
- **Fixed search hurt targeted names:** Light Yagami 4/4 → 2/4 and Itachi 3/4 → 2/4. The `-r2` repeats
  match (baseline 4/4 and 3/4, fixed 2/4 and 2/4), so this is not just sampling variance.
- **Answer-key gaps, not model faults:**
  - `rank-anime-rivals` cards are reasonable (Amuro/Char, Asta/Yuno, Hinata/Kageyama, Midoriya/Bakugo) but
    match none of my expected pairs, so they score "not useful".
  - The `genocidal maniacs` evidence this time was different pages (Eren, King Fritz, Sailor Galaxia, The
    Weaver, Fibrizo). Only Eren is in my key. Retention there says little, and the key should be widened from the saved evidence.
- `vague-believe-it`: Naruto was identified correctly in every arm. The "English dub" and "dattebayo" points
  were never stated together in evidence or card.

## Recommendation

**Neither research arm earns default-on from this pass. Keep the baseline.**

- **Fixed focused search** adds about $0.004 (+48%) and 2.2 s to every card. It won on music (Radiohead
  became useful, Sandstorm 2/3 → 3/3) and on the fourth-wall list (+1 entry). It lost on targeted names
  (−6 entries across 6 drafts, repeatable). On the two controls it added nothing at full cost. Net
  retention was equal (38 vs 38) and cost per useful card was higher ($0.0140 vs $0.0101).
- **Planner research** is cheap as a gate: about $0.0002 and 1.8 s, and it correctly said "not needed" on
  both controls and every reference case. It triggered only on the two lists. There it added different
  characters, Fibrizo on one and lost Animaniacs on the other, so the research result itself was mixed.
  If research is tried again, a planner-gated round limited to list/topic/ranking kinds is the cheaper
  shape than an unconditional fixed search. It is not shown to improve coverage yet.
- **Higher value next steps than more retrieval:** (1) diagnose the `control-doh` total loss in the
  checks, (2) widen the answer keys for `rank-anime-rivals` and `list-genocidal-maniacs` from the saved
  evidence and rescore at no cost, (3) look at why fixed-search pages displaced name facts (possibly the
  10-source cap or item order).

## After fixes (same saved runs, no new calls)

Two changes, then every saved raw answer was re-run through the current `checkAnswer` and rescored.
Rechecked run files: `.cache/live-tools/curation-live-rechecked/`.

1. **Checker fix: `shared/grounding.ts`, `isGrounded`.** It split a sentence's name tokens on
   apostrophes, so "D'oh!" became the name "D". The evidence side (`normalizePhrase`) deletes apostrophes,
   so the evidence word is "doh" and "d" never matched. Every `control-doh` summary line therefore failed
   the name check, the card had no summary line, and it returned `nothing_left`. The fix strips
   apostrophes before tokenising names, exactly as the evidence is normalised. Names, numbers, quotes and
   negations are still required. An apostrophe name the evidence lacks ("O'Brien") still fails, and there is
   no `d'oh` special case. New tests are in `src/services/llm/llm.test.ts` and `api/_lib/cardCheck.test.ts`; both failed before the fix.
2. **Answer keys widened** from the saved evidence for `rank-anime-rivals` (Amuro/Char, Asta/Yuno,
   Hinata/Kageyama, Midoriya/Bakugo, Yugi/Kaiba, Shizuo/Izaya, Kamina/Viral, Edward/Scar) and
   `list-genocidal-maniacs` (King Fritz, Sailor Galaxia, Fibrizo, Joker in the Precure crossover). A
   **fan-created** trap was added to the genocidal case: The Weaver comes from a My Hero Academia fan fiction
   and Mephiles from a fan "Sonic X: Combine Wars" story, both on the TV Tropes page.

**Verdict changes across all saved runs** (197 raw lines: the 17 cases × 3 arms, the repeats and the
11-19 pilot files `result.json`, `packing-result.json` and `packing-query-only-result.json`): exactly 6
lines, all in `control-doh`, all from dropped to kept, and all supported by their cited evidence:

- baseline summary: "D'oh! is Homer Simpson's catchphrase in The Simpsons; it was first used in a Tracey
  Ullman Show short before the series." Supported: Wikipedia and Wikisimpsons name Homer and the
  "Punching Bag" Tracey Ullman short as first use.
- fixed summary: "D'oh! is Homer Simpson's catchphrase in The Simpsons." Supported, same sources.
- context (both arms): "Homer says it to express anger, frustration, pain, or misfortune." Supported:
  Wikisimpsons, "Reason for saying".
- context (both arms): "It can also express sudden recognition of a foolish blunder or an ironic turn of
  events." Supported: the Merriam-Webster definition, word for word.

No other line in any run changed. The other 54 rechecked arm cards are identical to the saved cards.

| Arm | Useful before | Useful after | Kept / in evidence after | Wrong scope after | Est. $ per useful card after |
|---|---|---|---|---|---|
| baseline | 14/17 | 15/17 | 49/60 | 1 | $0.0094 |
| fixed | 15/17 | 17/17 | 48/63 | 0 | $0.0123 |
| planner | 14/17 | 15/17 | 49/62 | 1 | $0.0102 |

What changed:

- **`control-doh` now produces a useful card in all three arms**, so both controls pass.
- **`rank-anime-rivals` is useful in every arm** under the widened key.
- **`list-genocidal-maniacs` baseline and planner are now wrong-scope:** they kept The Weaver, a fan-fiction
  character, and the planner card also kept Mephiles. The fixed arm did not. This corrects "scope held
  everywhere" above: real-world and live-action scope held, but fan-created content got through, and
  nothing in the prompt's scope rule or the checks catches it.
- **Remaining non-useful cards:** `music-radiohead` baseline/planner (a thin card) and the two
  fan-fiction genocidal cards.

**The recommendation is unchanged:** the fixed search is still about +$0.004 and +2.2 s per card, and still
loses targeted-name facts. Its 17/17 useful count comes from Radiohead, and from avoiding the fan-fiction
entry by chance of different evidence. The planner's research arm added the Mephiles error.

Other keys that look too narrow, left unchanged:

- `list-fourth-wall`: the cards keep the Powerpuff Girls narrator, Quailman, and Donald/Goofy from evidence.
- `vague-believe-it`: the "English dub" and "dattebayo" points are never stated in the evidence.

`npm test`: 1,392 passed. `npm run typecheck`: 1 error, and `npm run lint`: 5 errors, all in
`api/_lib/supabase.test.ts` and `api/auth.test.ts`, which this work did not touch. Prettier passes on the
three changed files. The other Supabase/auth files it flags are not part of this change.

## Fan-made content filter (2026-11-21, no new calls)

**Where it came from.** Both The Weaver and Mephiles came from the Parallel extract of TV Tropes'
*Omnicidal Maniac* page. Parallel returns a page as excerpt fragments joined by " ... ", and the "Fan Works"
folder headings are mostly gone. The Weaver line names only a fan-fiction title ("Neither a Bird nor a
Plane, it's Deku!"). It also contains "genocidal maniac", so `bestSnippet` scored it as the page's best
sentence and anchored the 1,200-character item on it. The 11-19 pilot evidence also had a whole fanon
wiki, `charactersfanon.fandom.com`.

**Fix in shared server code.**

- `api/_lib/snippet.ts`: two new helpers, `isFanSite` and `dropFanWorks`.
  - `isFanSite` matches fanon wikis and fan-fiction archives. Ordinary fandom wikis and TV Tropes pass.
  - `dropFanWorks` cuts a fragment at a surviving fan-works heading, and drops any fragment that describes
    a fan-made work ("fan animation", "fanfic", "fan-made" and similar).
- `api/draft-card.ts`, `toCandidates`, uses both before packing. A fanon source goes to "Not used" with
  the reason "fan-made site, not the original work".
- The filter cannot see a bare fan-fiction title. One line was added to the topic prompt ("Exclude fan
  fiction, fan-made works and characters invented by fans…"), and the prompt version is now `topic-card-v2`.
  The prompt change is untested until a paid re-run.

**Replay over all saved evidence (46 arm inputs plus the 11-19 pilot files).** No answer-key fact was
lost in any arm. What the filter removed:

| Source | Removed | Text removed |
|---|---|---|
| `charactersfanon.fandom.com` (11-19 pilot) | whole source | fanon wiki |
| `a.osmarks.net` (11-19 pilot) | 259 chars | "Fan Fiction: The Conversion Bureau…" |
| `tvtropes.org`, genocidal maniacs | 169 chars | the "Sonic fan animation Nazo Unleashed" fragment |
| `meme.com`, pickle | 272 chars | "Fan-made Pickle Rick collage" gallery captions |
| `tvtropes.org`, believe it | 10 chars | a trailing "Fan Works" heading; the canon text before it was kept |
| `vocal.media`, fourth wall | 628 chars | **false positive**: a Sonic Twitter paragraph that mentions "canonical and fan-fiction" |

**The Weaver and Mephiles passages are still in the packed evidence.** Their fragments carry no fan
marker, so only the new prompt line can stop them.

## Prompt line re-run (2026-11-21, paid, $0.0031)

Baseline arm only, on the 5 list/topic/ranking cases, with the current code (fan filter, `topic-card-v2`
line, grounding fix). It replayed the saved picked pages, so there were no search or extract calls.
`genocidal maniacs` ran 3 times. The run made 7 OpenAI calls with 0 failures and 0 retries, against a $0.02
cap enforced in code. Runner: `.cache/live-tools/curation-rerun.test.mts`; files: `.cache/live-tools/curation-rerun/`.

| Case | Fan entry in raw / card | Wrong scope | Kept / in evidence (earlier baseline) |
|---|---|---|---|
| list-genocidal-maniacs, run 1 | The Weaver / The Weaver | yes | 3/5 (4/5) |
| list-genocidal-maniacs, run 2 | none / none | no | 3/5 (4/5) |
| list-genocidal-maniacs, run 3 | The Weaver / The Weaver | yes | 3/5 (4/5) |
| list-fourth-wall | none | no | 2/2 (2/2) |
| rank-anime-rivals | none | no | 6/8 (5/8) |
| scope-avatar | none | no | 3/3 (3/3) |
| scope-assassins | none | no | 4/4 (4/4) |

Mephiles did not appear; it was only ever in the planner arm's evidence.

**The prompt line failed.** The Weaver was still kept in 2 of 3 runs. The line also appears to cost canon
entries:

- Joker (the Precure crossover) was dropped in all 3 runs; the earlier baseline kept him.
- In run 2 the model ignored the whole TV Tropes item ("examples include fan works"). That also lost Fibrizo
  and Joker along with The Weaver.

This is a small sample, but nothing here supports keeping the line. The other four cases were unchanged,
and the rivals case gained Kamina/Viral.

**Next smallest fix (not done, not spent):**

1. Revert the `topic-card-v2` line.
2. Move the exclusion upstream into the Parallel extraction objective for list kinds
   (`extractionObjective` in `api/_lib/parallelExtract.ts`), adding one sentence: skip fan works, fan
   fiction and fan-made characters.
3. Parallel picks the excerpts while it can still see the page's "Fan Works" folders, which the packed text
   no longer has.
4. Confirming it needs one fresh extract of the TV Tropes page plus one draft, about $0.002–0.009.

## Extraction-objective re-run (2026-11-21, paid, $0.0025)

The `topic-card-v2` prompt line was reverted, so the topic prompt is back to `topic-card-v1`. One sentence
was added to `extractionObjective` (`api/_lib/parallelExtract.ts`) for list, topic and ranking kinds:
"Skip fan works, fan fiction and fan-made characters."

The live check made one fresh Parallel extract of the TV Tropes *Omnicidal Maniac* page; the other picked
pages were replayed from the saved run. It then ran 3 baseline drafts of `genocidal maniacs` with the
current code. That was 4 calls, no failures, no retries, against a $0.01 cap enforced in code. Runner:
`.cache/live-tools/curation-objective.test.mts`; files: `.cache/live-tools/curation-objective/`.

**It failed.** The fresh extract (11,243 chars, previously 10,025) still contains The Weaver ("Neither a
Bird nor a Plane…"), Mephiles / Combine Wars, Nazo and the Equestrian War fragment. The objective did not
change which fan examples Parallel returned.

| Run | The Weaver in raw / card | Kept answer-key entries | Lost by checks |
|---|---|---|---|
| 1 | yes / yes (wrong scope) | Eren, King Fritz, Sailor Galaxia | Fibrizo |
| 2 | no / no | Eren, King Fritz, Sailor Galaxia | Fibrizo |
| 3 | yes / yes (wrong scope) | King Fritz, Sailor Galaxia, Fibrizo | Eren |

- Joker is in the extracted page but was not chosen in any run.
- Mephiles appeared in no answer.
- Citations were correct on every kept line.

**Decision (fallback):** accept occasional fan entries that a page carries without any fan marker.
The site filter and fan-fragment filter stay in place: fanon sites, "fan animation" and "Fan Fiction"
fragments and fan-works headings. No further spend on this.

The objective sentence showed no effect. Reverting it is optional; it costs nothing but did not help.

## Source-words retry in the topic check (2026-11-21, no new calls)

Fibrizo and Eren were sometimes dropped because the model wrapped a supported claim in words about its
source ("is cited as an anime example… among the Mazoku", "the source says… calls him a genocidaire").
Those words count as unmatched content and push the line under the 60% shared-word rule.

**Change:**

- `api/_lib/cardCheck.ts` `topicGrounded` (list, topic and ranking cards only): when the normal check
  fails, it retries once without lower-case source words (described, cited, identified, named, listed,
  called, says, source, example, among, appears, regarded…) and requires 70% of the remaining content words.
- Names, numbers, quotes and negations are checked exactly as before. Reference cards are unchanged.
- `shared/grounding.ts` `isGrounded` gained an optional threshold parameter. Its default is unchanged, so
  other callers behave as before.

**Replay of all 182 saved topic lines with the real code:** exactly 4 lines change from dropped to kept, all
supported by the item they cite. No line goes the other way, and no line was pushed out by the per-field cap.

- Fibrizo, live baseline
- Eren, objective-re-run run 3
- Koro-sensei, live assassins baseline
- Killua, re-run assassins baseline

The false Kamina/Viral line ("helping lead to Team Gurren's formation") stays dropped. At the plain 60%
threshold it would have passed, which is why the retry demands 70%. Lines that name "Slayers", which the
evidence never states, stay dropped by the name rule.

## Card sources and tone (2026-11-21, paid, $0.0130)

There are 4 new cases (category `card-sources` in `cases.json`). Each ran once through the real handlers,
with requests built the way the app builds them:

- App sources are `kind: 'app'`, `from: 'app card'`, with gist + summary + context as text.
- Tone cards use the favourite and kept shapes from `CurateFlow`.

The run made 10 calls (3 searches, 3 extracts of 3 URLs, 4 drafts), with no failures and no retries,
against a $0.05 cap enforced in code. The server accepted every request. Runner:
`.cache/live-tools/card-sources-test/runner.test.mts`; files: `.cache/live-tools/card-sources-test/runs/`.

| Case | Result | App facts / web facts kept | Both kinds cited | Invented facts | Tone facts leaked / tone cited / copied 4-word runs |
|---|---|---|---|---|---|
| `winter is coming`, app card + 3 web | **422 `nothing_left`** | 0 / 0 | no | none | — |
| `bazinga`, app card only | **422 `nothing_left`** | 0 | — | none (raw answer also clean) | — |
| `rizz`, web + `stonks` favourite as tone | 200, useful | — / charm 1 of 2 in evidence | — | — | none / no / none |
| `touch grass`, web + kept Pickle Rick card as tone | 200, useful | — / 2 of 2 | — | — | none / no / none |

**Tone examples behaved.** Neither tone card's facts or phrases reached the raw answer or the card, and
neither card showed up in the evidence. The cards borrowed the short, playful voice.

**App-card cases failed in the checks, not in the model.** The raw answers were correct and stayed inside
the app card. They named the reference and its show: "…the grim motto of the Stark family in Game of
Thrones", and "Bazinga! is what Sheldon shouts… on The Big Bang Theory". Those names exist only in the app
card's **title** ("“Winter is coming” (Game of Thrones)", "Bazinga! (The Big Bang Theory)"). Two pieces of
code together hide them:

- `frames.ts` builds an app source's text from gist + summary + context only.
- The checks read item text, not titles.

So the name rule dropped every summary line. Replaying with titles included, both summary lines pass.

The bazinga context line ("People use it to signal…") also failed on its first word, "People". The name
rule treats any capitalised word that isn't a common word as a name, including the first word of a
sentence.

**Smallest fixes (not applied: app code was out of scope here):**

1. In `frames.ts`, prefix the app source text with the card title (or the reference's `origin`).
   Alternatively, let `cardCheck` also read an item's title for `app` sources.
2. Exempt a sentence's first word from the name rule when it is an ordinary word such as "People". This
   needs care, since a real name can also open a sentence.

Each needs a test and one paid confirming run, about $0.005.

### After the title fix (2026-11-21, paid, $0.0043)

**Fix:** `src/features/drafts/frames.ts` now starts an app card's source text with its title, then its
`origin` when the record has one, then the card's gist, summary and context. The title and origin come
first so the server's per-item length cut keeps them. Other source kinds are unchanged. A new test in
`useCurationTray.test.ts` checks the title comes first and the text stays within `LIMITS.itemChars`; it
failed before the change.

- `npx vitest run src/features/drafts api/_lib shared`: 164 passed, 4 failed. All 4 failures are in
  `curateFlow.test.tsx`: an error alert that isn't found (`role="alert"`). That is the failure-message code
  the Supabase session is editing right now, not the source text.
- Prettier passes on the changed files.

**Confirming run:** the 2 app-card cases only, $0.01 cap in code, 4 calls, no retries. The runner now builds
the app source with the app's own `framesFrom`.

- **`winter is coming`: 200, useful.** Summary lines now survive. It kept all 4 answer-key facts.
  - The Stark motto, Game of Thrones and Martin are cited to the app card, whose origin line names Martin.
  - Ned Stark and the Mariah Carey meme are cited to the web.
  - Both kinds are cited, citations are 4/4, and there are no wrong-scope hits.
- **`bazinga`: still 422 `nothing_left`, nothing invented.** The title now reaches the evidence:
  "Bazinga! (The Big Bang Theory) The sitcom The Big Bang Theory. Gotcha, I was joking…". The model's only
  summary line, "Bazinga! is Sheldon's catchphrase in the sitcom The Big Bang Theory.", failed on
  "catchphrase". The card text never uses that word; it is only the seed's `category`. With 2 content words,
  the short-line rule needs both, so the card lost its only summary line. That drop is correct by the rule.
  Two options:
  - include the reference's category in the app text ("Catchphrase.")
  - accept that a one-source app card can come back empty when the model paraphrases.

After the run, the title now gets a full stop before the origin ("…(Game of Thrones). The fantasy
series…"). The run itself used the version without it. The `cases.json` key now accepts Martin from either
source, since the app card's origin states it. The scorer flags a mis-cited entry only when no line naming it
cites the expected kind.

## Limits

One pass, one model, list-price estimates, regex answer keys written before the run by one reader, and
"useful" defined against those keys. Initial picks are the search's top 7, not a reader's choice. No
judge model. The Radiohead and rivals cards show that the key, not just the pipeline, limits the scores.
