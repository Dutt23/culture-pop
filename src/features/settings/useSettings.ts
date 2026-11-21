import { createContext, useContext } from 'react';
import type { SettingKey, Settings } from '../../domain/settings';

export interface SettingsContextValue {
  settings: Settings;
  /** False until stored settings have been read; until then `settings` holds defaults. */
  settingsLoaded: boolean;
  setSetting: <K extends SettingKey>(key: K, value: Settings[K]) => Promise<void>;
  /** Clears favourites, packs, settings, search history and cached online results. Curated content stays. */
  resetLocalData: () => Promise<void>;
  /** "Not now" on the online-search prompt: lasts until the app is reloaded, never stored. */
  onlineSearchSkipped: boolean;
  skipOnlineSearch: () => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
