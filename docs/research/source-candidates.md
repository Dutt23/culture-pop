# Source candidates beyond Wikimedia

Checked 2026-11-15. Scope: where Pop Culture Decoder could search or link beyond the integrated
Wikipedia, Wiktionary and Wikidata adapters, judged against the brief's rules: no backend, no keys (§5 Phase 2
"API key rule"), community meme/slang sites link-only (§5 Phase 2 "Meme/slang rule"), source
requirements (§7). Format follows `docs/SOURCE_INVENTORY.md`.

**Method and limits.** Anonymous GET and OPTIONS only, a handful of requests per host, User-Agent
`PopCultureDecoder-research/0.1` (no contact data). CORS test = `Origin: https://example.app` on GET, plus an
OPTIONS preflight with `Access-Control-Request-Headers: api-user-agent`. No logins, no HTML scraping, no
bypassing of blocks. Where a host answered 403 to curl (Cloudflare or similar), I stopped and recorded it.
Several terms pages that blocked direct fetch (Fandom ToS, AniList docs) were read through a search
tool's index, not re-requested; quotes below come from those copies. HTTP status for link-outs comes from a
HEAD request: it proves the host answers, not that the page renders in a browser. Anything not
checked is marked **NOT VERIFIED**. Nothing here was filled from memory.

Rule recap used for verdicts: **ingest** = public, no key/OAuth, browser-CORS works, terms allow client
use and short-excerpt caching with attribution. **link-out only** = a tapped link is fine, ingestion is
not permitted or unclear. **exclude** = not usable even as a link, or dead.

## Summary table

