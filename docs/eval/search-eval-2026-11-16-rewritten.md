# Search evaluation, 2026-11-16

Generated 2026-11-16T06:01:14.331Z by `src/test/search-eval/live.eval.ts`. Definitions: `docs/SEARCH_RANKING.md` ("Evaluation set").
Set: 109 cases, 98 scored. Live runs hit real providers, so numbers drift as Wikipedia changes.

## Summary

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| local | 42 | 50.0% | 0.500 | 0.0% | 50.0% | 50.0% (6) | 0.04 | 0.05 | 0.07 | 0.15 |
| live | 98 | 64.3% | 0.565 | 28.6% | 21.4% | 57.1% (21) | 4079 | 21222 | 21570 | 26632 |

## Local ranker (seeded library)

Cases run: **42 of 42**.

### By category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| anime_game | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| film | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| meme | 7 | 28.6% | 0.286 | 0.0% | 71.4% | – | 0.05 | 0.07 | 0.07 | 0.07 |
| music | 4 | 50.0% | 0.500 | 0.0% | 50.0% | 33.3% (3) | 0.04 | 0.05 | 0.05 | 0.05 |
| quote | 25 | 52.0% | 0.520 | 0.0% | 48.0% | 66.7% (3) | 0.04 | 0.05 | 0.07 | 0.15 |
| slang | 4 | 50.0% | 0.500 | 0.0% | 50.0% | – | 0.04 | 0.05 | 0.05 | 0.05 |

### By flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| misremembered: yes | 23 | 8.7% | 0.087 | 0.0% | 91.3% | 0.0% (3) | 0.04 | 0.06 | 0.07 | 0.15 |
| misremembered: no | 19 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (3) | 0.04 | 0.05 | 0.07 | 0.07 |
| ambiguous: yes | 7 | 57.1% | 0.571 | 0.0% | 42.9% | 50.0% (6) | 0.04 | 0.07 | 0.07 | 0.07 |
| ambiguous: no | 35 | 48.6% | 0.486 | 0.0% | 51.4% | – | 0.04 | 0.05 | 0.07 | 0.15 |
| indian: yes | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| indian: no | 41 | 48.8% | 0.488 | 0.0% | 51.2% | 50.0% (6) | 0.04 | 0.05 | 0.07 | 0.15 |
| ambiguous or indian: yes | 8 | 62.5% | 0.625 | 0.0% | 37.5% | 50.0% (6) | 0.04 | 0.07 | 0.07 | 0.07 |
| ambiguous or indian: no | 34 | 47.1% | 0.471 | 0.0% | 52.9% | – | 0.04 | 0.05 | 0.07 | 0.15 |
| origin: coverage | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.04 | 0.05 | 0.07 | 0.07 |
| origin: local_only | 28 | 25.0% | 0.250 | 0.0% | 75.0% | 25.0% (4) | 0.04 | 0.06 | 0.07 | 0.15 |

### Per case

| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |
|---|---|---|---|---|---|---|
| L1 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.07 | – |
| L2 | let it go | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.04 | – |
| L3 | all izz well | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.04 | – |
| L4 | winter is coming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.04 | – |
| L5 | this is fine | 1 | This is fine (dog meme) (this-is-fine-dog) | 1 | 0.04 | – |
| L6 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.05 | – |
| L7 | that's what she said | 1 | “That's what she said” (The Office) (thats-what-she-said-office) | 1 | 0.04 | – |
| L8 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.04 | – |
| L9 | how you doin | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.05 | – |
| L10 | bazinga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.04 | – |
| L11 | thanos snap | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.04 | – |
| L12 | distracted boyfriend | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.04 | – |
| L13 | i choose you | 1 | “I choose you!” (Pokémon) (i-choose-you-pokemon) | 1 | 0.04 | – |
| L14 | king of the world | 1 | “I'm the king of the world!” (Titanic) (king-of-the-world-titanic) | 1 | 0.04 | – |
| LT1 | hakuna matatta | – | – | 0/2 | 0.04 | – |
| LT2 | hakuna matata lion kng | – | – | 0 | 0.04 | – |
| LT3 | bazingaa | – | – | 0 | 0.04 | – |
| LT4 | bazzinga | – | – | 0 | 0.04 | – |
| LT5 | ok bomer | – | – | 0 | 0.04 | – |
| LT6 | okey boomer | – | – | 0 | 0.04 | – |
| LT7 | winter is comming | – | – | 0 | 0.04 | – |
| LT8 | winter comming game of thrones | – | – | 0 | 0.04 | – |
| LT9 | homer simson | – | – | 0 | 0.15 | – |
| LT10 | this is fien | – | – | 0 | 0.07 | – |
| LT11 | distracted boyfreind | – | – | 0 | 0.05 | – |
| LT12 | all izz wel | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.05 | – |
| LT13 | aal is wel | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.05 | – |
| LT14 | pickachu i choose you | – | – | 0 | 0.05 | – |
| LT15 | thanos snapp | – | – | 0 | 0.06 | – |
| LT16 | thats what she sad | – | – | 0 | 0.05 | – |
| LT17 | king of the wrld | – | – | 0 | 0.05 | – |
| LT18 | lte it go | – | – | 0/2 | 0.05 | – |
| LT19 | let it goo | – | – | 0/2 | 0.04 | – |
| LT25 | bzainga | – | – | 0 | 0.04 | – |
| LT26 | distarcted boyfriend | – | – | 0 | 0.05 | – |
| LT27 | wintre is coming | – | – | 0 | 0.04 | – |
| LT28 | thnaos snap | – | – | 0 | 0.04 | – |
| LT20 | how you doin joey | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.05 | – |
| LT21 | frozen let it go song | 1 | Let It Go (Frozen) (let-it-go-frozen) | 1 | 0.05 | – |
| LT22 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.04 | – |
| LT23 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.05 | – |
| LT24 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.04 | – |

## Live retrieval

Cases run: **98 of 98**.

HTTP requests: **426** over 98 searches (4.35 per search).

Degraded cases (a provider failed): **35** of 98. Rerun before recording a baseline if this is not 0.

### By category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| anime_game | 3 | 33.3% | 0.333 | 33.3% | 33.3% | 0.0% (1) | 3981 | 21149 | 21149 | 21149 |
| film | 12 | 66.7% | 0.479 | 41.7% | 25.0% | 55.6% (9) | 2616 | 21222 | 22426 | 22426 |
| meme | 20 | 90.0% | 0.817 | 20.0% | 5.0% | – | 3898 | 21570 | 21644 | 22671 |
| music | 11 | 54.5% | 0.500 | 9.1% | 45.5% | – | 21092 | 21209 | 21224 | 21224 |
| quote | 40 | 50.0% | 0.433 | 37.5% | 25.0% | 20.0% (5) | 3592 | 21205 | 21232 | 21263 |
| slang | 6 | 66.7% | 0.667 | 16.7% | 16.7% | 100.0% (1) | 1945 | 21170 | 21170 | 21170 |
| tv | 6 | 100.0% | 0.917 | 16.7% | 0.0% | 100.0% (5) | 4445 | 26632 | 26632 | 26632 |

### By flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| misremembered: yes | 11 | 27.3% | 0.182 | 54.5% | 36.4% | 100.0% (1) | 3047 | 21232 | 22426 | 22426 |
| misremembered: no | 87 | 69.0% | 0.614 | 25.3% | 19.5% | 55.0% (20) | 4155 | 21212 | 21263 | 26632 |
| ambiguous: yes | 22 | 63.6% | 0.545 | 27.3% | 27.3% | 57.1% (21) | 6897 | 21222 | 21263 | 26632 |
| ambiguous: no | 76 | 64.5% | 0.571 | 28.9% | 19.7% | – | 3978 | 21212 | 21570 | 22671 |
| indian: yes | 25 | 64.0% | 0.540 | 28.0% | 28.0% | 63.6% (11) | 4155 | 21212 | 21644 | 26632 |
| indian: no | 73 | 64.4% | 0.574 | 28.8% | 19.2% | 50.0% (10) | 4079 | 21222 | 21263 | 22671 |
| ambiguous or indian: yes | 36 | 58.3% | 0.486 | 30.6% | 30.6% | 57.1% (21) | 6449 | 21222 | 21644 | 26632 |
| ambiguous or indian: no | 62 | 67.7% | 0.612 | 27.4% | 16.1% | – | 3898 | 21209 | 21239 | 22671 |
| origin: coverage | 37 | 62.2% | 0.520 | 37.8% | 18.9% | 57.9% (19) | 3687 | 21222 | 21263 | 26632 |
| origin: demand | 49 | 73.5% | 0.667 | 20.4% | 18.4% | 50.0% (2) | 4361 | 21224 | 21570 | 22671 |
| origin: variant | 12 | 33.3% | 0.292 | 33.3% | 41.7% | – | 4155 | 21195 | 22426 | 22426 |

