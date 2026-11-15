import { useState } from 'react';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import type {
  MotionPreference,
  SpoilerPreference,
  ThemePreference,
} from '../../domain/settings';
import { useSettings } from './SettingsContext';
import styles from './SettingsPage.module.css';

const THEME_OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const MOTION_OPTIONS: readonly SegmentedOption<MotionPreference>[] = [
  { value: 'system', label: 'Match device' },
  { value: 'reduce', label: 'Reduce' },
  { value: 'full', label: 'Full' },
];

const SPOILER_OPTIONS: readonly SegmentedOption<SpoilerPreference>[] = [
  { value: 'hide', label: 'Hide until I tap' },
  { value: 'show', label: 'Show automatically' },
];

const SAVE_ERROR = "Couldn't save that setting. Please try again.";

export function SettingsPage() {
  const { settings, setSetting, resetLocalData } = useSettings();
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const save = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch {
      setMessage({ tone: 'error', text: SAVE_ERROR });
    }
  };

  const reset = async () => {
    if (!window.confirm('Remove all favourites and reset settings? This cannot be undone.')) return;
    try {
      await resetLocalData();
      setMessage({ tone: 'ok', text: 'Favourites and settings were reset.' });
    } catch {
      setMessage({ tone: 'error', text: "Couldn't reset local data. Please try again." });
    }
  };

  return (
    <Page title="Settings">
      <div className={styles.controls}>
        <SegmentedControl
          legend="Theme"
          name="theme"
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={(value) => save(() => setSetting('theme', value))}
        />
        <SegmentedControl
          legend="Motion"
          name="motion"
          options={MOTION_OPTIONS}
          value={settings.motion}
          onChange={(value) => save(() => setSetting('motion', value))}
        />
        <SegmentedControl
          legend="Spoilers"
          name="spoilers"
          options={SPOILER_OPTIONS}
          value={settings.spoilers}
          onChange={(value) => save(() => setSetting('spoilers', value))}
        />
      </div>

      <Section
        title="Your data"
        description="Everything stays in this browser. Searches are never saved or sent anywhere unless you tap an external search link."
      >
        <button type="button" className={styles.reset} onClick={reset}>
          Reset favourites &amp; settings
        </button>
        {message && (
          <p
            className={message.tone === 'error' ? styles.error : styles.ok}
            role={message.tone === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        )}
      </Section>

      <Section title="About the content">
        <p className={styles.ok}>
          Entries marked “Demo entry” were written for this app and are not externally verified.
          Browser storage is best-effort and can be cleared by your browser.
        </p>
      </Section>
    </Page>
  );
}
