import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PopCultureDb } from '../data/db';
import { createRepositories, type Repositories } from '../data/repositories';

const RepositoriesContext = createContext<Repositories | null>(null);

interface RepositoriesProviderProps {
  db: PopCultureDb;
  children: ReactNode;
}

export function RepositoriesProvider({ db, children }: RepositoriesProviderProps) {
  const repositories = useMemo(() => createRepositories(db), [db]);
  return (
    <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>
  );
}

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error('useRepositories must be used inside RepositoriesProvider');
  return repositories;
}
