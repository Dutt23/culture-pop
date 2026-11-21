import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/AppRoutes';
import type { RetrievalService } from '../app/retrievalServiceContext';
import { createDatabase, type PopCultureDb } from '../data/db';
import type { AuthClient } from '../services/auth/authClient';
import { fakeAuthClient } from './fakeAuth';
import { unusedRetrievalService } from './fakeRetrieval';

let counter = 0;
/** Signed in; the wider web isn't on for the account unless a test passes `widerWebOn` (D65). */
const signedIn = fakeAuthClient();
/** Signed in, with the wider web turned on for the account: it then runs by itself on a miss. */
export const widerWebOn = fakeAuthClient({
  signedIn: true,
  email: 'reader@example.test',
  widerWeb: true,
});

/** Every test gets its own IndexedDB database, so tests never share state. */
export function createTestDatabase(): PopCultureDb {
  counter += 1;
  return createDatabase(`test-db-${counter}-${Math.random().toString(36).slice(2)}`, {
    readyPack: false,
  });
}

export function renderApp(
  route: string,
  db: PopCultureDb = createTestDatabase(),
  retrieval: RetrievalService = unusedRetrievalService(),
  authClient: AuthClient = signedIn,
) {
  const user = userEvent.setup();
  const view = render(
    <AppProviders db={db} retrieval={retrieval}>
      <MemoryRouter initialEntries={[route]}>
        {/* Signed in by default; RequireSignIn.test.tsx covers the signed-out paths. */}
        <AppRoutes authClient={authClient} />
      </MemoryRouter>
    </AppProviders>,
  );
  return { db, user, retrieval, ...view };
}
