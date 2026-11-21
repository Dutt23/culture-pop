import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useRepositories } from '../../app/RepositoriesContext';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { Page } from '../../components/ui/Page';
import { Section } from '../../components/ui/Section';
import { resetTours, TOUR_PARAM } from '../../components/tour/useTour';
import { SETTING_LABELS, type SettingKey, type Settings } from '../../domain/settings';
import { AccountSection } from '../account/AccountSection';
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
const TASTE_OPTIONS = optionsOf('taste');

const SAVE_ERROR = "Couldn't save that setting. Please try again.";

interface NoteProps {
  /** The one sentence that says what the control does. */
  lead: string;
  /** Names the fold for screen readers, e.g. "online search". */
  topic: string;
  children: ReactNode;
}

/** One sentence on show; the fine print folds away so the controls aren't buried in text. */
function Note({ lead, topic, children }: NoteProps) {
  return (
    <div className={styles.note}>
      <p>{lead}</p>
      <details className={styles.more}>
        <summary>
          More <span className="sr-only">about {topic}</span>
        </summary>
        <p>{children}</p>
      </details>
    </div>
  );
}

export function SettingsPage() {
  const { settings, setSetting, resetLocalData } = useSettings();
  const { history } = useRepositories();
  const navigate = useNavigate();
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
      'Remove all favourites, packs, saved web links and search history, reset settings, and delete online results and the cards you kept on this device? Your library cards stay. This cannot be undone.';
    if (!window.confirm(question)) return;
    try {
      await resetLocalData();
      setMessage({
        tone: 'ok',
        text: 'Favourites, packs, saved web links, search history, settings, saved online results and kept cards were cleared.',
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
          <Note
            topic="online search"
            lead="When something isn't in your library, your search text can be sent to public online reference sites to find it."
          >
            What they find is kept on this device for offline use until you clear it below.
          </Note>
        </div>
        <div className={styles.withNote}>
          <SegmentedControl
            legend="Wider web search"
            name="webSearch"
            options={WEB_SEARCH_OPTIONS}
            value={settings.webSearch}
            onChange={(value) => save(() => setSetting('webSearch', value))}
          />
          <Note
            topic="wider web search"
            lead="When nothing explains a search, you can tap “Search the wider web”; Off hides the button."
          >
            With On, once you're signed in on this device, it runs by itself on those searches. Your
            search text then goes through our server to a web-search provider (Parallel), which may
            keep it and use it to improve its service. Nothing else is sent. The links it finds are
            not checked. Results from the wider web can be kept on this device, for you only, for 30
            days while search history is on; they are never sent anywhere, and Clear history deletes
            them. A link you save with the heart keeps only its title and address, on this device,
            until you remove it or reset. If you make a card from results, the search, the results
            you picked and any style cards go through our server to OpenAI (or Cloudflare if OpenAI
            is busy), and Parallel reads the pages you picked; they don't use it to train their
            models, and the card is kept only on this device. It needs you to sign in, and the owner
            to turn it on for your account.
          </Note>
        </div>
        <div className={styles.withNote}>
          <SegmentedControl
            legend="Search history"
            name="history"
            options={HISTORY_OPTIONS}
            value={settings.history}
            onChange={(value) => save(() => setSetting('history', value))}
          />
          <Note
            topic="search history"
            lead="Your searches are kept on this device for recent searches and your regulars, and never sent anywhere."
          >
            A search is kept when you submit it or open a result from it. Turning this off stops
            saving new searches; Clear history deletes the ones already saved, with any wider web
            results kept for them. Favourites and saved web links stay.
          </Note>
          <button type="button" className={styles.reset} onClick={clearHistory}>
            Clear history
          </button>
        </div>
        <div className={styles.withNote}>
          <SegmentedControl
            legend="Lean to my taste"
            name="taste"
            options={TASTE_OPTIONS}
            value={settings.taste}
            onChange={(value) => save(() => setSetting('taste', value))}
          />
          <Note
            topic="leaning to your taste"
            lead="When library results match equally well, the type you favourite and open most comes first."
          >
            The search page says when it did. It is worked out on this device from your favourites
            and search history and never sent anywhere.
          </Note>
        </div>
      </div>

      <AccountSection />

      <BackupSection />

      <Section title="Your data">
        <Note topic="your data" lead="Everything stays in this browser.">
          Search text leaves the device only through online search (if you turn it on), a wider web
          search you tap, or an external search link you tap. Search history and results found
          online are kept here until you clear them; wider web results are kept for 30 days, only
          while search history is on. Web links you save stay until you remove them or reset.
        </Note>
        <Note
          topic="resetting"
          lead="Reset everything removes what you saved here; your library cards stay."
        >
          It removes favourites, packs, saved web links, search history, settings, online results
          and the cards you kept, all saved on this device. Clear history does not delete kept
          cards. It asks first, and can't be undone.
        </Note>
        <button type="button" className={styles.reset} onClick={reset}>
          Reset everything
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

      <Section
        title="Show me around"
        description="The mascot walks you through search (tags, pasting a message) or packs (the spoiler choice, pinning)."
      >
        <div className={styles.row}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              resetTours(['search']);
              void navigate(`/search?${TOUR_PARAM}=1`);
            }}
          >
            Tour search
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              resetTours(['packs', 'pack']);
              void navigate(`/packs?${TOUR_PARAM}=1`);
            }}
          >
            Tour packs
          </button>
        </div>
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
