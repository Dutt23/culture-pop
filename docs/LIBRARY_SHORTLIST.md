# Library & research shortlist

Recommended reuse candidates — **not mandatory dependencies**. Before adopting any of them, check
current API, maintenance status, bundle impact and license, and record the result in
`DECISIONS.md`. Nothing below has been verified yet unless marked.

| Library / resource | What it would save | Target phase | Status |
|---|---|---|---|
| [Dexie](https://dexie.org/) + [`useLiveQuery`](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) | Reactive IndexedDB queries across screens | 1 | **In use** (behind repositories) |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | Service worker, offline caching, install | 1 | **In use** |
| [Motion for React](https://motion.dev/docs/react) — [layout animations](https://motion.dev/docs/react-layout-animations), [AnimatePresence](https://motion.dev/docs/react-animate-presence) | Shared-element card→detail morph, exit animations, gestures | 1 | **In use** (D22) — `layoutId` card→detail morph still to do (Phase 5) |
| [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) | Native route transitions, no dependency | 5 | Evaluate against Motion |
| [Radix UI Primitives](https://www.radix-ui.com/primitives) | Accessible dialog/tabs/popover/menu behaviour, unstyled | When a control needs it | Not needed yet |
| [shadcn/ui](https://ui.shadcn.com/) | Reference component source | — | Inspiration only (Tailwind ≠ CSS Modules) |
| [MiniSearch](https://lucaong.github.io/minisearch/) | Offline full-text, prefix, fuzzy, boosting | 2+ when library grows | Not yet — spec §4 requires a benchmark first; keep deterministic exact/alias tiers on top |
| [Fuse.js](https://www.fusejs.io/) | Typo-tolerant phrase search | 2+, if needed | Same as MiniSearch; pick at most one |
| [MediaWiki REST API](https://www.mediawiki.org/wiki/API:REST_API), [cross-site requests](https://www.mediawiki.org/wiki/API:Cross-site_requests) | Encyclopedia search/excerpts from the browser | 2 | Verify CORS, policy, attribution first (§7) |
| [Wikidata REST API](https://www.wikidata.org/wiki/Wikidata:REST_API) | Structured facts: works, characters, dates | 2 | Verify first (§7) |
| [Transformers.js](https://huggingface.co/docs/transformers.js/index) | On-device NLP / small models | 3 | Benchmark only (§5 Phase 3) |
| [WebLLM](https://github.com/mlc-ai/web-llm) — [examples](https://github.com/mlc-ai/web-llm/tree/main/examples) | WebGPU in-browser LLM, structured output | 3 | Benchmark only; WebGPU support on target phones unverified |

**Avoid initially:** GSAP alongside Motion, 3D/WebGL engines, full UI themes, backend services.

Principle: reuse infrastructure (storage, offline, a11y primitives, animation, search), build the
product identity (interpretation, discovery, immersive feel) ourselves.
