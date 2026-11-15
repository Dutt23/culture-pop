/**
 * Every host retrieval may call — the single list behind both the HTTP client's allowlist
 * (`http.ts`) and the production CSP `connect-src` (`vite.config.ts`), so adding a source is one
 * edit here. Verification for each: docs/SOURCE_INVENTORY.md. Kept free of imports so the Vite
 * config can load it.
 */
export interface RetrievalHost {
  host: string;
  /**
   * Wikimedia asks for an `Api-User-Agent` header. Other hosts get none: it is a custom header,
   * so it forces a CORS preflight, which TVmaze answers with 405.
   */
  apiUserAgent: boolean;
}

/** MusicBrainz is deliberately absent: its terms can't be met from a browser (D34). */
export const RETRIEVAL_HOSTS: readonly RetrievalHost[] = [
  { host: 'en.wikipedia.org', apiUserAgent: true },
  { host: 'query.wikidata.org', apiUserAgent: true },
  { host: 'en.wiktionary.org', apiUserAgent: true },
  { host: 'en.wikiquote.org', apiUserAgent: true },
  { host: 'api.tvmaze.com', apiUserAgent: false },
];

/** The CSP directive allowing exactly these hosts (https only) besides the app itself. */
export function connectSrc(): string {
  return ["connect-src 'self'", ...RETRIEVAL_HOSTS.map((h) => `https://${h.host}`)].join(' ');
}
