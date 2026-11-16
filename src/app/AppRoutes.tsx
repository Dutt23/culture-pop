import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { DiscoverPage } from '../features/discovery/DiscoverPage';
import { FavouritesPage } from '../features/favourites/FavouritesPage';
import { NotFoundPage } from '../features/not-found/NotFoundPage';
import { ReferencePage } from '../features/references/ReferencePage';
import { SearchPage } from '../features/search/SearchPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AppShell } from './AppShell';

// Development-only: the import is dead code in production builds and gets tree-shaken.
const DevComponentsPage = import.meta.env.DEV
  ? lazy(() => import('../features/dev/DevComponentsPage'))
  : null;
const LlmBenchPage = import.meta.env.DEV
  ? lazy(() => import('../features/dev/LlmBenchPage'))
  : null;

export function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/discover" replace />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/references/:id" element={<ReferencePage />} />
        <Route path="/favourites" element={<FavouritesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {DevComponentsPage && (
          <Route
            path="/dev/components"
            element={
              <Suspense fallback={null}>
                <DevComponentsPage />
              </Suspense>
            }
          />
        )}
        {LlmBenchPage && (
          <Route
            path="/dev/llm-bench"
            element={
              <Suspense fallback={null}>
                <LlmBenchPage />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
