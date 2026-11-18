import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { PageLoader } from '../components/mascot/PageLoader';
import { DiscoverPage } from '../features/discovery/DiscoverPage';
import { NotFoundPage } from '../features/not-found/NotFoundPage';
import { AppShell } from './AppShell';

// Discover is the landing page and stays in the first download; the others load when first opened.
// The service worker precaches every chunk, so they still open offline.
const SearchPage = lazy(() =>
  import('../features/search/SearchPage').then((m) => ({ default: m.SearchPage })),
);
const ReferencePage = lazy(() =>
  import('../features/references/ReferencePage').then((m) => ({ default: m.ReferencePage })),
);
const FavouritesPage = lazy(() =>
  import('../features/favourites/FavouritesPage').then((m) => ({ default: m.FavouritesPage })),
);
const PacksPage = lazy(() =>
  import('../features/packs/PacksPage').then((m) => ({ default: m.PacksPage })),
);
const PackPage = lazy(() =>
  import('../features/packs/PackPage').then((m) => ({ default: m.PackPage })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

// While a page's code downloads, the mascot juggles popcorn (only if it takes more than a moment).
const later = (page: ReactNode) => <Suspense fallback={<PageLoader />}>{page}</Suspense>;

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
        <Route path="/search" element={later(<SearchPage />)} />
        <Route path="/references/:id" element={later(<ReferencePage />)} />
        <Route path="/favourites" element={later(<FavouritesPage />)} />
        <Route path="/packs" element={later(<PacksPage />)} />
        <Route path="/packs/:packId" element={later(<PackPage />)} />
        <Route path="/settings" element={later(<SettingsPage />)} />
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
