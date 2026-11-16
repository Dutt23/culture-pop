# Comics sources research (checked 2026-11-15)

Scope: is anything better than, or alongside, Wikipedia and Wikidata for comic characters (e.g. Doctor Doom), series, graphic novels and manga, under the rules: browser only, no key, no OAuth, no proxy, no paid plan, terms allow it.

Method: curl from this machine, `User-Agent: PopCultureDecoder/0.2`, no contact data, a handful of requests per host, spaced out, nothing signed up for. CORS tested with `Origin: https://example.com` on real requests (GET, and POST for AniList). Wikidata counts and property lookups used WDQS SPARQL. Where a host blocked curl (Cloudflare challenge, Anubis, 402/403) I stopped and say so. Anything not read or tested is marked NOT VERIFIED. I did not redo the Reddit and Fandom ToS work in `docs/research/source-candidates.md`; changes to it are listed at the end.

## Verdict table

| Source                             | Public API?                                | Keyless + browser CORS (tested)                                                                                                                                                                                                                          | Terms / licence                                                                                                                                                           | Rate limit                                                                                          | Character data                                                                                                                                                                                                                | Verdict                                                                                                                                           |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comic Vine                         | Yes, key required                          | `GET /api/search/?...` without key: 401 `{"error":"Invalid API Key"}`; no `access-control-allow-origin` on the response; OPTIONS returned 404. Docs list `jsonp` format. A key in client code breaks the no-key rule anyway                              | Key per user and per site, "strictly for non-commercial use only", "link back to us" on any page using data, caching "suggested"                                          | "200 requests per resource, per hour", plus velocity blocks                                         | Best of the set: `first_appeared_in_issue`, `creators`, `story_arc_credits`, `issue_credits`, `volume_credits`, `count_of_issue_appearances`, `origin`, `powers`, `teams`, `character_enemies/friends`, `deck`, `description` | **Backend phase** (non-commercial only). Link-out now via Wikidata P5905                                                                          |
| Marvel developer API               | Was yes, key + hash                        | `developer.marvel.com` now 301-redirects to `www.marvel.com`. `gateway.marvel.com/v1/public/characters` returns `500 {"message":"Internal server error"}` with and without a fake key (two tries)                                                        | n/a                                                                                                                                                                       | n/a                                                                                                 | n/a                                                                                                                                                                                                                           | **Reject: appears retired.** No official shutdown notice found; third-party catalogue says the same (Aug 2026)                                    |
| DC API                             | None found                                 | n/a                                                                                                                                                                                                                                                      | n/a                                                                                                                                                                       | n/a                                                                                                 | n/a                                                                                                                                                                                                                           | **Reject** (absence not proven; one search, dccomics.com not checked directly)                                                                    |
| Grand Comics Database (comics.org) | Yes, REST (Django REST framework), `/api/` | Anonymous GET `/api/series/?format=json`: 200 JSON (234,353 series), but **no `access-control-allow-origin`**; OPTIONS returns `allow: GET, HEAD, OPTIONS` and no CORS headers. HTML pages and docs.comics.org give a Cloudflare challenge/block to curl | Site footer (via search index, direct fetch 403): CC BY-SA 4.0. GCD wiki page for the API has no terms text                                                               | Wiki: anonymous 30/hour (testing only, "will likely change"), registered 25/min and 2,000/day       | **No character endpoint.** OpenAPI schema lists only issue, publisher, series. Issue detail has stories, credits, cover URL; characters appear as text                                                                        | **Backend phase** for series/issue/creator data. Link-out via Wikidata P14738 / P3589                                                             |
| Metron (metron.cloud)              | Yes, REST                                  | `GET /api/character/?name=doom`: 401 `Authentication credentials were not provided`, `www-authenticate: Basic realm="api"`. No CORS header seen                                                                                                          | Data licence NOT VERIFIED (docs/ToS not readable: site is behind Anubis; Metron docs site has no licence text)                                                            | Per account: 20/min burst, 5,000/day                                                                | Has a character endpoint (path exists, behind auth); field list NOT VERIFIED                                                                                                                                                  | **Backend phase at best**, needs a registered account; licence unknown. Reject until licence read                                                 |
| League of Comic Geeks              | No public API found                        | Site returns a Cloudflare managed challenge (403) to curl                                                                                                                                                                                                | No licence found. Metron README (secondary) says their API is retailer-only                                                                                               | n/a                                                                                                 | n/a                                                                                                                                                                                                                           | **Link-out only** (and the link template is NOT VERIFIED in a browser)                                                                            |
| Fandom wikis (marvel, dc)          | MediaWiki `api.php`                        | **Yes with `origin=*`**: `access-control-allow-origin: *` on both `marvel.fandom.com` and `dc.fandom.com`; without `origin=*` no ACAO. `list=search` works; search snippets empty; `prop=extracts` not available (per prior doc)                         | `meta=siteinfo&siprop=rightsinfo` on both: `CC-BY-SA` (https://www.fandom.com/licensing). ToS bans automated access (prior doc; I could not re-read it, see below)        | Not published                                                                                       | Marvel wiki "Victor von Doom (Earth-616)" has sections History, Attributes, Paraphernalia, Notes, Trivia, See Also. `action=parse&prop=wikitext&section=0` returned about 185 KB                                              | **Link-out only** (unchanged: licence allows text reuse, ToS bans bots)                                                                           |
| AniList (manga + anime)            | Yes, GraphQL POST                          | **Verified on a real POST:** 200, `access-control-allow-origin: *`, `access-control-expose-headers` includes `X-RateLimit-*`, preflight allows `Content-Type`. This closes the prior doc's "POST response CORS NOT VERIFIED"                             | Free for non-commercial; no "backup or data storage"; no "hoarding or mass collection"; app named "AniList" must say UNOFFICIAL; commercial free under $150/month revenue | Docs: "degraded state ... 30 requests per minute" (nominal 90). Live header `x-ratelimit-limit: 30` | Media: title, startDate, siteUrl, characters. Character search ("Guts") returned id, name, description, media list. Manga only, no Western comics                                                                             | **Usable from the browser now (conditional)**: on-demand only, cache only user-saved items                                                        |
| Kitsu (manga + anime)              | Yes, JSON:API                              | `kitsu.app/api/edge/manga?filter[text]=berserk` and `/characters?filter[name]=Guts`: 200, `access-control-allow-origin: *`. `kitsu.io` also `*` (tested earlier in this run)                                                                             | Terms page `kitsu.app/terms` returns 403 to curl: NOT VERIFIED                                                                                                            | Not published                                                                                       | manga synopsis; characters have names, otherNames, description                                                                                                                                                                | **Hold** until terms are read (same as prior doc)                                                                                                 |
| MyAnimeList official API           | Yes, needs client ID                       | `api.myanimelist.net/v2/manga?q=berserk` without ID: 403 `{"error":"forbidden"}`                                                                                                                                                                         | NOT VERIFIED                                                                                                                                                              | n/a                                                                                                 | n/a                                                                                                                                                                                                                           | **Reject** (key). Link-out OK                                                                                                                     |
| Jikan (MAL scraper)                | Unofficial                                 | Request failed again (no response)                                                                                                                                                                                                                       | Prior doc: scrapes the site                                                                                                                                               | 60/min                                                                                              | n/a                                                                                                                                                                                                                           | **Reject** (unchanged)                                                                                                                            |
| VerseDB (versedb.com)              | Yes, REST, Bearer token                    | Needs token; CORS NOT VERIFIED                                                                                                                                                                                                                           | Page says API "free for reasonable use" for apps; business/marketplace use needs a paid data licence ("Plans from $99 a month"). Docs at `/api/docs` not read             | NOT VERIFIED                                                                                        | Cross-links characters, series, issues, creators, story arcs, events; fields NOT VERIFIED                                                                                                                                     | **Backend phase candidate, licence unclear.** New find, not on the owner's list                                                                   |
| Comic-con sites                    | Not found                                  | n/a                                                                                                                                                                                                                                                      | n/a                                                                                                                                                                       | n/a                                                                                                 | n/a                                                                                                                                                                                                                           | **Reject.** SDCC schedule runs on Sched with an iCal feed (per search; feed URL not seen). Events, not references. NOT VERIFIED beyond one search |

## Evidence

### Comic Vine

- Docs: https://comicvine.gamespot.com/api/documentation. Resources `/character`, `/characters`, `/story_arc`, `/story_arcs`, `/volume`, `/volumes`. List `limit` max 100. Formats `xml`, `json`, `jsonp`; error 103 says jsonp "requires a 'json_callback' argument".
- `/character` fields as documented: aliases, birth, character_enemies, character_friends, count_of_issue_appearances, creators, deck, description, first_appeared_in_issue, gender, image, issue_credits, issues_died_in, movies, origin, powers, publisher, real_name, story_arc_credits, team_enemies, team_friends, teams, volume_credits.
- Terms text on https://comicvine.gamespot.com/api: "You must log in to get a Comic Vine API Key"; "You must sign up for a unique api key for each site individually"; "The API is strictly for non-commercial use only. Commercial use will result in your API key being revoked."; "We officially support 200 requests per resource, per hour."; "If too many requests are made per second, you may receive temporary blocks"; "On any page you use our data, please link back to us."; caching is "suggested".
- Live: https://comicvine.gamespot.com/api/search/?format=json&query=doom&resources=character gave 401 "Invalid API Key"; no ACAO. The GameSpot/Fandom Terms of Use linked in the footer were not read, and the licence of the user-written data is NOT VERIFIED.
- Wikidata bridge: P5905 "Comic Vine ID", formatter `https://comicvine.gamespot.com/wd/$1/`, 48,792 items. Doctor Doom (Q430178) has `4005-1468`. Link HEAD to `/wd/4005-1468/` returned 403 to curl (Cloudflare): browser behaviour NOT VERIFIED.

### Marvel

- https://developer.marvel.com/ : 301 to https://www.marvel.com (CloudFront). `https://gateway.marvel.com/v1/public/characters?name=Doctor%20Doom` and the same with a fake `apikey/ts/hash`: HTTP 500, `x-amzn-errortype: InternalServerErrorException`.
- Secondary: https://jentic.com/apis/developer.marvel.com/marvel.md says the portal redirects and the gateway errors (dated Aug 2026), and a Marvel MCP listing says Marvel retired the API (https://glama.ai/mcp/servers/DanWahlin/marvel-mcp). I found no official Marvel notice. My conclusion "retired or broken, do not build on it" rests on my own two failed calls plus the redirect.

### DC

- One search (standard mode) found no official DC API; only Marvel's and third-party listings. dccomics.com not checked directly. Treat as none. Wikidata has DC page IDs (P9851 DC character ID, 209 items; P7951 DC Comics talent) for link-outs only.

### Grand Comics Database

- API page (mirror of the GCD wiki): https://github.com/GrandComicsDatabase/gcd-django/wiki/API : Basic and Session auth; anonymous allowed but "will likely change"; registered 25/min and 2,000/day; anonymous 30/hour for testing; fields "should not be considered stable"; API-V2 in development; no licence text.
- OpenAPI schema: https://www.comics.org/api/schema/ , paths: issue, issue on_sale_weekly, publisher, series, series overview, series by name/issue/year. No character path.
- Live: `https://www.comics.org/api/series/?format=json` returned 200 and JSON to an anonymous curl; response headers had no ACAO; OPTIONS gave no CORS headers. So browsers cannot read it cross-origin. `https://www.comics.org/download/` and `/legal/` were blocked (Cloudflare) for curl and WebFetch.
- Licence: search index shows the comics.org footer "copyrighted by the GCD and ... licensed under a Creative Commons Attribution-ShareAlike 4.0 International License" (e.g. https://www.comics.org/character/2321/groups/ appeared in results; I could not fetch it). A GitHub project (https://gh.r-mj.com/TheGrayDot/gcd_docker) says data dumps are downloaded after login and calls the data CC-BY, which conflicts: dump licence NOT VERIFIED. The GCD now has character pages (`comics.org/character/<id>/`) and a Wikidata property for them.

### Metron

- Live: https://metron.cloud/api/character/?name=doom : 401, `www-authenticate: Basic realm="api"`.
- Rate limits and auth: https://metron-project.github.io/blog/api-best-practices : HTTP Basic Auth, 20 requests/min and 5,000/day per authenticated user; 304 still counts.
- Licence: not found in that post or https://metron-project.github.io/docs/introduction. The post links a "Using Metron in Commercial Software" article that I could not read. NOT VERIFIED.

### League of Comic Geeks

- https://leagueofcomicgeeks.com/api : 403, `cf-mitigated: challenge`. Search found only unofficial scrapers and a secondary claim (Metron README, https://github.com/bpepple/metron) that LoCG's API is retailer-only. No licence found.

### Fandom (marvel.fandom.com, dc.fandom.com)

- Live: `https://marvel.fandom.com/api.php?action=query&list=search&srsearch=Doctor+Doom&format=json&origin=*` : 200, `access-control-allow-origin: *`, `access-control-allow-credentials: false`. Without `origin=*`: 200 but no ACAO. `dc.fandom.com` the same. Search returns "Doctor Doom" (pageid 12078) on Marvel, snippets empty.
- Licence field on both wikis: "CC-BY-SA", url https://www.fandom.com/licensing.
- ToS: prior doc quotes the 2025-12-19 version banning robots/scrapers and AI training. I tried `https://www.fandom.com/terms-of-use` with curl (403) and WebFetch (402), and a search did not surface the clause. So: **re-check NOT VERIFIED; the prior finding stands, nothing found that contradicts it.**
- Wikidata maps characters to the exact wiki page: P6262 "Fandom article ID" (formatter `https://community.fandom.com/wiki/w:c:$1`, 246,710 items). Doctor Doom's values include `marvel:Victor_von_Doom_(Earth-616)`, `villains:Doctor_Doom_(Marvel)`, `vsbattles:Doctor_Doom` and several language wikis. There is no separate "Marvel Database ID" or "DC Database ID" property: a label search of all properties found none, so the Fandom property is the route.

### AniList

- Terms (read from https://docs.anilist.co/guide/terms-of-use): "Free for non-commercial usage"; "Using the AniList API as a backup or data storage service is strictly prohibited"; "Hoarding or mass collection of data from the AniList API is strictly prohibited"; apps using "AniList" in the name must append "UNOFFICIAL" or "for AniList"; commercial use under $150 revenue per month is free.
- Rate limit (https://docs.anilist.co/guide/rate-limiting): "currently in a degraded state and is limited to 30 requests per minute"; nominal 90. Live `x-ratelimit-limit: 30`, `x-ratelimit-remaining: 29`.
- Live POST to `https://graphql.anilist.co` (media search for Berserk, MANGA) returned id 30002, startDate 1989, siteUrl, characters. Character search "Guts" returned id 422 and a description. No creator or first-appearance field was requested; Media has staff and startDate. For Western comics there is nothing.

### Kitsu, MAL, Jikan

- Kitsu: both `kitsu.app` and `kitsu.io` hosts answered GET with ACAO `*`. Terms unreadable (403). Docs/ToS NOT VERIFIED.
- MAL: https://api.myanimelist.net/v2/manga?q=berserk gave 403 `forbidden` without a client ID.
- Jikan: `https://api.jikan.moe/v4/manga?q=berserk&limit=1` failed to connect again.

### VerseDB

- https://versedb.com/apps : REST API with a Bearer token created in account settings, "free for reasonable use" for apps; marketplaces and business products need the separate data licence. https://versedb.com/developers : "Plans from $99 a month", "Storage and display terms set with you", "A commercial license". Not usable without a token, and I did not read `/api/docs`.

### Wikidata properties (comics)

Formatter URLs are P1630 values read live from WDQS. Counts are `COUNT(*)` of items having the property.

| Property      | Label                                    | Formatter URL                                                                         | Items       |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- | ----------- |
| P5905         | Comic Vine ID                            | `https://comicvine.gamespot.com/wd/$1/`                                               | 48,792      |
| P6262         | Fandom article ID                        | `https://community.fandom.com/wiki/w:c:$1`                                            | 246,710     |
| P4073         | Fandom wiki ID                           | `https://community.fandom.com/wiki/w:c:$1`                                            | not counted |
| P14738        | GCD character ID                         | `https://www.comics.org/character/$1/`                                                | 318         |
| P3589         | GCD series ID                            | `https://www.comics.org/series/$1/`                                                   | 2,449       |
| P9707         | GCD creator ID                           | `https://www.comics.org/creator/$1/`                                                  | not counted |
| P9432         | GCD publisher ID                         | `https://www.comics.org/publisher/$1/`                                                | not counted |
| P5621         | Marvel character ID                      | `https://www.marvel.com/comics/characters/$1/wd`                                      | 319         |
| P9851         | DC character ID                          | `https://www.dccomics.com/characters/$1`                                              | 209         |
| P7950 / P7951 | Marvel creators ID / DC Comics talent ID | `https://www.marvel.com/comics/creators/$1/wd` / `https://www.dccomics.com/talent/$1` | not counted |
| P8731         | AniList manga ID                         | `https://anilist.co/manga/$1`                                                         | 9,497       |
| P11736        | AniList character ID                     | `https://anilist.co/character/$1`                                                     | not counted |
| P4087         | MyAnimeList manga ID                     | `https://myanimelist.net/manga/$1`                                                    | 8,254       |
| P11494        | Kitsu manga ID                           | `https://kitsu.app/manga/$1`                                                          | 602         |
| P11149        | MangaUpdates manga ID                    | `https://www.mangaupdates.com/series/$1`                                              | not counted |
| P11348        | Anime-Planet manga ID                    | `https://www.anime-planet.com/manga/$1`                                               | not counted |
| P1984         | Anime News Network manga ID              | `https://www.animenewsnetwork.com/encyclopedia/manga.php?id=$1`                       | not counted |
| P5035         | Lambiek Comiclopedia artist ID           | `https://www.lambiek.net/artists/$1.htm`                                              | not counted |
| P1392         | ComicBookDB creator ID (Wayback)         | `https://web.archive.org/web/http://www.comicbookdb.com/creator.php?ID=$1`            | not counted |

Link-out HEADs from curl: myanimelist.net and anilist.co 200; comicvine `/wd/`, community.fandom.com `w:c:`, marvel.com `/wd`, comics.org all 403 (Cloudflare to curl). Browser rendering of those four NOT VERIFIED.

### What Wikipedia and Wikidata already give for Doctor Doom (no new host)

- Wikidata Q430178 (live SPARQL): first appearance P4584 "Fantastic Four #5"; creators P170 Jack Kirby and Stan Lee; universe P1080 "Earth-616"; member of P463 Avengers, Cabal, Future Foundation, Intelligencia, Terrible Trio; voice actors P175 (5); P1441 "present in work" only 5 items (Fantastic Four, Secret Wars, etc.), so appearances are thin. IDs: P5905 4005-1468, P5621 1010324, 11 values of P6262.
- Wikipedia `Doctor_Doom` section list (parse `prop=sections`, `origin=*`, ACAO `*`): Publication history (Creation, Early years, 1969-1978, 1980s and 1990s, 2000s, 2010s, 2020s), Characterization (Fictional character biography, Personality and motivation, Powers and abilities, Latveria and politics, Mask and scar), Themes and motifs, Supporting characters, Reception and legacy, In other media. "What has he done?" is answered best by the "Fictional character biography" and "Publication history" sections, which the existing adapter could extract by section, with no new source.

## Ranked recommendation

### Add now (browser, no key)

1. **Wikipedia section extracts + Wikidata facts for comic characters** (existing hosts, no new risk). Pull "Fictional character biography" / "Publication history" via `action=parse&prop=sections` then the section text; add Wikidata P4584 first appearance, P170 creators, P1080 universe, P463 teams, P175 voice actors. Beats every external API found for the "what has he done?" question.
2. **Wikidata external-ID bridge for comics** (CC0, same SPARQL): P5905 Comic Vine, P6262 Fandom (turns `marvel:`/`dc:` values into exact wiki pages), P14738/P3589 GCD, P8731/P4087/P11149 manga, P5621/P9851 official pages. Link-out only; coverage is partial (Comic Vine 48.8k items, Marvel/DC official IDs only about 200-300 each), so keep a search-link fallback.
3. **AniList** for manga and anime series and characters (conditional, same as the prior doc): verified real-POST CORS, 30/min, on-demand only, cache only what a user saves, "unofficial" naming. Covers manga and Japanese media only; nothing for Western comics.

### Backend phase (key, auth or no CORS)

1. **Comic Vine**: strongest character data (first appearance, creators, story arcs, appearances). Needs a server-held key, non-commercial only, 200 requests per resource per hour, link back. Check GameSpot terms and the data licence first (both NOT VERIFIED).
2. **GCD API**: series/issue/credits, CC BY-SA 4.0 (secondary source), but no CORS, no character endpoint, tight anonymous limit. Dumps need a login. Useful for series and issue detail and creator credits, not for character stories.
3. **Metron** and **VerseDB**: only after reading their licences. Metron needs a registered account (Basic auth); VerseDB needs a token and has a paid commercial tier.
4. **Kitsu**: could move to "now" if its terms, once read, allow client use.

### Link out only

Comic Vine and GCD pages via Wikidata IDs; Fandom wiki pages (Marvel, DC, others) via P6262; marvel.com and dccomics.com character pages via P5621/P9851; MyAnimeList, AniList, MangaUpdates, Anime-Planet for manga; League of Comic Geeks (search link NOT VERIFIED).

### Reject

Marvel developer API (portal redirects, gateway 500), DC (no API found), MyAnimeList official API (client ID), Jikan, Fandom API ingestion (ToS), League of Comic Geeks API, Comic-con schedule feeds (wrong data).

## Changes against `docs/research/source-candidates.md`

- AniList: the prior "POST response CORS NOT VERIFIED" is now verified (ACAO `*`, rate-limit headers exposed); the 30/min degraded limit still stands; terms unchanged.
- Fandom: CORS with `origin=*` reconfirmed on marvel and dc wikis; `rightsinfo` is CC-BY-SA; ToS re-read failed, so the earlier conclusion is carried, not re-verified.
- Kitsu: CORS confirmed on `kitsu.app` as well as `kitsu.io`; terms still unread.
- Jikan: second failed attempt; still unverified.
- Reddit: not re-checked (out of scope here).
- Operational note: Wikidata's `wbsearchentities` returned 429 (`x-envoy-ratelimited`, `retry-after: 4`) when I sent five requests about 1 second apart with the PopCultureDecoder UA; the SPARQL endpoint did not. Add client-side spacing or debounce for property lookups.

## Owner-supplied second opinion (2026-11-15) — deltas only, not re-verified here

An outside summary the owner pasted agrees with the verdicts above (Wikidata + Wikipedia now; Comic
Vine non-commercial only; Marvel API retired; Metron needs one account per user for consumer apps)
and adds:

- **IGDB** (games): has a `characters` endpoint with descriptions and storylines. Needs Twitch
  OAuth (a client secret), so backend phase only; commercial use through a partnership with
  attribution; local storage allowed. NOT VERIFIED by this project.
- **Open Library** (novels, editions, authors): open catalogue data and dumps; not meant as
  high-traffic live infrastructure. Candidate for a future Books category. NOT VERIFIED.
- **GCD bulk dumps** (CC BY-SA 4.0) for a self-hosted comics catalogue in the backend phase.
- **MobyGames**: paid, and its terms forbid AI grounding/RAG without written consent: avoid.
- **RAWG**: conflicting free-tier commercial statements: clarify before use.
- "What a character did in a specific issue or scene" needs a source-backed event layer; no single
  API provides it. Plot text stays behind Reveal.
