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