| Source | Covers / fit | Access | Browser CORS (GET, `Origin: https://example.app`) | Limits | Licence / terms (key line) | Verdict |
|---|---|---|---|---|---|---|
| **Wikidata external IDs** (via existing WDQS query) | Bridges an entity to KYM (P6760/P13484), TV Tropes (P6839), Urban Dictionary (P13553), MyAnimeList (P4086), AniList (P8729), Fandom (P6262) pages | WDQS, no key | `*` (already integrated) | WDQS limits in SOURCE_INVENTORY | CC0 | **ingest** (IDs only) |
| **Wikiquote (en)** | Film/TV/cartoon/anime quotes by work | Action API `en.wikiquote.org/w/api.php`, no key | `*`; preflight allows `api-user-agent` | WMF etiquette | Text CC BY-SA 4.0; quotes themselves are "used under the fair use clause" | **ingest** (short lines + link) |
| **Wikipedia other languages** (hi tested) | Indian films, shows, phrases in Hindi and other languages | Same Action API per language | `*` (hi tested) | Same as en | CC BY-SA 4.0 | **ingest** |
| **TVmaze** | TV and animation metadata; some Indian TV | `api.tvmaze.com`, no key | `*` on GET; OPTIONS returns 405 (no preflight needed for a plain GET) | "at least 20 calls every 10 seconds per IP"; 429 on excess | "licensed by CC BY-SA"; credit TVmaze by link | **ingest** |
| **AniList** | Anime and manga metadata, ID mapping | GraphQL POST `graphql.anilist.co`, no key for reads | Preflight (POST, `content-type`): ACAO `*`, allows `Content-Type`. POST body itself not sent (GET/OPTIONS only rule) | 90/min nominal, **30/min currently ("degraded")**; burst limiter | Free non-commercial; "Hoarding or mass collection of data ... is strictly prohibited"; "backup or data storage service is strictly prohibited" | **ingest (conditional)** |
| **MusicBrainz** | Artists, recordings, releases | `musicbrainz.org/ws/2`, no key | `*` on GET. Preflight allows `Authorization, Content-Type, User-Agent` but **not** `api-user-agent` | 1 req/s per IP; first request got 503 "busy" | Core data CC0; supplementary CC BY-NC-SA 3.0 | **ingest (conditional)** |
| **Fandom wikis** | Deep fan-wiki detail for shows, cartoons, games, anime | MediaWiki `*.fandom.com/api.php` | `*` **only with `origin=*`**; without it no ACAO header | Not published | Text CC BY-SA 3.0 by default; ToS bans "robot, spider, scraper or other automated means" without written permission | **link-out only** |
| **Know Your Meme** | Best meme origins and spread | No public API found | n/a | n/a | Terms (Literally Media): no "monitor, scrape, index, or otherwise copy ... by means of any robot" | **link-out only** |
| **Urban Dictionary** | Slang (crowd-sourced) | Undocumented `api.urbandictionary.com/v0/define` | `*` (works) | Not published | "Access to the Urban Dictionary API is available only with the express permission of Urban Dictionary" | **link-out only** |
| **TV Tropes** | Tropes, catchphrases | No API | n/a | n/a | Content CC BY-NC-SA 3.0; staff post: "We hard-block anyone who tries to scrape the site" (2018) | **link-out only** |
| **Reddit** | Discussions, r/OutOfTheLoop answers | OAuth only | `search.json` returned **403 HTML** to anonymous GET | 100 QPM per OAuth client; new access requests closed 2026-10-31 (secondary source) | "Clients must authenticate with a registered OAuth token" | **link-out only** |
| **IMDb** | Titles, cast | Paid API only via AWS Data Exchange; free TSV datasets | n/a | n/a | "You may not use data mining, robots, screen scraping"; datasets "personal and non-commercial use" | **link-out only** |
| **TMDB** | Film/TV metadata, Indian titles | API key required | NOT TESTED (needs key) | Not stated in FAQ | Free non-commercial with attribution; "Cache, for longer than 6 months" restricted; key rule §5 | **exclude** (link-out OK) |
| **OMDb** | IMDb-derived film data | `apikey` required | NOT TESTED (needs key) | NOT VERIFIED | NOT VERIFIED | **exclude** |
| **Jikan (MAL)** | Anime/manga via MyAnimeList | Unofficial REST | **NOT VERIFIED**: host timed out on 4 attempts from this network | 60/min, 3/s (README) | "scrapes the website"; "not affiliated with MyAnimeList.net" | **exclude** |
| **Kitsu** | Anime/manga | `kitsu.io/api/edge`, no key for GET | `*`; preflight allows `api-user-agent` | Not published | **NOT VERIFIED**: terms page would not render | hold: not cleared |
| **Open Library** | Books only | `openlibrary.org/search.json`, no key | `*` on GET; preflight 400 for `api-user-agent` | 1 req/s; 3 req/s with UA+email; "do not ... bulk download" | Data licence not stated on the API page: **NOT VERIFIED** | hold: low fit, licence unclear |
| **iTunes Search** | Songs, films, TV (store catalogue) | No key | `*`; preflight allows `api-user-agent` | NOT VERIFIED | Use "only to promote store content and not for entertainment purposes" | **exclude** |
| **GIPHY** | GIFs | API key (beta 100 calls/hour) | NOT TESTED (needs key) | 100/hour beta | "Do not cache API responses or media URLs"; "Powered by GIPHY" required | **exclude** |
| **Tenor** | GIFs | **API shut down 2026-06-30** | n/a | n/a | n/a | **exclude** |
| **Genius** | Lyrics, annotations | OAuth for every request | NOT TESTED | n/a | "All API requests must be authenticated"; "Commercial use ... not allowed without a license" | **exclude** |
| **Merriam-Webster API** | Dictionary | API key | NOT TESTED | 1,000/day/key | Free for non-commercial use only | **exclude** |
| **Dictionary.com** | Dictionary | No public API found (**NOT VERIFIED**, one search) | n/a | n/a | n/a | **exclude** (link-out unverified) |
| **Free Dictionary API** (dictionaryapi.dev) | Dictionary | Community project, no key | `*`; preflight allows `api-user-agent` | `x-ratelimit-limit: 450` | Repo is GPL-3.0 code; data provenance unclear (README tags it a Google-dictionary scraper). `yeet` returned 404 | **exclude** |
| **Datamuse** | Word-finding (rhymes, "means like") | No key today | ACAO reflects origin | 100,000/day/key | "starting February 1, 2027, an API key will be required in all requests" | **exclude** |
| **Imgflip `get_memes`** | Top ~100 meme templates (names, images) | No key for this endpoint | `*` | NOT VERIFIED | User-uploaded images; no explanations; search is Premium | **exclude** |
| **Know This Meme, Memefile** | Meme explainers / browse | No API found | n/a | n/a | Not checked | **link-out only** (Memefile); Know This Meme search URL 404 |

## Evidence by source

