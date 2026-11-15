import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { AppRoutes } from '../app/AppRoutes';
import { createDatabase, type PopCultureDb } from '../data/db';

let counter = 0;

/** Every test gets its own IndexedDB database, so tests never share state. */
export function createTestDatabase(): PopCultureDb {
  counter += 1;
  return createDatabase(`test-db-${counter}-${Math.random().toString(36).slice(2)}`);
}

export function renderApp(route: string, db: PopCultureDb = createTestDatabase()) {
  const user = userEvent.setup();
  const view = render(
    <AppProviders db={db}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
  return { db, user, ...view };
}
