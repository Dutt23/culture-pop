import type { ReactNode } from 'react';
import type { PopCultureDb } from '../data/db';
import { SettingsProvider } from '../features/settings/SettingsContext';
import { RepositoriesProvider } from './RepositoriesContext';
import { RetrievalProvider } from './RetrievalContext';
import type { RetrievalService } from './retrievalServiceContext';
import { StorageGate } from './StorageGate';
import { CurationJobsProvider } from './CurationJobsProvider';

interface AppProvidersProps {
  db: PopCultureDb;
  /** Injected in tests; defaults to the live service, built when a screen first needs it. */
  retrieval?: RetrievalService;
  children: ReactNode;
}

export function AppProviders({ db, retrieval, children }: AppProvidersProps) {
  return (
    <StorageGate db={db}>
      <RepositoriesProvider db={db}>
        <RetrievalProvider service={retrieval}>
          <SettingsProvider>
            <CurationJobsProvider>{children}</CurationJobsProvider>
          </SettingsProvider>
        </RetrievalProvider>
      </RepositoriesProvider>
    </StorageGate>
  );
}
