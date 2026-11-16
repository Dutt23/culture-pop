# Search evaluation, 2026-11-15

Generated 2026-11-15T21:31:07.046Z by `src/test/search-eval/live.eval.ts`. Definitions: `docs/SEARCH_RANKING.md` ("Evaluation set").
Set: 109 cases, 98 scored. Live runs hit real providers, so numbers drift as Wikipedia changes.

## Summary

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| local | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.04 | 0.05 | 0.32 | 0.32 |
| live | 98 | 78.6% | 0.697 | 32.7% | 6.1% | 76.2% (21) | 2416 | 20455 | 22140 | 23246 |

## Local ranker (seeded library)

Cases run: **14 of 14**.

### By category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| anime_game | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| film | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| meme | 2 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.05 | 0.05 | 0.05 |
| music | 1 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (1) | 0.05 | 0.05 | 0.05 | 0.05 |
| quote | 8 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (1) | 0.04 | 0.32 | 0.32 | 0.32 |
| slang | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |

### By flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| misremembered: yes | 0 | 0.0% | 0.000 | 0.0% | 0.0% | – | – | – | – | – |
| misremembered: no | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.04 | 0.05 | 0.32 | 0.32 |
| ambiguous: yes | 3 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.05 | 0.32 | 0.32 | 0.32 |
| ambiguous: no | 11 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.05 | 0.05 | 0.05 |
| indian: yes | 1 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.04 | 0.04 | 0.04 |
| indian: no | 13 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.04 | 0.05 | 0.32 | 0.32 |
| ambiguous or indian: yes | 4 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.04 | 0.32 | 0.32 | 0.32 |
| ambiguous or indian: no | 10 | 100.0% | 1.000 | 0.0% | 0.0% | – | 0.04 | 0.05 | 0.05 | 0.05 |
| origin: coverage | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.04 | 0.05 | 0.32 | 0.32 |

### Per case

| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |
|---|---|---|---|---|---|---|
| L1 | hakuna matata | 1 | Hakuna matata (Swahili phrase) (hakuna-matata-swahili) | 2/2 | 0.32 | – |
| L2 | let it go | 1 | Let it go (everyday saying) (let-it-go-saying) | 2/2 | 0.05 | – |
| L3 | all izz well | 1 | “All izz well” (3 Idiots) (all-izz-well-3-idiots) | 1 | 0.04 | – |
| L4 | winter is coming | 1 | “Winter is coming” (Game of Thrones) (winter-is-coming-got) | 1 | 0.04 | – |
| L5 | this is fine | 1 | This is fine (dog meme) (this-is-fine-dog) | 1 | 0.05 | – |
| L6 | ok boomer | 1 | OK boomer (ok-boomer) | 1 | 0.04 | – |
| L7 | that's what she said | 1 | “That's what she said” (The Office) (thats-what-she-said-office) | 1 | 0.04 | – |
| L8 | d'oh | 1 | D'oh! (The Simpsons) (doh-simpsons) | 1 | 0.04 | – |
| L9 | how you doin | 1 | “How you doin'?” (Friends) (how-you-doin-friends) | 1 | 0.04 | – |
| L10 | bazinga | 1 | Bazinga! (The Big Bang Theory) (bazinga-big-bang-theory) | 1 | 0.05 | – |
| L11 | thanos snap | 1 | The snap (Avengers) (the-snap-avengers) | 1 | 0.04 | – |
| L12 | distracted boyfriend | 1 | Distracted boyfriend (meme) (distracted-boyfriend) | 1 | 0.04 | – |
| L13 | i choose you | 1 | “I choose you!” (Pokémon) (i-choose-you-pokemon) | 1 | 0.04 | – |
| L14 | king of the world | 1 | “I'm the king of the world!” (Titanic) (king-of-the-world-titanic) | 1 | 0.04 | – |

## Live retrieval

Cases run: **98 of 98**.

Degraded cases (a provider failed): **1** of 98. Rerun before recording a baseline if this is not 0.

### By category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| anime_game | 3 | 66.7% | 0.667 | 33.3% | 0.0% | 100.0% (1) | 19856 | 20666 | 20666 | 20666 |
| film | 12 | 91.7% | 0.729 | 41.7% | 0.0% | 88.9% (9) | 1743 | 4717 | 21981 | 21981 |
| meme | 20 | 85.0% | 0.808 | 20.0% | 5.0% | – | 1764 | 11472 | 19042 | 22944 |
| music | 11 | 90.9% | 0.864 | 18.2% | 0.0% | – | 2231 | 5253 | 17120 | 17120 |
| quote | 40 | 67.5% | 0.569 | 40.0% | 12.5% | 40.0% (5) | 2426 | 22020 | 22148 | 23246 |
| slang | 6 | 66.7% | 0.611 | 50.0% | 0.0% | 0.0% (1) | 3474 | 20289 | 20289 | 20289 |
| tv | 6 | 100.0% | 0.917 | 16.7% | 0.0% | 100.0% (5) | 5469 | 20455 | 20455 | 20455 |

