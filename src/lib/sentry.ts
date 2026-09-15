import * as Sentry from '@sentry/react';

// Error monitoring. VITE_SENTRY_DSN is a public, safe-to-expose value (it's
// how Sentry's own client-side SDKs work everywhere) — unlike the
// Anthropic/SendGrid/Flutterwave secrets, this one IS meant to be
// VITE_-prefixed and bundled into the client. Without it set, Sentry.init
// is skipped entirely and the app behaves exactly as it did before this
// was added — no error monitoring, but nothing breaks either.
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Conservative default — full error monitoring without the added
    // complexity/cost of performance tracing or session replay, which
    // aren't things this app has asked for yet.
    tracesSampleRate: 0,
  });
}

export { Sentry };
