# Web-search API providers for "community pointers" (long-tail memes / slang)

Date checked: 2026-11-15. Method: official pricing pages, ToS, privacy notices and API docs only, fetched read-only. No account, key or authenticated call was made. Anything not found on an official page is marked **NOT VERIFIED**. Secondary sources (news, aggregators) are used only where labelled "secondary".

Scope: a small backend calls a licensed web-search API and returns title / URL / snippet. An on-device LLM later extracts candidate pointers from snippets; pointers are verified against permitted sources (Wikipedia etc.) and otherwise shown as "Community suggests... (unverified)". The app never calls Reddit or scrapes pages. This needs owner approval (spec section 7: "No account, paid API, proxy, cloud model ... without owner approval"; searches sent to external providers must be disclosed).

Quote policy: legal text is paraphrased with section numbers; only short fragments are quoted. Re-read the linked clause before relying on any row.

---

## 1. Comparison table

| Provider | New customers? | Free tier | Price per 1,000 | Own index? | Display to end users | Store / cache | Feed to LLM / AI | Query retention / training |
|---|---|---|---|---|---|---|---|---|
| **Brave Search API** | Yes (card required, prepaid) | $5 credit/month = 1,000 searches (pricing page; marketing header says "up to $20", conflict) | $5 (Search), $4 + tokens (Answers) | Yes, own index (FAQ) | Licensed "with the Customer Applications" (ToS 3(a)); optional "POWERED BY BRAVE" attribution | **Forbidden** beyond transient storage (ToS 3(b)(i)); "storage rights" only on custom plan | Training/improving AI models forbidden (3(b)(xiii)); inference use not addressed in ToS text (ambiguous) | Query logs max 90 days; ZDR Enterprise only (per privacy notice); no training claim on pricing page |
| **Mojeek Search API** | Yes (card required, PAYG) | "Free credit" on Startup plan, amount NOT VERIFIED | GBP 2 (Startup), GBP 3 (Business), custom (Enterprise) | Yes, independent (own crawler) | Allowed; no attribution required (FAQ) | Startup: cache 1 hour. Business/Enterprise: storage rights, indefinite (FAQ) | "AI Usage" column ticked on all plans; LLM/chatbot use allowed (page) | 90-day retention standard, ZDR on request; EU infrastructure, no sub-processors |
| **Perplexity Search API** | Yes | NOT VERIFIED | $5 (standard), $1 (`search_type: fast`) | Yes ("index of public content", not documented further) | Output may be displayed "solely within the Customer Applications" (API ToS 2.1) | Not addressed in the ToS or Search Addendum; customer does **not** own Search API output | Not addressed; Search API returns no generated text | Perplexity may retain and use Search Data (queries and results) for product improvement (Addendum 2.2); no Personal Data allowed (2.3) |
| Tavily | Yes | 1,000 credits/month, no card | $8 PAYG ($0.008/credit, 1 credit per basic search); monthly plans $0.0075 to $0.005/credit | Mostly own; may share queries with third-party index providers (privacy policy) | Services "solely for internal business purposes, including integration with Customer Applications" (ToS); display not explicit | Not addressed | AI Functionality clause lets Tavily and its AI vendors train on Customer Input (ToS 6.5) | Queries used to improve responses; retention period "as necessary" (not specific) |
| Exa | Yes | $10 credits/month (+$10 onboarding) | $4 (Lite), $7 (Auto), $12 (Deep) per 10 results | NOT VERIFIED (not stated on pages read) | ToS PDF restricts displaying information obtained from the Services "except as expressly permitted"; no API display clause found | No clause found | No clause found | Privacy policy: Query Data used to train and fine-tune models; ZDR only on Enterprise ($12,000/yr commitment) |
| You.com Web Search API | Yes | 100 queries/day via MCP, no key (not a backend key); $100 starter credits NOT VERIFIED | $5 (up to 100 results/call) | NOT VERIFIED (ZDR page says queries "do not go to Google or Bing") | API terms NOT VERIFIED (only consumer ToS found) | NOT VERIFIED | NOT VERIFIED | ZDR optional, by agreement; default retention NOT VERIFIED |
| Kagi Search API | Appears self-serve (pricing page "Get Started"); terms NOT VERIFIED | NOT VERIFIED | $12 | **Reseller/aggregator**: calls "all major search result providers" plus own sources (Kagi docs) | NOT VERIFIED (terms URL returned 404) | NOT VERIFIED | NOT VERIFIED | API queries not stored against account; temp logs purged (7 days LB/VM logs, 90 days Sentry samples) |
| Marginalia | Free non-commercial key by email; commercial metered key | Free non-commercial (CC-BY-NC-SA 4.0) | Commercial price NOT VERIFIED | Yes (small-web index) | Under licence terms | Under licence terms | NOT VERIFIED | NOT VERIFIED |
| Serper.dev | Yes | 2,500 free queries | $1.00 / $0.75 / $0.50 by pack | **No: scrapes Google** ("web-scraped data") | Terms silent; third-party IP responsibility on you | Terms silent | Terms silent | NOT VERIFIED |
| SerpApi | Yes | NOT VERIFIED | Plans: $25 for 1,000/mo; $75 for 5,000/mo; $150 for 15,000/mo | **No: scrapes Google/Bing/etc.** | n/a | n/a | n/a | n/a |
| Bing Web Search API | **No** | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| Grounding with Bing (replacement) | Azure only; paid subscription | Not available on free-credit subscriptions | NOT VERIFIED (official pricing page not retrievable) | Bing | Must show Bing URLs/citations as provided | n/a | Returns LLM text only | Data leaves the Azure compliance boundary |
| Google Custom Search JSON API | **No** (closed to new customers) | 100/day | $5 per 1,000, up to 10k/day | Google | n/a | n/a | n/a | n/a |

