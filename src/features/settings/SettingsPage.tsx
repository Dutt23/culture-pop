import { useState } from 'react';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import type {
  MotionPreference,
  RetrievalPreference,
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

const RETRIEVAL_OPTIONS: readonly SegmentedOption<RetrievalPreference>[] = [
  { value: 'ask', label: 'Ask first' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
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
    const question =
      'Remove all favourites, reset settings and delete online results saved on this device? This cannot be undone.';
    if (!window.confirm(question)) return;
    try {
      await resetLocalData();
      setMessage({ tone: 'ok', text: 'Favourites, settings and saved online results were cleared.' });
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
        <div className={styles.withNote}>
          <SegmentedControl
            legend="Online search"
            name="retrieval"
            options={RETRIEVAL_OPTIONS}
            value={settings.retrieval}
            onChange={(value) => save(() => setSetting('retrieval', value))}
          />
          <p className={styles.ok}>
            When something isn't in your library, your search text can be sent to Wikipedia,
            Wikidata, Wiktionary and Wikiquote (Wikimedia Foundation) to find it. TVmaze is asked
            only about TV series they find, never your search text. Your search text is never
            saved, but what they find is kept on this device for offline use until you clear it
            below.
          </p>
        </div>
      </div>

      <Section
        title="Your data"
        description="Everything stays in this browser. Search text is never saved; it leaves the device only through online search (if you turn it on) or an external search link you tap. Results found online are kept here until you clear them."
      >
        <button type="button" className={styles.reset} onClick={reset}>
          Reset favourites, settings &amp; saved online results
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
