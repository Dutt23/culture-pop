import type { Setting } from './types';

export type ThemePreference = 'system' | 'light' | 'dark';
export type MotionPreference = 'system' | 'reduce' | 'full';
export type SpoilerPreference = 'hide' | 'show';
/** Consent to send search text to Wikimedia. `ask` shows the disclosure first. */
export type RetrievalPreference = 'ask' | 'on' | 'off';
/**
 * Consent to send search text to the wider-web search (D45). `on` also runs it by itself on a miss,
 * once this device has unlocked (`webAccess`).
 */
export type WebSearchPreference = 'ask' | 'on' | 'off';
/** Whether a wider-web search has worked on this device: never the code, only that one worked. */
export type WebAccessState = 'unknown' | 'unlocked';
/** Question searches lean to films, TV, anime, books, games, myths and legends (owner, D50). */
export type StoriesPreference = 'on' | 'off';
/** Favourites and opened results break ties in the library's order (search tags plan; on by default). */
export type TastePreference = 'on' | 'off';
/** Search history on this device (D37: on by default, owner decision). */
export type HistoryPreference = 'on' | 'off';

export interface Settings {
  theme: ThemePreference;
  motion: MotionPreference;
  spoilers: SpoilerPreference;
  retrieval: RetrievalPreference;
  webSearch: WebSearchPreference;
  history: HistoryPreference;
  webAccess: WebAccessState;
  stories: StoriesPreference;
  taste: TastePreference;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: 'system',
  motion: 'system',
  spoilers: 'hide',
  retrieval: 'ask',
  webSearch: 'ask',
  history: 'on',
  webAccess: 'unknown',
  stories: 'on',
  taste: 'on',
};

/**
 * Each setting's allowed values, in display order, with their Settings-page labels. The only list
 * of values: `parseSettings` and the page both read it, and a missing value is a type error.
 */
export const SETTING_LABELS: {
  readonly [K in SettingKey]: Readonly<Record<Settings[K], string>>;
} = {
  theme: { system: 'System', light: 'Light', dark: 'Dark' },
  motion: { system: 'Match device', reduce: 'Reduce', full: 'Full' },
  spoilers: { hide: 'Hide until I tap', show: 'Show automatically' },
  retrieval: { ask: 'Ask first', on: 'On', off: 'Off' },
  webSearch: { ask: 'Ask first', on: 'On', off: 'Off' },
  history: { on: 'On', off: 'Off' },
  webAccess: { unknown: 'Not yet', unlocked: 'Unlocked' },
  stories: { on: 'On', off: 'Off' },
  taste: { on: 'On', off: 'Off' },
};

function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTING_LABELS, key);
}

/** Stored rows are untrusted: unknown keys and invalid values fall back to defaults. */
export function parseSettings(rows: readonly Setting[]): Settings {
  return rows.reduce<Settings>(
    (settings, row) => {
      if (!isSettingKey(row.key)) return settings;
      return Object.hasOwn(SETTING_LABELS[row.key], row.value)
        ? { ...settings, [row.key]: row.value }
        : settings;
    },
    { ...DEFAULT_SETTINGS },
  );
}
