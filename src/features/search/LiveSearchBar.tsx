import { useContext } from 'react';
import { SearchPeek } from '../../components/mascot/SearchPeek';
import type { PeekOutcome } from '../../components/mascot/usePeek';
import { SearchBar } from '../../components/search-bar/SearchBar';
import { normalizePhrase } from '../../domain/normalize';
import { LiveQueryContext } from './liveQuery';
import { useRecordSearch } from './useSearchHistory';

interface LiveSearchBarProps {
  /** How the search the results show is going. */
  outcome: PeekOutcome;
  /** The query `outcome` belongs to; while the box is ahead of it, the search is still going. */
  outcomeQuery: string;
  peekEnabled: boolean;
}

export function LiveSearchBar({ outcome, outcomeQuery, peekEnabled }: LiveSearchBarProps) {
  const live = useContext(LiveQueryContext);
  if (!live) throw new Error('LiveSearchBar needs a LiveQueryContext');
  const recordSearch = useRecordSearch();
  const { query, setQuery, settleQuery } = live;
  return (
    <SearchPeek
      query={query}
      outcome={query === outcomeQuery ? outcome : 'pending'}
      enabled={peekEnabled}
    >
      <SearchBar
        value={query}
        autoFocus={normalizePhrase(query).length === 0}
        onChange={setQuery}
        onSubmit={(value) => {
          settleQuery();
          recordSearch(value);
        }}
      />
    </SearchPeek>
  );
}
