# On-device LLM: how others cut first-load time, and which safeguards they use

Written 2026-11-16. Research only; no code changed, nothing downloaded, nothing run on a phone.
Companion to `docs/research/ondevice-llm.md` and D39 in `docs/DECISIONS.md`.

**Method and limits.** Web pages were read through a fetch tool that summarises pages, so quotes
and numbers below are what that tool reported, not a raw read. Anything I could not confirm is
marked **NOT VERIFIED**. "Secondary" means a blog or aggregator, not the vendor. No Reddit or
Hacker News thread could be opened directly (one HN-linked write-up was reachable only as a
four-line teaser). There are **no measured phone numbers for Qwen3 0.6B, Qwen3.5 0.8B,
Snapdragon 8 Elite, Dimensity 9400 or the X Fold5's chip** anywhere I could reach.

## 0. Findings that change the plan

1. **Chrome's built-in AI (Gemini Nano) does not run on Android Chrome today.** So it cannot remove
   the download for this phone (section 1).
2. **The X Fold5 has a Snapdragon 8 Gen 3 with an Adreno 750 GPU, not an 8 Elite**
   ([vivo X Fold5 page](https://www.vivo.com/en/products/x-fold5), chip and GPU as relayed by a
   search summary of vivo's pages; RAM size not confirmed: **NOT VERIFIED**).
3. **WebLLM on Android Chrome has open, unfixed device-loss and slowness reports**, one on Chrome
   ~149 (section 3). Nobody I found has reported WebLLM on an Adreno 750.
4. **The only phone speed figure for WebLLM that I found is slow in the part that matters most for
   us: prefill.** Pixel 8 Pro, Llama 3.2 3B q4f16: prefill about 5.4 tokens/s, decode about 5.1
   tokens/s, "short content takes 20+ seconds"
   ([web-llm #759](https://github.com/mlc-ai/web-llm/issues/759)). Our evidence prompt is capped at
   4,000 characters (about 1,000 tokens, my estimate). Arithmetic, not a measurement: at 5.4
   tokens/s that is about 185 s of prefill for a 3B model; a 0.6B model would be several times
   faster but nobody has measured it. D39's pass criterion "time to first token p50 ≤ 3 s" may
   be out of reach on a phone GPU; prompt size, not model download, may be the real wall.
5. **Passing a WebGPU feature check does not mean a small model will run on a phone.** A June 2026
   write-up (only the teaser was readable) reports a model that passed detection but still failed
   on a phone, and a long prefill of up to 76 s
   ([teaser](https://devbytes.co.in/news/mobile-browsers-are-not-yet-ready-for-small-language-models),
   [HN-mirror title](https://hackernews-dynamic.seasondane.workers.dev/news/48624985); body NOT VERIFIED).

## 1. Chrome built-in AI (Gemini Nano)

### Status in November 2026

| Question | Answer | Source |
|---|---|---|
| Android Chrome supported? | **No.** "Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported" by the APIs that use foundation models (Prompt, Summarizer, Writer, Rewriter, Proofreader). | [Chrome: get started / requirements](https://developer.chrome.com/docs/ai/get-started), [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) |
| Language Detector, Translator on mobile? | No: "These APIs do not work on mobile devices." They are stable (Chrome 138) but desktop only. | [Built-in APIs table](https://developer.chrome.com/docs/ai/built-in-apis), [get started](https://developer.chrome.com/docs/ai/get-started) |
| Prompt API stage | Web: listed as Chrome 148 (sampling parameters still an origin trial). The same page's text says Chrome 138 stable "only for Chrome Extensions", so the page contradicts itself; treat web stable status as desktop Chrome 148. | [Built-in APIs](https://developer.chrome.com/docs/ai/built-in-apis), [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) |
| Summarizer | Stable from Chrome 138, desktop class. | [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api) |
| Writer, Rewriter | "Developer trial", not stable. Proofreader: origin trial or developer trial (page is inconsistent). | [Built-in APIs](https://developer.chrome.com/docs/ai/built-in-apis) |
| Origin trial or flag needed? | Not for the stable ones on desktop; sampling parameters need an origin trial; no flag is mentioned. Irrelevant to Android, which has no implementation shipped. | [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) |
| Chrome's own plan for Android | Intent to Ship: launch is "Windows, Mac, Linux, and ChromeOS (on Chromebook Plus devices)"; "An implementation for Android using that platform's OS-level built-in language model is being prototyped", to come after launch. No date. | [blink-dev Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/iR6R7-nQeHI) |
| Chrome PM, Dec 2025 | "Most of the APIs are only available on desktop"; Android is wanted, decided per API, lighter APIs (detector, translator) likely first; "Stay tuned in 2026 for updates." | [chrome-ai-dev-preview-discuss thread](https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss/c/HKIndTczlPM) |
| Any November 2026 sign of an Android launch? | None found. A web search for Chrome 149/150 Android support found no confirmation. | search only; Chrome 149/150 release notes **NOT VERIFIED** (not read) |

### Desktop requirements (for the record; the phone does not meet "supported platform")

Windows 10/11, macOS 13+, Linux, ChromeOS on Chromebook Plus; at least 22 GB free on the profile
volume; strictly more than 4 GB VRAM; 16 GB RAM and 4 cores; unmetered connection for the first
download; the model is removed if free space drops below 10 GB
([get started](https://developer.chrome.com/docs/ai/get-started)). Even a 16 GB phone would not
count: the check is the platform, not RAM.

### Is the X Fold5 or its chipset supported?

- **In Chrome (web): no**, because no Android Chrome build exposes these APIs.
- **In a native Android app: yes, listed.** Google's ML Kit GenAI page lists "vivo X Fold5" under
  both the Gemini Nano 4 "custom generation and agents" row and the feature-API list (summarise,
  rewrite, proofread, describe image); it does not mention Snapdragon 8 Gen 3 and says model
  availability "may vary depending on the device's RAM configuration, OS version, and AICore update
  status" ([ML Kit GenAI overview](https://developers.google.com/ml-kit/genai)). Entry read via the
  fetch tool; re-check the live list before relying on it.
- That path is native only (AICore system service, Kotlin/Java), not reachable from a PWA or a
  Trusted Web Activity page. It would need a native shell (for example a Capacitor plugin) around
  the PWA. Constraints from the ML Kit docs: Android API 26+; not supported with an unlocked
  bootloader; input must fit under about 4,000 tokens; AICore enforces a per-app inference quota;
  `checkStatus()` returns AVAILABLE / DOWNLOADABLE / DOWNLOADING / UNAVAILABLE, and setup errors can
  take "minutes to hours" to clear
  ([ML Kit Prompt API: get started](https://developers.google.com/ml-kit/genai/prompt/android/get-started)).
  The model is managed by AICore, not stored by the app.

### API shape (desktop, for when Android arrives)

- Feature detect (`'Summarizer' in self`); `availability()` is async and returns states including
  `downloadable`, `downloading`, `unavailable` (pass the same options you will later use);
  `create()` triggers the download and needs user activation; a `monitor` callback receives
  `downloadprogress` events (`e.loaded` as a fraction); `create`, `prompt`, `promptStreaming` and
  `clone` take an `AbortSignal`; sessions have `clone()` and `destroy()`
  ([Prompt API](https://developer.chrome.com/docs/ai/prompt-api),
  [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api)).
- Context: `session.contextUsage` and `contextWindow` exist, but **the docs give no number**; on
  overflow older turns are dropped (system prompt kept) and a `contextoverflow` event fires; if that
  is not enough `prompt()` throws `QuotaExceededError`
  ([Prompt API](https://developer.chrome.com/docs/ai/prompt-api)).
- Summarizer options: `type` key-points/tldr/teaser/headline, `format`, `length`; no stated input
  limit ([Summarizer](https://developer.chrome.com/docs/ai/summarizer-api)).
- Languages: English, Spanish, Japanese, German, French in and out from Chrome 149
  ([get started](https://developer.chrome.com/docs/ai/get-started)).
- Latency numbers: none in the docs I read (**NOT VERIFIED**).
- Terms: the pages state "No data is sent to Google or any third party when using the model" and
  link no separate usage policy ([Prompt API](https://developer.chrome.com/docs/ai/prompt-api));
  any prohibited-use policy that applies is **NOT VERIFIED**.

**Verdict for this app:** do not design around it. Keep a thin adapter seam so that if Chrome ships
Android support, `availability()` can short-circuit the WebLLM download. Check
[the built-in APIs page](https://developer.chrome.com/docs/ai/built-in-apis) periodically.

## 2. Cutting first-load time

### 2.1 What the first load actually costs (arithmetic, not measured)

D39's sizes: Qwen3 0.6B 358 MB, Qwen3.5 0.8B 455 MB, Qwen2.5 1.5B 887 MB. At 20 Mbps, 358 MB is
about 2.5 minutes and 887 MB about 6 minutes; at 100 Mbps, 30 s and 70 s. Practitioners report cold
starts of 15 to 90 s up to several minutes, depending on connection and model (secondary:
[search summary of dev blogs](https://dev.to/creeta/qwen3-in-the-browser-zero-keys-webllm-0283-hands-on-3ai2),
which says a slow-connection first fetch can exceed two minutes and repeat starts take "roughly a
second" with caching, with no measurement). Chrome's own advice: "always aim to use the smallest
possible model" ([web.dev: Background Fetch for AI models](https://web.dev/articles/background-fetch-ai)).

### 2.2 Smaller or more heavily quantised models

- Qwen3 0.6B q4 at 358 MB is already near the floor for a model that can follow a JSON schema.
  D39 rejected SmolLM2 360M as too small (not measured). Going below q4 (q3, 2-bit) is not offered
  by WebLLM's prebuilt model list as far as the D39 notes show; **NOT VERIFIED** for 0.2.88.
- Best lever is the **prompt**, not the weights: shorten evidence (prefill dominates on phones,
  see section 0.4).
- Google's web stack (LiteRT-LM JS, below) ships Gemma 4 E2B at about 2.58 GB, far over budget
  ([Google blog](https://developers.googleblog.com/en/blazing-fast-on-device-genai-with-litert-lm/));
  D39 also excluded Gemma for licence terms.

### 2.3 Shard caching and resuming a cut-off download

- **WebLLM stores shards through TVM's artifact cache, default Cache API**; `appConfig.cacheBackend =
  "indexeddb"` switches to IndexedDB; an experimental `"cross-origin"` backend needs a browser
  extension ([WebLLM advanced usage](https://webllm.mlc.ai/docs/user/advanced_usage.html)).
- **Resume behaviour (from TVM `main`, not necessarily the code bundled in 0.2.88; check
  `node_modules`):** shards are fetched as whole files with plain GET, no `Range` header; each
  shard is stored only when its response completes (`cache.add`), so **finished shards survive a
  cut-off and only the interrupted shard restarts**; four parallel lanes fetch shards; progress is
  `fetchedBytes / totalBytes`
  ([tvm runtime.ts](https://raw.githubusercontent.com/apache/tvm/main/web/src/runtime.ts),
  [tvm artifact_cache.ts](https://raw.githubusercontent.com/apache/tvm/main/web/src/artifact_cache.ts)).
  Practical effect: a cancel or terminate loses at most one partial shard. How large a shard is for
  Qwen3 0.6B: **NOT VERIFIED** (read `ndarray-cache.json` in the model repo).
- **True byte-range resume is not built in.** A third-party guide describes a service worker doing
  Range requests for that ([SitePoint, secondary, summary only](https://www.sitepoint.com/ux-patterns-large-model-downloads/);
  page returned 403 to me, so **NOT VERIFIED**). A package `@verifyfetch/webllm` advertises
  resumable, verified downloads; claims **NOT VERIFIED**
  ([pkgstats listing](https://www.pkgstats.com/pkg:@verifyfetch/webllm)).
- **Cache API vs OPFS vs IndexedDB:** Chrome recommends the Cache API ("the general recommendation")
  and calls IndexedDB "the worst place to store large models" because data is (de)serialised; OPFS
  is fast but also serialises ([Chrome: cache models](https://developer.chrome.com/docs/ai/cache-models)).
  D39's Cache API choice matches. A new model version "must" get a new URL (same source).

### 2.4 `navigator.storage.persist()` and quota

- Chromium quota: an origin can store up to 60% of total disk in both best-effort and persistent
  mode; Chrome uses at most 80% of total disk overall
  ([MDN: quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).
  Model size is nowhere near the quota; the risk is eviction, not capacity.
- Best-effort data is evicted least-recently-used under storage pressure, **and eviction is
  all-or-nothing per origin: "all of its data, not parts of it"** (same source). That means pressure
  could wipe the user's Dexie data together with the model. This is a stronger reason to call
  `persist()` than the model alone.
- Chrome grants `persist()` silently from heuristics: site engagement, installed or bookmarked,
  notification permission; a denied request can be retried later
  ([web.dev: persistent storage](https://web.dev/articles/persistent-storage)). Android-specific
  behaviour and whether an installed PWA is treated as "installed" there: **NOT VERIFIED**.
- Chrome demo notes a model can end up stored redundantly in IndexedDB, Cache and OPFS; store it in
  one place ([Chrome: cache models](https://developer.chrome.com/docs/ai/cache-models)).

### 2.5 Is WebGPU shader and pipeline compilation cached between visits?

- Official: Chrome 117 says only that render pipelines created with `layout: "auto"` "take
  advantage of caching mechanisms in Chrome" ([new in WebGPU 117](https://developer.chrome.com/blog/new-in-webgpu-117)).
  WebLLM/TVM mostly builds compute pipelines, so that note does not cover it.
- Android: Chrome says shader-compiler (Tint) speed-ups "already accessible on Android"
  ([new in WebGPU 121](https://developer.chrome.com/blog/new-in-webgpu-121)), no cache statement.
- Secondary: a game-dev guide says Chrome writes a `DawnWebGPUCache` on disk but "you can't rely
  on" it persisting ([wavedash shader-stutter guide](https://docs.wavedash.com/tutorials/shader-stutter)).
- **Conclusion: persistence of compiled shaders across visits on Android Chrome is NOT VERIFIED.**
  Measure it: load twice on the phone, cold tab each time, and compare. Until then assume every
  visit recompiles, so avoid reloading the engine more than needed (see 2.8).

### 2.6 Prefetching only on Wi-Fi or while charging

There is no clean web API for "Wi-Fi and charging".

| API | What it gives | Status |
|---|---|---|
| Network Information (`navigator.connection`) | `effectiveType` (speed bucket), `saveData`, `type` | WICG draft, "limited availability" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)). Chrome Android exposing `type` = wifi/cellular: **NOT VERIFIED** from MDN (compat table not readable) |
| Battery Status (`getBattery()`) | level, charging | Secure context, not in workers, limited availability ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API)); Chrome Android support **NOT VERIFIED** from the page |
| Background Fetch | OS-level download that survives closing the tab, shows browser progress and cancel UI, pauses offline, resumes online | "Experimental, limited availability" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Fetch_API)); web.dev lists Chrome 74, Android not stated ([web.dev](https://web.dev/articles/background-fetch-ai)) |

Practical reading: treat connection and battery as **soft hints** (warn, never silently block), and
let the user press the download button. Background Fetch is the only API that moves the transfer
out of the page's lifetime. It writes to a Cache API store of your choosing in the service worker
(web.dev example uses a cache named `downloads`). **Whether you can fill the same Cache API name and
URL keys that WebLLM reads (so WebLLM finds the shards already cached) is NOT VERIFIED**; the TVM
code checks the cache by URL first, so it is plausible, but it needs a spike, and the cache name
WebLLM uses was not read.

### 2.7 Start with a tiny model, upgrade later

I found no primary source describing this as an established WebLLM pattern (**NOT VERIFIED** as
"common practice"). It follows from Chrome's smallest-model advice and from the Prompt API's
`availability()` states. For this app it is cheap: ship the 0.6B only; add a "better quality
(887 MB)" opt-in later, with its own consent, only if the 0.6B output fails the human faithfulness
check.

### 2.8 Warm-up and compile time

- Once consented, load in the background after the non-AI result is on screen; never block render.
- WebLLM's Service Worker engine exists "to avoid reloading the model between page refreshes", but
  the browser can kill the worker at any time and WebLLM uses heartbeats
  ([WebLLM advanced usage](https://webllm.mlc.ai/docs/user/advanced_usage.html)). D39 chose a
  Web Worker per page; reloads recompile. A longer idle timeout than 5 minutes trades memory for
  fewer recompiles; decide from the measured warm and cold load times.
- Start the load (only when the model is already cached) on a user-intent signal such as focusing
  the search box, not after the query. This is my suggestion, not a sourced pattern.

### 2.9 Measured load time and tokens/s on recent phones

| Phone, GPU | Runtime, model | Result | Source |
|---|---|---|---|
| Pixel 8 Pro (Tensor G3, Mali) | WebLLM, Llama 3.2 3B q4f16 | prefill ~5.4 tok/s, decode ~5.1 tok/s; 20+ s for short content; changing buffer size or prefill chunk size did not help | [web-llm #759](https://github.com/mlc-ai/web-llm/issues/759) |
| Android, GPU path (device not named) | LiteRT-LM native, Gemma 4 E2B | 52 tok/s decode | [Google blog](https://developers.googleblog.com/en/blazing-fast-on-device-genai-with-litert-lm/) (native, not Chrome) |
| Snapdragon 8 Elite, Dimensity 9400, Snapdragon 8 Gen 3 (any browser runtime) | any | **no figure found** | **NOT VERIFIED** |
| Qwen3 0.6B / Qwen3.5 0.8B on any phone | WebLLM | **no figure found** | **NOT VERIFIED** |

Weak, secondary evidence on vendors: a summary of a WebGPU benchmark paper gives median WebGPU
speedups over CPU of about 20x on Adreno, 55x on Mali, 71x on Apple Silicon
([search summary, WebGPU dispatch-overhead paper](https://arxiv.org/html/2604.02344)); I did not
verify it and it is not phone-specific. Chrome on Android needs Android 12+ and Qualcomm or ARM
GPUs ([new in WebGPU 121](https://developer.chrome.com/blog/new-in-webgpu-121)); the X Fold5
qualifies on paper.

## 3. Runtime choice for one Android phone

| | WebLLM 0.2.88 | MediaPipe LLM Inference (web) | LiteRT-LM JS (MediaPipe's successor) | Transformers.js (ONNX, WebGPU or WASM) |
|---|---|---|---|---|
| Android Chrome evidence | Mixed, mostly negative (below) | Gemma 3n listed in Google's guide; Android Chrome not stated; no benchmarks found | Web API "with WebGPU acceleration"; Android Chrome not stated; "can take several seconds to load the model" | WebGPU or CPU fallback; no Android-specific issue found |
| Small-model fit (≤1B) | Qwen3 0.6B, Qwen3.5 0.8B, Qwen2.5 1.5B prebuilt | Gemma-class, GB-sized | `.litertlm` models, Gemma 4 E2B/E4B/12B+ named; "Gemma, Qwen and more" on Hugging Face; a small Qwen on web **NOT VERIFIED** | Many small ONNX models |
| Structured JSON | Built in (XGrammar), already used by D39 | n/a verified | Constrained decoding mentioned for native SDKs; web **NOT VERIFIED** | Not verified by D39 |
| Status | Active, but 0.2.x | A search excerpt says "maintenance-only", migrate web projects to LiteRT-LM; the page fetch did not show that notice, so **treat as likely, NOT VERIFIED** | Current Google direction | Active |
| Sources | below | [MediaPipe web guide](https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/web_js) | [LiteRT-LM JS](https://developers.google.com/edge/litert-lm/js), [blog](https://developers.googleblog.com/en/blazing-fast-on-device-genai-with-litert-lm/) | [Transformers.js WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu) |

### Known WebLLM problems on Android (primary: GitHub issues)

- **[#836](https://github.com/mlc-ai/web-llm/issues/836), open, opened 2026-06-21:** engine
  initialisation fails on Qualcomm Adreno. Two phones: an Adreno 6xx (Android 10, Chrome ~120) with
  "Device was lost", and an Adreno 810 (Snapdragon 7s Gen 3, Android 16, Chrome ~149) with
  `vkQueueSubmit failed with VK_ERROR_DEVICE_LOST`, during warm-up, on 0.2.84, both reporting
  `shader-f16`. q4f16 and q4f32, 0.5B and 1B, and small contexts all failed; a plain WebGPU
  compute test passed. Maintainer has no Android device, asked whether 0.2.79 works and 0.2.80+
  fails (0.2.80 moved some CPU work to GPU kernels). The reporter pinned 0.2.79 in their fork for
  an "Adreno regression" and proposed detecting Adreno and catching device loss. **Our pin is
  0.2.88; whether the Adreno 750 hits this is NOT VERIFIED.**
- **[#722](https://github.com/mlc-ai/web-llm/issues/722), open:** `CreateComputePipelines failed
  with VK_ERROR_UNKNOWN` on Android Chrome; a maintainer says WebLLM should work on mobile Chrome.
  No root cause.
- **[#759](https://github.com/mlc-ai/web-llm/issues/759), open:** slow performance (section 2.9).
- Older: [#209](https://github.com/mlc-ai/web-llm/issues/209) (`maxStorageBufferBindingSize` on
  Android, closed), [#271](https://github.com/mlc-ai/web-llm/issues/271) (no adapter, closed),
  [#524](https://github.com/mlc-ai/web-llm/issues/524) (Gemma 2 2B crashes on a phone, open).
  Issue list: [GitHub search "android"](https://github.com/mlc-ai/web-llm/issues?q=android).
- No issue found for Mali. D39's `gpu_limits` check (256 MiB max buffer, 128 MiB storage binding)
  matches the failures in #209.
- Practitioner: a Qwen2.5-1.5B WebLLM run on a phone downloaded all 728 MB then failed at init
  with `TypeError: Load failed` (secondary, [HN-linked title](https://hackernews-dynamic.seasondane.workers.dev/news/48624985)
  and search summary; body **NOT VERIFIED**). Lesson: the failure can arrive after the download.

### Which to use

**WebLLM, kept as is, behind a one-phone spike (section 6).** It is already built, tested and has the
JSON-schema decoding D39 depends on. Do not switch to MediaPipe LLM Inference (reported
maintenance-only). LiteRT-LM JS is the fallback to try if WebLLM device-loses on the X Fold5, but
its small-model web support is unproven. Keep Transformers.js for embeddings only, as D39 says.

## 4. Safeguards people use, with sources

| Safeguard | What practitioners and docs do | Source |
|---|---|---|
| Consent and size disclosure | Start the download only after opt-in, show size and progress; Prompt API itself needs user activation to start a download | [jwatte blog](https://jwatte.com/blog/in-browser-llm-byo-model-cross-browser/) (secondary), [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) |
| Cancel and pause | Prompt API: `AbortSignal` on create/prompt. Background Fetch: browser UI to cancel, auto-pause offline | [Prompt API](https://developer.chrome.com/docs/ai/prompt-api), [web.dev](https://web.dev/articles/background-fetch-ai) |
| Battery and thermal | No web API for thermal. Battery API is limited. Notebookcheck reportedly measured strong heating and pronounced throttling on the X Fold5 (search summary of a review; **NOT VERIFIED**). So use self-measurement: time each run and back off | [MDN Battery](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API), [Notebookcheck X Fold5 review](https://www.notebookcheck.org/Analisis-del-Vivo-X-Fold5-Tableta-superligera-de-8-pulgadas-con-apariencia-de-smartphone-extraplano.1092427.0.html) |
| Memory and OOM | Check adapter limits and memory before load; wrap engine creation in try/catch; call `engine.unload()` to avoid leaking VRAM; device loss is a normal failure to catch | [dev.to Qwen3 WebLLM notes](https://dev.to/creeta/qwen3-in-the-browser-zero-keys-webllm-0283-hands-on-3ai2) (secondary), [web-llm #836](https://github.com/mlc-ai/web-llm/issues/836) |
| Storage eviction | Request `persist()`; assume cached weights can be evicted under disk pressure and re-download; Chrome deletes its own Gemini Nano if free space falls under 10 GB | [web.dev](https://web.dev/articles/persistent-storage), [Chrome: cache models](https://developer.chrome.com/docs/ai/cache-models), [get started](https://developer.chrome.com/docs/ai/get-started) |
| Prompt injection from retrieved text | OWASP: constrain behaviour, validate output formats with deterministic code, segregate and label external content, least privilege, test adversarially, treat the model as an untrusted user | [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) |
| Output validation and grounding | OWASP also lists evaluating responses for relevance and groundedness; D39's checks already go further | same |
| Never block the UI | Run in a worker; Chrome Prompt API streams; WebLLM has worker and Service Worker engines | [WebLLM docs](https://webllm.mlc.ai/docs/user/advanced_usage.html) |
| Telemetry-free measurement | WebLLM exposes its own timing per request; Chrome says no data goes to Google when using the model. A local-only counter store is my suggestion, not a sourced pattern | [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) |
| Updating a model version | Give a new version a new URL; keep old until new works. Chrome: "you must give it a new URL" | [Chrome: cache models](https://developer.chrome.com/docs/ai/cache-models) |
| Integrity | Pin model commits; Chrome notes cached models are trivial to extract, so do not rely on secrecy | [Chrome: cache models](https://developer.chrome.com/docs/ai/cache-models) |

## 5. UX patterns for "AI is getting ready"

- **Progressive enhancement, plain fetch as the fallback.** Chrome's own guidance for model
  downloads: feature-detect, use the better path (Background Fetch) if present, else plain `fetch`;
  "wait to load the model until your app needs it"; show progress
  ([web.dev](https://web.dev/articles/background-fetch-ai)).
- **Drive the UI from an availability state, not from a spinner.** The Prompt API's four states
  (`unavailable`, `downloadable`, `downloading`, `available`) are the model: hide the AI row when
  `unavailable`, show a size-stating button when `downloadable`, show a progress bar when
  `downloading`, show the AI text when `available`
  ([Prompt API](https://developer.chrome.com/docs/ai/prompt-api)). D39's `off / loading /
  ready / unavailable` is the same shape.
- **Show the non-AI result first, then add the AI part in place** without moving what is on screen.
  D39 already states this rule; no source needed beyond the app's own spec.
- **Progress screen is real work.** One developer writes that a "please wait while we download
  1.5GB" screen "doesn't exist in any product" and had to be built from scratch
  ([secondary, search summary of a dev.to post](https://dev.to/jtorchia/i-stuffed-a-tiny-llm-inside-a-nextjs-app-heres-what-i-learned-a2g);
  wording paraphrased, **NOT VERIFIED** at source).
- Native Android apps handle the same states with `checkStatus()` and `download()` callbacks
  ([ML Kit](https://developers.google.com/ml-kit/genai/prompt/android/get-started)).

## 6. Recommendation

### Ranked plan for this app on this phone

1. **Keep the model off and the app unchanged until one 30-minute spike on the X Fold5 says it is
   safe.** The spike decides everything else; no more design work is justified before it.
2. **Spike (owner runs it, per rule 8):** open `/dev/llm-bench` over `adb reverse` on the phone
   with Qwen3 0.6B q4f16 only. Record: download time on the owner's real network, cold load (tab
   freshly opened) vs warm load, prefill and decode tok/s at a **1,000-token** prompt (the real
   evidence size) and at 300 tokens, any device-lost or `Load failed`, and the first-vs-second
   shader-compile difference. Add Qwen2.5 1.5B only if 0.6B is clearly too weak.
3. **If it works:** ship Qwen3 0.6B opt-in only; shorten evidence (aim for the shortest prompt that
   passes the faithfulness check), ask for `persist()` after install, add the guards in the
   checklist below, no 1.5B tier until the 0.6B output fails a quality check.
4. **If WebLLM device-loses (#836-style):** try 0.2.79 once (the only workaround any reporter used;
   not shown to fix Adreno 750). If that fails, try LiteRT-LM JS with a small model. If that fails,
   **drop the on-device model for this phone**: the app is designed to work without it.
5. **Only if first-load time still hurts after (3):** consider a native shell using Google's
   AICore (the X Fold5 is on Google's list) so the download disappears from your app. That is a
   scope change and not needed for a PWA.

### Best way to cut or remove first-load time

- **Remove it:** only possible through native AICore, not in the browser (section 1).
- **Cut it:** one download of the smallest model (358 MB), explicit consent, install the PWA and
  request `persist()` so it is downloaded once and not evicted; rely on WebLLM's per-shard
  Cache API storage so a cut-off costs one shard; let the user press download on Wi-Fi with a soft
  warning if `saveData` or a slow `effectiveType` is reported; run the download and compile after
  the non-AI result is shown; keep the engine alive for the session to avoid recompiles.
- **Spike worth doing:** Background Fetch into WebLLM's cache (unproven, section 2.6) to make the
  download survive tab close.
- **Do not:** precache the model in the service worker (spends data without consent; D39 already
  excludes the worker file).

### Which runtime

**WebLLM 0.2.88 as built.** Fallback LiteRT-LM JS. Not MediaPipe LLM Inference. Not Transformers.js
for generation.

### Safeguard checklist against D39

Status is from `docs/research/ondevice-llm.md` (the D39 text) as read today; "has" means described
there, not that it was verified in code.

| Safeguard | D39 | Note |
|---|---|---|
| Consent with size, refuse load unless consent names model and bytes | **Has** | |
| WebGPU, adapter-limit and device-memory checks before download | **Has** | Insufficient alone (section 0.5) |
| Cancel (unsubscribe interrupts; during download terminates worker) | **Has** | Loses at most one partial shard |
| **Pause / resume** | **Missing** | Only cancel. Background Fetch or "continue download" button |
| Never block the UI (worker, Comlink, timeouts) | **Has** | Responsiveness criterion included |
| Crash containment (terminate worker, no auto-retry, sticky `unavailable`) | **Has, in memory only** | |
| **Crash that survives reload (loading marker set before load, cleared after success; if present at next start, mark "unsupported on this device", delete cache, stop offering)** | **Missing** | Needed for #836-style device loss and tab OOM, which kill the page before any status can be saved. Engineering suggestion, not sourced |
| **Post-download smoke test** (tiny generation under a time limit before showing AI parts) | **Missing** | Benchmark only; no runtime guard. Matches "download then fail at init" reports |
| **Adaptive disable** (if a real run exceeds a latency ceiling, stop using the model and say so) | **Missing** | Only practical answer to thermal throttling, which has no web API |
| Idle unload (5 min), unload on dispose | **Has** | Trade-off with recompile cost (2.8) |
| Memory budget, token and character caps | **Has** | Evidence cap of 4,000 chars may be too big for phone prefill |
| **Storage: `persist()`, `estimate()` before download, detect eviction at startup (`hasModelInCache`)** | **Missing** | Not mentioned in D39; also protects Dexie data (2.4) |
| Delete downloaded files without a download | **Has** | |
| **Metered or low-battery hints** (`saveData`, `effectiveType`, Battery API where present) | **Missing** | Soft warnings only |
| Prompt injection: quoted evidence, instructions ignored, checks do not rely on the prompt | **Has** | Matches OWASP |
| Output validation: schema, citations, grounding, quote and origin checks, spoiler fail-closed | **Has** | Strong |
| Integrity: pinned commits, SRI on library, config, tokenizer | **Has** | Weight files have no SRI (stated in D39) |
| Worker CSP header | **Documented, not applied** | "Important for enabling" |
| **Model version update procedure** (new URL, download beside old, switch after smoke test, then delete old entries) | **Partly** | Pins give new URLs; no cleanup of stale versions or side-by-side switch described |
| **Telemetry-free in-app measurement** (local counters: load ms, tok/s, failures, shown in settings) | **Missing in-app** | Dev bench only; no network telemetry exists, which is correct |
| Status screen, progress bar, "AI is getting ready" UI | **Not built** | `useLlmStatus` exists; no screen uses it |
| Show non-AI result first | **Designed, not built** | |
| In-app browsers (LINE and similar) report WebGPU but never finish | **Missing** | Low value for a single known phone; skip |

## Not verified, in one list

Chrome 149/150 release notes on Android; any Android Chrome Prompt API trial; Prompt API context
size and latency; usage policy; X Fold5 RAM; measured speed or load time for Qwen3 0.6B,
Qwen3.5 0.8B, Snapdragon 8 Gen 3, 8 Elite, Dimensity 9400; whether 0.2.88 fixes #836; whether
compiled WebGPU pipelines persist between visits on Android Chrome; `connection.type` and Battery
API on Chrome Android; Background Fetch on Android Chrome; Background-Fetch-to-WebLLM-cache
bridging; MediaPipe LLM Inference "maintenance-only" notice on the page itself; LiteRT-LM JS with
a small Qwen on Android Chrome; shard size for Qwen3 0.6B; whether the TVM source read matches the
copy inside WebLLM 0.2.88; SitePoint, HN and Reddit threads (not readable); Notebookcheck's
throttling remark.
