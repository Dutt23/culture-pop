# Graph UI for related references, and "important" highlighting (2026-11-16)

Owner question: should the app add a graph to show related references, and/or a way to highlight
important ones? Web research plus a read of the repo. Claims I could not confirm are marked
"unverified". Nothing was built or run, apart from two read-only `curl` checks of Wikimedia headers.

## Short answer

- **No graph now.** The data is too thin for one, and the page already lists the same links with
  reasons. If we ever want one, it is a small static "ego" graph, not a force simulation.
- **Yes to a little "important" signal, but only honest ones:** a count of links inside the reader's
  own library, and the reader's own favourites. Optional, labelled: how many language Wikipedias
  have an article (from Wikidata). Not Wikipedia pageviews.

## What the repo tells us

- The seed has no `presentIn` or `creators` (a count in `src/data/seed.ts` returns 0). Only
  references found online carry Wikidata works and creators. So for the 16 demo entries a graph
  would show a single dot with no edges.
- `relatedReferences()` in `src/domain/related.ts` already makes three kinds of link (work, creator, era), each
  with a reason, capped at 3 per group. A graph would redraw those same edges. The era "edge" is a
  bucket, not a link: in a graph it becomes a hub joined to every reference of that decade, which is
  clutter.
- Library size is tens to a few hundred. A graph of the whole library would be a hairball; a graph
  of one reference's neighbours is 3 to ~10 nodes. That is a list-sized problem.

## 1. What comparable products do

