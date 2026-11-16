# Embedding experiment, offline (captured snapshot)

Snapshot captured 2026-11-15T21:31:07.048Z, 97 cases. Candidate text = title + the first source text already held, cut to 300 characters; no new fetches. Same tuning / held-out split as the reranker (see rerank-offline.md). The baseline is the reranker alone.
"Descriptive" queries are the ones containing a kind-of-thing or context word (meme, cartoon, comic, song, lyrics, dialogue, scene, band, film, anime, show, series...), or naming a work.

## Xenova/all-MiniLM-L6-v2

Best weight on the tuning half (MRR, then wrong tops, then the smaller weight): 0. Tuning-half MRR by weight: 0: 0.745, 10: 0.745, 20: 0.735, 40: 0.721, 160: 0.716, 80: 0.715, 320: 0.714.

Embedding one query on this machine (Node, one at a time, q8 model): median 0.8 ms, p95 1.4 ms (30 queries).

| Order | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |
|---|---|---|---|---|---|---|
| tuning half: reranker alone | 50 | 80.0% | 0.745 | 26.0% | 4.0% | 90.0% (10) |
| tuning half: reranker, cosine as tie-break | 50 | 80.0% | 0.745 | 26.0% | 4.0% | 90.0% (10) |
| tuning half: reranker + 10 x cosine | 50 | 80.0% | 0.745 | 26.0% | 4.0% | 90.0% (10) |
| tuning half: reranker + 40 x cosine | 50 | 80.0% | 0.721 | 30.0% | 4.0% | 90.0% (10) |
| tuning half: reranker + 160 x cosine | 50 | 80.0% | 0.716 | 30.0% | 4.0% | 80.0% (10) |
| tuning half: cosine only | 50 | 78.0% | 0.666 | 38.0% | 4.0% | 80.0% (10) |
| held-out half: reranker alone | 47 | 80.9% | 0.686 | 34.0% | 8.5% | 72.7% (11) |
| held-out half: reranker, cosine as tie-break | 47 | 80.9% | 0.683 | 34.0% | 8.5% | 72.7% (11) |
| held-out half: reranker + 10 x cosine | 47 | 80.9% | 0.684 | 34.0% | 8.5% | 72.7% (11) |
| held-out half: reranker + 40 x cosine | 47 | 80.9% | 0.672 | 34.0% | 8.5% | 81.8% (11) |
| held-out half: reranker + 160 x cosine | 47 | 80.9% | 0.619 | 42.6% | 8.5% | 81.8% (11) |
| held-out half: cosine only | 47 | 78.7% | 0.579 | 48.9% | 8.5% | 72.7% (11) |
| full set: reranker alone | 97 | 80.4% | 0.716 | 29.9% | 6.2% | 81.0% (21) |
| full set: reranker, cosine as tie-break | 97 | 80.4% | 0.715 | 29.9% | 6.2% | 81.0% (21) |
| full set: reranker + 10 x cosine | 97 | 80.4% | 0.716 | 29.9% | 6.2% | 81.0% (21) |
| full set: reranker + 40 x cosine | 97 | 80.4% | 0.697 | 32.0% | 6.2% | 85.7% (21) |
| full set: reranker + 160 x cosine | 97 | 80.4% | 0.669 | 36.1% | 6.2% | 81.0% (21) |
| full set: cosine only | 97 | 78.4% | 0.624 | 43.3% | 6.2% | 76.2% (21) |

Exact-title cases worse than the reranker alone (full set, weight 40): **3** of 36. Held-out MRR 0.686 to 0.672; wrong top 34.0% to 34.0%.

### By kind of query (full set, reranker alone vs reranker + 40 x cosine)

| Kind | n | Recall@5 | MRR@10 | Incorrect top |
|---|---|---|---|---|
| misremembered | 11 | 36.4% to 36.4% | 0.273 to 0.258 | 54.5% to 54.5% |
| descriptive | 11 | 72.7% to 72.7% | 0.727 to 0.727 | 18.2% to 18.2% |
| indian | 24 | 79.2% to 79.2% | 0.667 to 0.656 | 33.3% to 33.3% |
| ambiguous | 22 | 100.0% to 100.0% | 0.852 to 0.842 | 27.3% to 27.3% |

### Rank changes, reranker alone to reranker + 40 x cosine (9)

