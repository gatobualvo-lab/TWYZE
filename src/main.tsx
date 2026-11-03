import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { MetricsProvider } from './services/metrics/MetricsProvider';
import { initSentry } from './lib/sentry';
import { initAnalytics } from './lib/analytics';
import { ensureRandomUUID } from './utils/polyfills';
import { startUpdateManager } from './services/pwa/updateManager';

// Older iPhones and Android WebViews lack crypto.randomUUID(), which record IDs depend on.
ensureRandomUUID();
initSentry();
initAnalytics();
// Installed copies of the app keep an older version until told otherwise; this moves them to the newest one safely.
startUpdateManager();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MetricsProvider>
        <App />
      </MetricsProvider>
    </ThemeProvider>
  </StrictMode>
);