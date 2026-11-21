import { useMemo, type ReactNode } from 'react';
import type { PopCultureDb } from '../data/db';
import { createRepositories } from '../data/repositories';
import { RepositoriesContext } from './useRepositories';
import { useHousekeeping } from './useHousekeeping';

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
