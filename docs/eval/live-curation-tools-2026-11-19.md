# Bounded research pilot — 2026-11-19

## Result

For one query, adding a planned evidence search increased accepted, cited character entries from
two to four. Both cards remained partial. This is a positive pilot result, not an aggregate quality
or accuracy improvement. Production code and routing were not changed.

## Method

- Query: `genocidal maniacs`; tags: `anime`, `cartoons`; format: list.
- Baseline: the first seven sources from the owner's earlier ten-source request. The three omitted
  sources were the historical Halloween article, English dictionary and Japanese dictionary. This
  is not a repeat of the earlier ten-source/default-fallback experiment.
- Read those seven pages live with Parallel Extract once. Both arms reuse identical extracted
  content for those pages through a local replay adapter; no second paid extraction is hidden.
- Baseline and augmented arms use the existing handler, `topic-card-v1` prompt, production evidence
  limits and validator. Both use OpenAI `gpt-6-luna`, temperature 0.2, reasoning none, with no
  Cloudflare fallback. Pinning the provider isolates retrieval from provider switching, but does
  not reproduce default fallback behavior or eliminate generation variation.
- One additional OpenAI planning call sees the query, unchanged tags and bounded selected evidence.
  Its structured answer requests research because fewer than three distinct examples are supported.
  The three-example threshold is specific to this list experiment, not a general routing policy.
- Execute one Parallel fast search with the plan's query and original tags. Take the first three
  new URLs after exact duplicate exclusion, extract them live and append them as sources 7–9.
- No native provider function-calling protocol, app-library search, automatic saving, production
  tool loop or Supabase worker was exercised. This tests model-planned retrieval via ordinary
  server functions. Extra pages come from search ranking, without a second model selection step.

The planner asked for named fictional characters with concrete actions. Search returned nine
results; none were real historical figures by title/snippet inspection. The selected added pages
were TV Tropes' Genocide Backfire and two CBR anime articles.

## Live calls

| Phase                    | Provider/API                | Wall time | Usage reported                  |
| ------------------------ | --------------------------- | --------- | ------------------------------- |
| Selected-page extraction | Parallel `/v1/extract`      | 2.030 s   | 7 URL extractions               |
| Baseline generation      | OpenAI `/v1/responses`      | 7.102 s   | 4,158 input / 296 output tokens |
| Research planner         | OpenAI `/v1/responses`      | 3.369 s   | 1,994 input / 71 output tokens  |
| Missing-evidence search  | Parallel `/v1/search`, fast | 1.004 s   | 1 search                        |
| Additional extraction    | Parallel `/v1/extract`      | 1.303 s   | 3 URL extractions               |
| Augmented generation     | OpenAI `/v1/responses`      | 5.842 s   | 4,927 input / 362 output tokens |

Generation-handler times, including local parsing/checking, were 7.131 s and 5.859 s. The measured
planner/search/extract block took 5.697 s. Calculated end-to-end stage paths, counting the shared
selected-page extraction once per hypothetical request, are about 9.161 s baseline and 13.586 s
augmented: approximately 4.425 s extra in this run. These are sums of observed stage times, not
independent end-to-end latency distributions. The faster second generation is not evidence that
research accelerates drafting; cache state, content and sampling differ.

Augmented generation reported 1,985 cached input tokens. Baseline reported a 1,985-token cache
write and zero cached tokens. Planner reported no cache hit. Total model tokens were 4,454 for
baseline versus 7,354 for planner plus augmented generation; token counts are not dollar costs.

