# Passage-selection methods, offline pilot (2026-11-20)

**Pilot, not a benchmark:** one query ("genocidal maniacs", tags Anime/Cartoons), 10 saved pages, ground truth labelled by one reader. Nothing here changes app code.

Follows `passage-selection-2026-11-19.md` and `embedding-offline.md`. The question is how to pack each fetched page into the 1,200-code-point evidence item before the model sees it, and whether semantic ranking beats the current anchored lexical cut.

## Setup

- **Data:** `.cache/live-tools/result.json`, replayed with no network. There are 10 web sources: the 7 the reader picked (P0–P6) and the 3 research pages from the augmented run (P7–P9, which hold Vegeta, Eren's 80% and Patry). Page text goes through `plainText`, as `extractPages` does for a list card.
- **Cap:** `LIMITS.itemChars` (1,200 code points). Every method ends with draft-card's final step: `cut` to 1,200, then strip URLs. As in `draft-card.ts`, pages of 1,200 code points or less are kept whole, so P3 (548) and P6 Ryunka (842) come out the same under every method.
- **Anchor** (shared by methods 2–4): `${search} ${picked snippet}`, the same string draft-card passes.
- **Harness:** `.cache/live-tools/passage-methods.test.ts`, run with `npx vitest run --config .cache/live-tools/passage-methods.config.ts`. Output goes to `.cache/live-tools/passage-methods-result.json`. Transformers.js runs with `allowRemoteModels = false`, so it loads the model from `.cache/transformers` or fails. It cannot download anything.

### Methods

1. **Head.** `cut(page, 1200)`.
2. **Anchored lexical (current).** The real `bestSnippet([page], anchor, 2)` from `api/_lib/snippet.ts`, called the same way `toCandidates` calls it. It starts at the best-scoring sentence minus two sentences and runs to the end of the page, then `cut`.
3. **Semantic.** The page is split with bestSnippet's sentence splitter, and any "sentence" over 400 chars (category lists, menus) is cut into word runs of 400 chars or less. Each window is a unit plus the unit before it. Windows are scored by MiniLM-L6 (q8) cosine against the anchor. The method keeps adding top windows while the rendered text fits in 1,200, then outputs them in page order with `…` at each gap.
4. **Hybrid.** Same as semantic, but the score is 0.5 × min-max(cosine) + 0.5 × min-max(lexical stem hits) within each page. The lexical part repeats bestSnippet's stem rule (5-letter stems, its stopword list, no "explains" bonus) because `score` is not exported.

### Ground truth

43 supported facts in all, 18 of them **core**. A fact is core when it is an animation character tied to genocide or mass extermination, which is the request. Examples: Frieza exterminating the Saiyans (P4, P7), Vegeta's genocide on multiple planets (P9), Eren's 80% (P7), Patry and the Clover Kingdom (P7), Ryunka (P6), Lucy in Elfen Lied backing out of global genocide (P8), Guts, Kira's 250,000, Euphemia in Code Geass, the Kurta clan, the Uchiha massacre, Ohara, Lord Shen, Golg Bodolza. The other 25 are weaker supported items, such as the omnicidal definition, Pretty Cure, Revy's 128 kills and names that only appear in a category list.

There are 35 off-scope markers. Real history covers the Armenian Genocide, Turkey and Azerbaijan on P4, and Hitler and Nazis on P7. Non-animation covers Deadpool, Midnighter, Lobo, Hulk and Punisher on P2; Doctor Who, Star Trek and mythology on P1 and P7; and Kylo Ren, Palpatine, Thanos and others on P5. Page chrome covers the TV Tropes menu on P7 and the CBR footers on P8 and P9. Each fact or marker is matched by regex on the packed text (all of a fact's patterns must match).

## Results

| Method | Core facts (of 18) | All facts (of 43) | Off-scope hits (real / non-anim / chrome) | Chars sent (10 items) | Wall time |
|---|---|---|---|---|---|
| Head | 5 | 8 | 5 (0 / 4 / 1) | 10,989 | 0.2 ms |
| **Anchored lexical** | **9** | 11 | 8 (0 / 6 / 2) | 10,534 | 4 ms |
| Semantic (MiniLM) | 7 | 14 | 7 (**1** / 6 / 0) | 10,949 | 1.3–2.0 s, plus 126–145 ms model load |
| Hybrid | 6 | 13 | 7 (**1** / 6 / 0) | 10,948 | 1.3–1.9 s, plus the same load |

Model load is from the on-disk cache in a warm Node process; the first-ever cold start will be slower. Semantic time covers embedding about 500 windows on CPU across the 8 pages that need packing, and was measured on two runs.

Core facts each method keeps:

- **Head:** P0 Code Geass "genocidal maniacs", P4 Frieza, P6 Ryunka, P7 Eren 80%, P7 Patry. Patry survives only because it sits early on the page.
- **Anchored:** everything Head keeps, plus P4 Euphemia, P8 Lucy (Elfen Lied), P8 Guts, and **P9 Vegeta**, which Head loses.
- **Semantic:** P0, P4 Frieza, P4 Euphemia, P6 Ryunka, P7 Eren 80%, P8 Guts, P9 Vegeta. It **loses Patry and Lucy**, which Anchored keeps.
- **Hybrid:** the same as Semantic minus Euphemia.

## Per-page notes

- **P7 TV Tropes Genocide Backfire (12k):** Anchored keeps the site menu ("Wiki Tools … Terms Of Service", about 400 chars) because the best sentence comes right after it, but it still keeps Eren and Patry. Semantic and hybrid drop the menu, but they spend the budget on non-anime examples (*She Retaliated…* manhwa, Lanfeust, Empire from the Ashes, Doctor Who) and the "Everybody Hates **Hitler**" line. They lose Patry. No method reaches the Frieza, Kurta, Uchiha, Ohara or Kung Fu Panda lines in 1,200 chars. That is a limit of the budget, not of the ranker.
- **P8 CBR body counts (7k):** Anchored starts at Lucy and runs into Guts. Semantic picks Guts but cuts Lucy's genocide sentence in favour of a fragment.
- **P9 CBR war criminals (6k):** All three rankers keep "Vegeta committed genocide". Anchored also keeps the CBR footer (Godzilla review) because it runs to the end of the page.
- **P5 category list (4k):** Semantic and hybrid pick list chunks naming Frieza, Eren Yeager and Sailor Galaxia. That is +3 facts, and it accounts for most of their lead on "All facts". These are bare names with no claim attached, so they are weak evidence.
- **P2 fandomwire superheroes (4k, comics/film):** Every method pulls in comic heroes. There is no animation content on the page to choose. Semantic and hybrid pull in more of them (Lobo, Hulk, Punisher) because the page title matches the query almost exactly. Filtering whole sources is a job for curation, not for packing.
- **P1 Tropedia Omnicidal Maniac (12k):** All methods keep the definition. Semantic and hybrid add Pretty Cure. None reaches Sailor Galaxia's planet-killing.
- **P4 All The Tropes (7k):** Anchored and Semantic keep Frieza and Euphemia. Hybrid keeps Frieza only. Anchored also carries Magneto (film). No method reaches the Armenian Genocide "Real Life" section.
- **Artifact:** the semantic picker keeps bare "..." units as separate pieces ("... … ..."), which wastes some characters. A real version should drop units with no letters.

## Limitations

- One query, one reader's labels and regex matching. A fact split across a gap, or reworded, counts as missed.
- The core/non-core split and the off-scope list are judgement calls made by reading the pages. They were not checked by a second reader.
- Semantic and hybrid are untuned. The window is unit plus previous unit, the hybrid weight is fixed at 0.5/0.5, and there is no MMR (diversity) or junk-unit filter. A tuned version could do better.
- The anchor includes the picked snippet. On P2 and P7 that pulls the ranking toward the page's own framing, whatever the ranker.
- Wall times come from one Mac and two runs. They are not latency percentiles.

## Recommendation

**Keep anchored lexical as the default and as the baseline. Carry Semantic forward as the one challenger in the wider test set, with two cheap fixes: drop units with no letters, and penalise menu-like units.**

On this pilot, anchored lexical keeps the most core facts (9 of 18, against 7 for semantic), never pulls in real-history text, and costs about 4 ms. Semantic's lead on all facts (14 against 11) comes mostly from bare names in a category list, and it lost Patry and Lucy and pulled in Hitler. Hybrid did not beat either method, so it is not worth a separate arm until semantic shows a gain.

What the wider set needs to answer:

1. Does semantic beat anchored on core facts across many queries?
2. Is a 1–2 s CPU embedding cost (or the browser equivalent) acceptable per draft?
3. Would anchored plus a chrome/menu filter close most of the gap at no model cost?
