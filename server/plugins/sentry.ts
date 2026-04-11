import * as Sentry from '@sentry/nuxt'

export default defineNitroPlugin(() => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
    skipOpenTelemetrySetup: true,
  })
})
