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

  const store = createSupabaseAttemptStore(supabaseAdmin)

  const result = await processXenditDisbursementWebhook({
    id:             body?.id ?? '',
    status:         body?.status,
    failure_code:   body?.failure_code,
    failure_reason: body?.failure_reason,
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
