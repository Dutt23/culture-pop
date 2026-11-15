import type { Setting } from './types';

export type ThemePreference = 'system' | 'light' | 'dark';
export type MotionPreference = 'system' | 'reduce' | 'full';
export type SpoilerPreference = 'hide' | 'show';

export interface Settings {
  theme: ThemePreference;
  motion: MotionPreference;
  spoilers: SpoilerPreference;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: 'system',
  motion: 'system',
  spoilers: 'hide',
};

const ALLOWED_VALUES: { readonly [K in SettingKey]: readonly Settings[K][] } = {
  theme: ['system', 'light', 'dark'],
  motion: ['system', 'reduce', 'full'],
  spoilers: ['hide', 'show'],
};

function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(ALLOWED_VALUES, key);
}

/** Stored rows are untrusted: unknown keys and invalid values fall back to defaults. */
export function parseSettings(rows: readonly Setting[]): Settings {
  return rows.reduce<Settings>(
    (settings, row) => {
      if (!isSettingKey(row.key)) return settings;
      const allowed: readonly string[] = ALLOWED_VALUES[row.key];
      return allowed.includes(row.value) ? { ...settings, [row.key]: row.value } : settings;
    },
    { ...DEFAULT_SETTINGS },
  );
}
