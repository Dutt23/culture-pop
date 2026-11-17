import { useState } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { useRetrievalService } from '../../app/retrievalService';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { SETTING_LABELS, type SettingKey, type Settings } from '../../domain/settings';
import { BackupSection } from './BackupSection';
import { useSettings } from './SettingsContext';
import styles from './SettingsPage.module.css';

function optionsOf<K extends SettingKey>(key: K): readonly SegmentedOption<Settings[K]>[] {
  // The keys are exactly the setting's values, in display order.
  const labels = SETTING_LABELS[key] as Readonly<Record<Settings[K], string>>;
  return (Object.entries(labels) as [Settings[K], string][]).map(([value, label]) => ({
    value,
    label,
  }));
}

const THEME_OPTIONS = optionsOf('theme');
const MOTION_OPTIONS = optionsOf('motion');
const SPOILER_OPTIONS = optionsOf('spoilers');
const RETRIEVAL_OPTIONS = optionsOf('retrieval');
const WEB_SEARCH_OPTIONS = optionsOf('webSearch');
const HISTORY_OPTIONS = optionsOf('history');

const SAVE_ERROR = "Couldn't save that setting. Please try again.";

export function SettingsPage() {
  const { settings, setSetting, resetLocalData } = useSettings();
  const { history } = useRepositories();
  const { webSearch } = useRetrievalService();
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
      'Remove all favourites, packs, saved web links and search history, reset settings and delete online results saved on this device? Your library cards stay. This cannot be undone.';
    if (!window.confirm(question)) return;
    try {
      await resetLocalData();
      setMessage({
        tone: 'ok',
        text: 'Favourites, packs, saved web links, search history, settings and saved online results were cleared.',
      });
    } catch {
      setMessage({ tone: 'error', text: "Couldn't reset local data. Please try again." });
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('Delete your search history from this device? This cannot be undone.'))
      return;
    try {
      await history.clear();
      setMessage({ tone: 'ok', text: 'Search history was cleared.' });
    } catch {
      setMessage({ tone: 'error', text: "Couldn't clear search history. Please try again." });
    }
  };

  const forgetAccessCode = async () => {
    try {
      await webSearch.lock();
      // Without the cookie a search can't run by itself; the button comes back.
      await setSetting('webAccess', 'unknown');
      setMessage({ tone: 'ok', text: 'The access code was forgotten on this device.' });
    } catch {
      setMessage({ tone: 'error', text: "Couldn't reach the server. Please try again." });
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
            When something isn't in your library, your search text can be sent to public online
            reference sites to find it. What they find is kept on this device for offline use until
            you clear it below.
          </p>
        </div>
        <div className={styles.withNote}>
          <SegmentedControl
            legend="Wider web search"
            name="webSearch"
            options={WEB_SEARCH_OPTIONS}
            value={settings.webSearch}
            onChange={(value) => save(() => setSetting('webSearch', value))}
          />
          <p className={styles.ok}>
            When nothing explains a search, you can tap &ldquo;Search the wider web&rdquo;. With On,
            once a search has worked on this device, it runs by itself on those searches. Your
            search text then goes through our server to a web-search provider (Parallel), which may
            keep it and use it to improve its service. Nothing else is sent. The links it finds are
            not checked. Results from the wider web can be kept on this device, for you only, for 30
            days while search history is on; they are never sent anywhere, and Clear history deletes
            them. A link you save with the heart keeps only its title and address, on this device,
            until you remove it or reset. Off hides the button. It needs an access code from the
            owner; the app never stores the code, only a sign-in cookie from our server.
          </p>
          <button type="button" className={styles.reset} onClick={forgetAccessCode}>
            Forget access code
          </button>
        </div>
        <div className={styles.withNote}>
          <SegmentedControl
            legend="Search history"
            name="history"
            options={HISTORY_OPTIONS}
            value={settings.history}
            onChange={(value) => save(() => setSetting('history', value))}
          />
          <p className={styles.ok}>
            Searches you submit or open a result from are kept on this device, so recent searches
            and your regulars can be shown. They are never sent anywhere. Turning this off stops
            saving new searches; Clear history deletes the ones already saved, with any wider web
            results kept for them. Favourites and saved web links stay.
          </p>
          <button type="button" className={styles.reset} onClick={clearHistory}>
            Clear history
          </button>
        </div>
      </div>

      <BackupSection />

      <Section
        title="Your data"
        description="Everything stays in this browser. Search text leaves the device only through online search (if you turn it on), a wider web search you tap, or an external search link you tap. Search history and results found online are kept here until you clear them; wider web results are kept for 30 days, only while search history is on. Web links you save stay until you remove them or reset."
      >
        <button type="button" className={styles.reset} onClick={reset}>
          Reset favourites, packs, saved links, history, settings &amp; saved online results
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
