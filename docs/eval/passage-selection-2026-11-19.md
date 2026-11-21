# Passage-selection follow-up — 2026-11-19

## What this establishes

The [bounded research pilot](live-curation-tools-2026-11-19.md) showed that one research round could
add two cited entries for one query. It also exposed a separate loss: useful Vegeta evidence was
already fetched but lay beyond the per-source text cutoff. Neither observation establishes general
accuracy, reliability or cost effectiveness across queries.

This follow-up confirms that local passage selection can recover the late evidence without another
search, extraction or model call for selection. It does **not** establish improved final-card coverage:
the last live card retained three entries versus four in the preceding research pilot.

## Change

For long fetched web pages used in topic/list/ranking cards, rank sentences using the existing
`bestSnippet` scorer and query plus the picked result's snippet. Keep two preceding sentences for
subject/work context, then apply the existing 1,200-code-point source budget. Short pages and the
reference-card path retain their previous behavior. Source indices, prompt, model settings and
grounding checks are unchanged. No dependency, embedding model or extra production API call added.

The first attempt ranked on the query alone. On a mixed-media trope page that moved evidence from
the Frieza/anime section into a later live-action/games section. The final selector also uses the
reader's picked snippet as an anchor. Replay checks confirm that the Frieza/Saiyan passage remains
and the Vegeta/Dragon Ball Z passage is recovered. This is lexical ranking, not semantic validation;
snippet quality, distant context and synonym-only matches remain limitations.

## Live comparison

All runs used OpenAI `gpt-6-luna`, the existing topic prompt and validator. The two follow-up drafts
replayed the same previously fetched ten pages, with no live Parallel calls. No native tool-calling
protocol or browser embedding model was tested.

| Run                                              | Raw proposed lines | Accepted entries | Accepted characters         | Draft-handler time |
| ------------------------------------------------ | ------------------ | ---------------- | --------------------------- | ------------------ |
| Prior research pilot, page-head cutoff           | 4                  | 4                | Frieza, Eren, Patry, Ryunka | 5.859 s            |
| Query-only passage selection, rejected iteration | 5                  | 2                | Vegeta, Ryunka              | 5.228 s            |
| Query + picked-snippet anchor                    | 7                  | 3                | Eren, Vegeta, Ryunka        | 5.739 s            |

The final raw answer also proposed Frieza and Patry, but their formulations did not survive the
existing grounding checks. Two other proposed lines expressly lacked a qualifying act and were
not useful additions. Restoring evidence therefore does not guarantee that generation and
validation deliver all supported examples. No validator relaxation was made to improve the count.
All delivered entries had valid source indices. Cards remained partial and marked major spoilers.

The final call reported 4,839 input tokens, including 1,985 cached tokens, and 418 output tokens.
At the same Standard Luna rates recorded in the pilot, its estimated model cost is $0.00051425.
The earlier query-only attempt cost approximately $0.00048195. Total follow-up model work is about
$0.00099620; retrieval cost was zero because pages were replayed. These are list-price estimates,
not reconciled invoices. Production passage selection itself adds no API fee; changed evidence
can still change input/output token usage. No speed improvement is established from these samples.

## Verification and remaining work

Regression tests cover late evidence reaching the actual model input, preservation of nearby work
and qualifications, and protection against a stronger unrelated query match on a mixed-media page.
Saved-evidence replay additionally checks the real Frieza and Vegeta passages. Focused handler,
extraction and search tests passed 123 tests after the final selector change. The live replay harness
passed its offline and live checks. Full unit suite passed 1,337 tests during the iteration; final
targeted checks were rerun after anchoring was added.

Final TypeScript and diff checks passed. Lint has zero errors and seven existing warnings. Changed
source files and reports were formatted. No browser test or new embedding inference was run.

Local artifacts: `.cache/live-tools/packing-input.json`, `packing-query-only-result.json`,
`packing-result.json` and `packing-cost.json`. Evaluation harnesses are archived as `.ts.txt` files
to avoid accidental paid execution and keep temporary network code out of normal lint inputs.
No API keys, authorization headers or environment contents were recorded.

Before deployment, evaluate supported-entry retention across repeated, held-out cases and diagnose
generation/validator losses separately. The semantic-ranking suggestion is a separate experiment:
reuse the cached MiniLM test tools to compare lexical, semantic and hybrid passage selection.
Send selected passage text and citations to the curator, not a full similarity matrix. Similarity
scores are relevance signals, not factual verification. Browser execution would require a model
download/cache and mobile performance testing; the present change requires neither.
