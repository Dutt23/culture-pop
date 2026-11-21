import { createContext, useContext } from 'react';
import type { Repositories } from '../data/repositories';

export const RepositoriesContext = createContext<Repositories | null>(null);

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error('useRepositories must be used inside RepositoriesProvider');
  return repositories;
}
