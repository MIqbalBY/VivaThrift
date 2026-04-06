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

  // ── Ensure stock decremented for each order_item (safety net) ─────────────
  // Offer-based & cart-based checkout should decrement stock optimistically,
  // but if for any reason it was skipped, we fix it here.
  for (const order of updatedOrders) {
    const { data: orderItems } = await supabaseAdmin
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', order.id)

    if (!orderItems?.length) continue

    for (const oi of orderItems) {
      const { data: prod } = await supabaseAdmin
        .from('products')
        .select('stock, status')
        .eq('id', oi.product_id)
        .single()

      if (!prod || prod.stock === null || prod.stock === undefined) continue

      const newStock = Math.max(0, prod.stock - oi.quantity)
      // Only decrement if stock hasn't been adjusted yet (still >= quantity)
      if (prod.stock >= oi.quantity) {
        const stockUpdate: Record<string, unknown> = { stock: newStock }
        if (newStock === 0) stockUpdate.status = 'sold'
        await supabaseAdmin
          .from('products')
          .update(stockUpdate)
          .eq('id', oi.product_id)

        // Expire all remaining pending/accepted offers when stock is exhausted
        if (newStock === 0) {
          await supabaseAdmin
            .from('offers')
            .update({ status: 'expired' })
            .eq('product_id', oi.product_id)
            .in('status', ['pending', 'accepted'])
        }
      }
    }
  }

  // ── Clear cart items for buyer (best-effort) ──────────────────────────────
  // Find buyer from first order, then remove their purchased cart items.
  const { data: firstOrder } = await supabaseAdmin
    .from('orders')
    .select('buyer_id')
    .eq('id', updatedOrders[0].id)
    .single()

  if (firstOrder) {
    const { data: buyerCart } = await supabaseAdmin
      .from('carts')
      .select('id')
      .eq('user_id', firstOrder.buyer_id)
      .maybeSingle()

    if (buyerCart) {
      // Kumpulkan product_ids dari semua order items
      const allProductIds: string[] = []
      for (const order of updatedOrders) {
        const { data: ois } = await supabaseAdmin
          .from('order_items')
          .select('product_id')
          .eq('order_id', order.id)
        if (ois) allProductIds.push(...ois.map(o => o.product_id))
      }
      if (allProductIds.length > 0) {
        await supabaseAdmin
          .from('cart_items')
          .delete()
          .eq('cart_id', buyerCart.id)
          .in('product_id', allProductIds)
      }
    }
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
