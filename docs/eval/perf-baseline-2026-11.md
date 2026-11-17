# Performance baseline, Phase 5 step 1 (2026-11-17)

Nothing was changed for this report. It is the "before" every Phase 5 speed fix is compared with.

**How it was measured.** Production build (commit `05bdf6e` plus the Phase 5 plan doc), served by
`vite preview`, driven by Playwright's Chromium on a MacBook with a phone profile: 390×844 Pixel 5
viewport and user agent, CPU slowed 4×, network "Slow 4G"-like (150 ms round trip, 1.6 Mbps down).
Load numbers are the median of 3 runs. These are **lab numbers for comparing before and after a
change, not what a real phone will show**; the owner's phone check (step 10) is the real-device
look. Battery use was not measured (no reliable way from a laptop).

Re-run with:

```bash
node scripts/perf/bundle-breakdown.mjs <build folder made with vite build --sourcemap>
```

```bash
npm run build && npm run preview -- --port 4174
```

```bash
node scripts/perf/measure.mjs http://localhost:4174
```

## Bundle

First load (Discover) downloads two JS chunks: **about 530 KB minified, 178 KB gzip**, plus 4 KB of CSS.
Search adds 48 KB (16 KB gzip), a reference page 9 KB, Settings 5 KB.

What fills the first load (minified bytes, attributed through source maps):

| Package or folder | KB | Needed on Discover? |
|---|---|---|
| react-dom | 202 | yes |
| dexie (IndexedDB) | 95 | yes: the library is read on first screen |
| motion (animations) | 69 | partly: card entry animations only |
| react-router | 38 | yes |
| `src/services/retrieval` + rxjs | 40 | **no**: online search runs only on Search |
| `src/data/seed.ts` (16 demo entries) | 11 | only on the very first open |
| double-metaphone (sound-alike search) | 6 | no: search only |
| everything else (app code, react, scheduler) | ~70 | mostly yes |

## Load (phone profile)

| | First visit | Return visit (service worker cache) |
|---|---|---|
| Discover heading visible | 1,681 ms | 174 ms |
| First contentful paint | 1,416 ms | 92 ms |
| Largest contentful paint | 1,616 ms | not recorded (paint came from cache before the observer fired) |
| Long tasks (main thread blocked >50 ms), total | 125 ms | 0 ms |
| Transferred | 179 KB | 0 KB |

## Typing in the search box

Five searches typed one key at a time, 120 ms apart (53 characters, on Search with the library
answering; online search off, so no network).

- Every key's handling took over 16 ms (one frame) at 4× slowdown: 167 key and input events.
- Of those, 75% took 24 ms or less; the worst took 104 ms.
- One long task (64 ms) in the whole run.

Web guidance treats under 200 ms for the slowest interaction as good; this is well under it, but
each key costing more than a frame is worth a look in step 2 (the results list re-renders on every
key).

**Not measured yet:** typing and scrolling while online results stream in. It needs the mocked
providers from `e2e/retrieval.spec.ts`; done in step 2 before touching that code.

## Memory

JavaScript heap after garbage collection: **4.3 MB** after the first load, **4.1 MB** after 20
searches. No growth, so no leak shows up in this run.

## Storage

Browser storage in use after the first open: **1.3 MB** (most of it the service worker's cached app
files). The library itself, as JSON: 16 references 5.6 KB, 19 interpretations 11.8 KB, 39 aliases
5.4 KB, about 23 KB together, roughly 1.4 KB per reference.

**Projection, not measured:** 50 references found online, each with sources, would add roughly
150 KB. The spec's 25 MB monitoring target is far away, so **no eviction (LRU) is needed**; step 6
shows the numbers to the reader instead.

## What step 2 should look at, in order

1. **Load online search only on Search** (~40 KB off first load). The retrieval service and rxjs
   are created at app start but Discover never searches.
2. **Motion is 69 KB** although the app uses `LazyMotion` with `domAnimation` (expected nearer
   20–30 KB): something imports the full bundle. Find it.
3. **Each key costs more than a frame**: check what re-renders while typing.
4. Measure online results streaming in (above), then decide.

Not worth it: react-dom, dexie and react-router are needed on the first screen; the seed is 11 KB.

## Step 2 results (2026-11-17)

**1. Online search loads only on Search: done.** The live retrieval service (Wikimedia, TVmaze,
wider web, rxjs) used to be built by the app-wide provider at start. Now `RetrievalContext.tsx`
holds only types and the context, and `useRetrievalService` (`src/app/retrievalService.ts`), which
only the on-demand screens import, builds one shared service on first use. Tests still inject
theirs.

| | Before | After |
|---|---|---|
| Main chunk | 332 KB (108 KB gzip) | 286 KB (93 KB gzip) |
| First-load JS, both chunks | ~540 KB (178 KB gzip) | ~494 KB (163 KB gzip) |
| Transferred on first open (phone profile) | 179 KB | 164 KB |
| New on-demand chunk `retrievalService` | — | 46 KB (15 KB gzip), loaded by Search or Settings |

Load times in two runs after the change: Discover visible 1,423 and 1,596 ms (baseline 1,681 ms);
first paint 1,284 and 1,312 ms (baseline 1,416 ms). Runs vary by up to about 250 ms, so the honest
claim is "15 KB less to download, likely a little faster", not a number of milliseconds.

**2. Motion: guess was wrong, left as is.** The source maps show only the `domAnimation` features
(animations, hover, focus, press; no layout or drag), about 69 KB minified, 22 KB gzip, which is
what that feature set costs. Loading it after the first paint was considered and not done: the page
header and cards start hidden and fade in, so a late feature load would keep the first screen
blank longer than the ~15 KB gzip it saves.

**3. Typing: no change needed.** Two more runs: 75% of key events at 16–24 ms, worst 64–88 ms
(baseline 104 ms), one long task. All well under 200 ms; the differences are run-to-run noise.

**4. Typing while online results stream in: measured, no change needed.** Recorded provider answers
held back 300–900 ms each, three lookups started while typing, then a scroll. Two runs: no long
tasks at all; 75% of events at 24–32 ms, worst 40–56 ms. `scripts/perf/measure.mjs` now includes
this scenario.

Step 2 is done: one change made, three checked and left alone because the numbers don't call for
them.
