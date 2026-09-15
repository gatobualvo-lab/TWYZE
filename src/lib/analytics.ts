import posthog from 'posthog-js';

// Product analytics on TrackWyze's OWN usage (signup, activation, feature
// adoption) — distinct from the business intelligence TrackWyze gives its
// customers about their own sales data. VITE_POSTHOG_KEY is a public,
// client-side key (same category as the Sentry DSN) — this is how
// PostHog's client SDK is designed to work, unlike the server-only
// Anthropic/SendGrid/Flutterwave secrets. Without it set, every function
// here is a no-op — the app behaves exactly as before.

let enabled = false;

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    // Capture pageviews on the SPA's route changes ourselves rather than
    // relying on PostHog's default (which assumes full page loads) —
    // TrackWyze never does a full reload when switching dashboard tabs.
    capture_pageview: false,
    // Business data (sales figures, customer names, etc.) must never end
    // up in PostHog — this only tracks that an action happened, never the
    // business data involved in it. Session recording is off for the same
    // reason: this is a financial app, screen recordings are out of scope.
    disable_session_recording: true,
    autocapture: false,
  });
  enabled = true;
}

export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (!enabled) return;
  posthog.identify(userId, traits);
}

export function resetAnalyticsIdentity(): void {
  if (!enabled) return;
  posthog.reset();
}

/** Track a product event. Never pass business data (amounts, customer names, etc.) as properties — only counts, categories, and other non-sensitive metadata. */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (!enabled) return;
  posthog.capture(name, properties);
}

export function trackPageview(path: string): void {
  if (!enabled) return;
  posthog.capture('$pageview', { $current_url: path });
}
