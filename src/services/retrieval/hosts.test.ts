import { describe, expect, it } from 'vitest';
import { connectSrc, RETRIEVAL_HOSTS } from './hosts';
import { ALLOWED_HOSTS } from './http';

describe('retrieval hosts', () => {
  it('builds CSP connect-src from exactly the hosts the HTTP client allows', () => {
    const [directive, self, ...origins] = connectSrc().split(' ');
    expect([directive, self]).toEqual(['connect-src', "'self'"]);
    expect(origins.every((o) => o === `https://${new URL(o).hostname}`)).toBe(true);
    expect(new Set(origins.map((o) => new URL(o).hostname))).toEqual(ALLOWED_HOSTS);
    expect(origins).toHaveLength(RETRIEVAL_HOSTS.length);
  });

  it('sends Api-User-Agent only to Wikimedia hosts', () => {
    const withHeader = RETRIEVAL_HOSTS.filter((h) => h.apiUserAgent).map((h) => h.host);
    const wikimedia = /\.(wikipedia|wikidata|wiktionary|wikiquote)\.org$/;
    expect(withHeader.every((host) => wikimedia.test(host))).toBe(true);
  });
});
