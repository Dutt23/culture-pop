import type { WebSearchFailure } from '../../services/retrieval/webSearch';
import { FAILURE_TEXT } from '../search/webSearchText';

/** The search copy names the wider web search; a card has its own words. */
export const DRAFT_FAILURE_TEXT: Record<WebSearchFailure, string> = {
  ...FAILURE_TEXT,
  offline: "You're offline. Making a card needs a connection.",
  bad_query: 'This search is too long to make a card from. Try fewer words.',
  rate_limited: 'Too many cards just now. Try again in a minute.',
  daily_cap: "Today's cards are used up. Try again tomorrow.",
  out_of_credit: 'The card writer is paused for now. Try again later.',
  not_configured: "The card writer isn't set up on the server yet.",
  signed_out: 'Sign in to make a card.',
  not_allowed: "Making cards isn't turned on for your account yet. Ask the owner.",
  blocked: 'The server refused to make the card.',
  failed: "The card writer didn't answer. Try again.",
};
