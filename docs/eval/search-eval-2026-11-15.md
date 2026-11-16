# Search evaluation, 2026-11-15 (baseline run, partly reconstructed)

**This file is not the original generated report.** The original (full per-case table for all 98
live cases) was overwritten by accident on 2026-11-15 at 20:47 UTC: a later run reused the same
file name while the UTC date was still the 15th. The report generator now takes an `EVAL_TAG` so
runs can no longer collide. Everything below was copied from the original run's output earlier
in the same session; it is the real data of that run, but incomplete (no latency columns for the
group tables, and only the cases that were **not** ranked first). For a complete before/after
comparison use the same-day runs made with the current code: `search-eval-2026-11-15-before-rerank.md`
and `search-eval-2026-11-15-reranked.md`.

Run: 2026-11-15, 98 scored cases, live providers, 0 degraded cases (after the User-Agent fix and the
re-run of throttled cases; see "How to run" in `docs/SEARCH_RANKING.md`).

## Summary

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) | p50 ms | p95 ms |
|---|---|---|---|---|---|---|---|---|
| local | 14 | 100.0% | 1.000 | 0.0% | 0.0% | 100.0% (2) | 0.08 | 0.59 |
| live | 98 | 78.6% | 0.701 | 31.6% | 6.1% | 76.2% (21) | 1798 | 22063 |

## Live retrieval, by category

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |
|---|---|---|---|---|---|---|
| anime_game | 3 | 66.7% | 0.667 | 33.3% | 0.0% | 100.0% (1) |
| film | 12 | 91.7% | 0.729 | 41.7% | 0.0% | 88.9% (9) |
| meme | 20 | 85.0% | 0.808 | 20.0% | 5.0% | – |
| music | 11 | 90.9% | 0.864 | 18.2% | 0.0% | – |
| quote | 40 | 67.5% | 0.577 | 37.5% | 12.5% | 40.0% (5) |
| slang | 6 | 66.7% | 0.611 | 50.0% | 0.0% | 0.0% (1) |
| tv | 6 | 100.0% | 0.917 | 16.7% | 0.0% | 100.0% (5) |

## Live retrieval, by flag and origin

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |
|---|---|---|---|---|---|---|
| misremembered: yes | 11 | 36.4% | 0.273 | 54.5% | 27.3% | 100.0% (1) |
| misremembered: no | 87 | 83.9% | 0.755 | 28.7% | 3.4% | 75.0% (20) |
| ambiguous: yes | 22 | 100.0% | 0.830 | 31.8% | 0.0% | 76.2% (21) |
| ambiguous: no | 76 | 72.4% | 0.663 | 31.6% | 7.9% | – |
| indian: yes | 25 | 80.0% | 0.693 | 28.0% | 12.0% | 81.8% (11) |
| indian: no | 73 | 78.1% | 0.703 | 32.9% | 4.1% | 70.0% (10) |
| ambiguous or indian: yes | 36 | 86.1% | 0.711 | 33.3% | 8.3% | 76.2% (21) |
| ambiguous or indian: no | 62 | 74.2% | 0.695 | 30.6% | 4.8% | – |
| origin: coverage | 37 | 91.9% | 0.784 | 32.4% | 0.0% | 78.9% (19) |
| origin: demand | 49 | 75.5% | 0.697 | 30.6% | 6.1% | 50.0% (2) |
| origin: variant | 12 | 50.0% | 0.458 | 33.3% | 25.0% | – |

## Live cases not ranked first

Rank "–" means no acceptable result in the list (a top result of "–" means an empty list). The last
column is meanings found in the top 5 (of the usable ones, for ambiguous cases).

| ID | Query | Rank | Top result | Meanings in top 5 |
|---|---|---|---|---|
| M1-v | catch me outside | – | Catch Me Outside (wd:Q110449182) | 0 |
| M6 | gigachad | 6 | Chad (slang) (wd:Q5066149) | 0 |
| M14 | waltuh breaking bad | – | – | 0 |
| S2 | no cap | 6 | Cap (wd:Q6147804) | 0 |
| S3 | bussin | – | F9 (film) (wd:Q29466808) | 0 |
| S7 | nani | 2 | Nani (footballer) (wd:Q482947) | 1/2 |
| Q3 | i'm kind of a big deal | 2 | Shaniera Akram (wd:Q23092271) | 1 |
| Q3-v | im kind of a big deal i have many leather bound books | – | Carl Jung (wd:Q41532) | 0 |
| Q6 | hey baby i hear the news are calling for salads and scrambled eggs | – | – | 0 |
| Q7-v | oh my yo wa moo shin dae doo hee yun knee | – | – | 0 |
| Q9 | want a sprite cranberry | – | Sprite (drink) (wd:Q206978) | 0 |
| Q10 | that was his mistake big hero 6 | – | To Be Hero X (wd:Q133866311) | 0 |
| F1 | three fingers inglorious bastards | – | Quentin Tarantino (wd:Q3772) | 0 |
| F1-v | inglorious bastards | 2 | The Inglorious Bastards (wd:Q338002) | 1 |
| A1 | nah id win | – | Global public good (wd:Q8270788) | 0 |
| B2 | neutral milk hotel meme | – | In the Aeroplane Over the Sea (wd:Q1660782) | 0 |
| B8 | mo bamba | 2 | Mo Bamba (wd:Q29318958) | 1 |
| I1 | mogambo khush hua | 2 | Mogambo (character) (wd:Q136377380) | 1 |
| I2 | rasode mein kaun tha | 2 | Rucha Hasabnis (wd:Q7376575) | 1 |
| I3 | paisa hi paisa hoga | – | Bewafa (song) (wd:Q135420995) | 0 |
| I3-v | babu bhaiya paisa hi paisa hoga | – | Hemlata (singer) (wd:Q5712227) | 0 |
| I4 | utha le re baba | 3 | Myntra (wd:Q6947830) | 1 |
| I4-v | uthale re baba | – | – | 0 |
| I5 | bilkul ricks nahi lene ka | – | – | 0 |
| I5-v | bilkul risk nahi lene ka | – | – | 0 |
| X6 | devdas | 2 | Devdas (wd:Q11169650) | 2/3 |
| X12 | panchayat | 2 | Gram panchayat (wd:Q2732840) | 2/2 |
| X15 | here's johnny | 4 | Here's Johnny (song) (wd:Q5736714) | 1/2 |
| X16 | dune | 2 | Dune (wd:Q25391) | 2/3 |
| X20 | play it again sam | 2 | Play It Again, Sam (play) (wd:Q17051771) | 2/2 |
| X23 | hello clarice | – | Hannibal (2001 film) (wd:Q722682) | 0 |
| L1 | hakuna matata | 2 | Hakuna matata (wd:Q1570072) | 1/2 |
| L4 | winter is coming | – | Winter Is Coming (wd:Q2614622) | 0 |
| L5 | this is fine | 2 | This Is Fine (wd:Q65082311) | 1 |
| L7 | that's what she said | 2 | Michael Scott (The Office) (wd:Q2346771) | 1 |
| L11 | thanos snap | 4 | The Blip (wd:Q106856883) | 1 |
| L14 | king of the world | – | King of the World (sculpture) (wd:Q138798785) | 0 |

The other 61 live cases had an acceptable result first.
