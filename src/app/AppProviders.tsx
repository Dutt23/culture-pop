import type { ReactNode } from 'react';
import type { PopCultureDb } from '../data/db';
import { SettingsProvider } from '../features/settings/SettingsContext';
import { RepositoriesProvider } from './RepositoriesContext';
import { StorageGate } from './StorageGate';

interface AppProvidersProps {
  db: PopCultureDb;
  children: ReactNode;
}

export function AppProviders({ db, children }: AppProvidersProps) {
  return (
    <StorageGate db={db}>
      <RepositoriesProvider db={db}>
        <SettingsProvider>{children}</SettingsProvider>
      </RepositoriesProvider>
    </StorageGate>
  );
}
