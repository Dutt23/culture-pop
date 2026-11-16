import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { parseSettings, type SettingKey, type Settings } from '../../domain/settings';
import { MotionPreferenceProvider } from '../../motion/MotionPreferenceProvider';
import { MOTION_ATTRIBUTE } from '../../motion/presets';

interface SettingsContextValue {
  settings: Settings;
  /** False until stored settings have been read; until then `settings` holds defaults. */
  settingsLoaded: boolean;
  setSetting: <K extends SettingKey>(key: K, value: Settings[K]) => Promise<void>;
  /** Clears favourites, settings, search history and cached online results. Curated content is untouched. */
  resetLocalData: () => Promise<void>;
  /** "Not now" on the online-search prompt: lasts until the app is reloaded, never stored. */
  onlineSearchSkipped: boolean;
  skipOnlineSearch: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { settings: settingsRepository, resetUserData } = useRepositories();
  const rows = useLiveQuery(() => settingsRepository.getAll(), [settingsRepository]);
  // Choices apply instantly; otherwise controlled inputs snap back until the IndexedDB write lands.
  // shortcut: overrides win over stored rows for this tab's lifetime, so another tab's change shows only after reload; reconcile with rows if multi-tab sync is ever needed.
  const [optimistic, setOptimistic] = useState<Partial<Settings>>({});
  const [onlineSearchSkipped, setOnlineSearchSkipped] = useState(false);
  const settings = useMemo(
    () => ({ ...parseSettings(rows ?? []), ...optimistic }),
    [rows, optimistic],
  );

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
    root.setAttribute(MOTION_ATTRIBUTE, settings.motion);
  }, [settings.theme, settings.motion]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      settingsLoaded: rows !== undefined,
      setSetting: async (key, value) => {
        setOptimistic((previous) => ({ ...previous, [key]: value }));
        try {
          await settingsRepository.set(key, value);
        } catch (error) {
          setOptimistic((previous) => {
            const reverted = { ...previous };
            delete reverted[key];
            return reverted;
          });
          throw error;
        }
      },
      resetLocalData: async () => {
        await resetUserData();
        setOptimistic({});
        setOnlineSearchSkipped(false);
      },
      onlineSearchSkipped,
      skipOnlineSearch: () => setOnlineSearchSkipped(true),
    }),
    [settings, rows, settingsRepository, resetUserData, onlineSearchSkipped],
  );

  return (
    <SettingsContext.Provider value={value}>
      <MotionPreferenceProvider preference={settings.motion}>{children}</MotionPreferenceProvider>
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
