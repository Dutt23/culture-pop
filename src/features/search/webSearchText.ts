import type { WebSearchFailure } from '../../services/retrieval/webSearch';

export const FAILURE_TEXT: Record<WebSearchFailure, string> = {
  offline: "You're offline. The wider web search needs a connection.",
  signed_out: 'Sign in to search the wider web.',
  not_allowed: "The wider web search isn't turned on for your account yet. Ask the owner.",
  bad_query: 'This search is too long for the wider web search. Try fewer words.',
  rate_limited: 'Too many searches just now. Try again in a minute.',
  daily_cap: "Today's wider web searches are used up. Try again tomorrow.",
  out_of_credit: 'The wider web search is paused for now. Try again later.',
  not_configured: "The wider web search isn't set up on the server yet.",
  blocked: 'The server refused the search.',
  no_card: "These results don't explain it. Try ticking others.",
  failed: "The wider web search didn't answer. Try again.",
  aborted: 'The search was cancelled.',
};

/** The consent card's wording; Settings repeats it in short (D45). */
export const WEB_SEARCH_DISCLOSURE = [
  'Your search text goes through our server to Parallel (parallel.ai), a paid web-search service.',
  'Nothing else is sent: no account, no device details, no location.',
  'Parallel keeps searches and may use them to improve its service.',
  'Results are links to other sites, and nobody has checked them.',
  'Results from the wider web can be kept on this device, for you only, for 30 days while search',
  'history is on. They are never sent anywhere else, and Clear history deletes them.',
  'A link you save with the heart (its title and address only) stays on this device until you',
  'remove it or reset the app.',
  'If you make a card from results, the search, the results you picked and any style cards go',
  'through our server to OpenAI (or Cloudflare if OpenAI is busy) to write a draft, and Parallel',
  "reads the web pages you picked. They don't use it to train their models. The card is kept only",
  'on this device.',
].join(' ');

export const isAccessFailure = (failure: WebSearchFailure): boolean =>
  failure === 'signed_out' || failure === 'not_allowed';
