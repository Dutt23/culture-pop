# Source inventory

Phase 1 integrates **no** external data sources and makes no automatic network requests.

| Source | Use in Phase 1 | Access method | Checked | Decision |
|---|---|---|---|---|
| Wikipedia search page | User-tapped link only (`https://en.wikipedia.org/w/index.php?search=…`) | Browser navigation, new tab | Not checked (no integration) | Link-out only |
| DuckDuckGo search page | User-tapped link only (`https://duckduckgo.com/?q=…`) | Browser navigation, new tab | Not checked (no integration) | Link-out only |

All seeded content is original demo text written for this app (`provenance=seed_curated`) and
cites no sources.

Phase 2 must, before any adapter is built, verify current official documentation, endpoint,
browser CORS, authentication, quota, attribution, licensing and caching rights for each candidate
(Wikipedia/MediaWiki REST, Wikidata, Wiktionary first) and record them here. Until then every
candidate is **NOT VERIFIED**.
