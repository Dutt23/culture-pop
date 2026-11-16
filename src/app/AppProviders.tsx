import { useState, type ReactNode } from 'react';
import type { PopCultureDb } from '../data/db';
import { SettingsProvider } from '../features/settings/SettingsContext';
import { RepositoriesProvider } from './RepositoriesContext';
import {
  createRetrievalService,
  RetrievalProvider,
  type RetrievalService,
} from './RetrievalContext';
import { StorageGate } from './StorageGate';

interface AppProvidersProps {
  db: PopCultureDb;
  /** Injected in tests; defaults to the live Wikimedia service. */
  retrieval?: RetrievalService;
  children: ReactNode;
}

export function AppProviders({ db, retrieval, children }: AppProvidersProps) {
  const [defaultRetrieval] = useState(createRetrievalService);
  return (
    <StorageGate db={db}>
      <RepositoriesProvider db={db}>
        <RetrievalProvider service={retrieval ?? defaultRetrieval}>
          <SettingsProvider>{children}</SettingsProvider>
        </RetrievalProvider>
      </RepositoriesProvider>
    </StorageGate>
  );
}
