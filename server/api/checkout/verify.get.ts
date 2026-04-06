import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// GET /api/checkout/verify?order_id=ORDER_ID
// Called from /cart/success to verify Xendit paid status and update order.
// This handles local dev where Xendit webhook can't reach localhost.

export default defineEventHandler(async (event) => {
  const userId  = await resolveServerUid(event)
  const orderId = getQuery(event).order_id as string | undefined

  if (!orderId) throw createError({ statusCode: 400, statusMessage: 'order_id diperlukan.' })

  // ── Load order (caller must be buyer) ────────────────────────────────────
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, xendit_invoice_id, buyer_id, shipping_method')
    .eq('id', orderId)
    .eq('buyer_id', userId)
    .maybeSingle()

  if (!order) throw createError({ statusCode: 404, statusMessage: 'Pesanan tidak ditemukan.' })

  // Already confirmed or beyond — nothing to do
  if (order.status !== 'pending_payment') {
    return { status: order.status, updated: false }
  }

  if (!order.xendit_invoice_id) {
    return { status: order.status, updated: false }
  }

  // ── Call Xendit API to fetch invoice status ──────────────────────────────
  const xenditKey   = process.env.XENDIT_KEY ?? ''
  const credentials = Buffer.from(`${xenditKey}:`).toString('base64')

  try {
    const invoice = await $fetch<{ status: string; id: string }>(
      `https://api.xendit.co/v2/invoices/${order.xendit_invoice_id}`,
      {
        headers: { Authorization: `Basic ${credentials}` },
      },
    )

    if (invoice.status === 'PAID') {
      // COD orders skip the "confirmed/Dikemas" stage — go directly to awaiting_meetup
      const nextStatus = (order as any).shipping_method === 'cod' ? 'awaiting_meetup' : 'confirmed'
      const { error: updErr } = await supabaseAdmin
        .from('orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id)
      if (updErr) {
        console.error('[verify] Failed to update order to confirmed:', updErr)
        throw createError({ statusCode: 500, statusMessage: `DB update gagal: ${updErr.message}` })
      }
      return { status: nextStatus, updated: true }
    }

    if (invoice.status === 'EXPIRED' || invoice.status === 'FAILED') {
      const { error: updErr } = await supabaseAdmin
        .from('orders')
        .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
        .eq('id', order.id)
      if (updErr) {
        console.error('[verify] Failed to update order to payment_failed:', updErr)
      }
      return { status: 'payment_failed', updated: !updErr }
    }

    return { status: order.status, updated: false }
  } catch {
    return { status: order.status, updated: false }
  }
})
