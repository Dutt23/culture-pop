import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/AppRoutes';
import type { RetrievalService } from '../app/retrievalServiceContext';
import { createDatabase, type PopCultureDb } from '../data/db';
import { fakeAuthClient } from './fakeAuth';
import { unusedRetrievalService } from './fakeRetrieval';

let counter = 0;
const signedIn = fakeAuthClient();

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
) {
  const user = userEvent.setup();
  const view = render(
    <AppProviders db={db} retrieval={retrieval}>
      <MemoryRouter initialEntries={[route]}>
        {/* Signed in by default; RequireSignIn.test.tsx covers the signed-out paths. */}
        <AppRoutes authClient={signedIn} />
      </MemoryRouter>
    </AppProviders>,
  );
  return { db, user, retrieval, ...view };
}
