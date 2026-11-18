import { fromWorks } from './labels';
import type { Category, Reference } from './types';

export interface ExternalSearchLink {
  site: string;
  href: string;
}

export interface ExternalSearchGroup {
  label: string;
  links: ExternalSearchLink[];
}

type Site =
  | 'Wikipedia'
  | 'Wikiquote'
  | 'Know Your Meme'
  | 'Urban Dictionary'
  | 'Reddit'
  | 'IMDb'
  | 'TVmaze'
  | 'MyAnimeList'
  | 'YouTube'
  | 'Spotify'
  | 'DuckDuckGo';

/**
 * Tap-only search links: nothing is sent until the user taps. Templates verified 2026-11-15
 * (docs/research/source-candidates.md). Each link is independent, so one site being down
 * never affects the others.
 */
const SEARCH_URL: Readonly<Record<Site, string>> = {
  Wikipedia: 'https://en.wikipedia.org/w/index.php?search=',
  Wikiquote: 'https://en.wikiquote.org/w/index.php?search=',
  'Know Your Meme': 'https://knowyourmeme.com/search?q=',
  'Urban Dictionary': 'https://www.urbandictionary.com/define.php?term=',
  Reddit: 'https://www.reddit.com/search/?q=',
  IMDb: 'https://www.imdb.com/find/?q=',
  TVmaze: 'https://www.tvmaze.com/search?q=',
  MyAnimeList: 'https://myanimelist.net/search/all?q=',
  // sp=EgIQAQ%3D%3D is YouTube's own "Type: Video" filter: no channels or playlists.
  YouTube: 'https://www.youtube.com/results?sp=EgIQAQ%3D%3D&search_query=',
  // On a phone with Spotify installed, this link opens the app.
  Spotify: 'https://open.spotify.com/search/',
  DuckDuckGo: 'https://duckduckgo.com/?q=',
};

const GROUPS: readonly { label: string; sites: readonly Site[] }[] = [
  { label: 'Encyclopedias and quotes', sites: ['Wikipedia', 'Wikiquote'] },
  { label: 'Memes and slang', sites: ['Know Your Meme', 'Urban Dictionary', 'Reddit'] },
  { label: 'Shows, films and anime', sites: ['IMDb', 'TVmaze', 'MyAnimeList'] },
  { label: 'Music and videos', sites: ['YouTube', 'Spotify'] },
  { label: 'Anything else', sites: ['DuckDuckGo'] },
];

const searchUrl = (site: Site, query: string) =>
  `${SEARCH_URL[site]}${encodeURIComponent(query.trim())}`;

export function externalSearchLinks(query: string): ExternalSearchGroup[] {
  return GROUPS.map(({ label, sites }) => ({
    label,
    links: sites.map((site) => ({ site, href: searchUrl(site, query) })),
  }));
}

const GENERAL: readonly Site[] = ['Wikipedia', 'YouTube', 'DuckDuckGo'];
const SCREEN: readonly Site[] = ['TVmaze', 'IMDb', 'Wikipedia'];
const SLANG: readonly Site[] = ['Know Your Meme', 'Urban Dictionary', 'Reddit'];

/** The sites a card's own page offers first, by what the card is about. */
const CARD_SITES: Readonly<Record<Category, readonly Site[]>> = {
  music: ['Spotify', 'YouTube', 'Wikipedia'],
  anime: ['MyAnimeList', 'Wikipedia', 'YouTube'],
  cartoon: SCREEN,
  tv: SCREEN,
  film: ['IMDb', 'Wikipedia', 'YouTube'],
  meme: SLANG,
  catchphrase: SLANG,
  saying: ['Wikiquote', 'Wikipedia', 'Urban Dictionary'],
  comics: GENERAL,
  games: GENERAL,
  other: GENERAL,
};

/** Sites that list whole shows, films and anime: a quote card searches them for its work. */
const WORK_SITES: ReadonlySet<Site> = new Set(['IMDb', 'TVmaze', 'MyAnimeList']);

/** A name, not an aside like "who they are", "TV series" or "2016 song". */
const startsAsName = (text: string) => /^[\p{Lu}\d]/u.test(text) && !/^(?:\d{4}|TV)\b/.test(text);

/** What's inside a title's brackets, up to any comma: "(The Chainsmokers, a deep cut)". */
const bracketLead = (inside: string) => inside.split(',')[0].trim();

/**
 * A card title as a search: "Closer (The Chainsmokers)" becomes "Closer The Chainsmokers", and
 * "The Chainsmokers (who they are)" becomes "The Chainsmokers". Quote marks are dropped.
 */
export function searchName(title: string): string {
  const cleaned = title
    .replace(/\(([^)]*)\)/g, (_, inside: string) => {
      const lead = bracketLead(inside);
      return startsAsName(lead) ? ` ${lead} ` : ' ';
    })
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || title.trim();
}

/** The show, film or anime a quote or character comes from, when the card says. */
function workOf(reference: Reference): string | undefined {
  if (reference.kind === 'work') return undefined;
  const sourced = fromWorks(reference)[0]?.label;
  if (sourced) return sourced;
  const inBrackets = /\(([^)]*)\)/.exec(reference.title)?.[1];
  const lead = inBrackets === undefined ? '' : bracketLead(inBrackets);
  return startsAsName(lead) ? lead : undefined;
}

export interface CardSearchLink {
  label: string;
  href: string;
}

/** "Find it on": three search links chosen by the card's type, Spotify first for music. */
export function cardSearchLinks(reference: Reference): CardSearchLink[] {
  const name = searchName(reference.title);
  const work = workOf(reference);
  return CARD_SITES[reference.category].map((site) => ({
    label: site === 'Spotify' ? 'Open in Spotify' : site,
    href: searchUrl(site, work && WORK_SITES.has(site) ? work : name),
  }));
}
