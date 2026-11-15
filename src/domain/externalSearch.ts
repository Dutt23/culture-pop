export interface ExternalSearchLink {
  site: string;
  href: string;
}

export interface ExternalSearchGroup {
  label: string;
  links: ExternalSearchLink[];
}

/**
 * Tap-only search links: nothing is sent until the user taps. Templates verified 2026-11-15
 * (docs/research/source-candidates.md). Each link is independent, so one site being down
 * never affects the others.
 */
const GROUPS: readonly { label: string; sites: readonly [string, string][] }[] = [
  {
    label: 'Encyclopedias and quotes',
    sites: [
      ['Wikipedia', 'https://en.wikipedia.org/w/index.php?search='],
      ['Wikiquote', 'https://en.wikiquote.org/w/index.php?search='],
    ],
  },
  {
    label: 'Memes and slang',
    sites: [
      ['Know Your Meme', 'https://knowyourmeme.com/search?q='],
      ['Urban Dictionary', 'https://www.urbandictionary.com/define.php?term='],
      ['Reddit', 'https://www.reddit.com/search/?q='],
    ],
  },
  {
    label: 'Shows, films and anime',
    sites: [
      ['IMDb', 'https://www.imdb.com/find/?q='],
      ['TVmaze', 'https://www.tvmaze.com/search?q='],
      ['MyAnimeList', 'https://myanimelist.net/search/all?q='],
    ],
  },
  {
    label: 'Anything else',
    sites: [['DuckDuckGo', 'https://duckduckgo.com/?q=']],
  },
];

export function externalSearchLinks(query: string): ExternalSearchGroup[] {
  const q = encodeURIComponent(query.trim());
  return GROUPS.map(({ label, sites }) => ({
    label,
    links: sites.map(([site, base]) => ({ site, href: `${base}${q}` })),
  }));
}
