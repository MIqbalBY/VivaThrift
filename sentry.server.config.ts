import * as Sentry from '@sentry/nuxt'

Sentry.init({
  // DSN diambil dari environment variable
  dsn: process.env.SENTRY_DSN,

  // Tracing: capture 20% di production, 100% di dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],

  // Kirim console.log/warn/error sebagai logs ke Sentry
  enableLogs: true,
})
