import { supabaseAdmin } from '../../utils/supabase-admin'
import { sendEmail } from '../../utils/send-email'
import { emailOrderConfirmedBuyer, emailNewOrderSeller } from '../../utils/email-templates'

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

  if (!xenditInvoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invoice id in payload.' })
  }

  // ── Handle EXPIRED / FAILED → restore stock + offer ───────────────────────
  if (status === 'EXPIRED' || status === 'FAILED') {
    const { data: failedOrders } = await supabaseAdmin
      .from('orders')
      .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
      .eq('xendit_invoice_id', xenditInvoiceId)
      .in('status', ['pending_payment'])
      .select('id, offer_id')

    for (const order of failedOrders ?? []) {
      // Restore product stock
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', order.id)
      for (const item of items ?? []) {
        const { data: prod } = await supabaseAdmin
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single()
        await supabaseAdmin
          .from('products')
          .update({ status: 'active', stock: (prod?.stock ?? 0) + item.quantity })
          .eq('id', item.product_id)
      }
      // Restore offer
      if (order.offer_id) {
        await supabaseAdmin
          .from('offers')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', order.offer_id)
      }
    }

    return { received: true, action: 'payment_failed', orderCount: failedOrders?.length ?? 0 }
  }

  // Ignore anything else (e.g. PENDING)
  if (status !== 'PAID') {
    return { received: true, action: 'ignored', status }
  }

  // ── Fetch current orders to determine shipping_method per order ───────────
  const { data: currentOrders } = await supabaseAdmin
    .from('orders')
    .select(`id, shipping_method, shipping_cost, meetup_location, total_amount, offer_id,
      buyer:users!buyer_id  ( id, name, email ),
      seller:users!seller_id ( id, name, email )`)
    .eq('xendit_invoice_id', xenditInvoiceId)
    .in('status', ['pending_payment'])

  if (!currentOrders?.length) {
    return { received: true, action: 'no_orders_found' }
  }

  // ── Update each order with correct next status (COD vs shipping) ──────────
  const updatePromises = currentOrders.map((o) => {
    const nextStatus = o.shipping_method === 'cod' ? 'awaiting_meetup' : 'confirmed'
    return supabaseAdmin
      .from('orders')
      .update({ status: nextStatus, payment_method: paymentMethod ?? null })
      .eq('id', o.id)
      .select('id, total_amount')
  })
  const updateResults = await Promise.all(updatePromises)
  const updatedOrders = updateResults.flatMap(r => r.data ?? [])
  const orderErr      = updateResults.find(r => r.error)?.error

  if (orderErr) {
    console.error('[xendit-webhook] Failed to update orders:', orderErr)
    throw createError({ statusCode: 500, statusMessage: 'Failed to update orders.' })
  }

  // ── Stock note ────────────────────────────────────────────────────────────
  // Stock decrement is handled optimistically at checkout time (cart.post.ts
  // and index.post.ts). We do NOT decrement again here to avoid double-
  // decrement bugs. If checkout crashed before decrementing, an admin can
  // reconcile manually or a scheduled job can fix the mismatch.

  // ── Clear cart items for buyer (best-effort) ──────────────────────────────
  // Find buyer from first order, then remove their purchased cart items.
  const { data: firstOrder } = await supabaseAdmin
    .from('orders')
    .select('buyer_id')
    .eq('id', updatedOrders[0]!.id)
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

  // ── Send transactional emails (best-effort, non-blocking) ────────────────
  for (const co of currentOrders) {
    const buyer  = co.buyer  as any
    const seller = co.seller as any
    if (!buyer?.email || !seller?.email) continue

    // Load product title from order_items
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('quantity, product:products ( title )')
      .eq('order_id', co.id)
      .limit(1)
    const item = items?.[0] as any
    const productTitle = item?.product?.title ?? 'Produk'
    const quantity     = item?.quantity ?? 1

    try {
      const buyerEmail = emailOrderConfirmedBuyer({
        buyerName:      buyer.name ?? 'Pembeli',
        orderId:        co.id,
        productTitle,
        quantity,
        totalAmount:    co.total_amount ?? 0,
        shippingMethod: (co.shipping_method as 'cod' | 'shipping') ?? 'shipping',
        meetupLocation: co.meetup_location,
      })
      const sellerEmail = emailNewOrderSeller({
        sellerName:     seller.name ?? 'Penjual',
        orderId:        co.id,
        productTitle,
        quantity,
        totalAmount:    co.total_amount ?? 0,
        buyerName:      buyer.name ?? 'Pembeli',
        shippingMethod: (co.shipping_method as 'cod' | 'shipping') ?? 'shipping',
      })
      // Fire-and-forget — don't block webhook response
      sendEmail({ to: buyer.email,  subject: buyerEmail.subject,  html: buyerEmail.html  }).catch(() => {})
      sendEmail({ to: seller.email, subject: sellerEmail.subject, html: sellerEmail.html }).catch(() => {})
    } catch { /* best-effort */ }
  }

  return {
    received:   true,
    action:     'confirmed',
    orderCount: updatedOrders.length,
    orderIds:   updatedOrders.map(o => o.id),
  }
})
