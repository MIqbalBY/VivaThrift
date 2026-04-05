import { supabaseAdmin } from '../../utils/supabase-admin'

// POST /api/webhooks/xendit
//
// Menerima notifikasi otomatis dari Xendit saat status Invoice berubah.
//
// Security:
//   Xendit menyertakan X-CALLBACK-TOKEN di setiap request.
//   Set di: dashboard.xendit.co → Settings → Developers → Callback Token
//
// Mendukung dua flow:
//   - Offer-based checkout  : external_id = single order UUID
//   - Cart-based checkout   : external_id = "orderId1_orderId2_..."
//
// On PAID: update SEMUA orders dengan xendit_invoice_id tsb → 'confirmed'
//          lalu insert payment record per order.

export default defineEventHandler(async (event) => {
  // ── Security: verify Xendit callback token ────────────────────────────────
  const receivedToken = getHeader(event, 'x-callback-token')
  const expectedToken = process.env.XENDIT_CALLBACK_TOKEN

  if (!expectedToken) {
    console.error('[xendit-webhook] XENDIT_CALLBACK_TOKEN env var is not set!')
    throw createError({ statusCode: 500, statusMessage: 'Webhook misconfigured.' })
  }
  if (receivedToken !== expectedToken) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid callback token.' })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await readBody(event)
  const {
    id:              xenditInvoiceId,
    status,
    payment_method:  paymentMethod,
    paid_amount:     paidAmount,
  } = body ?? {}

  // Abaikan event selain PAID
  if (status !== 'PAID') {
    return { received: true, action: 'ignored', status }
  }

  if (!xenditInvoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invoice id in payload.' })
  }

  // ── Update semua orders dengan invoice ID ini → confirmed ─────────────────
  // Satu query handles both single-order (offer flow) dan multi-order (cart flow).
  const { data: updatedOrders, error: orderErr } = await supabaseAdmin
    .from('orders')
    .update({
      status:         'confirmed',
      payment_method: paymentMethod ?? null,
    })
    .eq('xendit_invoice_id', xenditInvoiceId)
    .select('id, total_amount')

  if (orderErr) {
    console.error('[xendit-webhook] Failed to update orders:', orderErr)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update orders.' })
  }

  if (!updatedOrders?.length) {
    // Invoice ID tidak ditemukan di DB — mungkin sudah diproses atau data stale
    console.warn('[xendit-webhook] No orders found for invoice:', xenditInvoiceId)
    return { received: true, action: 'no_orders_found' }
  }

  // ── Insert payment record per order (non-fatal) ───────────────────────────
  // Untuk cart checkout dengan banyak order, amount dibagi proporsional.
  const totalDbAmount = updatedOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const actualPaid    = paidAmount ?? totalDbAmount

  const paymentRows = updatedOrders.map(o => ({
    order_id: o.id,
    amount:   totalDbAmount > 0
      ? Math.round(actualPaid * ((o.total_amount ?? 0) / totalDbAmount))
      : 0,
    status: 'paid',
  }))

  const { error: paymentErr } = await supabaseAdmin.from('payments').insert(paymentRows)
  if (paymentErr) {
    console.error('[xendit-webhook] Failed to insert payment records:', paymentErr)
  }

  return {
    received:   true,
    action:     'confirmed',
    orderCount: updatedOrders.length,
    orderIds:   updatedOrders.map(o => o.id),
  }
})