Parallel's published fast-search and extraction rates imply $0.007 baseline versus $0.011 augmented
retrieval, excluding any earlier initial search and all model charges. Incremental research is
approximately $0.004 plus additional LLM cost. Total Parallel work performed for this paired
experiment was ten URL extractions and one search, approximately $0.011 list price, since selected
extraction was shared. Actual billed LLM dollars, credits and taxes were not measured.
[Parallel pricing](https://docs.parallel.ai/getting-started/pricing).

### Cost comparison using observed cache usage

At OpenAI's published Standard short-context Luna rates, per million tokens: input $0.10,
output $0.50, cached input $0.01 and 30-minute cache writes $0.125. Partitioning each reported input
total into ordinary input, cache writes and cache hits gives these estimates. They are list-price
calculations, not an invoice reconciliation or a guarantee about future cache hit rates.
[OpenAI Standard pricing](https://developers.openai.com/api/docs/pricing.md).

| Cost component                           | Baseline  | With research |
| ---------------------------------------- | --------- | ------------- |
| Parallel extraction/search               | $0.007000 | $0.011000     |
| Card-generation LLM                      | $0.000613 | $0.000495     |
| Research-planning LLM                    | $0        | $0.000235     |
| Total estimated per card                 | $0.007613 | $0.011730     |
| Same usage profile scaled to 1,000 cards | $7.61     | $11.73        |

The incremental estimate is $0.004117 per card. Parallel accounts for $0.004 of that difference;
retrieval volume dominates this run's cost. Total paid work performed for both arms together is
about $0.012343, since the original seven-page extraction was shared. Earlier initial search,
hosting, discounts, credits, taxes and retry charges are excluded. Warm-cache baseline costs and
future output lengths can differ. Arithmetic and token partitions were checked offline and saved
in `.cache/live-tools/cost-estimate.json`.

The configured Cloudflare fallback's published marginal rates are $0.293 per million input and
$2.253 per million output tokens, above Luna's corresponding uncached Standard rates for this
model pair. Free allowances can change actual invoices. Cloudflare was not called in this pilot,
so these rates are not a measured cost/quality or latency comparison and tokenization can differ.
[Cloudflare model pricing](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/).

For follow-up experiments, report cost per usable card and supported entry, including failed
calls, retries and cache writes. Prefer local reuse and relevant-passage selection first; compare
a fixed focused search against a planner call before enabling an extra LLM round. Bound search
rounds and extracted pages, and skip research when sufficient evidence already exists.

## Content and citation checks

| Check                             | Baseline       | With research               |
| --------------------------------- | -------------- | --------------------------- |
| HTTP / existing validator         | 200 / accepted | 200 / accepted              |
| Accepted cited entries            | 2              | 4                           |
| Characters                        | Ryunka, Frieza | Frieza, Eren, Patry, Ryunka |
| Distinct sources cited by entries | 2              | 3                           |
| Partial / major-spoiler markers   | Both true      | Both true                   |
| Real historical figures in card   | 0              | 0                           |

Manual comparison against the actual bounded model input found supporting passages for the two
new entries: Eren's mass-extermination plan in Attack on Titan and Patry's campaign against humans
in Black Clover. Both cite the new [TV Tropes page](https://tvtropes.org/pmwiki/pmwiki.php/Main/GenocideBackfire).
Ryunka and Frieza retain support from the original source pool. Offline assertions also checked
that each delivered entry has nonempty citations and all source indices are within its request.

These checks establish alignment with retrieved text, not independent canon truth. Sources include
fan-maintained trope/wiki pages and editorial lists; no authoritative-source corroboration was
performed. Two new entries depend on one new page. Neither card establishes a valid comparative
ranking, and broad planet destruction is not by itself proof of genocide in a strict sense.

## Remaining bottleneck

Only one of the three added pages contributed accepted entries. In particular, the CBR war-crimes
page contains a relevant Vegeta passage roughly 5,305 characters into the extracted text. The model
received the early 1,200-character source budget, covering other characters, rather than that
passage. Its omission cannot be attributed solely to model reasoning. The page is
[10 Most Prolific Anime War Criminals, Ranked](https://www.cbr.com/productive-anime-war-criminals-ranked).

Next experiment should compare relevant-passage selection against head truncation using these same
saved pages before spending on more retrieval. Also compare a deterministic focused search against
the extra planner call. Then run repeated held-out tests for targeted names, vague single-character
descriptions, multi-character lists, cartoons and music, including sufficient-evidence controls
where research should be skipped. Measure supported coverage and scope errors alongside source
authority, latency and cost. Do not enable automatic research from this single result.

## Artifacts and limits

Local owner-only artifacts: `.cache/live-tools/result.json`, archived `live.test.ts.txt` and `vitest.config.ts.txt`.
They retain public-source evidence, exact model inputs/answers, structured plan and usage metadata.
The artifact recorder excludes API keys, authorization headers and environment contents. The
directory is gitignored; evidence was not placed in a shared application cache.

The live harness completed successfully. Citation-index self-checks passed. No production code was
edited, so the full application suite was not repeated. This experiment contains one paired case,
with no repeats, blind judging, Cloudflare comparison, adversarial tool tests or live UI test.