### Per case

| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |
|---|---|---|---|---|---|---|
| M1 | cash me outside | 1 | Bhad Bhabie (wd:Q28784685) | 1 | 2094 | – |
| M1-v | catch me outside | – | Catch Me Outside (wd:Q110449182) | 0 | 1786 | – |
| M2 | skibidi toilet | 1 | Skibidi Toilet (wd:Q121368207) | 1 | 1975 | – |
| M3 | 6 7 meme | 1 | 6-7 (wd:Q136163131) | 1 | 3898 | – |
| M3-v | six seven | 1 | 6-7 (wd:Q136163131) | 1 | 2975 | – |
| M6 | gigachad | 1 | gigachad (enwiktionary:gigachad) | 1 | 20365 | – |
| M7 | punch the monkey | 1 | Punch (monkey) (wd:Q138358320) | 1 | 8262 | – |
| M8 | nihilist penguin | 1 | Nihilistic penguin (wd:Q137916121) | 1 | 1222 | – |
| M9 | ctrl alt del loss comic | 1 | Loss (Ctrl+Alt+Del) (wd:Q56152168) | 1 | 21570 | – |
| M10 | italian brainrot | 1 | Italian brainrot (wd:Q133869040) | 1 | 16525 | – |
| M11 | tralalero tralala | 1 | Italian brainrot (wd:Q133869040) | 1 | 2253 | – |
| M12 | bombardiro crocodilo | 1 | Italian brainrot (wd:Q133869040) | 1 | 1010 | – |
| M13 | epic sax guy | 1 | Sergey Stepanov (musician) (wd:Q12740674) | 1 | 1708 | – |
| M14 | waltuh breaking bad | 3 | Walter White (Breaking Bad) (wd:Q23554) | 1 | 22671 | – |
| M15 | its morbin time | 1 | Morbius (film) (wd:Q55405369) | 1 | 4764 | – |
| M16 | sus among us | 1 | Among Us (wd:Q96417649) | 1 | 8567 | wikidata:timeout |
| S1 | rizz | 1 | Rizz (wd:Q123669845) | 1 | 1473 | – |
| S2 | no cap | 1 | no cap (enwiktionary:no cap) | 1 | 963 | – |
| S3 | bussin | – | F9 (film) (wd:Q29466808) | 0 | 1945 | – |
| S6 | 420 | 1 | 420 (enwiktionary:420) | 1 | 14301 | – |
| S7 | nani | 1 | nani (enwiktionary:nani) | 2/2 | 6897 | – |
| Q1 | i've fallen and i can't get up | 1 | I've fallen, and I can't get up! (wd:Q17029612) | 1 | 1678 | – |
| Q2 | where's the beef | 1 | Where's the beef? (wd:Q1459668) | 1 | 1974 | – |
| Q2-v | where is the beef | 1 | Where's the beef? (wd:Q1459668) | 1 | 5559 | – |
| Q3 | i'm kind of a big deal | 3 | Shaniera Akram (wd:Q23092271) | 1 | 2477 | – |
| Q3-v | im kind of a big deal i have many leather bound books | – | – | 0 | 21192 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| Q4 | show me the money | – | – | 0/2 | 21045 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| Q5 | the revolution will not be televised | 1 | The Revolution Will Not Be Televised (wd:Q1753999) | 1 | 3118 | – |
| Q5-v | revolution will not be televised quote | 1 | The Revolution Will Not Be Televised (wd:Q1753999) | 1 | 1995 | – |
| Q6 | hey baby i hear the news are calling for salads and scrambled eggs | – | – | 0 | 21152 | wiktionary:rate_limited |
| Q6-v | frasier theme song lyrics | – | – | 0 | 21195 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| Q7 | omae wa mou shindeiru | 1 | Kenshiro (wd:Q1185545) | 1 | 2273 | – |
| Q7-v | oh my yo wa moo shin dae doo hee yun knee | – | Oh My Kadavule (wd:Q85790351) | 0 | 2317 | – |
| Q8 | yeah i got time incredibles | 1 | The Incredibles (wd:Q213326) | 1 | 21239 | wiktionary:rate_limited |
| Q9 | want a sprite cranberry | – | – | 0 | 21198 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| Q10 | that was his mistake big hero 6 | – | To Be Hero X (wd:Q133866311) | 0 | 3978 | – |
| T1 | baby yoda | 1 | Grogu (wd:Q77001957) | 1 | 8916 | – |
| F1 | three fingers inglorious bastards | – | – | 0 | 21198 | wikipedia:rate_limited |
| F1-v | inglorious bastards | 2 | The Inglorious Bastards (wd:Q338002) | 1 | 22426 | – |
| A1 | nah id win | – | Global public good (wd:Q8270788) | 0 | 1324 | – |
| A2 | steal a brainrot | 1 | Steal a Brainrot (wd:Q135921344) | 1 | 3981 | – |
| B1 | midwest emo | – | – | 0 | 21209 | wikipedia:rate_limited, wikiquote:rate_limited |
| B2 | neutral milk hotel meme | 2 | In the Aeroplane Over the Sea (wd:Q1660782) | 1 | 19665 | – |
| B3 | messages from the stars rah band | 1 | Richard Anthony Hewson (wd:Q709410) | 1 | 2026 | – |
| B4 | tool band | 1 | Tool (band) (wd:Q184827) | 1 | 21204 | wikiquote:rate_limited |
| B5 | ruler of everything tally hall | – | – | 0 | 21202 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| B6 | can you play wonderwall | 1 | Wonderwall (wd:Q1045517) | 1 | 4361 | – |
| B7 | fucking magnets how do they work | 1 | Miracles (Insane Clown Posse song) (wd:Q6872509) | 1 | 2324 | – |
| B8 | mo bamba | – | – | 0 | 21184 | wikipedia:rate_limited, wiktionary:rate_limited |
| B9 | post malone ozzy osbourne | – | – | 0 | 21224 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| B10 | everywhere at the end of time | 1 | Everywhere at the End of Time (wd:Q104771220) | 1 | 1525 | – |
| I1 | mogambo khush hua | 2 | Mogambo (character) (wd:Q136377380) | 1 | 1722 | – |
| I2 | rasode mein kaun tha | 2 | Rucha Hasabnis (wd:Q7376575) | 1 | 21644 | wikidata:timeout |
| I2-v | kokilaben rap | – | – | 0 | 21166 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| I3 | paisa hi paisa hoga | – | Bewafa (song) (wd:Q135420995) | 0 | 3004 | – |
| I3-v | babu bhaiya paisa hi paisa hoga | – | Hemlata (singer) (wd:Q5712227) | 0 | 4155 | – |
| I4 | utha le re baba | 2 | Myntra (wd:Q6947830) | 1 | 21111 | wikiquote:rate_limited |
| I4-v | uthale re baba | – | – | 0 | 21184 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| I5 | bilkul ricks nahi lene ka | – | – | 0 | 827 | – |
| I5-v | bilkul risk nahi lene ka | – | – | 0 | 818 | – |
| I6 | kitne aadmi the | 1 | Gabbar Singh (character) (wd:Q5515286) | 1 | 21070 | wikiquote:rate_limited |
| X1 | how's the josh | – | – | 0 | 21212 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| X2 | mere paas maa hai | 1 | Deewaar (wd:Q787034) | 1 | 6449 | – |
| X3 | picture abhi baaki hai mere dost | 1 | Om Shanti Om (wd:Q330468) | 1 | 2023 | – |
| X4 | don ko pakadna mushkil hi nahi namumkin hai | 1 | Don (2006 Hindi film) (wd:Q662436) | 1/2 | 21126 | wiktionary:rate_limited, wikiquote:rate_limited |
| X5 | hera pheri | – | – | 0/3 | 21107 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| X6 | devdas | 2 | Devdas (wd:Q11169650) | 2/3 | 3053 | – |
| X7 | agneepath | 1 | Agneepath (2012 film) (wd:Q3595073) | 2/2 | 1125 | – |
| X8 | simba | 1 | Simba (wd:Q1649583) | 1/2 | 2616 | wikiquote-qid:HTTP 429 after 3 attempts |
| X9 | bahubali | – | – | 0/2 | 21152 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| X10 | taarak mehta | 1 | Taarak Mehta Ka Ooltah Chashmah (wd:Q2719817) | 2/2 | 3687 | – |
| X11 | mirzapur | 1 | Mirzapur (wd:Q888908) | 2/2 | 1695 | – |
| X12 | panchayat | 2 | Gram panchayat (wd:Q2732840) | 2/2 | 4445 | wikiquote-qid:HTTP 429 after 3 attempts |
| X13 | sacred games | 1 | Sacred Games (TV series) (wd:Q48727094) | 2/2 | 26632 | – |
| X14 | pushpa | 1 | Pushpa 2: The Rule (wd:Q112083510) | 2/2 | 2429 | – |
| X15 | here's johnny | – | Comedy on Wikiquote (enwikiquote:126447) | 0/2 | 21263 | wikipedia:rate_limited, wikiquote-qid:HTTP 429 after 3 attempts |
| X16 | dune | 2 | Dune (wd:Q25391) | 2/3 | 966 | – |
| X17 | the office | 1 | The Office (wd:Q43129905) | 3/3 | 7811 | – |
| X18 | the italian job | – | Top Gear (series 17) on Wikiquote (enwikiquote:248922) | 0/2 | 21222 | wikipedia:rate_limited |
| X19 | scarface | 1 | Scarface (1983 film) (wd:Q47075) | 2/2 | 1991 | – |
| X20 | play it again sam | 2 | Play It Again, Sam (play) (wd:Q17051771) | 2/2 | 1879 | – |
| X21 | luke i am your father | – | Rove (TV series) on Wikiquote (enwikiquote:48306) | 0 | 21232 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote-qid:HTTP 429 after 3 attempts |
| X22 | beam me up scotty | 1 | Beam me up, Scotty (wd:Q4876190) | 1 | 3047 | wikiquote:bad_response |
| X23 | hello clarice | – | Hannibal (2001 film) (wd:Q722682) | 0 | 1884 | – |
| L1 | hakuna matata | – | – | 0/2 | 21205 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| L2 | let it go | – | – | 0 | 21092 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| L3 | all izz well | 1 | 3 Idiots (wd:Q229633) | 1 | 2803 | – |
| L4 | winter is coming | – | Winter Is Coming (wd:Q2614622) | 0 | 2264 | – |
| L5 | this is fine | 2 | This Is Fine (wd:Q65082311) | 1 | 1488 | wikiquote-qid:HTTP 429 after 3 attempts |
| L6 | ok boomer | – | – | 0 | 21170 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| L7 | that's what she said | 2 | Michael Scott (The Office) (wd:Q2346771) | 1 | 3592 | – |
| L8 | d'oh | 1 | D'oh! (wd:Q1409224) | 1 | 2846 | – |
| L9 | how you doin | – | Mitch Hedberg on Wikiquote (enwikiquote:4525) | 0 | 21183 | wikipedia:rate_limited, wikiquote-qid:HTTP 429 after 3 attempts |
| L10 | bazinga | 1 | Sheldon Cooper (wd:Q629583) | 1 | 3519 | – |
| L11 | thanos snap | 4 | The Blip (wd:Q106856883) | 1 | 1195 | – |
| L12 | distracted boyfriend | 1 | Distracted boyfriend (wd:Q55691704) | 1 | 21160 | wiktionary:rate_limited |
| L13 | i choose you | – | – | 0/2 | 21149 | wikipedia:rate_limited, wiktionary:rate_limited, wikiquote:rate_limited |
| L14 | king of the world | – | King of the World (sculpture) (wd:Q138798785) | 0 | 4079 | – |

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