### Wikidata as a link-out bridge (new, no new hosts)
Wikidata has external-ID properties for the community sites the brief limits to links. Property search
(`wbsearchentities`, type=property) found: Know Your Meme numeric ID **P6760**, KYM slug **P13484**, TV Tropes ID
**P6839**, Urban Dictionary ID **P13553**, MyAnimeList anime **P4086**, AniList anime **P8729**, Fandom article
**P6262**, TMDB movie **P4947**, TMDB TV **P4983**. Formatter URLs (P1630) read from Wikidata: KYM
`https://knowyourmeme.com/memes/$1`, TV Tropes `https://tvtropes.org/pmwiki/pmwiki.php/$1`, Urban Dictionary
`https://www.urbandictionary.com/define.php?term=$1`, MAL `https://myanimelist.net/anime/$1`, AniList
`https://anilist.co/anime/$1`, Fandom `https://community.fandom.com/wiki/w:c:$1`.
Coverage by SPARQL count: TV Tropes 23,018 items; KYM slug 3,786 (numeric ID 296); Urban Dictionary 356;
MAL anime 7,436; Fandom 246,679. Example: the item "Rickrolling" (Q695677) returned KYM slug `rickroll` and TV Tropes
`JustForFun/Rickroll`. This yields a *deep* link to the exact KYM or TV Tropes page without contacting those
sites, which matches §5 ("external links only") and keeps data CC0 ([Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)).
KYM coverage is thin, so keep the generic search link as fallback.

