# Search evaluation, 2026-11-15

Generated 2026-11-15T21:42:48.467Z by `src/test/search-eval/live.eval.ts`. Definitions: `docs/SEARCH_RANKING.md` ("Evaluation set").
Set: 109 cases, 98 scored. Live runs hit real providers, so numbers drift as Wikipedia changes.

## Summary

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| local | 42 | 95.2% | 0.952 | 0.0% | 4.8% | 83.3% (6) | 0.17 | 0.27 | 0.30 | 0.48 |

## Local ranker (seeded library)

Cases run: **42 of 42**.

### By category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| anime_game | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.17 | 0.17 | 0.17 | 0.17 |
| film | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.17 | 0.17 | 0.17 | 0.17 |
| meme | 7 | 85.7% | 0.857 | 0.0% | 14.3% | – | 0.17 | 0.26 | 0.26 | 0.26 |
| music | 4 | 75.0% | 0.750 | 0.0% | 25.0% | 66.7% (3) | 0.17 | 0.23 | 0.23 | 0.23 |
| quote | 25 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (3) | 0.17 | 0.30 | 0.36 | 0.48 |
| slang | 4 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.08 | 0.16 | 0.16 | 0.16 |

### By flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| misremembered: yes | 23 | 91.3% | 0.913 | 0.0% | 8.7% | 66.7% (3) | 0.15 | 0.26 | 0.27 | 0.27 |
| misremembered: no | 19 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (3) | 0.19 | 0.36 | 0.48 | 0.48 |
| ambiguous: yes | 7 | 85.7% | 0.857 | 0.0% | 14.3% | 83.3% (6) | 0.21 | 0.48 | 0.48 | 0.48 |
| ambiguous: no | 35 | 97.1% | 0.971 | 0.0% | 2.9% | – | 0.16 | 0.27 | 0.30 | 0.36 |
| indian: yes | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.36 | 0.36 | 0.36 | 0.36 |
| indian: no | 41 | 95.1% | 0.951 | 0.0% | 4.9% | 83.3% (6) | 0.17 | 0.26 | 0.27 | 0.48 |
| ambiguous or indian: yes | 8 | 87.5% | 0.875 | 0.0% | 12.5% | 83.3% (6) | 0.21 | 0.48 | 0.48 | 0.48 |
| ambiguous or indian: no | 34 | 97.1% | 0.971 | 0.0% | 2.9% | – | 0.16 | 0.26 | 0.27 | 0.30 |
| origin: coverage | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.17 | 0.36 | 0.48 | 0.48 |
| origin: local_only | 28 | 92.9% | 0.929 | 0.0% | 7.1% | 75.0% (4) | 0.16 | 0.26 | 0.27 | 0.27 |

### Per case

| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |
|---|---|---|---|---|---|---|
| L1 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.48 | – |
| L2 | let it go | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.23 | – |
| L3 | all izz well | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.36 | – |
| L4 | winter is coming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.30 | – |
| L5 | this is fine | 1 | This is fine (dog meme) (this-is-fine-dog) | 1 | 0.13 | – |
| L6 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.14 | – |
| L7 | that's what she said | 1 | “That's what she said” (The Office) (thats-what-she-said-office) | 1 | 0.19 | – |
| L8 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.16 | – |
| L9 | how you doin | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.24 | – |
| L10 | bazinga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.13 | – |
| L11 | thanos snap | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.17 | – |
| L12 | distracted boyfriend | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.25 | – |
| L13 | i choose you | 1 | “I choose you!” (Pokémon) (i-choose-you-pokemon) | 1 | 0.17 | – |
| L14 | king of the world | 1 | “I'm the king of the world!” (Titanic) (king-of-the-world-titanic) | 1 | 0.16 | – |
| LT1 | hakuna matatta | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.25 | – |
| LT2 | hakuna matata lion kng | 1 | Hakuna Matata (The Lion King) (hakuna-matata-lion-king) | 1 | 0.27 | – |
| LT3 | bazingaa | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.13 | – |
| LT4 | bazzinga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.13 | – |
| LT5 | ok bomer | 1 | OK boomer (ok-boomer) | 1 | 0.07 | – |
| LT6 | okey boomer | 1 | OK boomer (ok-boomer) | 1 | 0.08 | – |
| LT7 | winter is comming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.09 | – |
| LT8 | winter comming game of thrones | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.12 | – |
| LT9 | homer simson | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.08 | – |
| LT10 | this is fien | – | – | 0 | 0.12 | – |
| LT11 | distracted boyfreind | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.26 | – |
| LT12 | all izz wel | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.15 | – |
| LT13 | aal is wel | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.12 | – |
| LT14 | pickachu i choose you | 1 | “I choose you!” (Pokémon) (i-choose-you-pokemon) | 1 | 0.27 | – |
| LT15 | thanos snapp | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.17 | – |
| LT16 | thats what she sad | 1 | “That's what she said” (The Office) (thats-what-she-said-office) | 1 | 0.21 | – |
| LT17 | king of the wrld | 1 | “I'm the king of the world!” (Titanic) (king-of-the-world-titanic) | 1 | 0.17 | – |
| LT18 | lte it go | – | – | 0/2 | 0.14 | – |
| LT19 | let it goo | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.17 | – |
| LT25 | bzainga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.14 | – |
| LT26 | distarcted boyfriend | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.26 | – |
| LT27 | wintre is coming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.22 | – |
| LT28 | thnaos snap | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.17 | – |
| LT20 | how you doin joey | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.21 | – |
| LT21 | frozen let it go song | 1 | Let It Go (Frozen) (let-it-go-frozen) | 1 | 0.22 | – |
| LT22 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.21 | – |
| LT23 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.16 | – |
| LT24 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.05 | – |

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
