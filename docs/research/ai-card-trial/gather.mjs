// Throwaway trial: evidence for 5 searches the app can't answer.
// Wikipedia + Wiktionary first, then up to 3 web pages via Parallel Search + Parallel Extract.
// Run: node --env-file=<project>/.env gather.mjs   (reads PARALLEL_API_KEY; never prints it)
import { writeFileSync } from 'node:fs';

const SEARCHES = process.env.SEARCHES
  ? JSON.parse(process.env.SEARCHES)
  : ['rizz', 'skibidi toilet', 'leap of faith assassins creed', "here's johnny", 'beige flag'];
const OUT = process.env.OUT ?? 'evidence.json';
const UA = { 'User-Agent': 'culture-pop-trial/0.1 (throwaway test script)' };
const PARALLEL_KEY = process.env.PARALLEL_API_KEY;
const MAX_ITEM = 1200;
const MAX_TOTAL = 6000;
const MAX_WEB_PAGES = 3;
// Usage tuning: 'usage' asks Extract for meaning and everyday use; EXTRA_USAGE_SEARCH adds pages that show it in use.
const EXTRACT_FOCUS = process.env.EXTRACT_FOCUS ?? 'facts';
const EXTRA_USAGE_SEARCH = process.env.EXTRA_USAGE_SEARCH === '1';
const EXTRA_PAGES = 2;
// RICH=1: up to 2 of the 3 web links come from meaning sites (a second search limited to them), Extract
// asks for creator, who says it to whom, attitude and every use, short excerpts are topped up from the
// page's full text, and meaning-site items go before Wikipedia so the 6,000-character cap keeps them.
// RICH=2 (after RICH=1 pulled page menus and off-topic meme pages): a meaning-site page only when its
// title or snippet has the whole search, the usual Extract objective, item text = the excerpt and
// full-text sentences that name the search (no menus), and the usual order (Wikipedia before web).
const RICH = process.env.RICH === '1' || process.env.RICH === '2';
const RICH2 = process.env.RICH === '2';
const MEANING_DOMAINS = ['knowyourmeme.com', 'urbandictionary.com', 'merriam-webster.com', 'dictionary.com'];
const isMeaningSite = (url) => MEANING_DOMAINS.some((d) => host(url) === d || host(url).endsWith(`.${d}`));
const WIKIMEDIA = /(^|\.)(wikipedia|wiktionary|wikiquote|wikidata)\.org$/;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
const clean = (html) =>
  html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