### By flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p90 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|---|---|---|---|
| misremembered: yes | 11 | 36.4% | 0.273 | 54.5% | 27.3% | 100.0% (1) | 2043 | 6535 | 20862 | 20862 |
| misremembered: no | 87 | 83.9% | 0.751 | 29.9% | 3.4% | 75.0% (20) | 2426 | 20455 | 22140 | 23246 |
| ambiguous: yes | 22 | 100.0% | 0.830 | 31.8% | 0.0% | 76.2% (21) | 3336 | 17240 | 20455 | 20666 |
| ambiguous: no | 76 | 72.4% | 0.659 | 32.9% | 7.9% | – | 2350 | 20862 | 22148 | 23246 |
| indian: yes | 25 | 80.0% | 0.680 | 32.0% | 12.0% | 81.8% (11) | 1789 | 20455 | 22148 | 23246 |
| indian: no | 73 | 78.1% | 0.703 | 32.9% | 4.1% | 70.0% (10) | 2426 | 20289 | 22020 | 22944 |
| ambiguous or indian: yes | 36 | 86.1% | 0.701 | 36.1% | 8.3% | 76.2% (21) | 2472 | 20455 | 22148 | 23246 |
| ambiguous or indian: no | 62 | 74.2% | 0.695 | 30.6% | 4.8% | – | 2350 | 20289 | 22020 | 22944 |
| origin: coverage | 37 | 91.9% | 0.770 | 35.1% | 0.0% | 78.9% (19) | 3584 | 21981 | 22140 | 22695 |
| origin: demand | 49 | 75.5% | 0.701 | 30.6% | 6.1% | 50.0% (2) | 2311 | 19856 | 22148 | 23246 |
| origin: variant | 12 | 50.0% | 0.458 | 33.3% | 25.0% | – | 1988 | 3801 | 20862 | 20862 |

### Per case

