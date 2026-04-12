import * as Sentry from '@sentry/nuxt'

const isVercelBuild = Boolean(process.env.VERCEL)

Sentry.init({
  // DSN diambil dari environment variable
  dsn: process.env.SENTRY_DSN,

  // Sentry Nuxt server tracing belum didukung di Vercel.
  tracesSampleRate: isVercelBuild ? 0 : (process.env.NODE_ENV === 'production' ? 0.2 : 1.0),

  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],

  // Kirim console.log/warn/error sebagai logs ke Sentry
  enableLogs: true,
})
