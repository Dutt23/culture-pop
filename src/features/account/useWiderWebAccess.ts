import { useEffect, useState } from 'react';
import { createAuthClient, type AuthClient } from '../../services/auth/authClient';

/**
 * Whether this person may use the wider web (search and card drafts), asked once when a screen that
 * needs it opens, so they hear "Sign in" before doing any work rather than after (D65).
 * `checking`: still asking (show a short "Checking" note, nothing to pick yet). `unknown`: the server
 * couldn't say; the screen carries on and the server's own check on the paid call decides.
 */
export type WiderWebAccess = 'checking' | 'unknown' | 'allowed' | 'signed_out' | 'not_allowed';

const defaultClient = createAuthClient();

export function useWiderWebAccess(client: AuthClient = defaultClient): WiderWebAccess {
  const [access, setAccess] = useState<WiderWebAccess>('checking');
  useEffect(() => {
    let live = true;
    void client.session().then((session) => {
      if (!live) return;
      if (!session) return setAccess('unknown');
      setAccess(
        !session.signedIn
          ? 'signed_out'
          : session.widerWeb === true
            ? 'allowed'
            : session.widerWeb === false
              ? 'not_allowed'
              : 'unknown',
      );
    });
    return () => {
      live = false;
    };
  }, [client]);
  return access;
}
