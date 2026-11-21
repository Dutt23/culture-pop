import type { AccountSession, AuthClient } from '../services/auth/authClient';

/**
 * An auth client that never touches the network: `session()` answers with `answer`; null stands
 * for "couldn't tell" (undefined from the real client, as when offline). Tests render the app
 * signed in with it.
 */
export function fakeAuthClient(
  answer: AccountSession | null = { signedIn: true, email: 'reader@example.test' },
): AuthClient {
  const ok = async () => ({ ok: true as const });
  return {
    sendCode: ok,
    signInWithCode: ok,
    signInWithPassword: ok,
    setPassword: ok,
    signOut: ok,
    session: async () => answer ?? undefined,
  };
}
