import { supabaseAdmin } from '../../utils/supabase-admin'
import { processXenditDisbursementWebhook } from '../../utils/xendit-disbursement-webhook-handler'
import { verifyXenditCallbackToken } from '../../utils/webhook-auth'
import { createSupabaseAttemptStore } from '../../utils/disbursement-attempts'
import { getXenditCallbackToken } from '../../utils/xendit-config'
import { createWebhookRequestId, logWebhookEvent } from '../../utils/webhook-observability'

// POST /api/webhooks/xendit-disbursement
//
// Xendit calls this endpoint when a disbursement status changes.
// Auth: shared X-CALLBACK-TOKEN header (same token as invoice webhook).
// Body (Xendit payload): { id, status, failure_code?, failure_reason?, ... }

export default defineEventHandler(async (event) => {
  const requestId = createWebhookRequestId()

  // ── Security: verify Xendit callback token ────────────────────────────────
  const authResult = verifyXenditCallbackToken({
    receivedToken: getHeader(event, 'x-callback-token'),
    expectedToken: getXenditCallbackToken(),
  })

  if (!authResult.ok) {
    await logWebhookEvent('warning', authResult.logMessage ?? '[xendit-disbursement-webhook] Invalid callback token.', {
      webhook: 'xendit-disbursement',
      requestId,
      statusCode: authResult.statusCode,
      errorMessage: authResult.statusMessage,
    })

    throw createError({ statusCode: authResult.statusCode, statusMessage: authResult.statusMessage })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await readBody(event)
  const eventName = (body?.event ?? '').toString().toLowerCase()

  // Payouts v2 callback shape is nested under `data` and uses `event`
  // (e.g. `payout.succeeded`) instead of a top-level `status`.
  const normalizedId = body?.id ?? body?.data?.id ?? ''
  const normalizedStatus = body?.status
    ?? (eventName === 'payout.succeeded' ? 'COMPLETED' : undefined)
    ?? (eventName === 'payout.failed' ? 'FAILED' : undefined)
  const normalizedFailureCode = body?.failure_code ?? body?.data?.failure_code
  const normalizedFailureReason = body?.failure_reason ?? body?.data?.failure_reason

  const store = createSupabaseAttemptStore(supabaseAdmin)

  const result = await processXenditDisbursementWebhook({
    id:             normalizedId,
    status:         normalizedStatus,
    failure_code:   normalizedFailureCode,
    failure_reason: normalizedFailureReason,
  }, {
    findByXenditId:    store.findByXenditId,
    updateCompleted:   store.updateCompleted,
    updateFailed:      store.updateFailed,
    listByOrder:       store.listByOrder,
    markOrderDisbursed: async (orderId, sellerXenditId) => {
      await supabaseAdmin
        .from('orders')
        .update({ disbursement_id: sellerXenditId })
        .eq('id', orderId)
    },
    onWarning: (message, error) => {
      void logWebhookEvent('warning', message, {
        webhook: 'xendit-disbursement',
        requestId,
        eventName: eventName || null,
        disbursementId: normalizedId || null,
        status: normalizedStatus ?? null,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    },
  })

  if (!result.ok && result.action === 'missing_id') {
    await logWebhookEvent('warning', '[xendit-disbursement-webhook] Missing disbursement id in payload.', {
      webhook: 'xendit-disbursement',
      requestId,
      eventName: eventName || null,
      status: normalizedStatus ?? null,
      statusCode: 400,
    })

    throw createError({ statusCode: 400, statusMessage: 'Missing disbursement id in payload.' })
  }

  await logWebhookEvent('info', '[xendit-disbursement-webhook] Processed webhook.', {
    webhook: 'xendit-disbursement',
    requestId,
    action: result.action,
    eventName: eventName || null,
    disbursementId: normalizedId || null,
    status: normalizedStatus ?? null,
    updated: result.updated,
  })

  return result
})
