import { useReducedMotion } from 'motion/react';
import { useEffect, useState, type CSSProperties } from 'react';
import { useSettings } from '../../features/settings/SettingsContext';
import styles from './IntroSplash.module.css';
import { GenrePlace } from '../mascot/GenrePlace';
import { Mascot, type Costume } from '../mascot/Mascot';

type Panel =
  | { kind: 'line'; line: string; from: string; tone: string }
  | { kind: 'mascot'; costume: Costume; caption: string; tone: string };

/** Library lines with the costumed mascot between them, flipped like comic pages. */
const PANELS: readonly Panel[] = [
  { kind: 'line', line: 'I am Groot', from: 'Guardians of the Galaxy', tone: styles.violet },
  { kind: 'mascot', costume: 'hero', caption: 'The heroes', tone: styles.night },
  { kind: 'line', line: 'Kitne aadmi the?', from: 'Sholay', tone: styles.peach },
  { kind: 'mascot', costume: 'wizard', caption: 'The wizards', tone: styles.lilac },
  { kind: 'line', line: "D'oh!", from: 'The Simpsons', tone: styles.dusk },
  { kind: 'mascot', costume: 'villain', caption: 'The villains', tone: styles.coral },
  { kind: 'line', line: 'Stonks', from: 'Meme', tone: styles.paper },
  { kind: 'mascot', costume: 'royal', caption: 'The royals', tone: styles.violet },
  { kind: 'line', line: 'Winter is coming', from: 'Game of Thrones', tone: styles.night },
  { kind: 'mascot', costume: 'outlaw', caption: 'The outlaws', tone: styles.peach },
  { kind: 'line', line: 'Bazinga!', from: 'The Big Bang Theory', tone: styles.lilac },
  { kind: 'mascot', costume: 'meme', caption: 'And the memes', tone: styles.dusk },
];

// Each page is shown a little shorter than the last, like a flip-book picking up speed.
const FIRST_PANEL_MS = 320;
const PANEL_STEP_MS = 20;
const SHORTEST_PANEL_MS = 100;
/** A costume takes a moment longer to take in than a line. */
const MASCOT_STRETCH = 1.25;
const LOGO_MS = 700;
const HOLD_MS = 400;
const FADE_OUT_MS = 300;
const REDUCED_FADE_MS = 200;

const SEEN_KEY = 'pcd:intro-seen';

const DURATIONS = PANELS.map(
  (panel, i) =>
    Math.max(SHORTEST_PANEL_MS, FIRST_PANEL_MS - i * PANEL_STEP_MS) *
    (panel.kind === 'mascot' ? MASCOT_STRETCH : 1),
);
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const STARTS = DURATIONS.map((_, i) => sum(DURATIONS.slice(0, i)));
const PANELS_END_MS = sum(DURATIONS);
const INTRO_MS = PANELS_END_MS + LOGO_MS + HOLD_MS + FADE_OUT_MS;

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode or blocked storage: the intro may play again next time, nothing worse.
  }
}

/**
 * The opening flip-book, once per visit: famous lines and the costumed mascot flash past, then the
 * logo. Covers the app from
 * the first frame, waits for the motion setting, and with reduced motion only fades away. A tap or
 * any key skips it. Decorative, so hidden from screen readers; the app underneath is already live.
 */
export function IntroSplash() {
  const { settings, settingsLoaded } = useSettings();
  const deviceReduced = useReducedMotion() ?? false;
  const [done, setDone] = useState(alreadySeen);
  const reduced = settings.motion === 'reduce' || (settings.motion === 'system' && deviceReduced);

  useEffect(() => {
    if (done) return;
    const skip = () => setDone(true);
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [done]);

  useEffect(() => {
    if (done || !settingsLoaded) return;
    markSeen();
    const timer = setTimeout(() => setDone(true), reduced ? REDUCED_FADE_MS : INTRO_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [done, settingsLoaded, reduced]);

  if (done) return null;
  const playing = settingsLoaded && !reduced;
  return (
    <div
      className={`${styles.splash} ${playing ? styles.playing : ''} ${settingsLoaded && reduced ? styles.fadeAway : ''}`}
      style={{ '--fade-out-start': `${INTRO_MS - FADE_OUT_MS}ms` } as CSSProperties}
      aria-hidden="true"
      data-testid="intro-splash"
      onPointerDown={() => setDone(true)}
    >
      {playing && (
        <>
          {PANELS.map((panel, i) => (
            <div
              key={i}
              className={`${styles.panel} ${panel.tone}`}
              style={
                {
                  '--start': `${STARTS[i]}ms`,
                  '--duration': `${DURATIONS[i]}ms`,
                  '--tilt': `${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg`,
                } as CSSProperties
              }
            >
              {panel.kind === 'line' ? (
                <>
                  <span className={styles.line}>{panel.line}</span>
                  <span className={styles.from}>{panel.from}</span>
                </>
              ) : (
                <>
                  <GenrePlace costume={panel.costume} className={styles.place} />
                  <Mascot costume={panel.costume} />
                  <span className={styles.caption}>{panel.caption}</span>
                </>
              )}
            </div>
          ))}
          <div
            className={styles.flash}
            style={{ '--start': `${PANELS_END_MS}ms` } as CSSProperties}
          />
          <div className={styles.logo} style={{ '--start': `${PANELS_END_MS}ms` } as CSSProperties}>
            <img src="/icon.svg" alt="" width={96} height={96} />
            <span className={styles.wordmark}>
              Pop Culture <em>Decoder</em>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
