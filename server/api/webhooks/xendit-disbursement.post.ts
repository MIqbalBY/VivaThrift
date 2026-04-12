import { supabaseAdmin } from '../../utils/supabase-admin'
import { processXenditDisbursementWebhook } from '../../utils/xendit-disbursement-webhook-handler'
import { verifyXenditCallbackToken } from '../../utils/webhook-auth'
import { createSupabaseAttemptStore } from '../../utils/disbursement-attempts'
import { getXenditCallbackToken } from '../../utils/xendit-config'

// POST /api/webhooks/xendit-disbursement
//
// Xendit calls this endpoint when a disbursement status changes.
// Auth: shared X-CALLBACK-TOKEN header (same token as invoice webhook).
// Body (Xendit payload): { id, status, failure_code?, failure_reason?, ... }

export default defineEventHandler(async (event) => {
  // ── Security: verify Xendit callback token ────────────────────────────────
  const authResult = verifyXenditCallbackToken({
    receivedToken: getHeader(event, 'x-callback-token'),
    expectedToken: getXenditCallbackToken(),
  })

  if (!authResult.ok) {
    if (authResult.logMessage) {
      console.error(authResult.logMessage)
    }
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
      console.warn(message, error)
    },
  })

  if (!result.ok && result.action === 'missing_id') {
    throw createError({ statusCode: 400, statusMessage: 'Missing disbursement id in payload.' })
  }

  return result
})
