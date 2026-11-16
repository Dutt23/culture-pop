# Answering list questions about fiction (2026-11-16)

Owner question: the app can't answer list or judgement questions such as "who committed the worst
genocides". The owner expects a short list: Paul Atreides (Dune), Eren Yeager (Attack on Titan),
Lelouch (Code Geass), Frieza (Dragon Ball) and so on, each with a reason and a source. Today the app
returns pages (a Fandom category, anime-villain listicles) with snippets. This note covers how to get
answers that are **correct** (real characters, real works, sourced claims), fast, cheap and private.
Every live check below was a read-only request made on 2026-11-16.

## A. Structured sources, no AI

| Source | What a live check found | Use |
| --- | --- | --- |
| **Wikidata SPARQL** | Only 3 fictional characters (P31/P279\* Q95074) point at genocide (Q41397) at all, all obscure, through P101 "field of work". Frieza has `occupation = fictional tyrant`, `character type = villain`, `narrative role = antagonist`. Paul Atreides, Eren Yeager and Lelouch have no statement about killing (Lelouch has `occupation = terrorist`). | **Cannot answer.** Good for **checking** an item: is it a fictional character, which work is it in (P1441), which franchise. The code already reads these (`wikidata.ts`). |
| **Wikipedia categories** | `Category:Fictional mass murderers` has 765 pages and `Fictional war criminals` has 73. Both contain Frieza and Eren Yeager. Lelouch, Light Yagami, Thanos and Darth Vader are mass murderers only. Paul Atreides is in neither. `Category:Fictional genocides` exists but is empty. No "Genocide in fiction" or "List of fictional genocides" article exists. Mass murderers ∩ war criminals = 52 names, almost all plausible (Palpatine, Tarkin, Daenerys, Kefka, Megatron, Omni-Man, Homelander…). | A good **candidate list** with no AI. A category is an editor's judgement and gives no reason. |
| **Wikipedia search inside a category** | `incategory:"Fictional_mass_murderers" genocide` returned **45 pages, each with a highlighted snippet** (Thanos: "Due to his genocidal tendencies…"; Ronan: "embarks on a genocidal campaign against the Xandarians"). About 6 of the top 20 were wrong: Bardock is a *victim* ("survivors of the Saiyan genocide by Frieza"), Monokuma matched the character name "Genocide Jack", Doctor Poison and Firefly matched a golem called "Genocide", and Nyssa *turned against* a genocide plan. | **Best no-AI source:** one browser request, CORS already allowed, every item comes with a Wikipedia sentence. A word match can't tell perpetrator from victim. |
| **Fandom (Villains Wiki)** | `villains.fandom.com/api.php` is public. It sends `access-control-allow-origin: *`, and the site reports its licence as **CC BY-SA** (`siteinfo rightsinfo`). `Category:Genocidal` has **9,657 pages**, including Paul Atreides, Eren Yeager and Thanos (MCU). The category is broad and fan-judged, and search inside a category returned nothing. No published rate limit was found (unverified). Wikipedia sent us a **429** after a burst of category paging. | Use to **check a name**, not to build a list: too broad to rank. |
| **TV Tropes** | No public API (a [scraper vendor](https://apify.com/lulzasaur/tvtropes-scraper) says so; not confirmed by TV Tropes). Licence **CC BY-NC-SA** since 2012 ([Wikipedia](https://en.wikipedia.org/wiki/TV_Tropes)). | Skip: it would mean scraping HTML. |

**Question → lookup without AI.** Use a small hand-written table: keyword stems map to a Wikipedia
category, a search word and a Fandom category. For example `genocid|exterminat|wipe out` maps to
(`Fictional mass murderers`, `genocide`, Villains `Genocidal`). Further rows: `betray` →
`Fictional traitors`, `dictator|tyrant` → `Fictional dictators`, `mass murder|killed the most` →
`Fictional mass murderers`. Detect a list question with the D44 question rule plus a plural or
superlative noun ("who …", "which villains …", "worst", "most"). Coverage covers only the rows we
write (perhaps 20–40 covers most of what one person asks), and the answer is only as precise as
Wikipedia's categories. Paul Atreides is missed because Wikipedia doesn't categorise him that way.

## B. Picking names out of retrieved pages, without AI

Matching every Parallel snippet against *all* Wikidata character labels is noisy, because short
labels ("Light", "Ace") collide with ordinary words. Match against the **closed candidate list from
A** instead (52 to 765 titles plus their Wikidata aliases). Then count **independent sources** per
name: the Wikipedia category, the Wikipedia search hit, the Villains Wiki category and each distinct
Parallel host whose excerpt names the character next to the keyword. The result is an honest
"named by N sources" order. A simple check removes most false hits: drop a sentence where the name
follows "by", "survivor", "victim of" or "against". This catches Bardock, but not every case.

## C. Server AI with grounding (only if the owner drops "no hosted inference")

1. Retrieve: the Wikipedia `incategory:` search, a Parallel search and the Fandom category check, in
   parallel.
2. One call to a cheap model with **only those snippets**. It returns JSON of the form `{name, work,
   why, quote, sourceUrl}`, where `quote` must be a **verbatim** span from a supplied snippet.
3. Check in code: the quote string appears in that snippet; the name resolves on Wikidata to a
   fictional character; P1441 or the franchise matches `work`. Drop any item that fails a check.
   "Worst" is never decided by the model (see D).

Cost: roughly 4k tokens in and 600 out per answer. At Gemini 2.5 Flash-Lite's $0.10/$0.40 per 1M
([Google](https://aistudio.google.com/docs/pricing)) that is about **$0.0006** per answer, and
Groq gpt-oss-20b is similar ([Groq](https://console.groq.com/docs/models)). Haiku prices are in
`explainer-products.md`. Latency adds one model call on top of search. It was not measured;
Groq is the fastest at about 1,000 tokens/s. Privacy: the question and the public snippets go to
one more provider. The key stays on the server, and nothing is stored, as in D45.
[Parallel FindAll](https://parallel.ai/products/findall) builds cited entity lists from a
natural-language query, but it is a slow batch job billed per match (Parallel's own figures; price
per run and speed unverified). It is better suited to building the mapping table offline than to a
live tap.

## D. Presenting "worst" honestly

| Option | Honest? | Notes |
| --- | --- | --- |
| "Often named for genocide in fiction", ordered by source count | Yes | Default. Show "named by 3 sources" on each item. |
| Show scale only when a source states it ("destroyed the planet where the Saiyans had settled" — Wikipedia, Frieza) | Yes | Quote it; never compare numbers across works. |
| Order by "worst" | No | No source ranks it. Present it as a judgement only when a quoted listicle says so, labelled "<site> calls this the worst". |

## E. Phone UX

One answer card, **"Often named for this"**, holding 3–8 rows. Each row shows the character, the work
(from Wikidata), a one-line reason quoted from its source, a source chip and "named by N". The
character links to the reference page and the chip opens the source. Below sit "More from the web"
(today's results) and the honest limit: "Lists come from Wikipedia categories and the sources
shown; who is 'worst' is opinion." **Spoilers:** a "who did X" answer is mostly spoilers (Eren and
Paul are late-story twists). With `settings.spoilers` hidden, the card shows only the works ("8
characters from Dune, Attack on Titan, Dragon Ball…") and one **Reveal** button for names and
reasons, using the existing InterpretationCard reveal pattern.

## F. Recommendation

1. **Smallest first step, no AI, about 1–1.5 days.** Add a list-question detector, a mapping table
   with about 10 rows, and the Wikipedia `incategory:` search (one request). Rank by source count,
   using the Wikipedia category, a Villains Wiki category check (a single batched `titles=` request)
   and mentions in Parallel results, matched only against candidate names. Add the "by / victim"
   filter and the spoiler-gated card. The spec allows all of this; no new provider is involved.
   Risks: wrong rows (about 6 of the top 20 in the test, half of them removed by the filter), names
   missing from Wikipedia's categories (Paul Atreides), and 429s if requests are bursty. Keep it to
   one request per source per question.
2. **If the owner allows server AI**, add C on top of the same retrieval, behind a button ("Tidy
   this list"), with every item checked by code. Needed from the owner: a decision on the "no hosted
   inference" spec line, a Gemini or Anthropic key in Vercel, and a daily cap like D45's.
3. **Measuring correctness:** about 15 list questions, each with an expected list written by the
   owner, covering genocide, betrayal, "characters who died and came back", "fake deaths" and "AI
   villains". For each shown item, score **precision**: the item is right *and* its shown source
   supports the reason, judged by a person. Also score **recall** against the expected list. Targets
   to agree with the owner: precision ≥ 90% (a wrong name is worse than a missing one), recall ≥ 50%.
   Record recall and precision before and after step 2, so the AI option is judged on numbers.

Sources for the live checks: query.wikidata.org/sparql, en.wikipedia.org/w/api.php
(`categorymembers`, `search` with `incategory:`, `prop=categories`), villains.fandom.com/api.php
(`siteinfo`, `categorymembers`, `prop=categories`).
