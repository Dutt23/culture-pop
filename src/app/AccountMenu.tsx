import { AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Mascot } from '../components/mascot/Mascot';
import { BusyButton } from '../components/ui/BusyButton';
import { useBusy } from '../components/ui/useBusy';
import { ActivityIcon, SettingsIcon } from '../components/ui/icons';
import { SIDE_TRAY_LEAVE_MS, SideTray } from '../components/ui/SideTray';
import { useMotionPresets } from '../motion/useMotionPresets';
import {
  createAuthClient,
  readAccountHint,
  type AccountSession,
  type AuthClient,
} from '../services/auth/authClient';
import styles from './AccountMenu.module.css';
import { useCurationJobs } from './useCurationJobs';

/**
 * The account button in the top bar, on every page but sign-in (D67): the signed-in person's
 * initial. It opens the mascot's TV (`SideTray`, look `tv`) showing who is signed in, whether wider web search
 * is on for them, what's left today when the server says, Settings, Activity and Sign out (pinned
 * at the bottom). Signing out switches the screen off, then goes to sign-in.
 */

const defaultClient = createAuthClient();

function cardsBeingMade(count: number) {
  return count === 1 ? '1 card being made' : `${count} cards being made`;
}

export function AccountMenu({ client = defaultClient }: { client?: AuthClient }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  // The email this device signed in with (D64); the sign-in guard has already checked the session.
  const email = readAccountHint();
  const { activeCount } = useCurationJobs();
  const making = activeCount > 0 ? cardsBeingMade(activeCount) : '';
  const label = [email ? `Your account, ${email}` : 'Your account', making]
    .filter(Boolean)
    .join(', ');

  // Following Settings or Activity from the tray lands on that page with the tray closed.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.avatar}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">{email ? email[0]?.toUpperCase() : 'Me'}</span>
        {activeCount > 0 && <span className={styles.dot} aria-hidden="true" />}
      </button>
      <AnimatePresence>
        {open && (
          <AccountTray
            key="tray"
            client={client}
            email={email}
            opener={buttonRef}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

interface AccountTrayProps {
  client: AuthClient;
  email: string | null;
  opener: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

function AccountTray({ client, email, opener, onClose }: AccountTrayProps) {
  const navigate = useNavigate();
  const { reduced } = useMotionPresets();
  const [poweringOff, setPoweringOff] = useState(false);
  // undefined: still asking; null: the server couldn't say.
  const [session, setSession] = useState<AccountSession | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, run] = useBusy();
  const { jobs, activeCount } = useCurationJobs();
  const running = jobs.filter((job) => job.status === 'running');

  useEffect(() => {
    let live = true;
    void client
      .session()
      .catch(() => undefined)
      .then((s) => live && setSession(s ?? null));
    return () => {
      live = false;
    };
  }, [client]);

  async function signOut() {
    setError('');
    const result = await run(() => client.signOut());
    if (!result) return;
    if (!result.ok) return setError("Couldn't sign out. Try again.");
    // Signed out: the screen switches off, then sign-in.
    setPoweringOff(true);
    const wait = reduced ? 0 : SIDE_TRAY_LEAVE_MS;
    window.setTimeout(() => navigate('/sign-in', { replace: true }), wait);
  }

  const widerWeb =
    session === undefined
      ? { tone: 'quiet', text: 'Checking…' }
      : session?.widerWeb === true
        ? { tone: 'on', text: 'On' }
        : session?.widerWeb === false
          ? { tone: 'off', text: 'Off' }
          : { tone: 'quiet', text: "Can't tell right now" };
  const who = email ?? session?.email;

  return (
    <SideTray
      title="Your account"
      opener={opener}
      onClose={onClose}
      // Stays open while signing out, so a failure message is seen.
      stayOpen={busy || poweringOff}
      leaving={poweringOff}
      footer={
        <>
          <BusyButton
            busy={busy}
            busyLabel="Signing out…"
            className={styles.signOut}
            onClick={() => void signOut()}
          >
            Sign out
          </BusyButton>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </>
      }
    >
      <div className={styles.hero}>
        <div className={styles.moon} aria-hidden="true" />
        <div className={styles.mascot}>
          <Mascot costume="plain" size={104} />
        </div>
        <div className={styles.floor} aria-hidden="true" />
      </div>
      <p className={styles.hello}>Hi there!</p>
      <p className={styles.email}>{who ? <>Signed in as {who}</> : 'Signed in'}</p>

      <dl className={styles.facts}>
        {activeCount > 0 && (
          <div className={styles.fact}>
            <dt>Cards in progress</dt>
            <dd>
              <span className={styles.pill} data-tone="on">
                {activeCount}
              </span>
              <ul className={styles.running}>
                {running.map((job) => (
                  <li key={job.id}>
                    <Link to="/activity" replace className={styles.runningLink}>
                      “{job.request.search}” · being made…
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        <div className={styles.fact}>
          <dt>Wider web search</dt>
          <dd>
            <span className={styles.pill} data-tone={widerWeb.tone}>
              {widerWeb.text}
            </span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Today</dt>
          <dd>
            {session?.quota ? (
              <span className={styles.pill} data-tone="on">
                {session.quota.available === 1
                  ? '1 card left'
                  : `${session.quota.available} cards left`}
              </span>
            ) : (
              <span className={styles.slot}>Your daily use shows here once it&apos;s ready.</span>
            )}
          </dd>
        </div>
      </dl>

      <nav aria-label="Account" className={styles.links}>
        {/* Replace: the tray's own history entry becomes the page, so Back skips the tray. */}
        <Link to="/settings" replace className={styles.link}>
          <SettingsIcon />
          Settings
        </Link>
        <Link to="/activity" replace className={styles.link}>
          <ActivityIcon />
          Activity
        </Link>
      </nav>
    </SideTray>
  );
}
