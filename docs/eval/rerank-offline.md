# Reranker, offline (captured snapshot)

Snapshot captured 2026-11-15T21:31:07.048Z; 97 cases captured without a failing provider.
Split: cases grouped by base row (`Q3` and `Q3-v` together), alternating in file order; 1st, 3rd, 5th… group tunes, 2nd, 4th… is held out.
Weights: `{"position":40,"exactTitle":10,"dictionary":40}`

| Group | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |
|---|---|---|---|---|---|---|
| tuning half: arrival order | 50 | 80.0% | 0.735 | 28.0% | 4.0% | 80.0% (10) |
| tuning half: reranked | 50 | 80.0% | 0.745 | 26.0% | 4.0% | 90.0% (10) |
| held-out half: arrival order | 47 | 76.6% | 0.651 | 38.3% | 8.5% | 72.7% (11) |
| held-out half: reranked | 47 | 80.9% | 0.686 | 34.0% | 8.5% | 72.7% (11) |
| full set: arrival order | 97 | 78.4% | 0.694 | 33.0% | 6.2% | 76.2% (21) |
| full set: reranked | 97 | 80.4% | 0.716 | 29.9% | 6.2% | 81.0% (21) |

Ceiling for any reordering of these lists (full set, 97 cases): an acceptable result is in the list for 80.4% of cases (so best possible Recall@5 and MRR@10 are 80.4% and the same share at rank 1); 13.4% have a non-empty list with no acceptable result; 6.2% are empty.

Exact-title cases (an acceptable candidate's title equals the query): 36; worse after reranking: **0**.

### Improved (3)
- M6 "gigachad": rank 6 → 1
- S2 "no cap": rank 6 → 1
- S7 "nani": rank 2 → 1

### Worse (0)
