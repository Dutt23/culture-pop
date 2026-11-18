import type { SourceKind } from '../../../api/_lib/cardTypes.js';
import type { Interpretation, Reference } from '../../domain/types';
import type { RetrievedCandidate } from '../../services/retrieval/types';
import type { WebResult } from '../../services/retrieval/webSearch';

export interface Frame {
  key: string;
  kind: SourceKind;
  from: string;
  title: string;
  line: string;
  url?: string;
  text?: string;
}

const WIKIS = ['wikipedia', 'wiktionary', 'wikiquote', 'wikidata'] as const;

const wikiFrom = (publisher: string, url: string) => {
  const hay = `${publisher} ${url}`.toLowerCase();
  return WIKIS.find((w) => hay.includes(w));
};

function hrefOf(url: string | undefined): string | undefined {
  try {
    return url ? new URL(url).href : undefined;
  } catch {
    return undefined;
  }
}

/** Same rule as the server: https only, no credentials in the address. */
function httpsHref(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export function framesFrom(input: {
  candidates: RetrievedCandidate[];
  webResults: WebResult[];
  appCards: { reference: Reference; interpretation: Interpretation; own: boolean }[];
}): Frame[] {
  const all: Frame[] = [];
  for (const c of input.candidates) {
    const s = c.sources[0];
    const from = s && wikiFrom(s.publisher, s.url);
    if (!s || !from) continue; // the server accepts only the four wikis
    const line = s.excerpt || c.title;
    all.push({ key: `wiki:${c.id}`, kind: 'wiki', from, title: c.title, line, text: line, url: s.url });
  }
  for (const w of input.webResults) {
    const href = httpsHref(w.url);
    if (!href) continue;
    const from = new URL(href).hostname.replace(/^www\./, '');
    all.push({ key: href, kind: 'web', from, title: w.title, line: w.snippet, text: w.snippet, url: href });
  }
  for (const { reference, interpretation: i, own } of input.appCards) {
    all.push({
      key: `app:${reference.id}`,
      kind: 'app',
      from: own ? 'your card' : 'app card',
      title: reference.title,
      line: i.gist ?? i.summary,
      text: [i.gist, i.summary, i.context].filter(Boolean).join(' '),
    });
  }
  const keys = new Set<string>();
  const urls = new Set<string>();
  return all.filter((f) => {
    const href = hrefOf(f.url);
    if (keys.has(f.key) || (href && urls.has(href))) return false;
    keys.add(f.key);
    if (href) urls.add(href);
    return true;
  });
}
