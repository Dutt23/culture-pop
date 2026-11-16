# Search evaluation, 2026-11-15

Generated 2026-11-15T21:42:49.452Z by `src/test/search-eval/live.eval.ts`. Definitions: `docs/SEARCH_RANKING.md` ("Evaluation set").
Set: 109 cases, 98 scored. Live runs hit real providers, so numbers drift as Wikipedia changes.

## Summary

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| local | 42 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (6) | 0.19 | 0.27 | 0.29 | 0.61 |

## Local ranker (seeded library)

Cases run: **42 of 42**.

### By category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| anime_game | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.19 | 0.19 | 0.19 | 0.19 |
| film | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.20 | 0.20 | 0.20 | 0.20 |
| meme | 7 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.19 | 0.28 | 0.28 | 0.28 |
| music | 4 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (3) | 0.14 | 0.24 | 0.24 | 0.24 |
| quote | 25 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (3) | 0.20 | 0.29 | 0.39 | 0.61 |
| slang | 4 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.09 | 0.17 | 0.17 | 0.17 |

### By flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| misremembered: yes | 23 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (3) | 0.15 | 0.27 | 0.28 | 0.29 |
| misremembered: no | 19 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (3) | 0.20 | 0.39 | 0.61 | 0.61 |
| ambiguous: yes | 7 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (6) | 0.19 | 0.61 | 0.61 | 0.61 |
| ambiguous: no | 35 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.19 | 0.27 | 0.29 | 0.39 |
| indian: yes | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.26 | 0.26 | 0.26 | 0.26 |
| indian: no | 41 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (6) | 0.19 | 0.27 | 0.29 | 0.61 |
| ambiguous or indian: yes | 8 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (6) | 0.19 | 0.61 | 0.61 | 0.61 |
| ambiguous or indian: no | 34 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.17 | 0.27 | 0.29 | 0.39 |
| origin: coverage | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.20 | 0.39 | 0.61 | 0.61 |
| origin: local_only | 28 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (4) | 0.15 | 0.27 | 0.28 | 0.29 |

### Per case

| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |
|---|---|---|---|---|---|---|
| L1 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.61 | – |
| L2 | let it go | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.22 | – |
| L3 | all izz well | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.26 | – |
| L4 | winter is coming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.39 | – |
| L5 | this is fine | 1 | This is fine (dog meme) (this-is-fine-dog) | 1 | 0.17 | – |
| L6 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.17 | – |
| L7 | that's what she said | 1 | “That's what she said” (The Office) (thats-what-she-said-office) | 1 | 0.25 | – |
| L8 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.14 | – |
| L9 | how you doin | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.20 | – |
| L10 | bazinga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.15 | – |
| L11 | thanos snap | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.20 | – |
| L12 | distracted boyfriend | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.27 | – |
| L13 | i choose you | 1 | “I choose you!” (Pokémon) (i-choose-you-pokemon) | 1 | 0.19 | – |
| L14 | king of the world | 1 | “I'm the king of the world!” (Titanic) (king-of-the-world-titanic) | 1 | 0.20 | – |
| LT1 | hakuna matatta | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.25 | – |
| LT2 | hakuna matata lion kng | 1 | Hakuna Matata (The Lion King) (hakuna-matata-lion-king) | 1 | 0.14 | – |
| LT3 | bazingaa | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.08 | – |
| LT4 | bazzinga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.07 | – |
| LT5 | ok bomer | 1 | OK boomer (ok-boomer) | 1 | 0.08 | – |
| LT6 | okey boomer | 1 | OK boomer (ok-boomer) | 1 | 0.09 | – |
| LT7 | winter is comming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.11 | – |
| LT8 | winter comming game of thrones | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.21 | – |
| LT9 | homer simson | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.09 | – |
| LT10 | this is fien | 1 | This is fine (dog meme) (this-is-fine-dog) | 1 | 0.15 | – |
| LT11 | distracted boyfreind | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.28 | – |
| LT12 | all izz wel | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.17 | – |
| LT13 | aal is wel | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.14 | – |
| LT14 | pickachu i choose you | 1 | “I choose you!” (Pokémon) (i-choose-you-pokemon) | 1 | 0.29 | – |
| LT15 | thanos snapp | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.19 | – |
| LT16 | thats what she sad | 1 | “That's what she said” (The Office) (thats-what-she-said-office) | 1 | 0.23 | – |
| LT17 | king of the wrld | 1 | “I'm the king of the world!” (Titanic) (king-of-the-world-titanic) | 1 | 0.20 | – |
| LT18 | lte it go | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.11 | – |
| LT19 | let it goo | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.14 | – |
| LT25 | bzainga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.13 | – |
| LT26 | distarcted boyfriend | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.27 | – |
| LT27 | wintre is coming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.24 | – |
| LT28 | thnaos snap | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.19 | – |
| LT20 | how you doin joey | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.22 | – |
| LT21 | frozen let it go song | 1 | Let It Go (Frozen) (let-it-go-frozen) | 1 | 0.24 | – |
| LT22 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.19 | – |
| LT23 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.09 | – |
| LT24 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.07 | – |

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
