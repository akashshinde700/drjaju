// Optional Sentry initialization. Requires REACT_APP_SENTRY_DSN in environment to activate.
import * as Sentry from '@sentry/react';

export default function initSentry() {
  try {
    // Only use import.meta.env in browser - process object doesn't exist
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) {
      // console.log('Sentry DSN not configured (VITE_SENTRY_DSN env var not set)');
      return;
    }

    Sentry.init({
      dsn,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 0.1,
      environment: import.meta.env.MODE || 'development',
    });
    // console.log('✅ Sentry initialized successfully');
  } catch (e) {
    console.error('⚠️ Sentry initialization failed:', e.message);
  }
}

// Initialize on module load
initSentry();
