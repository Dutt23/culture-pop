import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { PageLoader } from '../components/mascot/PageLoader';
import { returnPathOf } from '../features/account/returnPath';
import {
  createAuthClient,
  readAccountHint,
  type AccountSession,
  type AuthClient,
} from '../services/auth/authClient';
import { onSessionEnded } from '../services/auth/sessionEnded';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * The app needs a signed-in account (D66). This is a front door, not the security boundary: the
 * server checks the session on every `/api` call whatever the app shows.
 *
 * Asks `/api/auth/session` on entry, on every page change, and when the device goes on or offline.
 * Offline, or when the server can't answer, a device that signed in before (the `pcd-account` hint)
 * keeps using what's saved on it; a device that never signed in goes to sign-in.
 * Signed out at once, without asking: an `/api` call answered 401, or another tab signed out (its
 * sign-out removes the hint, which this tab sees as a `storage` event). A page restored by Back
 * from the browser's cache is hidden and checked again.
 */

type Access = 'checking' | 'allowed' | 'signed-out';

const defaultClient = createAuthClient();

function accessFrom(session: AccountSession | undefined): Access {
  if (session) return session.signedIn ? 'allowed' : 'signed-out';
  return readAccountHint() ? 'allowed' : 'signed-out';
}

function useAccess(client: AuthClient): { access: Access; session?: AccountSession } {
  const { pathname } = useLocation();
  const isOnline = useOnlineStatus();
  const [access, setAccess] = useState<Access>('checking');
  // The server's last clear answer: kept while the next check runs and when one can't say
  // (offline, a dropped request), so the wider web doesn't vanish on a blip; read by useWiderWebAllowed.
  // Undefined until the server first answers, and again after a sign-out.
  const [session, setSession] = useState<AccountSession | undefined>(undefined);
  const [nudge, setNudge] = useState(0);
  // Only the newest check may answer; a sign-out signal also outdates any check in flight.
  const latest = useRef(0);

  // Keeps showing the current page while it re-checks.
  useEffect(() => {
    const check = ++latest.current;
    void client
      .session()
      .catch(() => undefined)
      .then((session) => {
        if (check !== latest.current) return;
        if (session) setSession(session);
        setAccess(accessFrom(session));
      });
  }, [client, isOnline, pathname, nudge]);

  useEffect(() => {
    const signOut = () => {
      latest.current += 1;
      setSession(undefined);
      setAccess('signed-out');
    };
    let hint = readAccountHint();
    const onStorage = () => {
      const now = readAccountHint();
      if (now === hint) return;
      hint = now;
      if (now) setNudge((n) => n + 1);
      else signOut();
    };
    // A page the browser restored from its back/forward cache shows nothing until checked again.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setAccess('checking');
      setNudge((n) => n + 1);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow);
    const stopListening = onSessionEnded(signOut);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow);
      stopListening();
    };
  }, []);

  return { access, session };
}

/** Wraps every page except sign-in. */
export function RequireSignIn({ client = defaultClient }: { client?: AuthClient }) {
  const location = useLocation();
  const { access, session } = useAccess(client);
  if (access === 'checking') return <PageLoader />;
  if (access === 'signed-out') {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet context={session} />;
}

/** Wraps the sign-in page: someone already signed in goes straight on to where they were going. */
export function SignInGate({ client = defaultClient }: { client?: AuthClient }) {
  const location = useLocation();
  const { access } = useAccess(client);
  if (access === 'checking') return <PageLoader />;
  if (access === 'allowed') return <Navigate to={returnPathOf(location)} replace />;
  return <Outlet />;
}
