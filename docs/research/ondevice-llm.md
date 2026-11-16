# On-device language model (Phase 3 step 5, spec §5)

Written 2026-11-16. **Status: built, not measured on a phone.** Unit tests, typecheck and lint were
run by the agent at the owner's request (see D39); the benchmark itself has not been run. Every number below marked "measured" was read from
a package or Hugging Face, not from running a model. The benchmark results table is empty until
the owner runs it.

**Verdict: do not enable yet.** The rule is "enable only if it passes", and nothing has been
measured on a phone. The app keeps working exactly as today (deterministic curator, D36). The model
can be switched on only after the benchmark below passes on a mid-range phone; see "What enabling
means" at the end.

## What the model is for, in one example each

The model never becomes a source of facts. It only rewords facts the app already fetched, judges
spoilers, or suggests search words.

1. **Plain explanation from evidence.** For Doctor Doom, the app gives the model numbered evidence:
   `E1` "“Doctor Doom” is a comics character." (Wikidata), `E2` "Created by Jack Kirby and Stan Lee."
   (Wikidata), `E5`… paragraphs from Wikipedia's "Fictional character biography" section. The model
   must answer in JSON with the spec's fields (§5 Phase 3), every sentence carrying the IDs it
   relies on:
   - `meaning`: one or two sentences, e.g. `{"text": "Doctor Doom is a Marvel Comics supervillain.", "ids": ["E4"]}`;
   - `context`: optional sentences, only what the evidence says;
   - `example`: optional, and only an exact quote copied from what it cites (never a made-up usage
     example, which nothing could ground);
   - `spoiler`: `none` or `major`;
   - `uncertainty`: `low`, `medium` or `high`, shown only as the model's own caution, never used
     to accept or reject anything.

   The app then drops any sentence that cites nothing or cites an unknown ID. It also drops a
   sentence when a name, number, quotation or negation ("not", "never", "isn't") in it is missing
   from its cited evidence, or when its other words are: every word in a short sentence (under 5
   content words), at least 60% in a longer one, each matched from the start of a word. So
   "Doctor Doom dies." and "Doctor Doom was never a supervillain." are dropped when the evidence
   says neither, and "dies" doesn't count as found inside "studies". A sentence claiming an origin
   or a start ("originated", "comes from", "coined", "first used"…) is dropped unless what it cites
   makes that kind of claim too. An example that isn't word for word in its cited evidence is
   dropped. `spoiler` fails closed: `major` unless the model said `none` and nothing kept cites
   story text; anything else (unsure, invalid) is `major`. Invalid `uncertainty` becomes `high`.

   `toInterpretation()` maps what survives onto an `Interpretation`: `meaning` → `summary`,
   `context`, `example` → `usageExample` (in quotation marks), `provenance: 'model_suggested'`
   always (never `source_supported`), `evidence: 'supported'` only when every kept sentence's
   sources are held, otherwise `'uncertain'`, `selection: null`, and the reference's own
   `relation`. If no `meaning` sentence survives it returns nothing and the curator's text stays.
2. **Spoiler judgement.** Wikiquote "matching text" stays hidden by default (D36/D37). The model may
   unhide a line only when two differently worded questions both say "safe/no", and the line has no
   spoiler word ("dies", "killed", "your father", "ending", …). "Unsure" means hidden. No confidence
   score from the model is used.
