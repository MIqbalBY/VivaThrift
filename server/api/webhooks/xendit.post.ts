import { supabaseAdmin } from '../../utils/supabase-admin'

// POST /api/webhooks/xendit
//
// Menerima notifikasi otomatis dari Xendit saat status Invoice berubah.
//
// Security layer:
//   Xendit menyertakan X-CALLBACK-TOKEN di setiap request.
//   Token ini di-set di dashboard Xendit → Settings → Developers → Callback Token.
//   Jika token tidak cocok → 401 (drop request, tidak diproses).
//
// On PAID event:
//   • Update orders.status → 'confirmed'
//   • Update orders.payment_method
//   • Insert record ke tabel payments

export default defineEventHandler(async (event) => {
  // ── Security: verify Xendit callback token ────────────────────────────────
  const receivedToken = getHeader(event, 'x-callback-token')
  const expectedToken = process.env.XENDIT_CALLBACK_TOKEN

  if (!expectedToken) {
    // Misconfiguration — block silently so server doesn't crash in dev
    console.error('[xendit-webhook] XENDIT_CALLBACK_TOKEN env var is not set!')
    throw createError({ statusCode: 500, statusMessage: 'Webhook misconfigured.' })
  }

  if (receivedToken !== expectedToken) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid callback token.' })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await readBody(event)

  const {
    id:           xenditInvoiceId, // Xendit Invoice ID  (e.g. "inv_xxx")
    external_id:  orderId,         // Our orders.id (UUID we passed at creation)
    status,                        // "PAID" | "EXPIRED" | "SETTLED" etc.
    payment_method: paymentMethod, // "BANK_TRANSFER" | "CREDIT_CARD" | "EWALLET" etc.
    paid_amount:  paidAmount,      // Actual amount paid (may differ from invoice if fee absorbed)
  } = body ?? {}

  // Only act on PAID events; acknowledge everything else silently
  if (status !== 'PAID') {
    return { received: true, action: 'ignored', status }
  }

  if (!orderId || !xenditInvoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing external_id or id in payload.' })
  }

  // ── Update order: confirmed + payment_method ──────────────────────────────
  // Double guard: match both our order ID (external_id) AND xendit_invoice_id
  // so a replayed webhook for a different order cannot modify unrelated rows.
  const { error: orderErr } = await supabaseAdmin
    .from('orders')
    .update({
      status:         'confirmed',
      payment_method: paymentMethod ?? null,
    })
    .eq('id', orderId)
    .eq('xendit_invoice_id', xenditInvoiceId)

  if (orderErr) {
    console.error('[xendit-webhook] Failed to update order:', orderErr)
    // Return 500 so Xendit retries the webhook
    throw createError({ statusCode: 500, statusMessage: 'Failed to update order.' })
  }

  // ── Insert payment record (non-fatal if it fails) ─────────────────────────
  const { error: paymentErr } = await supabaseAdmin
    .from('payments')
    .insert({
      order_id: orderId,
      amount:   paidAmount ?? 0,
      status:   'paid',
    })

  if (paymentErr) {
    console.error('[xendit-webhook] Failed to insert payment record:', paymentErr)
    // Non-fatal: order is already confirmed, payment record is supplemental
  }

  return { received: true, action: 'confirmed', orderId }
})