// Markdown from Parallel: images out, links to their words, marks removed (as api/web-search.ts does).
const plain = (md) =>
  md.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, ' ').replace(/[#*_`>|]/g, '').replace(/\s+/g, ' ').trim();
const host = (url) => new URL(url).hostname.replace(/^www\./, '');

// Wikimedia rate-limits bursts: wait between calls, and once more after a 429.
async function getJson(url, retried = false) {
  await pause(1500);
  const response = await fetch(url, { headers: UA });
  if (response.status === 429 && !retried) {
    await pause(30_000);
    return getJson(url, true);
  }
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function wikipedia(q) {
  const search = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&origin=*&srsearch=${encodeURIComponent(q)}`);
  const titles = search.query.search.map((s) => s.title);
  if (titles.length === 0) return [];
  const pages = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&origin=*&titles=${encodeURIComponent(titles.join('|'))}`);
  return titles
    .map((title) => Object.values(pages.query.pages).find((p) => p.title === title))
    .filter((p) => p?.extract)
    .map((p) => ({ from: 'wikipedia', title: p.title, text: clip(p.extract.replace(/\s+/g, ' '), MAX_ITEM) }));
}

async function wiktionary(q) {
  if (q.split(' ').length > 2) return [];
  try {
    const defs = await getJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(q.replace(/ /g, '_'))}`);
    return (defs.en ?? []).slice(0, 2).map((d) => ({
      from: 'wiktionary',
      title: q,
      text: clip(`${d.partOfSpeech}: ${d.definitions.slice(0, 2).map((x) => clean(x.definition)).join(' / ')}`, MAX_ITEM),
    }));
  } catch {
    return [];
  }
}

async function parallel(path, body) {
  const response = await fetch(`https://api.parallel.ai/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': PARALLEL_KEY },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Parallel ${path} ${response.status}`);
  return response.json();
}

/** The same search the app runs, then Extract on the top web pages for text from inside them. */
async function web(q) {
  if (!PARALLEL_KEY) return { items: [], note: 'no PARALLEL_API_KEY' };
  const objective = `Explain "${q}": what it means or refers to in pop culture or internet culture (films, TV, comics, games, music, memes, slang), and where it comes from.`;
  const found = await parallel('search', {
    objective,
    search_queries: [q, `${q} meaning origin`],
    mode: 'fast',
    max_chars_total: 6000,
    advanced_settings: { max_results: 10 },
  });
  const isWeb = (r) => r.url && !WIKIMEDIA.test(new URL(r.url).hostname);
  const pages = (found.results ?? []).filter(isWeb).slice(0, MAX_WEB_PAGES);
  if (RICH) {
    const meaning = await parallel('search', {
      objective,
      search_queries: [q, `${q} meaning`],
      mode: 'fast',
      max_chars_total: 6000,
      advanced_settings: { max_results: 10, source_policy: { include_domains: MEANING_DOMAINS } },
    });
    const picked = [];
    const onTopic = (r) => !RICH2 || `${r.title} ${(r.excerpts ?? []).join(' ')}`.toLowerCase().includes(q.toLowerCase());
    for (const r of (meaning.results ?? []).filter((r) => r.url && isMeaningSite(r.url) && onTopic(r))) {
      if (picked.length < 2 && !picked.some((p) => host(p.url) === host(r.url))) picked.push(r);
    }
    const rest = (found.results ?? []).filter((r) => isWeb(r) && !picked.some((p) => p.url === r.url));
    pages.splice(0, pages.length, ...[...picked, ...rest].slice(0, MAX_WEB_PAGES));
  }
  const richObjective = `Explain "${q}" for someone who just heard it: what it means, who created it or which show, film, book, game or meme it comes from, who says it to whom, the tone or attitude (smug, mocking, menacing, rude), and every way people use it in everyday conversation, with example sentences.`;
  const usageObjective = `What "${q}" means when someone says it in a chat or online, and how and when people use it in everyday conversation. Prefer real example sentences of people using it.`;
  if (EXTRA_USAGE_SEARCH) {
    const more = await parallel('search', {
      objective: usageObjective,
      search_queries: [`${q} meaning`, `how to use ${q}`, `${q} example`],
      mode: 'fast',
      max_chars_total: 6000,
      advanced_settings: { max_results: 10 },
    });
    const known = new Set(pages.map((p) => p.url));
    pages.push(...(more.results ?? []).filter((r) => isWeb(r) && !known.has(r.url)).slice(0, EXTRA_PAGES).map((r) => ({ ...r, extra: true })));
  }
  const snippetChars = pages.map((p) => (p.excerpts ?? []).join(' ').length);
  if (pages.length === 0) return { items: [], note: 'no web pages' };
  const extractObjective = RICH && !RICH2 ? richObjective : EXTRACT_FOCUS === 'usage' ? usageObjective : objective;
  const extracted = await parallel('extract', { urls: pages.map((p) => p.url), objective: extractObjective, ...(RICH && { advanced_settings: { full_content: { max_chars_per_result: 20000 } } }) });
  const items = pages.map((page, i) => {
    const got = (extracted.results ?? []).find((r) => r.url === page.url);
    const excerpt = plain((got?.excerpts ?? page.excerpts ?? []).join(' '));
    const full = plain(got?.full_content ?? '');
    const text = RICH2 ? namingSentences(`${excerpt} ${full}`, q) : RICH ? topUp(excerpt, full, q) : excerpt;
    return { meaningSite: isMeaningSite(page.url), from: host(page.url), title: plain(page.title ?? got?.title ?? host(page.url)).slice(0, 120), text: clip(text, MAX_ITEM), url: page.url, searchChars: snippetChars[i] ?? 0, extractChars: text.length, extra: Boolean(page.extra) };
  });
  return { items, note: `${pages.length} pages (${pages.filter((p) => p.extra).length} from the usage search); extract errors: ${(extracted.errors ?? []).length}` };
}

/** Excerpts first, then full-text sentences that name the search, until the item cap. */
function topUp(excerpt, full, q) {
  let text = excerpt;
  for (const sentence of full.split(/(?<=[.!?])\s+/)) {
    if (text.length + sentence.length + 1 > MAX_ITEM) break;
    if (sentence.toLowerCase().includes(q.toLowerCase()) && !text.includes(sentence)) text = `${text} ${sentence}`.trim();
  }
  return text;
}

/** Sentences that name the search (or most of its words), in page order, without repeats or menu runs. */
function namingSentences(text, q) {
  const qWords = q.toLowerCase().split(' ').filter((w) => w.length > 2);
  const names = (s) => s.toLowerCase().includes(q.toLowerCase()) || qWords.filter((w) => s.toLowerCase().includes(w)).length >= Math.max(1, qWords.length - 1);
  const kept = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (sentence.length > 400 || !names(sentence) || kept.includes(sentence)) continue;
    kept.push(sentence);
  }
  return kept.join(' ');
}

const out = [];
for (const q of SEARCHES) {
  const wiki = await wikipedia(q).catch((error) => {
    console.log(`  Wikipedia skipped for ${q}: ${error.message.split(' ')[0]}`);
    return [];
  });
  const webResult = await web(q).catch((error) => ({ items: [], note: error.message }));
  const items = RICH && !RICH2
    ? [...(await wiktionary(q)), ...webResult.items.filter((i) => i.meaningSite), ...wiki, ...webResult.items.filter((i) => !i.meaningSite)]
    : [...(await wiktionary(q)), ...wiki, ...webResult.items];
  const kept = [];
  let total = 0;
  for (const it of items) {
    if (!it.text || total + it.text.length > MAX_TOTAL) continue; // dropped, not cut
    total += it.text.length;
    kept.push({ id: `E${kept.length + 1}`, ...it });
  }
  out.push({ q, evidence: kept, chars: total, webNote: webResult.note });
  console.log(`${q}: ${kept.length} items (${kept.filter((k) => k.url).length} web), ${total} chars | web: ${webResult.note}`);
  for (const k of kept.filter((k) => k.url)) console.log(`    ${k.from}: search ${k.searchChars} chars → extract ${k.extractChars} chars`);
}
writeFileSync(new URL(`./${OUT}`, import.meta.url), JSON.stringify(out, null, 2));