### Wikiquote
Live test: `list=search` and `prop=extracts&explaintext=1` both work with `origin=*` (`access-control-allow-origin: *`,
preflight `access-control-allow-headers: api-user-agent`). Licence from `meta=siteinfo&siprop=rightsinfo`:
"Creative Commons Attribution-Share Alike 4.0". Caveat from
[Wikiquote:Copyrights](https://en.wikiquote.org/wiki/Wikiquote:Copyrights) (draft policy page): "though Wikiquote content is
licensed under the CC-BY-SA and the GFDL, much of the content on Wikiquote is derivative of copyrighted material and
is used under the 'fair use' clause of U.S. copyright law." So CC BY-SA does not clear the underlying lines for
reuse. Store at most one short line with its page link, as the brief's "Respect copyright, quotes" requires; show the
page as the citation. Same WMF etiquette and Terms of Use as Wikipedia.

### Wikipedia other languages
`hi.wikipedia.org/w/api.php?...&origin=*` returned 200, ACAO `*`, 372 hits for "शोले". This is the
best verified route for Indian pop culture (Hindi film, TV, phrases) and needs only a host/language parameter in the
existing adapter. Other Indian-language editions (ta, te, bn, ml, mr) were **not tested**; same software, so expect the
same headers, but NOT VERIFIED. Licence as in SOURCE_INVENTORY.
Wikimedia Pageviews (`wikimedia.org/api/rest_v1/metrics/pageviews/...`) also returned ACAO `*` and a preflight
allowing `api-user-agent`; it could break ties between interpretations, but its data licence was **not checked**.

### TVmaze
Docs ([tvmaze.com/api](https://www.tvmaze.com/api)): "All endpoints are CORS ... enabled"; "Use of the TVmaze API is licensed by" CC BY-SA;
credit TVmaze with a link; 20 calls per 10 s per IP; output cached 60 minutes server-side; images may be cached, but
image rights belong to their owners, so link or hotlink rather than store. Live test `search/shows?q=simpsons`: 200, ACAO `*`.
Indian coverage probe (4 queries): Taarak Mehta Ka Ooltah Chashmah (IN, 2008) found; Shaktimaan (IN, 1997) found; Sacred Games
(2018) found; Chhota Bheem not found. Good for TV/animation and dates, weak for memes, quotes and Indian animation.

### AniList
Docs: "Free for non-commercial usage"; "Using the AniList API as a backup or data storage service is strictly prohibited";
"Hoarding or mass collection of data ... is strictly prohibited"; apps must follow naming rules; commercial use under $150
revenue per month is free. Rate page: "currently in a degraded state and is limited to 30 requests per minute", nominal 90.
All queries are POST (`graphql.anilist.co` answered GET with "Use POST request"). Preflight for POST+`content-type`:
`access-control-allow-origin: *`, allow-methods `GET, POST, OPTIONS`, allow-headers include `Content-Type`.
The actual POST response was not sent (rule: GET/OPTIONS only), so response CORS headers are NOT VERIFIED
(the rate-limit headers are listed in `access-control-expose-headers`). Condition: query on demand, cache only
what a user saves, never prefetch catalogues.

### MusicBrainz
Docs ([Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)): "1 request per second"; requests need a meaningful
User-Agent, else they are "anonymous" and throttled with 503. Browsers cannot set `User-Agent`, and the preflight does
not list `api-user-agent`, so a browser app can only send its default UA. My first anonymous call returned `503 ... busy`
(then `200` on retry with `access-control-allow-origin: *`); whether a default browser UA is accepted reliably is
**NOT VERIFIED**. Licence ([Data License](https://musicbrainz.org/doc/About/Data_License)): core data CC0; supplementary
data CC BY-NC-SA 3.0. Use for song/artist/release dates only.

### Fandom
`api.php` works: `list=search` returned titles, ACAO `*` only when `origin=*` was sent (the no-origin request had no ACAO
header). `prop=extracts` is **not available** ("Unrecognized value for parameter prop: extracts"), search snippets came
back empty, so usable text would need `action=parse`/revisions wikitext, which is heavy. Licensing page: "the text on Fandom
communities ... is licensed under the Creative Commons Attribution-Share Alike License 3.0"; "Some wikis use licenses other than
the CC BY-SA license"; media "should not be assumed to be available under the same license". Terms of Use (revised 2025-12-19)
say users agree not to "use any robot, spider, scraper or other automated means to access the Services for any purpose without
our express written permission", and not to "use or copy the content for ... training a machine learning or AI system"; an
archive-team forum post reports cease-and-desist letters for crawling. The licence page allows text reuse; the ToS bans
automated access: that conflict is why this is link-out until Fandom clarifies in writing. Also CC BY-NC wikis exist.
Search pages (`/wiki/Special:Search`, `fandom.com/?s=`) returned a Cloudflare challenge (403) to curl, so a search link
template is NOT VERIFIED here; per-wiki links from Wikidata P6262 are safer.

### Know Your Meme
Terms for `knowyourmeme.com` (Literally Media Ltd, [literally.media/terms-and-conditions](https://literally.media/terms-and-conditions/), updated Nov 2023):
"To monitor, scrape, index, or otherwise copy any of the material on the Sites by means of any robot, spider, or other
automatic device ... regardless of whether such use may be considered a fair use". Personal non-commercial licence only. No public API
found in this search (absence not proven). Search URL HEAD: 200.

### Urban Dictionary
Terms ([urbandictionary.help/tos](https://urbandictionary.help/tos/)): "Access to the Urban Dictionary API is available only with
the express permission of Urban Dictionary and is governed by the Urban Dictionary API Terms of Service." The
`/v0/define` endpoint answers anonymous GET with ACAO `*` (tested, 200), but it is undocumented, so CORS openness is not permission.
Entries are user-written and may be NSFW. Link-out HEAD: 200.

### TV Tropes
Content licence: the site's own licence page lists "TV Tropes is under a CC BY-NC-SA 3.0 license" (non-commercial; an app is
fine only if non-commercial, but ingestion is also blocked in practice): staff on the TV Tropes forum (2018): "We hard-block anyone who tries to
scrape the site without advance permission". Terms page: [tvtropes.org/pmwiki/termsofservice.php](https://tvtropes.org/pmwiki/termsofservice.php). The
search URL I tried (`/pmwiki/search_result.php?q=`) returned 403 to curl, so it is NOT VERIFIED; use the Wikidata P6839 deep link.

### Reddit
`https://www.reddit.com/search.json?q=skibidi` returned 403 (HTML block page) to anonymous GET. Data API Wiki: "Clients must
authenticate with a registered OAuth token"; "Traffic not using OAuth or login credentials will be blocked"; 100 QPM per client.
Data API Terms: "you will not misrepresent or mask either the user agent or OAuth identity". Two 2026 trade posts report that
unauthenticated `.json` died around May 2026 and new access requests closed 2026-10-31 (secondary sources, not Reddit
announcements: [FetchLayer](https://fetchlayer.dev/blog/reddit-api-pricing), [Reddireach](https://www.reddireach.com/blog/reddit-api-pricing)). Link-out
`/search/?q=` HEAD: 200. Do not link to scrape-style `.json`.

### IMDb, TMDB, OMDb
IMDb [Conditions of Use](https://www.imdb.com/conditions): "You may not use data mining, robots, screen scraping, or similar
data gathering and extraction tools on this site". [Help: use of data](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX):
data "can only be used for personal and non-commercial use and must not be ... republished ... to create any kind of online/offline database".
Official API is "exclusively available through AWS Data Exchange" ([developer.imdb.com](https://developer.imdb.com/documentation/api-documentation/getting-access)), needing an AWS account. `/find` HEAD: 202 (bot gate; works
for people, not verified here).
TMDB [FAQ](https://developer.themoviedb.org/docs/faq): key required; free "for non-commercial purposes as long as you attribute TMDB";
[API terms](https://www.themoviedb.org/api-terms-of-use) restrict caching "for longer than 6 months". The brief excludes it (§5). OMDb page requires `apikey`;
its terms were not read: NOT VERIFIED.

### Others
- **Jikan**: README: "It scrapes the website"; "not affiliated with MyAnimeList.net". Four attempts timed out at TCP connect
  (`135.181.39.91:443`), so no CORS evidence. Exclude; AniList covers the same need through an official API.
- **Kitsu**: GET and preflight both fine (`access-control-allow-origin: *`, allows `api-user-agent`); docs: "Authentication is not
  required for most public-facing GET endpoints". Terms page (`kitsu.io/terms`) returned only tracker markup, so the data terms are NOT VERIFIED.
- **Open Library**: "do not use our APIs to bulk download metadata"; 1 req/s default. Books are off-brief.
- **iTunes**: ACAO `*`, but terms limit use to promoting store content.
- **GIPHY**: [docs](https://developers.giphy.com/docs/api/): "Do not cache API responses or media URLs"; beta keys 100 calls/hour; keys are not allowed client-side under the brief.
- **Tenor**: The Verge (2026-06-30): Google "prepares to shut down the Tenor API today"; new sign-ups stopped 2026-01-13.
- **Genius**: [docs](https://docs.genius.com/) above. Lyrics are copyrighted; no value for this app.
- **Datamuse**: [datamuse.com/api](https://www.datamuse.com/api/): key required from 2027-02-01. It finds related words, not cultural explanations.
- **Quote hobby APIs** (Animechan: 100 req/day free; tv-quotes-api: 111,173 quotes; Peep Show, Archer APIs found on Reddit):
  community-run, no licence statements for the scripts they carry, copyrighted lines. Exclude. Terms of each: NOT VERIFIED.
- **Indian sources**: no official, keyless Bollywood or OTT API found. Hindi (and other) Wikipedia + Wikidata + TVmaze (partial) are the
  verified options. Kaggle CSVs labelled CC0 are derived from IMDb/TMDB scrapes, so the CC0 label does not clear provenance. A
  Bollywood.ai agent API exists but catalogues AI-generated Hindi videos, not cultural references. TraxDinosaur's "Movies-Series-Api"
  is a scraper wrapper. Letterboxd search link returned 403 to curl. Not evaluated: TheTVDB, Trakt, Simkl, Last.fm, Discogs, Spotify,
  YouTube (all NOT VERIFIED; the brief already treats key/OAuth services as excluded).

## What the community actually uses (Reddit and forums)

Direct Reddit access is blocked (403), so threads were found through a search index; sample is small and skewed old.
- r/OutOfTheLoop pinned advice ([2013 thread](https://www.reddit.com/r/OutOfTheLoop/comments/1r0sdz/hey_you_thinking_about_asking_a_question_try/)): try Know Your Meme and Urban Dictionary first. Same answer in
  r/findareddit ([2018](https://www.reddit.com/r/findareddit/comments/9mnmx2/a_subreddit_for_people_looking_for_the_origins_of/)).
- Know Your Meme's own guide ([Meme Research 101](https://knowyourmeme.com/editorials/guides/meme-research-101-precision-googling)) and a 2026 how-to
  ([giveupinternet.com](https://giveupinternet.com/blog/how-to-find-a-memes-origin/)): Google date-ranged search, TinEye, the Wayback Machine, X advanced
  search, then KYM. A useful point for the app: an origin has up to three dates (source, first meme use, viral moment); show them separately.
- Developers who wanted programmatic access built scrapers (r/Python `memedict`, `culturgen`) or posted an Urban Dictionary dump to r/datasets (2017). Both
  are exactly what the brief forbids. I found no thread recommending a licensed meme or slang API.
- r/learnpython (2025) on a Fandom API: the answer was to read the ToS ban on scraping.
- Indian meme culture: r/OutOfTheLoop answers and KYM entries ("Indian Guy on YouTube") exist, but no Indian-specific source with an API turned up
  (r/IndianDankMemes and similar were not retrievable here; NOT VERIFIED).

## Link-out templates

`{q}` = `encodeURIComponent(query)`. Status = HEAD request on 2026-11-15 (host answers; page rendering in a browser not checked).

| Site | Template | Status |
|---|---|---|
| Know Your Meme | `https://knowyourmeme.com/search?q={q}` | 200 |
| Urban Dictionary | `https://www.urbandictionary.com/define.php?term={q}` | 200 |
| Reddit | `https://www.reddit.com/search/?q={q}` | 200 |
| Wikiquote | `https://en.wikiquote.org/w/index.php?search={q}` | 200 |
| TMDB | `https://www.themoviedb.org/search?query={q}` | 200 |
| IMDb | `https://www.imdb.com/find/?q={q}` | 202 (bot gate) |
| MyAnimeList | `https://myanimelist.net/search/all?q={q}` | 200 |
| AniList | `https://anilist.co/search/anime?search={q}` | 200 |
| TVmaze | `https://www.tvmaze.com/search?q={q}` | 200 |
| MusicBrainz | `https://musicbrainz.org/search?query={q}&type=artist` | 200 |
| Open Library | `https://openlibrary.org/search?q={q}` | 200 |
| Memefile | `https://memefile.com/search/?q={q}` | 200 after redirect from `/search?q=` |
| TV Tropes search | `https://tvtropes.org/pmwiki/search_result.php?q={q}` | **403 to curl: NOT VERIFIED** |
| Genius | `https://genius.com/search?q={q}` | **403 to curl: NOT VERIFIED** |
| Dictionary.com, Merriam-Webster | `/browse/{q}`, `/dictionary/{q}` | **403 to curl: NOT VERIFIED** |
| Fandom | `fandom.com/?s={q}` and `/wiki/Special:Search` | **403 challenge: NOT VERIFIED** |
| Know This Meme | `https://knowthismeme.com/search?q={q}` | **404: do not use** |
| Letterboxd | `/search/{q}/` | **403 to curl: NOT VERIFIED** |

## Recommended next

Ingest candidates, ranked by value per effort and rule fit:
1. **Wikidata external IDs** (extend the existing SPARQL with OPTIONAL P6760/P13484, P6839, P13553, P4086/P8729, P6262). No new host, CC0, turns
   KYM / TV Tropes / UD / MAL / AniList / Fandom into exact-page link-outs only when the entity has the ID.
2. **Wikiquote** adapter for quote-shaped queries (same MediaWiki code path as Wikipedia). Store one short line + link; carry the fair-use caveat in the UI copy.
3. **Wikipedia in Hindi and other Indian languages** (language parameter on the existing adapter; test ta/te/bn/ml/mr headers first).
4. **TVmaze** for TV and animation works (dates, network, genres, summary under CC BY-SA, credit link). Partial Indian coverage.
5. **AniList** (conditional): anime only, on-demand queries, no catalogue prefetch, respect the 30/min degraded limit, "unofficial" naming rule. Needs an owner call on
   the "data storage" clause versus caching saved references.
6. **MusicBrainz** (conditional): music only, 1 req/s, must confirm a default browser UA is accepted before building.

Link-outs to add (tap only, never fetched): Know Your Meme, Urban Dictionary, Reddit (r/OutOfTheLoop is the community's own answer
to "what is this"), TV Tropes via Wikidata ID, IMDb, TMDB, MyAnimeList, Wikiquote, Genius only after a browser check. Keep the user-triggered
disclosure: a link-out sends the query to that site only on tap.

Not recommended: Fandom (ToS vs licence conflict), Jikan, Kitsu (terms unread), Open Library (off-brief), Datamuse, Free Dictionary API,
Imgflip, iTunes, GIPHY, Tenor, Genius API, Merriam-Webster, hobby quote APIs, IMDb/TMDB/OMDb data.

Open items for the owner: (a) whether to email Fandom and Know Your Meme for written API permission; (b) AniList "data storage" reading;
(c) project contact for `Api-User-Agent` (already open in SOURCE_INVENTORY); (d) browser-verify the link-out templates marked NOT VERIFIED.
