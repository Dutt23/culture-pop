import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppProviders } from './app/AppProviders';
import { AppRoutes } from './app/AppRoutes';
import { IntroSplash } from './components/intro-splash/IntroSplash';
import { createDatabase } from './data/db';
import './design/tokens.css';
import './design/themes.css';
import './design/global.css';

// A deploy replaces the hashed files; a tab still running the old build then 404s on its lazy
// pages. Reload once to pick up the new build; the timestamp stops a reload loop.
const RELOADED_AT = 'pcd-chunk-reload-at';
const RELOAD_GAP_MS = 10_000;
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (Date.now() - last < RELOAD_GAP_MS) return;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <AppProviders db={createDatabase()}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <IntroSplash />
    </AppProviders>
  </StrictMode>,
);
