import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { MetricsProvider } from './services/metrics/MetricsProvider';
import { initSentry } from './lib/sentry';
import { initAnalytics } from './lib/analytics';

initSentry();
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MetricsProvider>
        <App />
      </MetricsProvider>
    </ThemeProvider>
  </StrictMode>
);