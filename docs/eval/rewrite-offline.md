# Query rewriting, offline (captured lists)

97 cases captured without a failing provider; 51 of them were misses by the rule in `rewrite.ts` (no candidate named by the query) and have fallback captures. The other 46 are scored from their plain list. Everything is reranked by `rerankCandidates`. Fallback captured 2026-11-16T06:44:02.067Z. Same tuning / held-out split as the reranker.

| Config | n | Recall@5 | MRR@10 | Incorrect top | No results | Ambiguity coverage (n) |
|---|---|---|---|---|---|---|
| tuning: no fallback | 50 | 80.0% | 0.742 | 26.0% | 4.0% | 90.0% (10) |
| held-out: no fallback | 47 | 80.9% | 0.697 | 31.9% | 8.5% | 72.7% (11) |
| full: no fallback | 97 | 80.4% | 0.720 | 28.9% | 6.2% | 81.0% (21) |
| tuning: suggestion only | 50 | 80.0% | 0.739 | 26.0% | 4.0% | 90.0% (10) |
| held-out: suggestion only | 47 | 83.0% | 0.704 | 34.0% | 6.4% | 72.7% (11) |
| full: suggestion only | 97 | 81.4% | 0.722 | 29.9% | 5.2% | 81.0% (21) |
| tuning: shorter phrase only | 50 | 80.0% | 0.736 | 28.0% | 2.0% | 90.0% (10) |
| held-out: shorter phrase only | 47 | 83.0% | 0.704 | 36.2% | 4.3% | 72.7% (11) |
| full: shorter phrase only | 97 | 81.4% | 0.720 | 32.0% | 3.1% | 81.0% (21) |
| tuning: suggestion, then shorter | 50 | 80.0% | 0.739 | 28.0% | 2.0% | 90.0% (10) |
| held-out: suggestion, then shorter | 47 | 83.0% | 0.704 | 36.2% | 4.3% | 72.7% (11) |
| full: suggestion, then shorter | 97 | 81.4% | 0.722 | 32.0% | 3.1% | 81.0% (21) |
| tuning: shorter, then suggestion | 50 | 80.0% | 0.736 | 28.0% | 2.0% | 90.0% (10) |
| held-out: shorter, then suggestion | 47 | 85.1% | 0.711 | 38.3% | 2.1% | 72.7% (11) |
| full: shorter, then suggestion | 97 | 82.5% | 0.724 | 33.0% | 2.1% | 81.0% (21) |

### Verdict per fallback (held-out half, and exact-title cases over the full set)

| Fallback | Held-out MRR | Held-out Recall@5 | Exact-title cases worse | Extra requests (all cases) | Adopt |
|---|---|---|---|---|---|
| suggestion | 0.697 to 0.704 | 80.9% to 83.0% | 0 of 36 | 23 | yes |
| shorter_phrase | 0.697 to 0.704 | 80.9% to 83.0% | 0 of 36 | 50 | yes |

Adopted by the rule (held-out improves, no exact-title case worse): suggestion, shorter_phrase.

### Final order tried: suggestion, shorter_phrase

| Kind | n | Recall@5 | MRR@10 | Incorrect top |
|---|---|---|---|---|
| misremembered | 11 | 36.4% to 36.4% | 0.273 to 0.273 | 54.5% to 72.7% |
| indian | 24 | 79.2% to 79.2% | 0.660 to 0.654 | 33.3% to 33.3% |
| ambiguous | 22 | 100.0% to 100.0% | 0.852 to 0.852 | 27.3% to 27.3% |
| all other | 53 | 84.9% to 86.8% | 0.807 to 0.813 | 20.8% to 22.6% |

Extra requests with the final order: 55 over 97 searches (0.57 per search; 1.08 per missed search).

### Improved (1)
- M14 "waltuh breaking bad": rank none to 3

### Worse (1)
- I4 "utha le re baba": rank 3 to 5
