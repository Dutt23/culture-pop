// Our own curation before the AI sees anything: label each item by its job, drop noise, order, cap.
// Pure, so the app can run the same checks (flagSources) before sending.
import type {
  DraftSourceInput,
  EvidenceItem,
  EvidenceRole,
  NotUsed,
  SourceKind,
} from './cardTypes.js';

const MEANING_SITES =
  /(^|\.)(wiktionary\.org|merriam-webster\.com|dictionary\.com|dictionary\.cambridge\.org|urbandictionary\.com|knowyourmeme\.com|collinsdictionary\.com|oxfordlearnersdictionaries\.com)$/;
const ORIGIN_SITES = /(^|\.)(wikipedia\.org|wikiquote\.org|wikidata\.org|fandom\.com|imdb\.com)$/;
const CAPS: Record<EvidenceRole, number> = { meaning: 2, origin: 2, usage: 3 };
const ORDER: readonly EvidenceRole[] = ['meaning', 'origin', 'usage'];
const BOILERPLATE =
  /\b(cookie|subscribe|sign up|log in|advertisement|newsletter|all rights reserved|privacy policy|accept all)\b/i;
const APP_FROM = new Set(['app card', 'your card']);
const MIN_CHARS = 40;
const MIN_LATIN_SHARE = 0.6;
const LATIN_SEARCH_SHARE = 0.5;
const DUPLICATE_OVERLAP = 0.7;

export type FlagReason = 'off_topic' | 'other_language' | 'duplicate';

const siteOf = (from: string) =>
  ['wikipedia', 'wiktionary', 'wikiquote', 'wikidata'].includes(from) ? `${from}.org` : from;

export function roleOf(from: string, kind: SourceKind): EvidenceRole {
  if (kind === 'app') return from === 'app card' ? 'meaning' : 'usage';
  const site = siteOf(from);
  if (MEANING_SITES.test(site)) return 'meaning';
  if (ORIGIN_SITES.test(site)) return 'origin';
  return 'usage';
}

/** Share of letters that are Latin; a mostly non-Latin page is dropped for a Latin search. */
const latinShare = (text: string) => {
  const letters = text.match(/\p{L}/gu) ?? [];
  return letters.length
    ? letters.filter((c) => /\p{Script=Latin}/u.test(c)).length / letters.length
    : 1;
};

const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}']{3,}/gu) ?? []);

const overlap = (a: string, b: string) => {
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(1, Math.min(wa.size, wb.size));
};

const withoutBoilerplate = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !BOILERPLATE.test(s))
    .join(' ')
    .trim();

/** The whole search phrase scores 2, otherwise the share of its words present. */
const relevanceOf = (search: string) => {
  const searchWords = [...words(search)];
  const phrase = search.toLowerCase();
  return (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes(phrase)) return 2;
    if (!searchWords.length) return 1;
    return searchWords.filter((w) => lower.includes(w)).length / searchWords.length;
  };
};

export function flagSources(
  sources: readonly DraftSourceInput[],
  search: string,
): (FlagReason | null)[] {
  const latinSearch = latinShare(search) > LATIN_SEARCH_SHARE;
  const relevance = relevanceOf(search);
  return sources.map((s, i) => {
    const text = `${s.title} ${s.text ?? ''}`;
    if (latinSearch && latinShare(text) < MIN_LATIN_SHARE) return 'other_language';
    if (relevance(text) === 0) return 'off_topic';
    const isDuplicate = sources.slice(0, i).some((e) => {
      if (s.url && e.url === s.url) return true;
      return overlap(`${e.title} ${e.text ?? ''}`, text) > DUPLICATE_OVERLAP;
    });
    return isDuplicate ? 'duplicate' : null;
  });
}

type Candidate = Omit<EvidenceItem, 'id' | 'role'>;
type Kept = Candidate & { role: EvidenceRole };

/**
 * Labels, filters, orders and caps the items, then renumbers them E1… so ids stay short.
 * Returns the items to send and what was dropped.
 */
export function curateEvidence(
  items: readonly Candidate[],
  search: string,
): { items: EvidenceItem[]; dropped: NotUsed[] } {
  const latinSearch = latinShare(search) > LATIN_SEARCH_SHARE;
  const dropped: NotUsed[] = [];
  const drop = (k: Candidate, why: string) => dropped.push({ source: k.source, why });
  const kept: Kept[] = [];
  for (const raw of items) {
    const text = withoutBoilerplate(raw.text);
    if (text.length < MIN_CHARS) drop(raw, 'too short after cleaning');
    else if (latinSearch && latinShare(text) < MIN_LATIN_SHARE) drop(raw, 'different language');
    else if (kept.some((k) => overlap(k.text, text) > DUPLICATE_OVERLAP)) {
      drop(raw, 'near-duplicate');
    } else {
      const kind = APP_FROM.has(raw.from) ? 'app' : 'web';
      kept.push({ ...raw, text, role: roleOf(raw.from, kind) });
    }
  }
  const relevance = relevanceOf(search);
  const score = (k: Kept) => relevance(`${k.title} ${k.text}`);
  const relevant = kept.filter((k) => {
    if (score(k) > 0) return true;
    drop(k, 'mentions none of the search words');
    return false;
  });
  const ordered = ORDER.flatMap((role) => {
    // Best match first, and a second source before a second item from the same source.
    const seen = new Map<string, number>();
    const ofRole = relevant
      .filter((k) => k.role === role)
      .sort((a, b) => score(b) - score(a))
      .map((k) => {
        const repeat = (seen.get(k.from) ?? -1) + 1;
        seen.set(k.from, repeat);
        return { k, repeat };
      })
      .sort((a, b) => a.repeat - b.repeat)
      .map(({ k }) => k);
    ofRole.slice(CAPS[role]).forEach((k) => drop(k, `over the ${role} cap`));
    return ofRole.slice(0, CAPS[role]);
  });
  return { items: ordered.map((k, i) => ({ ...k, id: `E${i + 1}` })), dropped };
}
