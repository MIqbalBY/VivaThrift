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

  // ── 2. Load order(s) ────────────────────────────────────────────────────
  // Single-product checkout: external_id === orderId → query by id
  // Cart checkout: external_id === "uuid1_uuid2_..." → query by xendit_invoice_id
  let orders: { id: string; status: string; shipping_method: string | null }[] = []

  const { data: singleOrder } = await supabaseAdmin
    .from('orders')
    .select('id, status, shipping_method')
    .eq('id', externalId)
    .maybeSingle()

  if (singleOrder) {
    orders = [singleOrder as any]
  } else if (xenditId) {
    // Cart checkout: multiple orders share the same xendit_invoice_id
    const { data: multiOrders } = await supabaseAdmin
      .from('orders')
      .select('id, status, shipping_method')
      .eq('xendit_invoice_id', xenditId)
    orders = (multiOrders ?? []) as any
  }

  if (orders.length === 0) {
    // Not our order — acknowledge and ignore
    return { received: true }
  }

  // ── 3. Handle PAID ───────────────────────────────────────────────────────
  if (xenditStatus === 'PAID') {
    const pendingOrders = orders.filter(o => o.status === 'pending_payment')
    for (const o of pendingOrders) {
      // COD orders skip the "confirmed/Dikemas" stage — go directly to awaiting_meetup
      const nextStatus = (o as any).shipping_method === 'cod' ? 'awaiting_meetup' : 'confirmed'
      await supabaseAdmin
        .from('orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', o.id)
    }
  }

  // ── 4. Handle EXPIRED / FAILED ───────────────────────────────────────────
  if (xenditStatus === 'EXPIRED' || xenditStatus === 'FAILED') {
    const pendingOrders = orders.filter(o => o.status === 'pending_payment')
    for (const o of pendingOrders) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
        .eq('id', o.id)
    }
  }

  return { received: true }
})
