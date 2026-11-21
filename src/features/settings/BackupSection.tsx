import { useId, useState, type ChangeEvent } from 'react';
import { useRepositories } from '../../app/RepositoriesContext';
import { BusyButton, useBusy } from '../../components/ui/BusyButton';
import { Section } from '../../components/ui/Section';
import { BackupError, backupFileName, MAX_BACKUP_BYTES, readBackup } from '../../data/backup';
import own from './BackupSection.module.css';
import styles from './SettingsPage.module.css';

type Message = { tone: 'ok' | 'error'; text: string };

/** Long enough for a phone's download manager to take the file before its address is released. */
const RELEASE_AFTER_MS = 60_000;

/** FileReader rather than `file.text()`: it works in every browser the app supports. */
function readText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsText(file);
  });
}

function restoredText(skipped: number, missingCards: number): string {
  return [
    'Backup restored: its favourites, packs, saved links and settings were added.',
    skipped > 0 && "Some parts of the file couldn't be read and were left out.",
    missingCards > 0 && "A few cards aren't in this version of the app, so they were left out.",
  ]
    .filter(Boolean)
    .join(' ');
}

/** Save what the reader made to a file, and add it back from one (this phone or another). */
export function BackupSection() {
  const { backup } = useRepositories();
  const [message, setMessage] = useState<Message | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [saving, runSave] = useBusy();
  const inputId = useId();

  const save = async () => {
    try {
      const now = new Date();
      const file = await backup.create(now);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName(now);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), RELEASE_AFTER_MS);
      setMessage({ tone: 'ok', text: 'Your backup file is downloading.' });
    } catch {
      setMessage({ tone: 'error', text: "Couldn't make a backup. Please try again." });
    }
  };

  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file again still restores it.
    event.target.value = '';
    if (!file) return;
    setRestoring(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) {
        throw new BackupError('This file is too big to be a backup.');
      }
      const { backup: parsed, skipped } = readBackup(await readText(file));
      const { missingCards } = await backup.restore(parsed);
      setMessage({ tone: 'ok', text: restoredText(skipped, missingCards) });
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof BackupError
            ? error.message
            : "Couldn't restore that backup. Please try again.",
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Section
      title="Backup"
      description="Save your favourites, packs, saved web links and settings to a file, to keep or to move to another phone. It never holds your search history, wider web results or your sign-in. Restoring only adds: what's already on this phone, settings included, stays as it is."
    >
      <BusyButton
        busy={saving}
        busyLabel="Saving…"
        className={styles.secondary}
        onClick={() => void runSave(save)}
      >
        Save a backup file
      </BusyButton>
      <div className={styles.withNote}>
        <label htmlFor={inputId} className={own.label}>
          {restoring ? 'Restoring…' : 'Restore from a backup file'}
        </label>
        {/* No `accept` filter: some phones label .json files oddly and would grey them out. */}
        <input
          id={inputId}
          type="file"
          className={own.file}
          disabled={restoring}
          aria-busy={restoring || undefined}
          onChange={(event) => void restore(event)}
        />
      </div>
      {message && (
        <p
          className={message.tone === 'error' ? styles.error : styles.ok}
          role={message.tone === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </Section>
  );
}
