const RECOVERY_FLAG = 'vt:chunk-recovery-at'
const RECOVERY_WINDOW_MS = 15_000

function isRecoverableChunkError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : ''

  if (!message) {
    return false
  }

  return [
    'failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'importing a module script failed',
  ].some(fragment => message.toLowerCase().includes(fragment))
}

function recoverFromChunkError() {
  const now = Date.now()
  const lastAttempt = Number(sessionStorage.getItem(RECOVERY_FLAG) ?? '0')

  if (now - lastAttempt < RECOVERY_WINDOW_MS) {
    return
  }

  sessionStorage.setItem(RECOVERY_FLAG, String(now))
  window.location.reload()
}

export default defineNuxtPlugin((nuxtApp) => {
  const handleError = (error: unknown) => {
    if (import.meta.client && isRecoverableChunkError(error)) {
      recoverFromChunkError()
    }
  }

  nuxtApp.hook('app:error', handleError)

  const previousHandler = nuxtApp.vueApp.config.errorHandler
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    handleError(error)
    previousHandler?.(error, instance, info)
  }

  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason)
  })
})