---

## 2. Per-provider notes and evidence

### 2.1 Brave Search API (candidate A)

Evidence:
- Pricing: https://api-dashboard.search.brave.com/documentation/pricing and https://brave.com/search/api/
- ToS (last updated 1 Sep 2026): https://api-dashboard.search.brave.com/documentation/resources/terms-of-service
- Privacy notice (updated 3 Nov 2026): https://api-dashboard.search.brave.com/documentation/resources/privacy-notice
- Docs: https://api-dashboard.search.brave.com/documentation/services/web-search , https://api-dashboard.search.brave.com/documentation/services/llm-context , https://api-dashboard.search.brave.com/documentation/guides/rate-limiting

Facts:
- **Pricing.** Search plan: $5 per 1,000 requests, "Includes free $5 in credits every month", 50 requests/second, prepaid credits. Answers plan: $4 per 1,000 + $5 per million input and output tokens, 2 req/s. The brave.com marketing header says "up to $20 in free calls", which conflicts with the $5 on both plan cards and the docs pricing page; this report uses $5. Card required "to prevent abuse". Only successful requests are billed (rate-limiting doc).
- **Index.** FAQ: results come from Brave's own independent index with no fallback to another engine.
- **Display.** ToS 3(a) licenses use of Search Results with Customer Applications. Attribution is optional; if used, it must read "POWERED BY BRAVE" with the logo (4(d)).
- **Storage / caching.** ToS 3(b)(i) bars customers (and End Users) from storing, caching or creating a database of Search Results other than transient storage required to run the application. 3(b)(xiv) requires deleting retained Search Results on termination. FAQ: storage rights only "with a custom plan". **This conflicts with the product's "cache on device" step if snippets or links are persisted.**
- **AI.** 3(b)(xiii) bars using Search Results to create, evaluate, train, re-train, fine-tune, benchmark or otherwise improve AI models or services (the customer's or third parties'). The text does not mention inference-time grounding; Brave sells an "LLM Context" endpoint for exactly that, but the ToS does not carve it out. Ask Brave in writing whether on-device snippet extraction is permitted. 3(b)(xii) bars redistribution/resale; 3(b)(ii) bars derivative works of Search Results.
- **Third-party content.** ToS 9(d): third-party content in results may carry its owners' IP rights, and your use may be restricted by them. Brave's LLM Context doc lists "extracting forum discussions (e.g. from Reddit)" as a use case, which is the only official evidence found that Reddit threads appear in results.
- **Privacy.** Privacy notice: search-query logs kept max 90 days for billing/troubleshooting/abuse; "Option for Zero Data Retention (Enterprise clients)". Brave states it does not collect identifiers that link a query to an individual or device and that the customer is responsible for end-user privacy notices (ToS 3b reference). The marketing pricing page also claims architectural ZDR ("Your queries never leave Brave") and "No unintended use of your data"; the privacy notice's 90-day log and Enterprise-only ZDR is the more specific statement, so treat standard-plan retention as 90 days. Brave is US-based (Brave Software Inc). Data residency choice: NOT VERIFIED.
- **Technical.** Web search: `web.results[]` with `title`, `url`, `description`; optional `extra_snippets` (up to 5 alternate excerpts; on Search plan features list); `count` max 20; `country`, `search_lang`, `ui_lang`, `freshness` (`pd/pw/pm/py` or date range), `safesearch`. Dedicated `discussions` / forum result type: NOT VERIFIED (not in the docs read). Latency claims: NOT VERIFIED. Hinglish / India coverage: NOT VERIFIED (country and language parameters exist; no India-specific documentation found).
- **Scraper?** No; own crawler plus opt-in Web Discovery Project signals (FAQ).