- M1 "cash me outside": rank 1 to 2
- F1-v "inglorious bastards": rank 2 to 3
- X1 "how's the josh": rank 2 to 4
- X15 "here's johnny": rank 4 to 5
- X16 "dune": rank 2 to 3
- L5 "this is fine": rank 2 to 3
- L7 "that's what she said": rank 2 to 3
- L10 "bazinga": rank 1 to 2
- L11 "thanos snap": rank 4 to 3

### Semantic local search (ranking the seed library by cosine)

| Query | Expected | Top 3 by cosine | First is expected | Top cosine |
|---|---|---|---|---|
| red pill | matrix (experiment only) | The Matrix (0.40); Bazinga! (The Big Bang Theory) (0.18); “I'm the king of the world!” (Titanic) (0.15) | yes | 0.40 |
| dog sitting in a burning room | this-is-fine-dog | This is fine (dog meme) (0.47); Bazinga! (The Big Bang Theory) (0.11); D'oh! (The Simpsons) (0.10) | yes | 0.47 |
| guy checking out another girl while his girlfriend looks angry | distracted-boyfriend | Distracted boyfriend (meme) (0.41); “That's what she said” (The Office) (0.13); Let it go (everyday saying) (0.12) | yes | 0.41 |
| cartoon dad says oh when he hurts himself | doh-simpsons | D'oh! (The Simpsons) (0.48); Bazinga! (The Big Bang Theory) (0.36); “All izz well” (3 Idiots) (0.36) | yes | 0.48 |
| no worries song from the lion king | hakuna-matata-lion-king | Hakuna Matata (The Lion King) (0.52); Let It Go (Frozen) (0.45); “I'm the king of the world!” (Titanic) (0.41) | yes | 0.52 |
| sheldon laughing after a prank | bazinga-big-bang-theory | Bazinga! (The Big Bang Theory) (0.61); D'oh! (The Simpsons) (0.42); “How you doin'?” (Friends) (0.30) | yes | 0.61 |
| dismissing an older generation | ok-boomer | OK boomer (0.48); Let it go (everyday saying) (0.25); “Winter is coming” (Game of Thrones) (0.18) | yes | 0.48 |
| pizza recipe | (nothing) | “How you doin'?” (Friends) (0.17); The Matrix (0.12); Bazinga! (The Big Bang Theory) (0.11) | – | 0.17 |
| weather tomorrow | (nothing) | “Winter is coming” (Game of Thrones) (0.21); “All izz well” (3 Idiots) (0.16); Bazinga! (The Big Bang Theory) (0.12) | – | 0.21 |

## Xenova/paraphrase-multilingual-MiniLM-L12-v2

Best weight on the tuning half (MRR, then wrong tops, then the smaller weight): 0. Tuning-half MRR by weight: 0: 0.745, 10: 0.745, 20: 0.735, 40: 0.732, 80: 0.710, 160: 0.710, 320: 0.690.

Embedding one query on this machine (Node, one at a time, q8 model): median 1.3 ms, p95 2.1 ms (30 queries).

| Order | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |
|---|---|---|---|---|---|---|
| tuning half: reranker alone | 50 | 80.0% | 0.745 | 26.0% | 4.0% | 90.0% (10) |
| tuning half: reranker, cosine as tie-break | 50 | 80.0% | 0.745 | 26.0% | 4.0% | 100.0% (10) |
| tuning half: reranker + 10 x cosine | 50 | 80.0% | 0.745 | 26.0% | 4.0% | 100.0% (10) |
| tuning half: reranker + 40 x cosine | 50 | 80.0% | 0.732 | 28.0% | 4.0% | 90.0% (10) |
| tuning half: reranker + 160 x cosine | 50 | 78.0% | 0.710 | 32.0% | 4.0% | 80.0% (10) |
| tuning half: cosine only | 50 | 78.0% | 0.650 | 42.0% | 4.0% | 80.0% (10) |
| held-out half: reranker alone | 47 | 80.9% | 0.686 | 34.0% | 8.5% | 72.7% (11) |
| held-out half: reranker, cosine as tie-break | 47 | 80.9% | 0.686 | 34.0% | 8.5% | 72.7% (11) |
| held-out half: reranker + 10 x cosine | 47 | 80.9% | 0.688 | 34.0% | 8.5% | 72.7% (11) |
| held-out half: reranker + 40 x cosine | 47 | 80.9% | 0.686 | 31.9% | 8.5% | 81.8% (11) |
| held-out half: reranker + 160 x cosine | 47 | 80.9% | 0.621 | 42.6% | 8.5% | 72.7% (11) |
| held-out half: cosine only | 47 | 78.7% | 0.504 | 59.6% | 8.5% | 72.7% (11) |
| full set: reranker alone | 97 | 80.4% | 0.716 | 29.9% | 6.2% | 81.0% (21) |
| full set: reranker, cosine as tie-break | 97 | 80.4% | 0.716 | 29.9% | 6.2% | 85.7% (21) |
| full set: reranker + 10 x cosine | 97 | 80.4% | 0.717 | 29.9% | 6.2% | 85.7% (21) |
| full set: reranker + 40 x cosine | 97 | 80.4% | 0.710 | 29.9% | 6.2% | 85.7% (21) |
| full set: reranker + 160 x cosine | 97 | 79.4% | 0.667 | 37.1% | 6.2% | 76.2% (21) |
| full set: cosine only | 97 | 78.4% | 0.579 | 50.5% | 6.2% | 76.2% (21) |

