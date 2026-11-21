import { createContext } from 'react';

export interface LiveQuery {
  /** The text in the box, up to date on every key press. */
  query: string;
  setQuery: (value: string) => void;
  settleQuery: () => void;
}

/**
 * The search box reads the text from here, not from props, so a key press redraws only the box
 * while the results below catch up a moment later (they are drawn from a deferred copy).
 */
export const LiveQueryContext = createContext<LiveQuery | null>(null);
