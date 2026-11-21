import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BusyButton, useBusy } from '../../components/ui/BusyButton';
import { Section } from '../../components/ui/Section';
import {
  createAuthClient,
  readAccountHint,
  type AccountSession,
  type AuthClient,
} from '../../services/auth/authClient';
import styles from './AccountSection.module.css';

/** Settings → Your account: who is signed in, with sign in or sign out. */

const defaultClient = createAuthClient();

export function AccountSection({ client = defaultClient }: { client?: AuthClient }) {
  // A device that never signed in shows "Sign in" without asking the server anything.
  const navigate = useNavigate();
  const [hint] = useState(readAccountHint);
  // undefined: still asking; null: the server couldn't say (offline or accounts not set up).
  const [session, setSession] = useState<AccountSession | null | undefined>(
    hint ? undefined : { signedIn: false },
  );
  const [error, setError] = useState('');
  const [signingOut, runSignOut] = useBusy();

  useEffect(() => {
    if (!hint) return;
    let live = true;
    void client.session().then((s) => live && setSession(s ?? null));
    return () => {
      live = false;
    };
  }, [client, hint]);

  async function signOut() {
    const result = await runSignOut(() => client.signOut());
    if (!result) return;
    if (result.ok) {
      setError('');
      setSession({ signedIn: false });
      // The app needs an account (D66), so signing out goes straight to sign-in.
      navigate('/sign-in', { replace: true });
    } else {
      setError("Couldn't sign out. Try again.");
    }
  }

  return (
    <Section title="Your account">
      {session === undefined ? (
        <p className={styles.text}>Checking…</p>
      ) : session === null ? (
        <p className={styles.text}>Accounts aren&apos;t available right now.</p>
      ) : session.signedIn ? (
        <div className={styles.row}>
          <p className={styles.text}>
            Signed in as <strong>{session.email}</strong>
            {session.quota && <> · {session.quota.available} cards left</>}
          </p>
          <BusyButton
            busy={signingOut}
            busyLabel="Signing out…"
            className={styles.button}
            onClick={() => void signOut()}
          >
            Sign out
          </BusyButton>
        </div>
      ) : (
        <div className={styles.row}>
          <p className={styles.text}>Sign in to keep your cards and search the wider web.</p>
          <Link className={styles.button} to="/sign-in">
            Sign in
          </Link>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}