3. **Search rewrites.** "catch me outside" → the model suggests at most 3 search strings such as
   "cash me outside". Each is at most 8 words, no links, different from what was typed. The app
   searches them and merges the lists taking turns, original first (original #1, rewrite #1, …,
   original #2, …), so the original top hit always stays first.

## Choices

| Question | Choice | Why |
|---|---|---|
| Library | **WebLLM** (`@mlc-ai/web-llm` 0.2.88, Apache-2.0, 0 production advisories on install) | Schema-constrained JSON decoding built in (`response_format: json_object` + schema, XGrammar), WebLLM's own timing per request (time to first token, decode speed), Cache API storage, and SRI checks on the code it downloads. |
| Not chosen | Transformers.js 4.3.2 | Runs without WebGPU (WASM), but generation on a phone CPU is expected to be too slow for these jobs (not measured), and its structured-output support was not verified for this step. Stays the candidate for embeddings (SEARCH_RANKING.md). |
| Where it runs | A module Web Worker, `src/workers/llm.worker.ts`: download, loading, tokenising, inference | Rendering is never blocked by the model. The main thread imports none of WebLLM's code. |
| Worker communication | **Comlink** 4.4.2 (Google Chrome Labs, Apache-2.0, ~1 kB): the worker `expose`s a typed API (`load`, `run`, `interrupt`, `remove`, `heapBytes`), the client `wrap`s it, and download progress comes back through `proxy()` | No hand-written `postMessage` protocol. Not WebLLM's own worker engine (`CreateWebWorkerMLCEngine`): its main-thread half lives in the same single 6.8 MB module as the engine, so the page would download and parse that bundle too (whether a build could shake it down was not verified); with Comlink the main thread's share is ~1 kB by construction, and the main thread keeps the validation. |
| Custom code around Comlink | A timeout, a listener for the worker's `error` event, terminate-on-failure, and an idle timer (`createLlmClient`, ~60 lines) | Comlink has no timeouts, crash handling or lifecycle; nothing else here is hand-rolled. |
| Cancelling | `client.run(job)` is an RxJS Observable: unsubscribing (a new query, leaving the page) calls the worker's `interrupt()`, which stops WebLLM's generation. Unsubscribing during a download terminates the worker. | Same teardown pattern as retrieval (D35). |
| Lifecycle | One worker per model, created on the consented load; loading another model terminates the previous worker; terminated after 5 minutes idle, on any failure, and on `dispose()` (page left, feature off). | One model in memory at a time; terminating a worker frees its memory. |
| Status | `client.status$` (an RxJS `BehaviorSubject` inside): `off`, `loading` (with progress), `ready`, or `unavailable` (with the reason). `useLlmStatus(client)` gives it to a screen. `start()` begins loading on first need and returns at once; `run()` while not `ready` errors immediately. `unavailable` is sticky: `start()` won't retry, only an explicit `load()` does. | Nothing ever waits on the model: a screen shows the AI part only when `ready`, otherwise the curator's text as today. No user-facing screen uses it yet. |
| When it downloads | Only after a button that states the size ("Download 358 MB from Hugging Face and load"); `load()` refuses unless the consent names that exact model and byte count. The worker is created on that click. | Spec: consent before download. |
| Where weights go | The browser's Cache API (WebLLM default). Never IndexedDB, never the app's Dexie records. "Delete downloaded files" removes them. | Spec. |
| Integrity | Model repos pinned to a commit; model library pinned to a `binary-mlc-llm-libs` commit; SHA-384 SRI on the model library, chat config and `tokenizer.json`, `onFailure: 'error'`. | A re-upload upstream can't change what runs. Weight files have no SRI in WebLLM; they come from the pinned commit. |
| Evidence format | Both measured: JSON and TOON (`@toon-format/toon` 4.4.0, MIT). Output is always JSON. | Owner asked to compare. TOON writes the evidence as one table (`evidence[3]{id,from,text}:` then rows), usually fewer prompt tokens. |
| No WebGPU | No model. `detectSupport()` returns `no_webgpu`, `no_adapter`, `low_memory` or `gpu_limits`, and nothing is downloaded. | Spec: the app works fully without the model. |
| GPU without `shader-f16` | The q4f32 build of the same model (same download, more GPU memory). | Many phone GPUs lack f16 shaders in Chrome. |

### Candidate models (all Apache-2.0; sizes from Hugging Face at the pinned commit, 2026-11-16)

| Model | Download (q4f16) | GPU memory, WebLLM estimate (q4f16 / q4f32) | Note |
|---|---|---|---|
| Qwen3 0.6B | 358 MB | 1403 / 1925 MB | Smallest; thinking switched off per request |
| Qwen3.5 0.8B | 455 MB | 1629 / 1894 MB | Newest small model WebLLM ships |
| Qwen2.5 1.5B Instruct | 887 MB | 1630 / 1889 MB | Larger, likely better wording, twice the download |

Download = every file in the pinned repo plus the model library WASM (6–7 MB). Gemma and Llama
models were left out because of their licence terms; SmolLM2 360M was left out as too small for
cited summaries (not measured).

## Memory budget

The model must never run the browser out of memory. In order:

1. **Pick by budget before any download.** `detectSupport()` reads `navigator.deviceMemory` (Chromium;
   it rounds down to a power of two, so a 6 GB phone reports 4) and the WebGPU adapter limits.
   - Device memory under 4 GB: no model (`low_memory`).
   - `maxBufferSize` under 256 MiB or `maxStorageBufferBindingSize` under 128 MiB (the smallest
     sizes WebLLM's runtime accepts before refusing): no model (`gpu_limits`).
   - Budget = 40% of device memory, assuming 4 GB where the browser doesn't say: 1638 MB on a
     4 GB-class device, 3276 MB on 8 GB. `pickVariant()` offers a model only if its GPU memory
     (WebLLM's estimate) fits. Example: on a 4 GB phone without `shader-f16`, Qwen3 0.6B q4f32
     (~1925 MB) is not offered, q4f16 (~1403 MB) would be on a GPU that has `shader-f16`.
   - The consent button states both: "Download 358 MB from Hugging Face and load (uses about
     1403 MB of memory)". The smallest model that passes the benchmark is the one to ship.
2. **Hard caps.** The user's own text (a question, a typed query, a quote line and its work) is
   cut to 200 characters before it goes into a prompt, so it can't overflow the context and unload
   the model. Context window 3072 tokens (`CONTEXT_WINDOW`; WebLLM's estimates assume 4096, so
   real use is lower); answers at most 700 tokens (explanations: 5 sentences and an example of ≤280 characters with IDs, so a full answer isn't cut mid-JSON), 80 (rewrites), 20 (spoilers);
   evidence capped at 4,000 characters per prompt (`MAX_EVIDENCE_CHARS`, story text at 2,400);
   one model loaded at a time. All quantised to 4 bits (q4f16 or q4f32).
3. **WebAssembly memory.** Each model library is a compiled WASM file that declares its own memory
   (`instance.exports.memory`); WebLLM 0.2.88 gives no way to set its `maximum`, and there is no
   `WebAssembly.Memory` the app creates. The weights live in GPU buffers, not WASM memory. No
   Transformers.js/ONNX, so no WASM thread count to cap.
4. **Contain failures.** Everything runs in the worker. An allocation failure (`RangeError`), a
   lost GPU device (WebLLM's `DeviceLostError`) or any engine error rejects the Comlink call or
   fires the worker's `error` event; the client then terminates the worker (freeing its memory),
   reports a plain error, and does **not** retry. The next attempt needs a new load by the user.
5. **Release memory.** The worker is terminated after 5 minutes idle, when a different model is
   loaded, and on `dispose()`. The bench page's "Unload (free memory)" button does the same, so
   release can be checked with `dumpsys meminfo` before load, after load and after unload.
6. **Measure.** Peak JS heap of the main thread and the worker during load and during the run
   (Chromium's `performance.memory`, sampled every second; the page isn't cross-origin isolated,
   so `measureUserAgentSpecificMemory` isn't available); GPU limits and budget; storage used;
   load and inference time. GPU memory itself has no web API, so on Android it's read with
   `dumpsys meminfo`.

## Pass criteria (all must pass on a mid-range phone)

"Mid-range phone": Android, 6–8 GB RAM, 2022–2024 mid-range chip (e.g. Snapdragon 7-series,
Dimensity 7000-series, Tensor G1-class), current Chrome. The bench page records the device memory,
core count and GPU so the run says which phone it was.

| Criterion | Target | How it is measured |
|---|---|---|
| Download size | ≤ 1000 MB | Pinned file sizes; the page also records storage used before and after the load |
| Memory | WebLLM GPU estimate ≤ 2000 MB, and the run finishes without the tab crashing or the GPU being lost | Estimate from the model record; real use on Android: `adb shell dumpsys meminfo com.android.chrome` during the run |
| Load from cache | ≤ 30 s | Second load of the same model |
| Faithfulness (automatic) | ≥ 70% of proposed sentences survive the citation + grounding checks | `checkExplanation` |
| Coverage | ≥ 80% of explanation cases end with at least one shown sentence | Same |
| Faithfulness (human) | ≥ 95% of **shown** sentences fully supported by their cited evidence | The report's appendix lists every shown sentence with its cited text; the owner (or the agent, reading the saved JSON) labels them |
| Time to first token | p50 ≤ 3 s | WebLLM's `time_to_first_token_s` |
| Explanation total time | p95 ≤ 20 s | Worker wall clock |
| Spoilers | 0 labelled spoilers shown; ≥ 50% of safe lines shown; p95 ≤ 4 s per line | 27 labelled lines (`src/test/llm-eval/cases.ts`) |
| Rewrites | ≥ 2 more misremembered cases in the top 5 (baseline 36.4%, 4 of 11, SEARCH_RANKING.md); 0 correctly typed cases pushed out; model time p95 ≤ 5 s | Live search for each eval case before and after rewrites, same run, same scoring as the search eval |
| No WebGPU | No download, app unchanged | Unit tests (`detectSupport`, consent refusal); open the app in a browser without WebGPU |
| Main thread stays responsive | During generation: no long task over 100 ms, frame gap p95 ≤ 50 ms | Long Tasks API (`PerformanceObserver`) and `requestAnimationFrame` gaps while explanations and spoilers run; keep the page visible |
| No crash | 0 model errors in the run | Errors listed in the report |
| No out-of-memory crash on a 4 GB-class device | 0 errors on a phone that reports `deviceMemory` ≤ 4 | Same run on a 4 GB-class phone (a 6 GB phone also reports 4) |

The rewrite check uses the **same run's** original search as the baseline, because live results
drift (SEARCH_RANKING.md). The 36.4% figure is the reference point, not the comparison.

## How to run (owner)

Unit tests, types, lint and the production checks:

```bash
npx vitest run src/services/llm src/features/dev
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build && npm run check:dist
```

Desktop run (any machine with Chrome and a GPU; numbers here do **not** count for the phone criteria):

```bash
npm run dev
```

Then open http://localhost:5173/dev/llm-bench, pick a model, press the download button, then
"Run benchmark". A full run (30 explanation cases × 2 formats, 10 character stories, 27 spoiler
lines, up to 22 rewrite cases with live searches and 3 s pauses) takes roughly 15–30 minutes. Press
"Save JSON" and put the file in `docs/eval/`; copy the Markdown report into this file.

Phone run (Android, USB debugging on). WebGPU needs a secure page, so the phone must open
`localhost`, forwarded over USB:

```bash
npm run dev
```

```bash
adb reverse tcp:5173 tcp:5173
```

Open http://localhost:5173/dev/llm-bench in Chrome on the phone and run as above. Check memory
before loading, after loading, during the run, and after pressing "Unload (free memory)" (the GPU
and graphics lines should fall back to about the "before" level):

```bash
adb shell dumpsys meminfo com.android.chrome
```

Chrome runs WebGPU in its GPU process; if the numbers don't move, list Chrome's processes and
repeat for each `com.android.chrome:privileged_process…` entry (which one is the GPU process was
not verified):

```bash
adb shell dumpsys meminfo | grep -i chrome
```

Run each model once, then load the chosen one a second time to get the cached load time. For the
4 GB criterion, repeat the run of the chosen model on a phone that reports 4 GB or less (the page
shows it under "Device").

## Results

Not run yet. Paste each run's report here (device, model, date).

| Date | Device | Model | Verdict | Report |
|---|---|---|---|---|
| – | – | – | – | – |

## Security and CSP

- **Production CSP unchanged; `check:dist` stricter.** It now also fails if `dist/` contains the
  bench page ("On-device model benchmark"), its labelled cases ("Kattappa ne Baahubali") or WebLLM
  (`CreateMLCEngine`); drop the last marker when the model is enabled. Production code never imports the
  model: the bench page is dev-only (`import.meta.env.DEV` guard, like `/dev/components`), so
  today's `dist/` has no worker, no WebLLM and no new host.
- `vite.config.ts`: the PWA precache now ignores `llm.worker-*.js`, so once the model ships its
  7 MB worker is never downloaded before consent; workers are built as ES modules.
- **Important for enabling:** the CSP is a `<meta>` tag in `index.html`. A worker loaded from its
  own URL does not inherit that policy; it takes the policy from its own response headers (CSP
  Level 3, "initialize a worker's policy"), and `vercel.json` sends only `frame-ancestors`. So the
  worker needs its own header, and that is also where `'wasm-unsafe-eval'` belongs, never on the
  page:

  ```json
  { "source": "/assets/llm.worker-(.*).js",
    "headers": [{ "key": "Content-Security-Policy",
      "value": "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src https://huggingface.co https://*.hf.co https://raw.githubusercontent.com" }] }
  ```

  `https://*.hf.co` covers Hugging Face's download CDN (`us.aws.cdn.hf.co`, checked 2026-11-16:
  weights answer with a 302 there). WebLLM's bundle contains no `eval` or `new Function`
  (checked), so `'unsafe-eval'` is not needed.
- The worker returns raw text; all checks run on the main thread, which treats the text as untrusted.
- The explanation prompt says evidence text is quoted material whose instructions must be ignored
  (Wikipedia text could contain an instruction-like sentence); the output checks don't rely on it.
- "Delete downloaded files" deletes only when the model is in the cache: WebLLM's delete would
  otherwise fetch the model's file list from Hugging Face, a download without consent.
- `@mlc-ai/web-llm` is pinned to exactly 0.2.88, since the model-library pins depend on its version.

## Model pins

Commits, sizes and SRI hashes live in `src/services/llm/models.ts`. To refresh: read the commit and
file sizes from `https://huggingface.co/api/models/mlc-ai/<model>?blobs=true`, hash
`mlc-chat-config.json`, `tokenizer.json` and the model library with SHA-384, and take the
`binary-mlc-llm-libs` commit that has the `modelVersion` folder of the installed WebLLM
(`v0_2_87` for 0.2.88).

## Files

| File | What |
|---|---|
| `src/services/llm/models.ts` | Candidates, pins, SRI, sizes |
| `src/services/llm/evidence.ts` | Evidence items from cached sources and curator facts; JSON/TOON encoding; Wikipedia biography section fetch (through the app's HTTP client) |
| `src/services/llm/jobs.ts` | Prompts and output schemas for the three jobs |
| `src/services/llm/check.ts` | Citation + grounding + origin + quote checks per field, spoiler decision, rewrite filter, result merge |
| `src/services/llm/interpretation.ts` | `toInterpretation()`: checked answer → `Interpretation` (`model_suggested`) |
| `src/services/llm/client.ts` | WebGPU and memory-budget checks, consent-checked load, Comlink client with status stream, cancel, timeouts (run 2 min, load 20 min), crash containment and idle unload |
| `src/features/llm/useLlmStatus.ts` | React hook for the status (no screen uses it yet) |
| `src/workers/llm.worker.ts` | WebLLM engine, exposed with Comlink |
| `src/features/dev/LlmBenchPage.tsx`, `llmBench.ts`, `llmBenchReport.ts` | `/dev/llm-bench`, dev only |
| `src/test/llm-eval/cases.ts` | 27 labelled spoiler lines, 10 comics characters |
| `src/services/llm/llm.test.ts`, `src/features/dev/llmBench.test.ts`, `src/features/llm/useLlmStatus.test.ts` | Tests |

## Known limits

- The grounding check is word-based. It catches made-up names, numbers and quotes, but a sentence
  can reuse the evidence's words and still say something it doesn't (e.g. swap who did what). That
  is why the human label pass is a criterion, not optional.
- Spoiler labels were set by the agent; the owner may relabel. 27 lines is enough to catch a
  model that leaks spoilers, not to prove it never does.
- Rewrites are tried on every eval case in the bench. In the app they would run only when the
  plain search finds nothing good (owner rule, BUILD_PROGRESS step 3c).
- Story text and model output are kept in memory only; nothing new is stored. The story `Source`
  has no excerpt, so its plot text can't show up wherever excerpts are shown openly.
- With thinking off, WebLLM writes Qwen3's empty `<think></think>` block into the answer; `parseJson`
  strips it before parsing. Qwen3.5 records carry WebLLM's own stop tokens and one-turn history.
- A failed or timed-out run fails its job's criteria (it can't drop out of a percentile), and the
  report counts answers cut off at the token limit.
- Evidence building, TOON/JSON encoding and output checks run on the main thread: inputs are capped
  at 4,000 characters, so they take well under a millisecond (not measured separately; the
  responsiveness probe covers them). The one larger parse, a full Wikipedia article for a story
  (~100 KB JSON), goes through the app's existing HTTP client, like every retrieval.
- Desktop browsers can't imitate a phone's GPU memory, so the memory criteria need a real phone.

## What enabling means (only after a pass)

Wire `createLlmClient` into Settings (an "AI explanations" switch whose prompt states the size,
plus "Delete AI model"), add the worker CSP header above, show model sentences as a separate
interpretation that is never `source_supported` (provenance stays the curator's), keep plot
sentences behind Reveal, and add e2e tests for "no download before consent" and "no WebGPU".