Exact-title cases worse than the reranker alone (full set, weight 40): **0** of 36. Held-out MRR 0.686 to 0.686; wrong top 34.0% to 31.9%.

### By kind of query (full set, reranker alone vs reranker + 40 x cosine)

| Kind | n | Recall@5 | MRR@10 | Incorrect top |
|---|---|---|---|---|
| misremembered | 11 | 36.4% to 36.4% | 0.273 to 0.258 | 54.5% to 54.5% |
| descriptive | 11 | 72.7% to 72.7% | 0.727 to 0.727 | 18.2% to 18.2% |
| indian | 24 | 79.2% to 79.2% | 0.667 to 0.656 | 33.3% to 33.3% |
| ambiguous | 22 | 100.0% to 100.0% | 0.852 to 0.852 | 27.3% to 27.3% |

### Rank changes, reranker alone to reranker + 40 x cosine (7)

- M1 "cash me outside": rank 1 to 2
- Q3 "i'm kind of a big deal": rank 2 to 3
- F1-v "inglorious bastards": rank 2 to 3
- X1 "how's the josh": rank 2 to 4
- L5 "this is fine": rank 2 to 3
- L7 "that's what she said": rank 2 to 1
- L11 "thanos snap": rank 4 to 3

### Semantic local search (ranking the seed library by cosine)

| Query | Expected | Top 3 by cosine | First is expected | Top cosine |
|---|---|---|---|---|
| red pill | matrix (experiment only) | The Matrix (0.31); Let It Go (Frozen) (0.19); Let it go (everyday saying) (0.19) | yes | 0.31 |
| dog sitting in a burning room | this-is-fine-dog | This is fine (dog meme) (0.60); D'oh! (The Simpsons) (0.14); Hakuna Matata (The Lion King) (0.12) | yes | 0.60 |
| guy checking out another girl while his girlfriend looks angry | distracted-boyfriend | Distracted boyfriend (meme) (0.43); OK boomer (0.22); “How you doin'?” (Friends) (0.18) | yes | 0.43 |
| cartoon dad says oh when he hurts himself | doh-simpsons | D'oh! (The Simpsons) (0.34); “How you doin'?” (Friends) (0.28); “All izz well” (3 Idiots) (0.28) | yes | 0.34 |
| no worries song from the lion king | hakuna-matata-lion-king | Hakuna Matata (The Lion King) (0.49); Let It Go (Frozen) (0.46); “I'm the king of the world!” (Titanic) (0.38) | yes | 0.49 |
| sheldon laughing after a prank | bazinga-big-bang-theory | Bazinga! (The Big Bang Theory) (0.41); This is fine (dog meme) (0.36); D'oh! (The Simpsons) (0.35) | yes | 0.41 |
| dismissing an older generation | ok-boomer | OK boomer (0.52); Let it go (everyday saying) (0.42); “That's what she said” (The Office) (0.23) | yes | 0.52 |
| pizza recipe | (nothing) | Bazinga! (The Big Bang Theory) (0.22); “How you doin'?” (Friends) (0.19); “Winter is coming” (Game of Thrones) (0.13) | – | 0.22 |
| weather tomorrow | (nothing) | “Winter is coming” (Game of Thrones) (0.25); “All izz well” (3 Idiots) (0.17); “How you doin'?” (Friends) (0.12) | – | 0.25 |
