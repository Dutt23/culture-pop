# Source inventory

Checked 2026-11-15 against current official documentation and live endpoints. Browser CORS was
tested with an `Origin` header and an `Api-User-Agent` preflight. Fixtures in
`src/services/retrieval/fixtures/` are real responses recorded that day (text CC BY-SA 4.0,
Wikidata CC0, TVmaze CC BY-SA) and are used only by tests. They were recorded with the app's own URL
builders, anonymously, with `Api-User-Agent: PopCultureDecoder-dev/0.2` for Wikimedia hosts only.

## Integrated (Phase 2)

| Source | Endpoint / access | CORS from browser | Auth / key | Limits and etiquette | Licence and attribution | Decision |
|---|---|---|---|---|---|---|
| **Wikipedia (en)** | Action API `https://en.wikipedia.org/w/api.php`, `generator=search` + `prop=extracts|pageprops|info`, `origin=*` | ✅ `access-control-allow-origin: *`; preflight allows `api-user-agent` | None | No fixed read limit; send requests in series, batch with generators, back off on `ratelimited`/429 and honour `Retry-After` (exposed to JS). Identify via `Api-User-Agent` (browsers can't set `User-Agent`). Sources: [API:Etiquette](https://www.mediawiki.org/wiki/API:Etiquette) (edited 2026-05-13), [API:Cross-site requests](https://www.mediawiki.org/wiki/API:Cross-site_requests), [WMF API Usage Guidelines](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines) v1.0 | Text CC BY-SA 4.0 / GFDL ([Terms of Use](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use)). Attribute by hyperlink to the page plus a licence notice. Store only short intro excerpts (≤2 sentences) with link and licence. No white-labelling: the UI names Wikipedia as the provider | **Use** |
| **Wikidata** | Wikidata Query Service `https://query.wikidata.org/sparql` (GET): type via `wdt:P31/wdt:P279*` against a fixed class list, date via `P577`/`P580` | ✅ `access-control-allow-origin: *` | None | 60 s query deadline; 60 s processing per minute per client; 30 error queries/min; 5 parallel per IP; 429 + `Retry-After`, ignoring it risks a temporary ban; User-Agent policy applies ([WDQS User Manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual)). One small query per search (~1–4 KB) | Structured data CC0 ([Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)); attribution not required, shown anyway | **Use**: `wbgetentities` rejected because it returns every claim (~230 KB for one film) |
| **Wikidata external IDs** | Same WDQS query: `?item ?idProperty ?externalId` for P13484/P6760 (Know Your Meme), P6839 (TV Tropes), P13553 (Urban Dictionary), P4086 (MyAnimeList), P8729 (AniList), P6262 (Fandom) | ✅ (same endpoint; preflight allows `api-user-agent`, verified 2026-11-15) | None | Same query, no extra request | CC0; builds tap-only links, the target sites' content is never fetched | **Use** for exact-page links only |
| **Wiktionary (en)** | Action API `https://en.wiktionary.org/w/api.php`, `prop=extracts&explaintext=1`, `origin=*` | ✅ `*`; preflight allows `api-user-agent` | None | Same as Wikipedia | Text CC BY-SA 4.0 / GFDL; attribute with link and licence | **Use** for phrases, idioms and slang only. Not definitive for cultural origin |
| **Wikiquote (en)** (added 2026-11-15) | Action API `https://en.wikiquote.org/w/api.php`, `list=search&srsearch="<phrase>"&srprop=snippet&srlimit=10`, `origin=*` (exact-phrase search; only pages quoting the phrase are kept, at most 3, as "Quoted in" cards) | ✅ `access-control-allow-origin: *`; preflight allows `api-user-agent` (no `max-age`, so each search costs one OPTIONS) | None | Same as Wikipedia ([API:Etiquette](https://www.mediawiki.org/wiki/API:Etiquette)); responses are `cache-control: private, max-age=0` | Text "Creative Commons Attribution-Share Alike 4.0" (`meta=siteinfo&siprop=rightsinfo`). [Wikiquote:Copyrights](https://en.wikiquote.org/wiki/Wikiquote:Copyrights): "much of the content on Wikiquote is derivative of copyrighted material" and asks that "only short quotations" be used. The app keeps one snippet line (≤160 chars, plain text) per page, links the page, and its licence label says the line may be fair use | **Use**, conditional on the one-line limit. Snippets are HTML with entities: tags are stripped and entities decoded, never rendered as HTML. Plain search matches scattered words, so the search is exact-phrase. A page named after the phrase (the work's own page) or a "List of" page is dropped. Limit: "whats up doc" without the apostrophe finds nothing |
| **TVmaze** (added 2026-11-15) | `https://api.tvmaze.com/search/shows?q=` (GET, no key). Plain GET with `Accept` only: no custom header | ✅ `access-control-allow-origin: *` on GET; OPTIONS answers **405**, so `Api-User-Agent` is never sent. No redirect on search (`/lookup/shows` redirects 301: not used) | None | "at least 20 calls every 10 seconds per IP address", 429 beyond; output cached 60 min server-side ([tvmaze.com/api](https://www.tvmaze.com/api)). At most 2 requests per search, follow-up only | "Use of the TVmaze API is licensed by CC BY-SA"; attribution: "linking back to TVmaze" (same page). Data "can freely be used for any purpose" if the licence is met. The app links each show page and labels it TVmaze, CC BY-SA | **Use as enrichment only.** Never searched with the user's text: the demand research (`docs/research/query-demand.md`) found 0/58 matches for queries as typed and 7/7 for canonical show titles. Once Wikidata has classed a Wikipedia hit as a series (animated series, TV series or TV programme), TVmaze is searched for that article title without its disambiguator ("Break Point (2021 TV series)" → "Break Point"), for at most 2 hits. The show merges into the same `wd:` card only when the item's TVmaze ID **P8600** names it (formatter `https://tvmaze.com/shows/$1`, verified 2026-11-15), or when the name is identical and the premiere year equals Wikidata's year. It adds the network and summary as a TVmaze source, and fills a missing year (`premiered`, cited). TVmaze never creates a card. Shows whose name lacks the searched title, or with `score` < 0.5, are dropped |

**Not used:** the RESTBase `/api/rest_v1/` endpoints (`page/summary`, Wiktionary `page/definition`)
work today but are officially deprecated with no removal date
([RESTBase/deprecation](https://www.mediawiki.org/wiki/RESTBase/deprecation)). The Action API is
stable.

**Request pattern per search** (after consent, online, local cache miss): Wikipedia, Wiktionary
and Wikiquote start in parallel, with the search text. Wikidata starts as soon as Wikipedia returns
its IDs; its query also asks for P8600. When Wikidata has answered, TVmaze is asked about the
titles of at most 2 hits Wikidata calls a series. It never receives the search text itself, and is
skipped when there's no series. A failed lookup only marks TVmaze as failed. Each Wikimedia host
gets at most one request at a time. Each request has a
timeout, is cancelled when the query changes, and retries at most twice on 429/5xx, honouring
`Retry-After`. Searches are debounced. The service worker does not cache API responses. Every host
comes from one list (`src/services/retrieval/hosts.ts`), which builds both the HTTP client's
allowlist and the CSP `connect-src`. `Api-User-Agent` goes to Wikimedia hosts only.

## Checked and not integrated

| Source | Checked 2026-11-15 | Why not |
|---|---|---|
| **MusicBrainz** (`musicbrainz.org/ws/2/artist`, `/recording`, `fmt=json`) | Works from a browser: `access-control-allow-origin: *`, no redirect, a browser User-Agent got 200. Preflight allows `Authorization, Content-Type, User-Agent` but **not** `api-user-agent`. Rate limit "(on average) 1 request per second" per IP, 503 beyond ([Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)). Core data CC0, everything else (tags, annotations, ratings) CC BY-NC-SA 3.0 ([Data License](https://musicbrainz.org/doc/About/Data_License)). Search results carry no Wikidata link; that needs a second `inc=url-rels` lookup | The terms can't be met from a browser. [MusicBrainz_API](https://musicbrainz.org/doc/MusicBrainz_API) requires "a meaningful user-agent string" with contact details, which browsers can't set and which its preflight won't take as `Api-User-Agent`. Free use is also limited: "Non-commercial use of this web service is free"; commercial use needs a plan. Revisit with a small server-side proxy that can send a proper User-Agent, plus an owner decision on commercial status. Music stays covered by Wikipedia + Wikidata (song and composition classes) |


**Open item (owner decision):** the etiquette pages ask for contact details in the
`Api-User-Agent` string. The app currently sends `PopCultureDecoder/<version>` without personal
contact details; add a project URL or contact once one exists.

## Link-out only (no ingestion)

| Source | Use | Reason |
|---|---|---|
| Wikipedia search page, DuckDuckGo | User-tapped links | Fallback when evidence is thin (§1) |
| Know Your Meme, Urban Dictionary, Reddit, Wikiquote, IMDb, TVmaze, MyAnimeList | Grouped tap-only search links (templates verified 2026-11-15) | Community or commercial sites without permitted client ingestion; Reddit API closed to new access (secondary sources); Urban Dictionary API needs express permission (§2, §7) |
| Exact pages on Know Your Meme, TV Tropes, Urban Dictionary, MyAnimeList, AniList, Fandom | Tap-only, from Wikidata IDs | Links only; content never fetched |
| Full candidate survey | `docs/research/source-candidates.md` | Wikiquote and TVmaze now integrated (above); Hindi Wikipedia is the next ingest candidate (owner to decide) |
| "Where people talk about it": Know Your Meme, Urban Dictionary, Reddit search | Shown first when there's no curated answer and online search found nothing, or found only works and pages about people for a phrase-like query (D34) | Same templates as the grouped search links; tap-only |
| TMDB, GIPHY, YouTube | Not integrated | Need keys or a backend; excluded by §2 |

All seeded demo content is original text written for this app (`provenance=seed_curated`) and cites
no sources.
