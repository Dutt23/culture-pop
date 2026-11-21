import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PopCultureDb } from '../data/db';
import { createRepositories, type Repositories } from '../data/repositories';
import { useHousekeeping } from './useHousekeeping';

const RepositoriesContext = createContext<Repositories | null>(null);

interface RepositoriesProviderProps {
  db: PopCultureDb;
  children: ReactNode;
}

export function RepositoriesProvider({ db, children }: RepositoriesProviderProps) {
  const repositories = useMemo(() => createRepositories(db), [db]);
  // Limits on machine-made data, once a day when the phone is idle (D69).
  useHousekeeping(repositories);
  return (
    <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>
  );
}

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error('useRepositories must be used inside RepositoriesProvider');
  return repositories;
}
