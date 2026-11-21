import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { useRepositories } from '../../app/useRepositories';
import type { HistoryEntry } from '../../domain/history';
import { useSettings } from '../settings/useSettings';

const NONE: HistoryEntry[] = [];

/**
 * Records a search when the form is submitted or a result is opened, never per keystroke (D37).
 * Does nothing while history is off, or before stored settings are read (they may say off).
 */
export function useRecordSearch(): (text: string, referenceId?: string) => void {
  const { history } = useRepositories();
  const { settings, settingsLoaded } = useSettings();
  const enabled = settingsLoaded && settings.history === 'on';
  return useCallback(
    (text, referenceId) => {
      if (!enabled) return;
      // History is a convenience: a failed write (e.g. storage full) must never interrupt a search.
      history.record({ text, referenceId }, Date.now()).catch(() => undefined);
    },
    [history, enabled],
  );
}

/** A live list from one history query; empty while history is off. */
function useHistoryList(query: 'recent' | 'frequent', limit: number): HistoryEntry[] {
  const { history } = useRepositories();
  const { settings } = useSettings();
  const on = settings.history === 'on';
  return (
    useLiveQuery(
      () => (on ? history[query](limit, Date.now()) : NONE),
      [history, on, query, limit],
    ) ?? NONE
  );
}

/** Latest searches from both tiers; empty while history is off. */
export function useRecentSearches(limit: number): HistoryEntry[] {
  return useHistoryList('recent', limit);
}

/** "Your regulars": the Frequent tier only; empty while history is off. */
export function useRegulars(limit: number): HistoryEntry[] {
  return useHistoryList('frequent', limit);
}
