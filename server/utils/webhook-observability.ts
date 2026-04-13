import * as Sentry from '@sentry/nuxt'

type WebhookLogLevel = 'info' | 'warning' | 'error'

type WebhookName = 'xendit-invoice' | 'xendit-disbursement'

type WebhookLogContext = {
  webhook: WebhookName
  requestId: string
  action?: string | null
  eventName?: string | null
  invoiceId?: string | null
  disbursementId?: string | null
  status?: string | null
  statusCode?: number
  orderCount?: number
  updated?: boolean
  errorMessage?: string | null
}

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function buildPayload(context: WebhookLogContext) {
  return {
    webhook: context.webhook,
    requestId: context.requestId,
    action: normalizeString(context.action),
    eventName: normalizeString(context.eventName),
    invoiceId: normalizeString(context.invoiceId),
    disbursementId: normalizeString(context.disbursementId),
    status: normalizeString(context.status),
    statusCode: typeof context.statusCode === 'number' ? context.statusCode : undefined,
    orderCount: typeof context.orderCount === 'number' ? context.orderCount : undefined,
    updated: typeof context.updated === 'boolean' ? context.updated : undefined,
    errorMessage: normalizeString(context.errorMessage),
  }
}

export function createWebhookRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `webhook-${Date.now()}`
}

export async function logWebhookEvent(level: WebhookLogLevel, message: string, context: WebhookLogContext) {
  const payload = buildPayload(context)

  if (level === 'error') {
    console.error(message, payload)
  } else if (level === 'warning') {
    console.warn(message, payload)
  } else {
    console.info(message, payload)
  }

  if (level === 'info') {
    return
  }

  Sentry.withScope((scope) => {
    scope.setLevel(level === 'warning' ? 'warning' : 'error')

    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) {
        continue
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        scope.setTag(key, String(value))
      } else {
        scope.setExtra(key, value)
      }
    }

    Sentry.captureMessage(message)
  })

  await Sentry.flush(2000)
}