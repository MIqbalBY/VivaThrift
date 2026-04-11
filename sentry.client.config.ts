import * as Sentry from '@sentry/nuxt'

Sentry.init({
  // DSN diambil dari runtimeConfig.public.sentry.dsn (tersedia di browser via Nuxt)
  dsn: useRuntimeConfig().public.sentry.dsn as string,

  // Tracing: capture 20% request di production, 100% di dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Batasi distributed tracing hanya ke domain sendiri
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/www\.vivathrift\.store/,
    /^https:\/\/vivathrift\.store/,
  ],

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],

  // Kirim console.log/warn/error sebagai logs ke Sentry
  enableLogs: true,

  // Session Replay: 10% session normal, 100% saat error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