### 2.2 Mojeek Search API (candidate B)

Evidence: https://www.mojeek.com/services/search/web-search-api/ (pricing, FAQ), https://www.mojeek.com/support/api/search/request_parameters.html

Facts:
- **Pricing.** Startup GBP 2 per 1,000 requests (5 q/s, 100,000/day, up to 10 results). Business GBP 3 per 1,000 (10 q/s, 400,000/day, up to 40 results). Enterprise custom. Prices exclude VAT. PAYG, no minimum, no auto payments, bank card required. Free credit for testing exists on Startup; amount NOT VERIFIED. No USD figure was published, so no conversion is shown.
- **Terms (from the page FAQ, not the full agreement).** Display allowed, including next to third-party ads, and no attribution required. Startup plan can cache results for one hour; Business and Enterprise have storage rights that "permit indefinite data retention". Plans show an "AI Usage" feature, and the benefit list says AI/ML use and LLM/chatbot use are allowed. Results can be combined with other sources and modified, subject to the terms. Commercial use allowed. Mojeek grants no rights in third-party page content; customers must follow publisher copyright terms.
- **Full Search API Terms of Service text: NOT VERIFIED** (the page says it is available when you open an account). Confirm the FAQ claims in the agreement before committing.
- **Privacy.** Independent index; 90-day standard retention, ZDR available on request (Enterprise custom plans include ZDR); European infrastructure with no sub-processors; Mojeek acts as Processor and you are Controller of query data; DPA guaranteed.
- **Technical.** Independent crawler (MojeekBot, honours robots.txt). Parameters: `fmt=json`, `t` (results per page), `dlen` (snippet length up to 511), `tlen`, `rb`/`rbb` (boost a country), `lb`/`lbb` (boost a language), `since`/`before`, `fi`/`fe` (include/exclude up to 25 domains), `site`. Snippet is query-dependent text; fields are URL, title, snippet (optional dates and size). Whether Reddit, Know Your Meme or Indian-language/Hinglish pages are indexed: NOT VERIFIED (needs a free-credit test). Latency: NOT VERIFIED beyond "fast retrieval" marketing.
- **Scraper?** No.

### 2.3 Perplexity Search API (candidate C)

Evidence: https://docs.perplexity.ai/docs/getting-started/pricing , https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service (Jan 23, 2026), https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service-search (Search Addendum, Sep 22, 2025), https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers , https://docs.perplexity.ai/docs/search/quickstart

