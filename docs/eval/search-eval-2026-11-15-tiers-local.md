# Search evaluation, 2026-11-15

Generated 2026-11-15T21:42:47.475Z by `src/test/search-eval/live.eval.ts`. Definitions: `docs/SEARCH_RANKING.md` ("Evaluation set").
Set: 109 cases, 98 scored. Live runs hit real providers, so numbers drift as Wikipedia changes.

## Summary

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| local | 42 | 50.0% | 0.500 | 0.0% | 50.0% | 50.0% (6) | 0.04 | 0.05 | 0.06 | 0.11 |

## Local ranker (seeded library)

Cases run: **42 of 42**.

### By category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| anime_game | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| film | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| meme | 7 | 28.6% | 0.286 | 0.0% | 71.4% | – | 0.04 | 0.05 | 0.05 | 0.05 |
| music | 4 | 50.0% | 0.500 | 0.0% | 50.0% | 33.3% (3) | 0.04 | 0.11 | 0.11 | 0.11 |
| quote | 25 | 52.0% | 0.520 | 0.0% | 48.0% | 66.7% (3) | 0.04 | 0.05 | 0.06 | 0.08 |
| slang | 4 | 50.0% | 0.500 | 0.0% | 50.0% | – | 0.04 | 0.05 | 0.05 | 0.05 |

### By flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| misremembered: yes | 23 | 8.7% | 0.087 | 0.0% | 91.3% | 0.0% (3) | 0.04 | 0.05 | 0.05 | 0.05 |
| misremembered: no | 19 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (3) | 0.04 | 0.08 | 0.11 | 0.11 |
| ambiguous: yes | 7 | 57.1% | 0.571 | 0.0% | 42.9% | 50.0% (6) | 0.04 | 0.08 | 0.08 | 0.08 |
| ambiguous: no | 35 | 48.6% | 0.486 | 0.0% | 51.4% | – | 0.04 | 0.05 | 0.06 | 0.11 |
| indian: yes | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| indian: no | 41 | 48.8% | 0.488 | 0.0% | 51.2% | 50.0% (6) | 0.04 | 0.05 | 0.06 | 0.11 |
| ambiguous or indian: yes | 8 | 62.5% | 0.625 | 0.0% | 37.5% | 50.0% (6) | 0.04 | 0.08 | 0.08 | 0.08 |
| ambiguous or indian: no | 34 | 47.1% | 0.471 | 0.0% | 52.9% | – | 0.04 | 0.05 | 0.06 | 0.11 |
| origin: coverage | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.04 | 0.06 | 0.08 | 0.08 |
| origin: local_only | 28 | 25.0% | 0.250 | 0.0% | 75.0% | 25.0% (4) | 0.04 | 0.05 | 0.05 | 0.11 |

### Per case

| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |
|---|---|---|---|---|---|---|
| L1 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.08 | – |
| L2 | let it go | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.04 | – |
| L3 | all izz well | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.04 | – |
| L4 | winter is coming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.04 | – |
| L5 | this is fine | 1 | This is fine (dog meme) (this-is-fine-dog) | 1 | 0.05 | – |
| L6 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.04 | – |
| L7 | that's what she said | 1 | “That's what she said” (The Office) (thats-what-she-said-office) | 1 | 0.04 | – |
| L8 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.04 | – |
| L9 | how you doin | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.06 | – |
| L10 | bazinga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.05 | – |
| L11 | thanos snap | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.04 | – |
| L12 | distracted boyfriend | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.04 | – |
| L13 | i choose you | 1 | “I choose you!” (Pokémon) (i-choose-you-pokemon) | 1 | 0.04 | – |
| L14 | king of the world | 1 | “I'm the king of the world!” (Titanic) (king-of-the-world-titanic) | 1 | 0.04 | – |
| LT1 | hakuna matatta | – | – | 0/2 | 0.04 | – |
| LT2 | hakuna matata lion kng | – | – | 0 | 0.04 | – |
| LT3 | bazingaa | – | – | 0 | 0.04 | – |
| LT4 | bazzinga | – | – | 0 | 0.04 | – |
| LT5 | ok bomer | – | – | 0 | 0.04 | – |
| LT6 | okey boomer | – | – | 0 | 0.05 | – |
| LT7 | winter is comming | – | – | 0 | 0.04 | – |
| LT8 | winter comming game of thrones | – | – | 0 | 0.05 | – |
| LT9 | homer simson | – | – | 0 | 0.04 | – |
| LT10 | this is fien | – | – | 0 | 0.05 | – |
| LT11 | distracted boyfreind | – | – | 0 | 0.04 | – |
| LT12 | all izz wel | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.05 | – |
| LT13 | aal is wel | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.04 | – |
| LT14 | pickachu i choose you | – | – | 0 | 0.04 | – |
| LT15 | thanos snapp | – | – | 0 | 0.05 | – |
| LT16 | thats what she sad | – | – | 0 | 0.04 | – |
| LT17 | king of the wrld | – | – | 0 | 0.05 | – |
| LT18 | lte it go | – | – | 0/2 | 0.04 | – |
| LT19 | let it goo | – | – | 0/2 | 0.04 | – |
| LT25 | bzainga | – | – | 0 | 0.04 | – |
| LT26 | distarcted boyfriend | – | – | 0 | 0.04 | – |
| LT27 | wintre is coming | – | – | 0 | 0.04 | – |
| LT28 | thnaos snap | – | – | 0 | 0.04 | – |
| LT20 | how you doin joey | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.04 | – |
| LT21 | frozen let it go song | 1 | Let It Go (Frozen) (let-it-go-frozen) | 1 | 0.11 | – |
| LT22 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.04 | – |
| LT23 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.05 | – |
| LT24 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.04 | – |

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
