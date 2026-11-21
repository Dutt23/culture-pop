import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRepositories } from '../../app/useRepositories';
import { parseSettings, type Settings } from '../../domain/settings';
import { MotionPreferenceProvider } from '../../motion/MotionPreferenceProvider';
import { MOTION_ATTRIBUTE } from '../../motion/presets';
import { SettingsContext, type SettingsContextValue } from './useSettings';

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