| ID | Query | Rank | Top result | Meanings in top 5 | Latency ms | Failed providers |
|---|---|---|---|---|---|---|
| M1 | cash me outside | 1 | Bhad Bhabie (wd:Q28784685) | 1 | 1474 | – |
| M1-v | catch me outside | – | Catch Me Outside (wd:Q110449182) | 0 | 974 | – |
| M2 | skibidi toilet | 1 | Skibidi Toilet (wd:Q121368207) | 1 | 2772 | – |
| M3 | 6 7 meme | 1 | 6-7 (wd:Q136163131) | 1 | 1845 | – |
| M3-v | six seven | 1 | 6-7 (wd:Q136163131) | 1 | 3801 | – |
| M6 | gigachad | 6 | Chad (slang) (wd:Q5066149) | 0 | 22944 | – |
| M7 | punch the monkey | 1 | Punch (monkey) (wd:Q138358320) | 1 | 1761 | – |
| M8 | nihilist penguin | 1 | Nihilistic penguin (wd:Q137916121) | 1 | 1332 | – |
| M9 | ctrl alt del loss comic | 1 | Loss (Ctrl+Alt+Del) (wd:Q56152168) | 1 | 2196 | – |
| M10 | italian brainrot | 1 | Italian brainrot (wd:Q133869040) | 1 | 11472 | – |
| M11 | tralalero tralala | 1 | Italian brainrot (wd:Q133869040) | 1 | 1764 | – |
| M12 | bombardiro crocodilo | 1 | Italian brainrot (wd:Q133869040) | 1 | 1325 | – |
| M13 | epic sax guy | 1 | Sergey Stepanov (musician) (wd:Q12740674) | 1 | 2038 | – |
| M14 | waltuh breaking bad | – | – | 0 | 488 | – |
| M15 | its morbin time | 1 | Morbius (film) (wd:Q55405369) | 1 | 5502 | – |
| M16 | sus among us | 1 | Among Us (wd:Q96417649) | 1 | 1712 | – |
| S1 | rizz | 1 | Rizz (wd:Q123669845) | 1 | 1414 | – |
| S2 | no cap | 6 | Cap (wd:Q6147804) | 0 | 5524 | – |
| S3 | bussin | – | F9 (film) (wd:Q29466808) | 0 | 3474 | – |
| S6 | 420 | 1 | 420 (cannabis culture) (wd:Q748539) | 1 | 3542 | – |
| S7 | nani | 2 | Nani (footballer) (wd:Q482947) | 1/2 | 1408 | – |
| Q1 | i've fallen and i can't get up | 1 | I've fallen, and I can't get up! (wd:Q17029612) | 1 | 4460 | – |
| Q2 | where's the beef | 1 | Where's the beef? (wd:Q1459668) | 1 | 3155 | – |
| Q2-v | where is the beef | 1 | Where's the beef? (wd:Q1459668) | 1 | 3213 | – |
| Q3 | i'm kind of a big deal | 2 | Joyner Lucas (wd:Q32540222) | 1 | 4115 | – |
| Q3-v | im kind of a big deal i have many leather bound books | – | Carl Jung (wd:Q41532) | 0 | 2043 | – |
| Q4 | show me the money | 1 | Jerry Maguire (wd:Q329131) | 2/2 | 1685 | – |
| Q5 | the revolution will not be televised | 1 | The Revolution Will Not Be Televised (wd:Q1753999) | 1 | 2416 | – |
| Q5-v | revolution will not be televised quote | 1 | The Revolution Will Not Be Televised (wd:Q1753999) | 1 | 3334 | – |
| Q6 | hey baby i hear the news are calling for salads and scrambled eggs | – | – | 0 | 1377 | – |
| Q6-v | frasier theme song lyrics | 1 | Frasier (wd:Q209282) | 1 | 1988 | – |
| Q7 | omae wa mou shindeiru | 1 | Kenshiro (wd:Q1185545) | 1 | 1457 | – |
| Q7-v | oh my yo wa moo shin dae doo hee yun knee | – | – | 0 | 20862 | – |
| Q8 | yeah i got time incredibles | 1 | The Incredibles (wd:Q213326) | 1 | 2311 | – |
| Q9 | want a sprite cranberry | – | Sprite (drink) (wd:Q206978) | 0 | 7577 | – |
| Q10 | that was his mistake big hero 6 | – | To Be Hero X (wd:Q133866311) | 0 | 1947 | – |
| T1 | baby yoda | 1 | Grogu (wd:Q77001957) | 1 | 18703 | – |
| F1 | three fingers inglorious bastards | – | Quentin Tarantino (wd:Q3772) | 0 | 3780 | – |
| F1-v | inglorious bastards | 2 | The Inglorious Bastards (wd:Q338002) | 1 | 1474 | – |
| A1 | nah id win | – | Global public good (wd:Q8270788) | 0 | 17198 | – |
| A2 | steal a brainrot | 1 | Steal a Brainrot (wd:Q135921344) | 1 | 19856 | – |
| B1 | midwest emo | 1 | Midwest emo (wd:Q39052425) | 1 | 1217 | – |
| B2 | neutral milk hotel meme | – | In the Aeroplane Over the Sea (wd:Q1660782) | 0 | 5253 | – |
| B3 | messages from the stars rah band | 1 | Richard Anthony Hewson (wd:Q709410) | 1 | 1225 | – |
| B4 | tool band | 1 | Tool (band) (wd:Q184827) | 1 | 17120 | – |
| B5 | ruler of everything tally hall | 1 | Marvin's Marvelous Mechanical Museum (album) (wd:Q6778267) | 1 | 2231 | – |
| B6 | can you play wonderwall | 1 | Wonderwall (wd:Q1045517) | 1 | 1749 | – |
| B7 | fucking magnets how do they work | 1 | Miracles (Insane Clown Posse song) (wd:Q6872509) | 1 | 2350 | – |
| B8 | mo bamba | 2 | Mo Bamba (wd:Q29318958) | 1 | 2592 | – |
| B9 | post malone ozzy osbourne | 1 | Take What You Want (wd:Q68097173) | 1 | 1310 | – |
| B10 | everywhere at the end of time | 1 | Everywhere at the End of Time (wd:Q104771220) | 1 | 2118 | – |
| I1 | mogambo khush hua | 2 | Mogambo (character) (wd:Q136377380) | 1 | 22148 | – |
| I2 | rasode mein kaun tha | 2 | Rucha Hasabnis (wd:Q7376575) | 1 | 19042 | – |
| I2-v | kokilaben rap | 1 | Yashraj Mukhate (wd:Q99842759) | 1 | 2580 | – |
| I3 | paisa hi paisa hoga | – | Bewafa (song) (wd:Q135420995) | 0 | 1633 | – |
| I3-v | babu bhaiya paisa hi paisa hoga | – | Hemlata (singer) (wd:Q5712227) | 0 | 1467 | – |
| I4 | utha le re baba | 2 | Myntra (wd:Q6947830) | 1 | 23246 | – |
| I4-v | uthale re baba | – | – | 0 | 1010 | – |
| I5 | bilkul ricks nahi lene ka | – | – | 0 | 522 | – |
| I5-v | bilkul risk nahi lene ka | – | – | 0 | 509 | – |
| I6 | kitne aadmi the | 1 | Gabbar Singh (character) (wd:Q5515286) | 1 | 20083 | – |
| X1 | how's the josh | 2 | Aditya Dhar (wd:Q61013862) | 1 | 1066 | – |
| X2 | mere paas maa hai | 1 | Deewaar (wd:Q787034) | 1 | 1551 | – |
| X3 | picture abhi baaki hai mere dost | 1 | Om Shanti Om (wd:Q330468) | 1 | 18054 | wikidata:timeout |
| X4 | don ko pakadna mushkil hi nahi namumkin hai | 1 | Don (2006 Hindi film) (wd:Q662436) | 1/2 | 17240 | – |
| X5 | hera pheri | 1 | Phir Hera Pheri (wd:Q11816211) | 3/3 | 1116 | – |
| X6 | devdas | 2 | Devdas (wd:Q11169650) | 2/3 | 1743 | – |
| X7 | agneepath | 1 | Agneepath (2012 film) (wd:Q3595073) | 2/2 | 1390 | – |
| X8 | simba | 1 | Simba (wd:Q1649583) | 1/2 | 3803 | – |
| X9 | bahubali | 1 | Bahubali (wd:Q2397602) | 2/2 | 1744 | – |
| X10 | taarak mehta | 1 | Taarak Mehta Ka Ooltah Chashmah (wd:Q2719817) | 2/2 | 5469 | – |
| X11 | mirzapur | 1 | Mirzapur (wd:Q888908) | 2/2 | 1789 | – |
| X12 | panchayat | 2 | Gram panchayat (wd:Q2732840) | 2/2 | 20455 | – |
| X13 | sacred games | 1 | Sacred Games (TV series) (wd:Q48727094) | 2/2 | 7451 | – |
| X14 | pushpa | 1 | Pushpa 2: The Rule (wd:Q112083510) | 2/2 | 1580 | – |
| X15 | here's johnny | 4 | Here's Johnny (song) (wd:Q5736714) | 1/2 | 1523 | – |
| X16 | dune | 2 | Dune (wd:Q25391) | 2/3 | 4717 | – |
| X17 | the office | 1 | The Office (wd:Q43129905) | 3/3 | 3765 | – |
| X18 | the italian job | 1 | The Italian Job (wd:Q1051032) | 2/2 | 1295 | – |
| X19 | scarface | 1 | Scarface (1983 film) (wd:Q47075) | 2/2 | 3336 | – |
| X20 | play it again sam | 2 | Play It Again, Sam (play) (wd:Q17051771) | 2/2 | 3642 | – |
| X21 | luke i am your father | 1 | The Empire Strikes Back (wd:Q181795) | 1 | 3584 | – |
| X22 | beam me up scotty | 1 | Beam me up, Scotty (wd:Q4876190) | 1 | 1729 | – |
| X23 | hello clarice | – | Hannibal (2001 film) (wd:Q722682) | 0 | 6535 | – |
| L1 | hakuna matata | 2 | Hakuna matata (wd:Q1570072) | 1/2 | 8424 | – |
| L2 | let it go | 1 | Let It Go (wd:Q15282326) | 1 | 4710 | – |
| L3 | all izz well | 1 | 3 Idiots (wd:Q229633) | 1 | 2472 | – |
| L4 | winter is coming | – | Winter Is Coming (wd:Q2614622) | 0 | 22695 | – |
| L5 | this is fine | 2 | This Is Fine (wd:Q65082311) | 1 | 1471 | – |
| L6 | ok boomer | 1 | OK boomer (wd:Q74367025) | 1 | 20289 | – |
| L7 | that's what she said | 2 | Michael Scott (The Office) (wd:Q2346771) | 1 | 22020 | – |
| L8 | d'oh | 1 | D'oh! (wd:Q1409224) | 1 | 2426 | – |
| L9 | how you doin | 1 | Joey Tribbiani (wd:Q746277) | 1 | 1647 | – |
| L10 | bazinga | 1 | Sheldon Cooper (wd:Q629583) | 1 | 1120 | – |
| L11 | thanos snap | 4 | The Blip (wd:Q106856883) | 1 | 21981 | – |
| L12 | distracted boyfriend | 1 | Distracted boyfriend (wd:Q55691704) | 1 | 1609 | – |
| L13 | i choose you | 1 | Pokémon, I Choose You! (wd:Q7208759) | 2/2 | 20666 | – |
| L14 | king of the world | – | King of the World (sculpture) (wd:Q138798785) | 0 | 22140 | – |

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
