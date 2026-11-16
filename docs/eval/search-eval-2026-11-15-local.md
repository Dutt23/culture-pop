# Search evaluation, 2026-11-15

Generated 2026-11-15T14:20:35.610Z by `src/test/search-eval/live.eval.ts`. Definitions: `docs/SEARCH_RANKING.md` ("Evaluation set").
Set: 109 cases, 98 scored. Live runs hit real providers, so numbers drift as Wikipedia changes.

## Summary

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| local | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.05 | 0.07 | 0.39 | 0.39 |

## Local ranker (seeded library)

Cases run: **14 of 14**.

### By category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| anime_game | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.05 | 0.05 | 0.05 | 0.05 |
| film | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.05 | 0.05 | 0.05 | 0.05 |
| meme | 2 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.05 | 0.05 | 0.05 | 0.05 |
| music | 1 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (1) | 0.06 | 0.06 | 0.06 | 0.06 |
| quote | 8 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (1) | 0.05 | 0.39 | 0.39 | 0.39 |
| slang | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.05 | 0.05 | 0.05 | 0.05 |

### By flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| misremembered: yes | 0 | 0.0% | 0.000 | 0.0% | 0.0% | – | – | – | – | – |
| misremembered: no | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.05 | 0.07 | 0.39 | 0.39 |
| ambiguous: yes | 3 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.06 | 0.39 | 0.39 | 0.39 |
| ambiguous: no | 11 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.05 | 0.05 | 0.07 | 0.07 |
| indian: yes | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.05 | 0.05 | 0.05 | 0.05 |
| indian: no | 13 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.05 | 0.07 | 0.39 | 0.39 |
| ambiguous or indian: yes | 4 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.05 | 0.39 | 0.39 | 0.39 |
| ambiguous or indian: no | 10 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.05 | 0.05 | 0.07 | 0.07 |
| origin: coverage | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.05 | 0.07 | 0.39 | 0.39 |

### Per case

| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |
|---|---|---|---|---|---|---|
| L1 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.39 | – |
| L2 | let it go | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.06 | – |
| L3 | all izz well | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.05 | – |
| L4 | winter is coming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.05 | – |
| L5 | this is fine | 1 | This is fine (dog meme) (this-is-fine-dog) | 1 | 0.05 | – |
| L6 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.05 | – |
| L7 | that's what she said | 1 | “That's what she said” (The Office) (thats-what-she-said-office) | 1 | 0.05 | – |
| L8 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.05 | – |
| L9 | how you doin | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.05 | – |
| L10 | bazinga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.07 | – |
| L11 | thanos snap | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.05 | – |
| L12 | distracted boyfriend | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.05 | – |
| L13 | i choose you | 1 | “I choose you!” (Pokémon) (i-choose-you-pokemon) | 1 | 0.05 | – |
| L14 | king of the world | 1 | “I'm the king of the world!” (Titanic) (king-of-the-world-titanic) | 1 | 0.05 | – |

## Excluded from scoring

| ID | Query | Status | Note |
|---|---|---|---|
| M4 | understandable have a nice day | no_target | No enwiki page or Wikidata item found. |
| M5 | mcdonalds sprite | no_target | No Wikidata item found; "Sprite (drink)" is not the reference. |
| S4 | username checks out | no_target | No Wiktionary entry (checked) and no Wikidata item found. |
| S5 | mods are asleep | no_target | No Wiktionary entry (checked) and no Wikidata item found. |
| T2 | are you ready for your kiss now explodey | unverified | Canonical rests on one Reddit comment. |
| T3 | whoever smelt it dealt it cartoon mayor | unverified | NOT VERIFIED (thread unresolved) |
| I7 | bhai aap kya kehna chahte ho | no_target | No item for the moment; the person page (Q195616) is related, not the reference. |
| I8 | money follows my brother ravi kishan | no_target | No item for the line; the person page (Q7296641) is related, not the reference. |
| I9 | average in everything kareena kapoor dialogue | unverified | Canonical rests on one Reddit comment. |
| I10 | mil jaye to mitti kho jaye to sona | unverified | Canonical rests on one Reddit comment. |
| I11 | gaadi titanic waali laana tinted | unverified | NOT VERIFIED (Hera Pheri vs Aan: Men at Work) |
