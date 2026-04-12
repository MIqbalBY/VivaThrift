import { supabaseAdmin } from '../../utils/supabase-admin'
import { createSupabaseAttemptStore, isRetryEligible } from '../../utils/disbursement-attempts'
import { disburseFunds } from '../../utils/xendit-disburse'

// POST /api/cron/retry-disbursements
//
// Scheduled job (every 2 hours) that retries failed disbursement attempts.
// Backoff schedule (from nextRetryWindowMs):
//   attempt 1 → wait 1h
//   attempt 2 → wait 4h
//   attempt 3+ → no more retries, manual intervention required
//
// Security: CRON_SECRET bearer token.

export default defineEventHandler(async (event) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = getHeader(event, 'authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized.' })
  }

  const store = createSupabaseAttemptStore(supabaseAdmin)
  const rows = await store.listRetryable(new Date().toISOString())
  const nowMs = Date.now()
  const eligible = rows.filter((row) => isRetryEligible(row, nowMs))

  let retried = 0
  const errors: string[] = []

  for (const row of eligible) {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select(`
        id, total_amount, shipping_cost, platform_fee, payment_gateway_fee, seller_id,
        seller:users!seller_id ( bank_code, bank_account_number, bank_account_name )
      `)
      .eq('id', row.order_id)
      .single() as unknown as { data: any }

    if (!order) {
      errors.push(`retry ${row.id}: order ${row.order_id} not found`)
      continue
    }

    const seller = order.seller ?? {}
    const sellerForDisburse = {
      bank_code:           seller.bank_code,
      account_holder_name: seller.bank_account_name,
      account_number:      seller.bank_account_number,
    }

    try {
      await disburseFunds({
        orderId:          order.id,
        externalIdPrefix: 'vt_retry',
        totalAmount:      order.total_amount,
        shippingCost:     order.shipping_cost ?? 0,
        platformFee:      order.platform_fee ?? 0,
        paymentGatewayFee: order.payment_gateway_fee ?? 0,
        seller:           sellerForDisburse,
        attemptStore:     store,
        attemptNo:        row.attempt_no + 1,
      })
      retried++
    } catch (e: any) {
      errors.push(`retry ${row.id}: ${e?.message ?? 'unknown'}`)
    }
  }

  const summary = {
    ok: true,
    eligible: eligible.length,
    retried,
    errors: errors.length,
    errorMessages: errors,
  }
  console.log('[cron/retry-disbursements]', summary)
  return summary
})
