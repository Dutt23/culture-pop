import styles from './SearchBar.module.css';

interface VoiceButtonProps {
  listening: boolean;
  onToggle: () => void;
}

/** The mascot's TV with sound waves: smiles at rest; while listening the mouth opens and waves pulse. */
function TalkingTvIcon() {
  return (
    <svg
      className={styles.voiceIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 5 6 2.5M12 5l2-2.5" />
      <rect className={styles.voiceScreen} x="2.5" y="5" width="14" height="11" rx="3" />
      <circle cx="7" cy="10" r="0.6" fill="currentColor" />
      <circle cx="12" cy="10" r="0.6" fill="currentColor" />
      <path className={styles.voiceSmile} d="M7.5 12.6q2 1.4 4 0" />
      <ellipse className={styles.voiceMouth} cx="9.5" cy="13" rx="1.4" ry="1" />
      <path className={styles.voiceWave} d="M19 8.5q1.5 2 0 4" />
      <path className={styles.voiceWave} d="M21.3 7q2.6 3.5 0 7" />
    </svg>
  );
}

/** The voice search button in the search box. Pressed while listening; a second tap stops. */
export function VoiceButton({ listening, onToggle }: VoiceButtonProps) {
  return (
    <button
      type="button"
      className={styles.voice}
      aria-label="Search by voice"
      aria-pressed={listening}
      title={listening ? 'Stop listening' : 'Search by voice'}
      onClick={onToggle}
    >
      <TalkingTvIcon />
    </button>
  );
}
