// Our own curation before the AI sees anything: label each item by its job, drop noise, order, cap.
// This is the part we control fully; the prompt then only has to write.

/** Where a site's text usually helps: what it means, where it came from, or how people use it. */
const MEANING_SITES = /(^|\.)(wiktionary\.org|merriam-webster\.com|dictionary\.com|dictionary\.cambridge\.org|urbandictionary\.com|knowyourmeme\.com|collinsdictionary\.com|oxfordlearnersdictionaries\.com)$/;
const ORIGIN_SITES = /(^|\.)(wikipedia\.org|wikiquote\.org|wikidata\.org|fandom\.com|imdb\.com)$/;
const CAPS = { meaning: 2, origin: 2, usage: 3 };
const ORDER = ['meaning', 'origin', 'usage'];
/** Page furniture that Parallel's excerpts sometimes keep. */
const BOILERPLATE = /\b(cookie|subscribe|sign up|log in|advertisement|newsletter|all rights reserved|privacy policy|accept all)\b/i;

const siteOf = (from) => (from === 'wikipedia' || from === 'wiktionary' || from === 'wikiquote' ? `${from}.org` : from);

export function roleOf(item) {
  const site = siteOf(item.from);
  if (MEANING_SITES.test(site)) return 'meaning';
  if (ORIGIN_SITES.test(site)) return 'origin';
  return 'usage';
}

/** Share of letters that are Latin; a page mostly in another script is dropped for a Latin search. */
const latinShare = (text) => {
  const letters = text.match(/\p{L}/gu) ?? [];
  return letters.length ? letters.filter((c) => /\p{Script=Latin}/u.test(c)).length / letters.length : 1;
};

const words = (text) => new Set((text.toLowerCase().match(/[\p{L}\p{N}']{3,}/gu) ?? []));
const overlap = (a, b) => {
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(1, Math.min(wa.size, wb.size));
};

/** Sentences without page furniture. */
const withoutBoilerplate = (text) =>
  text.split(/(?<=[.!?])\s+/).filter((s) => !BOILERPLATE.test(s)).join(' ').trim();

/**
 * Labels, filters, orders and caps the items, then renumbers them E1… so ids stay short.
 * Returns the items to send and what was dropped, so a report can show our curation too.
 */
export function curateEvidence(items, search) {
  const latinSearch = latinShare(search) > 0.5;
  const dropped = [];
  const kept = [];
  for (const raw of items) {
    const text = withoutBoilerplate(raw.text);
    if (text.length < 40) { dropped.push({ ...raw, why: 'too short after cleaning' }); continue; }
    if (latinSearch && latinShare(text) < 0.6) { dropped.push({ ...raw, why: 'different language' }); continue; }
    if (kept.some((k) => overlap(k.text, text) > 0.7)) { dropped.push({ ...raw, why: 'near-duplicate' }); continue; }
    kept.push({ ...raw, text, role: roleOf(raw) });
  }
  // Relevance: the whole search phrase scores 2, otherwise the share of its words present.
  const searchWords = [...words(search)];
  const relevance = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes(search.toLowerCase())) return 2;
    return searchWords.length ? searchWords.filter((w) => lower.includes(w)).length / searchWords.length : 1;
  };
  const relevant = kept.filter((k) => {
    if (relevance(`${k.title} ${k.text}`) > 0) return true;
    dropped.push({ ...k, why: 'mentions none of the search words' });
    return false;
  });
  const ordered = ORDER.flatMap((role) => {
    // Best match first, and a second source before a second item from the same source.
    const seen = new Map();
    const ofRole = relevant
      .filter((k) => k.role === role)
      .sort((a, b) => relevance(`${b.title} ${b.text}`) - relevance(`${a.title} ${a.text}`))
      .map((k) => ({ k, repeat: (seen.set(k.from, (seen.get(k.from) ?? -1) + 1), seen.get(k.from)) }))
      .sort((a, b) => a.repeat - b.repeat)
      .map(({ k }) => k);
    ofRole.slice(CAPS[role]).forEach((k) => dropped.push({ ...k, why: `over the ${role} cap` }));
    return ofRole.slice(0, CAPS[role]);
  });
  return {
    items: ordered.map((k, i) => ({ ...k, id: `E${i + 1}` })),
    dropped,
  };
}
