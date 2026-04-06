import { supabaseAdmin } from '../../utils/supabase-admin'

// POST /api/webhook/xendit
// Xendit sends this after payment events. Secured via X-CALLBACK-TOKEN header.
// events handled: PAID → confirmed, EXPIRED/FAILED → payment_failed
//
// Configure in Xendit dashboard → Settings → Developers → Callback URL:
//   https://your-domain.com/api/webhook/xendit

export default defineEventHandler(async (event) => {
  // ── 1. Verify callback token ─────────────────────────────────────────────
  const expectedToken = process.env.XENDIT_CALLBACK_TOKEN ?? ''
  const receivedToken = getHeader(event, 'x-callback-token') ?? ''

  if (!expectedToken || receivedToken !== expectedToken) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid callback token.' })
  }

  const body = await readBody(event)

  // Xendit sends the external_id as our orderId
  const xenditStatus: string  = body?.status ?? ''
  const externalId:   string  = body?.external_id ?? ''
  const xenditId:     string  = body?.id ?? ''

  if (!externalId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing external_id.' })
  }

  // ── 2. Load existing order ───────────────────────────────────────────────
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, xendit_invoice_id')
    .eq('id', externalId)
    .maybeSingle()

  if (!order) {
    // Not our order — acknowledge and ignore
    return { received: true }
  }

  // ── 3. Handle PAID ───────────────────────────────────────────────────────
  if (xenditStatus === 'PAID' && order.status === 'pending_payment') {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', order.id)
  }

  // ── 4. Handle EXPIRED / FAILED ───────────────────────────────────────────
  if (
    (xenditStatus === 'EXPIRED' || xenditStatus === 'FAILED') &&
    order.status === 'pending_payment'
  ) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
      .eq('id', order.id)
  }

  return { received: true }
})