Facts:
- **Pricing.** Search API $5.00 per 1,000 requests ("Ranked web results as JSON, with page text extracted into each result's snippet"); Fast Search $1.00 per 1,000. Billed per successful request; one request with up to five queries is one billing unit but consumes five rate-limit units. Rate limit 50 query units/second. Free tier: NOT VERIFIED (none found in the pricing page text).
- **Fields.** `title`, `url`, `snippet` (extracted page text, can be long), `max_results` 1 to 20. Domain, language, date and country controls documented.
- **Terms.** API ToS 2.1: customer may display Output "solely within the Customer Applications". Search Addendum Schedule 1: customer does not own Search API Output. 2.2: Perplexity may retain, copy, distribute and use Search Data (input and output) for lawful business purposes including product improvement. 2.3: no Personal Data to Search Services unless authorised. Caching/storage and feeding results to an LLM: not addressed in either document. The Addendum also says the main agreement's zero-data-retention obligations do not apply to Search Services.
- **Privacy.** See above; US company; residency NOT VERIFIED.
- **Risk note (secondary).** Reddit sued Perplexity, SerpApi, Oxylabs and AWMProxy in Oct 2025 over scraping Reddit data via Google results (Search Engine Land: https://searchengineland.com/reddit-sues-perplexity-serpapi-scraping-google-463681). Perplexity denies scraping. Status of the case NOT VERIFIED. Relevant if the app's explicit goal is surfacing Reddit threads.
- **Independent index?** Not documented beyond "index of public content".

### 2.4 Tavily

Evidence: https://www.tavily.com/pricing , https://docs.tavily.com/documentation/api-credits , https://docs.tavily.com/documentation/rate-limits , Platform Terms (updated May 4, 2026) https://www.tavily.com/terms , Privacy Policy (updated Nov 24, 2025) https://www.tavily.com/privacy

- 1,000 free credits/month, no card. Basic search 1 credit, advanced 2. PAYG $0.008/credit; monthly plans $0.0075 to $0.005/credit. Rate limit 100 RPM free, 1,000 RPM on PAYG.
- Terms: services "solely for Customer's internal business purposes, including for integration with Customer Applications" (ToS); no explicit display or caching clause found; Acceptable Use Policy URL returned no usable text. ToS 6.5: Tavily and its AI vendors may use input to the AI Functionality (research/answer features, not plain search) for training. Privacy policy: query data may be used to improve responses; Tavily "mostly" uses its own services but may share queries with third-party index providers in limited cases.
- Search response includes `title`, `url`, `content`, `score`, `published_date`; `country`, `include_domains`, `exclude_domains`, `language` params. Reddit/forum coverage: NOT VERIFIED.

### 2.5 Exa

Evidence: https://exa.ai/pricing , https://docs.exa.ai/reference/search , https://exa.ai/privacy-policy (updated June 29, 2026), ToS PDF https://exa.ai/terms-of-service

- Free: $10 credits/month plus a $10 onboarding bonus. Search from $4 per 1,000 (Lite), $7 (Auto), $12 (Deep), with up to 10 results; each additional result above 10 adds $1 per 1,000 requests (pricing table). Contents (page text/highlights) $1 per 1,000 pages. Configurable latency "300ms to 1s".
- Privacy policy: Query Data "is used to improve our products and technology, including by training and fine-tuning models". ZDR is Enterprise only ($12,000 annual commitment). EU data residency page exists; terms NOT VERIFIED.
- The only ToS found is a general PDF (website, search engine and API together; a placeholder DPA link remains). It prohibits, without permission, displaying or copying information obtained through the Services except as the Terms allow, and developing a competing product from Output. No clause covers displaying results in an end-user app, caching or LLM use. Treat display rights as NOT VERIFIED and get them in writing.

### 2.6 You.com Web Search API

Evidence: https://docs.you.com/administration/billing , https://you.com/pricing , https://docs.you.com/administration/zero-data-retention

- $5.00 per 1,000 calls, up to 100 results per call; web and news in one request; p50 latency ~0.4 s (pricing page). Free: 100 queries/day through the MCP server with no key. A backend key plan has no verified free tier.
- ZDR is optional and added to an agreement on request; it covers Web Search and Answer APIs; when enabled, queries are not retained or used to train and "your queries do not go to Google or Bing". Default (non-ZDR) retention and API terms: NOT VERIFIED (the API terms URL returned "Page not found"; the consumer Terms last updated Aug 27, 2024 cover websites and apps).

### 2.7 Kagi Search API

Evidence: https://kagi.com/api/pricing , https://help.kagi.com/kagi/api/overview.html , https://help.kagi.com/kagi/search-details/search-sources.html , https://kagi.com/privacy

- $12 per 1,000 search requests; Extract $4 per 1,000 pages; invoiced every 30 days or at $100 usage. Search results use "anonymized API calls to all major search result providers" plus own sources (so a reseller layer; downstream terms of those providers NOT VERIFIED). API terms URLs tried returned 404, so display, cache and AI rules are NOT VERIFIED.
- Privacy: API queries are not stored against the account; may be logged temporarily without account link then purged on the retention table (load balancer and VM logs 7 days; sampled error reports 90 days).

### 2.8 Marginalia

Evidence: https://about.marginalia-search.com/article/api/ (updated 2025-12-08)

- Free non-commercial key by email under CC-BY-NC-SA 4.0; paid non-commercial key; metered commercial key with no attribution requirement (price NOT VERIFIED). Index is the independent "small web", so low value for Reddit and Know Your Meme. Possible supplement only if the app is non-commercial.

### 2.9 Serper.dev and SerpApi (Google scrapers)

Evidence: https://serper.dev , https://serper.dev/terms (updated May 29, 2024), https://serpapi.com/pricing

- Serper's own terms: "Serper provides web-scraped data collected from public domain sources"; it is "not affiliated with or endorsed by Google". Pricing $50 for 50k credits ($1.00/1k), $375 for 500k ($0.75/1k), $1,250 for 2.5M ($0.50/1k), credits valid 6 months; 2,500 free queries. SerpApi: $25/month for 1,000 searches, $75 for 5,000, $150 for 15,000, with a "U.S. Legal Shield" offering.
- **Legal risk: high.** Both repackage Google (and other engines') result pages. Reddit's Oct 2025 suit named SerpApi for obtaining Reddit data via Google results (secondary, link above). Google sued SerpApi in Dec 2025; secondary reporting says the DMCA claims were dismissed in July 2026 without a ruling that scraping is lawful, and the posture (amendment, appeal) is NOT VERIFIED against the docket (4:25-cv-10826-YGR). The app brief forbids scraping; paying a scraper to do it is the same exposure with a middleman. **Not recommended.**

### 2.10 Unavailable options

- **Bing Web Search API:** retired. Microsoft: "will be retired on August 11, 2025 ... no longer available ... or new customer signup" (https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement). Suggested replacement is Grounding with Bing Search (Azure AI Agents). Per Microsoft Learn (https://learn.microsoft.com/en-us/azure/ai-foundry/agents/how-to/tools/bing-grounding): developers "don't have access to raw content", Bing URLs and citations must be displayed in the exact provided form, queries leave the Azure compliance boundary, and free-credit subscriptions are ineligible. It does not return title/snippet JSON, so it does not fit this design. Price: NOT VERIFIED (official pricing page not retrievable; one secondary source said $14 per 1,000, others differ).
- **Google Custom Search JSON API:** https://developers.google.com/custom-search/v1/overview says it is closed to new customers; existing customers must move by January 1, 2027; 100 free queries/day, $5 per 1,000 up to 10k/day; whole-web search is not offered, and Google suggests Vertex AI Search for up to 50 domains.

---

## 3. Minimal backend shape

One serverless function (Cloudflare Worker, Vercel or Netlify function). Platform pricing and limits were not researched: NOT VERIFIED.

```
PWA --POST /api/pointers {q}--> function --GET provider search--> JSON
                                   |
   secrets: PROVIDER_KEY (env, never shipped to client)
```

Rules:
1. **Key server-side only.** Env secret; client calls only your function. Lock CORS to the app origin.
2. **Query-only proxy.** Accept just `q` (trim, collapse whitespace, cap ~100-200 chars) and an optional locale. Never forward cookies, IP, User-Agent, device IDs or any user identifier to the provider (Brave, Mojeek and Kagi say they do not want end-user identifiers; Perplexity bans Personal Data). Reject queries that look like emails, phone numbers or URLs with credentials.
3. **Per-IP rate limit** at the platform edge (for example 10 requests/minute and 100/day per IP) plus a **global daily cap** that returns 429 and stops spending once the budget is hit. If you keep IPs for limiting, keep them in memory/short-lived counters only and say so in the privacy disclosure; do not log queries.
4. **Allowlisted response fields.** Return only `[{title, url, snippet, source_host}]`, truncated (title 120 chars, snippet ~300), at most 5 to 10 results, URL scheme limited to https. Strip HTML. Add the provider attribution line (required for Brave if you show its mark; optional for Mojeek). Treat snippets as untrusted data (spec section 7); never let them reach the on-device LLM as instructions.
5. **Caching, per provider terms.**
   - Brave: no stored cache. Use `Cache-Control: no-store`, in-flight request coalescing (a few seconds) only. Do **not** persist snippets or result links in IndexedDB; persist only verified facts from permitted sources and what the user explicitly saves. Or buy a custom plan with storage rights.
   - Mojeek Startup: edge cache up to 1 hour. Business plan: longer, per the agreement.
   - Perplexity / Tavily / Exa / You.com: terms silent, so treat as no cache until confirmed in writing.
6. **Privacy disclosure** in-app: query text is sent to the backend and then to the named provider; state provider retention (Brave up to 90 days, Mojeek 90 days; Perplexity may use queries and results to improve its products).
7. **Fail closed:** on provider error or 429 return an empty list and let the app fall back to the permitted sources it already has.

---

## 4. Cost estimate

Assumptions: one provider call per user search (no multi-query batching); no cache hit (Brave ToS forbids persistent cache; edge cache would only reduce cost for Mojeek); free credit applied once per month; excludes hosting, taxes and FX. Brave free credit taken at the conservative $5 (1,000 searches).

| Searches / month | Brave ($5 per 1,000, minus $5 credit) | Mojeek Startup (GBP 2 per 1,000) | Mojeek Business (GBP 3 per 1,000, storage rights) | Perplexity standard ($5 per 1,000) | Perplexity fast ($1 per 1,000) |
|---|---|---|---|---|---|
| 1,000 | 1 x $5 - $5 = **$0** | 1 x 2 = **GBP 2** (less unknown free credit) | 1 x 3 = **GBP 3** | 1 x 5 = **$5** | 1 x 1 = **$1** |
| 10,000 | 10 x $5 - $5 = **$45** | 10 x 2 = **GBP 20** | 10 x 3 = **GBP 30** | 10 x 5 = **$50** | 10 x 1 = **$10** |
| 100,000 | 100 x $5 - $5 = **$495** | 100 x 2 = **GBP 200** (about 3,300/day at 100k/month, inside the 100,000/day cap) | 100 x 3 = **GBP 300** | 100 x 5 = **$500** | 100 x 1 = **$100** |

Perplexity free credits: NOT VERIFIED, none subtracted. GBP not converted (no verified rate used).

For reference, same arithmetic for the others (gross, before free allowance): Tavily PAYG 1,000 searches = 1,000 credits x $0.008 = $8, free allowance covers it ($0); 10,000 = $80 - $8 (1,000 free) = $72; 100,000 = $800 - $8 = $792. Exa Lite $4 per 1,000: $4 / $40 / $400 (the $10 monthly credit would cut each by up to $10). You.com $5 per 1,000: $5 / $50 / $500. Kagi $12 per 1,000: $12 / $120 / $1,200. Serper $1.00 per 1,000 (Starter pack): $1 / $10 / $100. SerpApi: $25 / $150 (Production plan covers 15,000) / above 15,000 plan price NOT VERIFIED.

---

## 5. Risks

1. **Persistent caching conflicts with Brave's standard ToS.** The architecture's step 6 ("Cached on device as today") must not store raw Brave snippets or links. Either design around transient use, buy storage rights, or use a provider that sells them (Mojeek Business).
2. **AI clause ambiguity.** Brave 3(b)(xiii) forbids using results to train or improve AI. On-device extraction at inference time looks like a different use but is not expressly allowed. Get written confirmation before building the Phase 3 extractor.
3. **Coverage is unproven.** Whether Brave, Mojeek or others return Reddit threads, Know Your Meme pages or Hinglish/Indian-context pages for real queries is NOT VERIFIED (Reddit blocked a direct robots.txt fetch from this environment, and no official provider page documents Reddit coverage except Brave's single LLM Context line). Run a 25-query test during the free-credit window before any commitment.
4. **Third-party content rights.** Snippets are fragments of Reddit and site content. Keep display to title, short snippet and link-out; label as unverified; never present as fact (matches the brief's "link-only" policy for community sites).
5. **Reddit litigation climate.** Reddit is suing Perplexity and SerpApi over search-derived Reddit data (secondary sources). Prefer providers that are first-party search indexes, and avoid scrapers.
6. **Privacy.** Queries are user text and may contain personal data. Perplexity and Kagi tell customers not to send personal data. Disclose in-app; do not log queries; do not forward IPs.
7. **Cost abuse.** Public endpoint with a paid key: needs the per-IP limit, global daily cap and provider spend limit (Brave prepaid credits helps cap loss).
8. **Terms drift.** Several terms were updated in 2026 (Brave 1 Sep, Brave privacy 3 Nov, Perplexity 23 Jan, Tavily 4 May); recheck at integration time and record in `docs/SOURCE_INVENTORY.md`.
9. **Currency/billing.** Mojeek bills in GBP with VAT excluded; account card required; no USD figure verified.

---

## 6. Ranked recommendation

1. **Brave Search API** (first test). Own index, clear self-serve pricing ($5 per 1,000, about 1,000 free/month), 50 q/s, explicit mention of forum/Reddit content in its LLM Context docs, and a ToS that plainly licenses display in your app. Hard condition: no persistent storage of results and a written answer on LLM-extraction use; otherwise ask for a storage-rights plan.
2. **Mojeek Search API** (run in parallel as the terms-clean alternative). Cheapest, explicit storage-rights and AI-use tiers, no attribution, EU/no sub-processors. Unknown: index depth for Reddit/KYM/Hinglish, and the full agreement text (needs an account to read).
3. **Perplexity Search API**. Terms explicitly allow showing output inside your app, price $5 (or $1 fast), but it keeps and may reuse queries and results, is silent on caching and LLM use, and Reddit's lawsuit makes it an awkward fit for a Reddit-pointer feature. Use only if tests 1 and 2 give poor coverage.

Not recommended: Serper, SerpApi (scrapers, legal exposure), Kagi (reseller at $12 per 1,000, terms not found), Exa (queries train models; app display rights unclear), Tavily and You.com (acceptable fallbacks; terms for display and cache not verified), Marginalia (non-commercial small-web only). Unavailable: Bing Web Search API, Google Custom Search JSON API (new customers).

Next actions (all need owner approval before any of them): (a) approve a free-tier test with Brave and Mojeek using 25 pop-culture and Hinglish queries; (b) email Brave about on-device LLM use and storage rights, and Mojeek for the full Search API Terms; (c) update spec section 2/7 and `docs/DECISIONS.md` for the backend and privacy disclosure; (d) record sources in `docs/SOURCE_INVENTORY.md`.

## Update 2026-11-16: Parallel (owner suggestion) and free tiers

- **Parallel** (https://parallel.ai/pricing, read 2026-11-16): "Build" pay-as-you-go plan gives
  "$5 free monthly with a card on file, plus up to $80 at signup", "up to 5,000 free requests per
  month", Search API "from $1 per 1k requests" (10 results), Extract "$1 per 1k URLs", 600 requests
  per minute. A card is required. Zero data retention only on the $1,000/month Scale plan, so queries
  are retained on the free plan. Display, caching and LLM-use terms (Customer Terms & Conditions)
  NOT VERIFIED; Reddit and Hinglish coverage NOT VERIFIED.
- Free-tier ranking for a small app (searches per month at no cost, from this file's earlier rows):
  Parallel about 5,000 (card) > Exa about 2,500 Lite (no card; queries train models) > Tavily
  1,000 (no card) ≈ Brave about 1,000 ($5 credit, card; clearest display terms) > Mojeek (small
  test credit).
