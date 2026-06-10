// Sentry instrumentation — must be loaded via --import BEFORE server.js
// See: https://docs.sentry.io/platforms/javascript/guides/express/install/esm/
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
})
