# On-device model benchmark: Qwen3 0.6B on a Mac (smoke run)

Run 2026-11-16T14:29Z at `/dev/llm-bench` in the Claude desktop app's built-in browser (Chrome 152),
Mac with 32 GB, 14 cores, WebGPU Apple Metal 3 with `shader-f16`. Model `Qwen3-0.6B-q4f16_1-MLC`
(358 MB download, ~1403 MB GPU memory), 30 explanation cases, both evidence formats. The pane was
hidden for most of the run, so timings may be slower than a foreground tab.

**This is not the phone test.** A Mac GPU is far faster than the vivo X Fold5's Adreno GPU, so speed
and memory here say nothing about the phone. It checks that the pipeline works end to end and how
good the model's answers are, which doesn't depend on the device.

## Bug found and fixed during the run

The first run failed every case with "Model not ready" although the page said "Loaded". Comlink sends
download progress on its own message channel, so the last progress message (100%) arrived after the
load result and set the status from `ready` back to `loading`. Fix: `client.ts` ignores progress once
the status is no longer `loading`; test "stays ready when a progress message arrives after loading
finished" in `llm.test.ts`. This would have hit the phone too.

## Pass criteria (after the fix)

| Criterion                                              | Value                    | Target    | Pass            |
| ------------------------------------------------------ | ------------------------ | --------- | --------------- |
| Download size                                          | 358 MB                   | ≤ 1000 MB | yes             |
| GPU memory (WebLLM estimate)                           | 1403 MB                  | ≤ 2000 MB | yes             |
| Load time from cache                                   | 742 ms                   | ≤ 30 s    | yes             |
| Explanations: sentences kept by the checks (toon)      | 29.0%                    | ≥ 70.0%   | **no**          |
| Explanations: cases with at least one sentence         | 80.6%                    | ≥ 80.0%   | yes             |
| Explanations: shown sentences supported (human labels) | not labelled             | ≥ 95%     | not measured    |
| Explanations: time to first token, p50                 | 92 ms                    | ≤ 3 s     | yes             |
| Explanations: total time, p95                          | 10,517 ms                | ≤ 20 s    | yes             |
| Spoilers: spoiler lines shown                          | 0                        | 0         | yes             |
| Spoilers: safe lines shown                             | 0% of 16                 | ≥ 50%     | **no**          |
| Spoilers: time per line (two runs), p95                | 258 ms                   | ≤ 4 s     | yes             |
| Rewrites: misremembered cases newly in top 5           | 0 (4 → 4 of 11)          | ≥ 2       | **no**          |
| Rewrites: correctly typed cases pushed out of top 5    | 0 of 3                   | 0         | yes             |
| Main thread during generation: longest task            | 104 ms (2 over 50 ms)    | ≤ 100 ms  | **no** (barely) |
| Main thread during generation: frame gap p95           | 10 ms (max 1267 ms)      | ≤ 50 ms   | yes             |
| No model errors or crashes                             | 0 errors, 0 page crashes | 0         | yes             |
| Rewrites: model time, p95                              | 610 ms                   | ≤ 5 s     | yes             |

## Explanations

| Format | Cases | Valid JSON | Kept / proposed | Cases explained | First token p50 | Total p50 | Total p95 | Decode tok/s p50 | Dropped                                               |
| ------ | ----- | ---------- | --------------- | --------------- | --------------- | --------- | --------- | ---------------- | ----------------------------------------------------- |
| json   | 30    | 28         | 37/125 (29.6%)  | 24              | 93 ms           | 1,986 ms  | 9,530 ms  | 92.1             | duplicate 20, ungrounded 46, empty 10, not a quote 12 |
| toon   | 30    | 30         | 45/149 (30.2%)  | 27              | 86 ms           | 3,414 ms  | 8,981 ms  | 90.3             | duplicate 38, ungrounded 43, empty 13, not a quote 10 |

Character stories (live Wikipedia, 6 of 10 characters had a biography section): json kept 2/21
(9.5%), toon 4/20 (20%); total p95 10–16 s.

Most sentences that survived are titles or copies of the evidence ("Morbius", "Among Us is a 2018
online multiplayer social deduction game", the first sentence of the Wikipedia article), not
explanations in the model's own words. The checks did their job (nothing invented got through); the
model had little worth keeping.

## Spoilers

The model answered `unsure` to all 27 lines in both framings, so nothing was unhidden: safe (fails
closed) but useless.

## Search rewrites

The model copied the prompt's instruction "no explanations, no answers" as the search terms in 12 of
14 cases (for example "luke i am your father" → `no explanations · no answers`). Prompt in
`src/services/llm/jobs.ts:123`. A 0.6B model echoes instruction text; the prompt should not contain
phrases that look like search terms, but this also shows the model is too small for the job.

## Verdict

Qwen3 0.6B is fast enough (first word in ~0.1 s, typical answer 2–3.5 s on this Mac) but **not good
enough**: about 30% of its sentences pass the grounding checks, spoiler judging always says "unsure",
and rewrites echo the prompt. Before the phone test, try the larger Qwen3.5 0.8B and Qwen2.5 1.5B on
the Mac for quality; quality doesn't change with the device, only speed does.
