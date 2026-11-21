# Curation evaluation set (2026-11-20)

A wider test set for AI card curation, a scorer for recorded runs, and a plan for one live pass. Nothing
here calls a paid API. Background: `docs/eval/live-curation-tools-2026-11-19.md`,
`docs/eval/passage-selection-2026-11-19.md`, `docs/eval/passage-methods-2026-11-20.md`.

## Cases

`cases.json` holds 17 cases. Each has `search`, `about`, `kind`, expected entries or key points
(regex patterns, all must match), `mustNotInclude` traps and a `why`. No page text, no lyrics.

| Category | Cases |
|---|---|
| Targeted name (run twice each) | `itachi uchiha`, `light yagami`, `hayao miyazaki` (a real person in scope) |
| Vague single character | "the guy who says believe it", "the scientist who turned himself into a pickle", "…this isn't even my final form" |
| Multi-character | `genocidal maniacs` (Anime/Cartoons, the pilot case), fourth-wall-breaking cartoon characters, `best anime rivalries` (ranking) |
| Anime/cartoon scope trap | `avatar` (Cartoons), `famous assassins` (Anime), `one piece` (Anime) |
| Music | `radiohead` (band), `darude sandstorm` (song reference / meme), `drip` (music slang) |
| Sufficient-evidence control | `kamehameha`, `d'oh` |

**An expected entry counts only if the evidence the model received states it.** Entries missing from
the evidence are reported as `notInEvidence`, not as misses, so the scorer separates retrieval gaps
from curation and check losses. Matching is lexical; a reworded fact counts as missing. One reader wrote
the lists; they are not a canon.

## Scorer

`.cache/live-tools/curation-score.mts` (gitignored, outside tsc and lint). No network, no keys.

```bash
node .cache/live-tools/curation-score.mts [run.json ...]
```

With no arguments it scores the recorded pilot files `result.json` and `packing-result.json`. It reads
the model input from `captured.input.user` (TOON), so "in evidence" means the bounded text the model
saw. Per arm it reports:

- **Retention:** expected entries in the evidence and in the final card, over those in the evidence (also core only).
- **Raw vs final:** raw answer lines dropped by the checks, and expected entries in the raw answer but not the card.
- **Wrong scope:** `mustNotInclude` hits in the final card and in the raw answer.
- **Citations:** each kept line's capitalised names must appear in the evidence it cites (raw ids, or card source indices).
- **Source authority:** sources cited and offered, by domain bucket (reference, academic, fan-wiki, editorial, dictionary/meme, social/video, other).
- **Latency:** handler time and stage path (retrieval and planner stages plus handler).
- **Usage and cost:** input, cached and output tokens; failed calls and retries; estimated dollars and dollars per useful card.
  A useful card is HTTP 200, at least one expected entry kept and no wrong-scope hit. Rates come from
  `.cache/live-tools/cost-estimate.json` (OpenAI, 2026-11-19) and Parallel's $0.001 per search and per
  extracted URL. **These rates need rechecking before a run.**

### Smoke test on the recorded pilot (one case, so not a benchmark)

| Arm | Kept / in evidence | Lost by checks | Wrong scope | Citations | Path | Est. $ |
|---|---|---|---|---|---|---|
| baseline (7 selected pages) | 2/2 (Frieza, Ryunka) | 0 | 0 | 2/2 | 9,161 ms | 0.007613 |
| augmented (planner + 3 pages) | 4/4 | 0 | 0 | 4/4 | 13,565 ms | 0.011730 |
| packing (anchored selector, replayed) | 4/8 | 3 (Patry, Lucy, Light/Kira) | 0 | 3/3 | 5,739 ms | 0.000514 (no retrieval) |

The dollar figures match the pilot report. The augmented path is 21 ms under the report's 13,586 ms
because the scorer sums the three research calls rather than the measured research block. The packing
row reproduces the ADR finding: more evidence reached the model and the checks dropped Patry. The
Light/Kira raw line said the passage did not state genocide, so that drop is correct.

## Live run plan (not run)

Arms, from ADR item 6. All arms use the same initial retrieval, replayed from one shared extraction as in the pilot:

1. **Baseline:** one Parallel fast search for `search` + `about`. Extract the top 7 results (the pilot's selection size). One `topic-card-v1` or `card-draft-v8` draft.
2. **Fixed focused search:** the baseline evidence plus one fixed-template search
   (`${search} ${about} characters examples` for lists, `${search} ${about}` for a reference card),
   with up to 3 new URLs extracted and appended. No extra model call.
3. **Planner research:** one `live-evidence-planner-v1` call (archived `live.test.ts.txt`). If
   `needed`, one search and up to 3 new URLs extracted; otherwise the baseline evidence is reused.
   Controls should come back `needed=false`.

Fixed settings: OpenAI `gpt-6-luna`, temperature 0.2, reasoning none, no Cloudflare fallback, the
production `LIMITS`, the existing validator. Targeted-name cases repeat the drafts once on the same
evidence (no new retrieval). Record one file per case in the `arms` shape the scorer accepts:
`{ caseId, request, arms: { baseline|fixed|planner: { status, elapsedMs, body, captured, calls } } }`.
Each arm's `calls` should include the shared extraction. Separately, anchored vs semantic passage
selection can be replayed offline on the saved pages for free.

### Cost estimate (list prices, rates to recheck)

| Item | Count | Unit | Total |
|---|---|---|---|
| Initial search, shared | 17 | $0.001 | $0.017 |
| Initial extraction, shared (7 URLs) | 119 URLs | $0.001 | $0.119 |
| Fixed focused search + 3 URLs | 17 × 4 | $0.001 | $0.068 |
| Planner call (≈2,000 in / 80 out) | 17 | ≈$0.00024 | $0.004 |
| Planner search + 3 URLs (if every planner says needed) | 17 × 4 | $0.001 | $0.068 |
| Drafts, uncached worst case (≈6,000 in / 500 out) | 51 | ≈$0.00085 | $0.043 |
| Repeat drafts for targeted names | 9 | ≈$0.00085 | $0.008 |
| **Subtotal, no judge** | | | **≈$0.33** |
| Optional judge (`gpt-6.2-sol`, $2/$10 per M per `judge.mjs`, ≈5,000 in / 400 out) | 51 | ≈$0.014 | ≈$0.71 |
| **Total with judge** | | | **≈$1.04** |

**Hard cap:** stop the run when the running estimate reaches **$0.50 without the judge** or **$1.25
with it**. Also stop at more than 51 searches, 221 extracted URLs, 77 Luna calls or 51 judge calls.
Retry a failed call at most once; retries and failed calls count toward the cap and appear in the
scorer's failed/retries column. Cloudflare is not called.

### What decides it

Per arm: supported-entry retention, entries lost by checks, wrong-scope hits, citation correctness,
authority mix, path latency and cost per useful card. Research earns a place only if fixed or planner
search raises retention on the list and scope cases without new wrong-scope hits, and adds nothing on
the two controls. If fixed search matches the planner, drop the planner call. A single pass is still
a small sample; treat differences of one or two entries as noise.