| Product | Related content | Graph? |
| --- | --- | --- |
| Wikipedia | "Read more" cards at the bottom of an article, picked by CirrusSearch `morelike` ([Read more](https://www.mediawiki.org/wiki/Reading/Web/Projects/Read_more)); raters preferred it over a navigation-vector model ([Wikimedia study](https://meta.wikimedia.org/wiki/Research:Evaluating_RelatedArticles_recommendations)) | No |
| Know Your Meme | "Related Entries" and "Related Sub-entries" lists, editor-curated per its style guide ([style guide](https://knowyourmeme.com/editorials/the-style-guide)) | No |
| TV Tropes | Bulleted trope lists on a page; sidebar structure not confirmed (unverified) | No |
| Letterboxd | "Similar Films" section on a film page, engine licensed from Nanocrowd ([Nanocrowd](https://nanocrowd.com/nanocrowd-letterboxd/)) | No |
| Wikidata | No built-in graph found; third-party tools such as [Wikidata Graph Builder](https://github.com/AngryLoki/wikidata-graph-builder) draw d3 graphs for researchers | Yes, expert tools |
| Obsidian | Global and local graph views | Yes |

Marvel/Fandom wikis, Spotify and any pop-culture graph explorer: no reliable source found
(unverified). The pattern is clear enough: consumer "related" features are lists or cards; graphs
live in expert tools and note apps.

**Do graphs get used?** No usage data found for any consumer product. Obsidian users say the
whole-vault graph is mostly decoration while the local graph (one note and its neighbours) is the
useful one ([forum thread](https://forum.obsidian.md/t/q-how-should-i-use-graph-view-correctly-because-im-not-getting-any-ideas/82382),
[another](https://forum.obsidian.md/t/whats-the-point-of-the-graph-view-how-are-you-using-it/71316)); these are opinions, not
studies. Lab research is mixed: in a crowdsourced study node-link diagrams beat matrices for
reading a node's neighbours, while matrices did as well or better on clusters
([Okoe, Jianu, Kobourov](https://arxiv.org/pdf/1709.00293.pdf)). That supports a graph only for
the "who is next to this node" question, which a list answers too. No study of casual users found.

## 2. Mobile feasibility

- **Legibility and targets:** WCAG 2.2 sets 24 px as the minimum target and 44 px as the enhanced
  level ([summary](https://www.disabilityworld.org/toolkit/standards/wcag/2-5-8-target-size-minimum/);
  secondary source, not checked against W3C). At 360 px wide, 44 px nodes plus a readable label
  fit about 6 around a ring. More than that overlaps.
- **Research agrees it is hard:** a phone-graph paper says a two-hop circular layout needs nodes
  "too small to touch" ([GraphTiles](https://techrep.csc.ncsu.edu/2013/TR-2013-6.pdf)); another says
  force layouts get too dense on small screens ([Horak et al. 2020](https://mt.inf.tu-dresden.de/cnt/uploads/Horak2020MultivariateNetworksOnMobiles.pdf)).
- **Gestures:** a pannable, zoomable canvas inside a scrolling page fights the page scroll. A static
  ego graph has no pan or zoom, so the conflict goes away.
- **Screen readers:** graphs are poor for them. Practical fallbacks: a real list or table of the
  same links ([Mermaid table viewer demo](https://samkacer.github.io/MermaidAccessDemo/guide)); hide a
  chart you cannot make keyboard-usable ([KeyLines advice](https://cambridge-intelligence.com/build-accessible-data-visualization-apps-with-keylines/)).
  No controlled study of these alternatives found. In this app the existing grouped cards already are
  the accessible version.
- **Unfolded (wider) screen:** a graph beside the cards is the only layout where it makes sense.

## 3. Libraries and cost

Sizes from the Bundlephobia API on 2026-11-16 (min, gzip, dependencies included):

| Option | Min | Gzip | Render | Notes |
| --- | --- | --- | --- | --- |
| d3-force 3.0.1 | 15.6 KB | 5.8 KB | none (you draw) | Simulation only; runs until it cools |
| react-force-graph-2d 1.29.2 | 181 KB | 59.8 KB | canvas | Canvas has no DOM nodes, so nothing for assistive tech |
| vis-network 10.1.5 | 414 KB | 118 KB | canvas | |
| sigma 4.0.6 | 376 KB | 96.9 KB | WebGL | Built for thousands of nodes |
| cytoscape 3.35.0 | 442 KB | 138.9 KB | canvas | Most features, biggest |
| Hand-rolled SVG ego graph | ~0 | ~1 to 2 KB of code (estimate) | SVG | No library |

The app's first load is 176 KB gzip, so react-force-graph-2d would add a third and cytoscape 79%.
Even lazy-loaded and precached, that cost is hard to justify for a few nodes. Force simulations
keep the CPU busy until they settle; no battery measurement found (unverified), but a fixed layout
has none of that cost. **Yes, an ego graph is easy without a library:** centre node, N neighbours at
`angle = 2*pi*i/N`, SVG `<line>`s and `<a>` nodes (each an ordinary focusable link), CSS for
hover and focus. Static positions, no simulation, works offline, and each node is a real link, so
keyboard and screen readers get a usable structure.

## 4. "Important" signals

| Signal | Allowed under spec? | Cost | Offline | Honest label |
| --- | --- | --- | --- | --- |
| Links inside the reader's library (count of references sharing a work or creator) | Yes, it is the reader's own data | Free; computed from `related.ts` inputs (count needs the uncapped lists) | Yes | "Linked to 5 things in your library" |
| Favourited, or opened from a search (D49) | Yes | Free | Yes | "In your favourites" |
| Wikidata sitelink count | Yes: Wikidata is already a source; the Wikidata API sends `access-control-allow-origin: *` (checked). The WDQS `wikibase:sitelinks` predicate could ride on the existing query (not tested in the app) | One new field per reference, so a Dexie schema bump; fetched once | Stored after first fetch | "Has articles in 86 languages (Wikidata)". The Matrix, Q83495, had 86 Wikipedia sitelinks when checked. A notability hint, not a ranking. It favours Western, long-established topics. Sitelinks are a threshold in Wikidata's own policy ([Help:Sitelinks](https://www.wikidata.org/wiki/Help:Sitelinks)); I found no study validating them as a graded importance score |
| Wikipedia pageviews | Data is CC0 and needs a User-Agent ([access policy](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html)); the endpoint sends `access-control-allow-origin: *` (checked). Needs a new host in `hosts.ts` and the CSP | Rate limits are in flux: Wikimedia says 200 requests/min for browsers and for bots with a compliant User-Agent, "new in 2026 and subject to change" ([rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits)); the pageviews endpoint's own limit is not stated | No, needs a live call | Only as "Read 120,702 times on English Wikipedia in October 2026". It is a current-popularity number, so it sits closest to the "no fake trending" rule. Not worth the new host for a personal app |

**Never label:** "Popular", "Trending" or "Top" without the source and period named.

## 5. Recommendation

1. **Skip the graph for now.** Revisit once real libraries have enough Wikidata links to show.
2. **Smallest "important" version (about half a day):** on each card and reference page, a quiet
   line "Linked to N in your library" when N is 2 or more, plus the existing heart. Tapping it opens
   the related groups. It explains itself, adds no network call and no dependency.
3. **Optional second step (about 1 day, schema bump):** store the Wikidata sitelink count; show
   "Articles in N languages (Wikidata)" on explained online references only.
4. **If the owner still wants a graph (about 1 to 2 days):** a "Connections" view on the reference page, a plain-SVG ego
   graph of work and creator neighbours only (no era), at most 6 nodes, loaded only
   when the viewport is 600 px or wider (unfolded), with the existing grouped list always present
   as the accessible and phone version. Test: nodes are links in tab order, 44 px targets, reduced
   motion respected.

**Risks:** a graph that is mostly empty looks broken; sitelink counts can read as popularity;
adding a new host (pageviews) widens the CSP and the privacy story; any force library undoes the
Phase 5 speed work.
