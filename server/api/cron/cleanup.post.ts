import { supabaseAdmin } from '../../utils/supabase-admin'
import { creditSellerWallet } from '../../utils/seller-wallet'

// POST /api/cron/cleanup
//
// Scheduled job that runs periodically (via Vercel Cron or external trigger).
// Handles:
//   1. Expire pending offers older than 24 hours
//   2. Cancel unpaid orders older than 1 hour + restore stock
//   3. Auto-complete shipped orders older than 7 days + disburse
//
// Security: protected by CRON_SECRET env var.

export default defineEventHandler(async (event) => {
  // ── Auth: verify cron secret ──────────────────────────────────────────────
  const authHeader = getHeader(event, 'authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized.' })
  }

  const results = {
    expiredOffers: 0,
    cancelledOrders: 0,
    autoCompletedOrders: 0,
  }

  const now = new Date()

  // ── 1. Expire pending offers > 24 hours ───────────────────────────────────
  const offerCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: expiredOffers } = await supabaseAdmin
    .from('offers')
    .update({ status: 'expired', updated_at: now.toISOString() })
    .eq('status', 'pending')
    .lt('created_at', offerCutoff)
    .select('id')

  results.expiredOffers = expiredOffers?.length ?? 0

  // ── 2. Cancel unpaid orders > 1 hour + restore stock ──────────────────────
  const orderCutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const { data: staleOrders } = await supabaseAdmin
    .from('orders')
    .select('id, offer_id')
    .eq('status', 'pending_payment')
    .lt('created_at', orderCutoff)

  for (const order of staleOrders ?? []) {
    // Cancel the order
    await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled', updated_at: now.toISOString() })
      .eq('id', order.id)

    // Restore stock
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
      if (prod) {
        await supabaseAdmin
          .from('products')
          .update({ status: 'active', stock: (prod.stock ?? 0) + item.quantity })
          .eq('id', item.product_id)
      }
    }

    // Restore offer to accepted (so buyer can retry checkout)
    if (order.offer_id) {
      await supabaseAdmin
        .from('offers')
        .update({ status: 'accepted', updated_at: now.toISOString() })
        .eq('id', order.offer_id)
    }
  }
  results.cancelledOrders = staleOrders?.length ?? 0

  // ── 3. Auto-complete shipped orders > 7 days ─────────────────────────────
  const shipCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: autoCompleteOrders } = await supabaseAdmin
    .from('orders')
    .select(`
      id, total_amount, shipping_cost, platform_fee, offer_id, seller_id, buyer_id,
      payment_gateway_fee
    `)
    .eq('status', 'shipped')
    .lt('shipped_at', shipCutoff)

  for (const order of (autoCompleteOrders ?? []) as any[]) {
    // Mark completed
    await supabaseAdmin
      .from('orders')
      .update({ status: 'completed', completed_at: now.toISOString() })
      .eq('id', order.id)

    // Mark offer completed
    if (order.offer_id) {
      await supabaseAdmin
        .from('offers')
        .update({ status: 'completed', updated_at: now.toISOString() })
        .eq('id', order.offer_id)
    }

    // Credit seller wallet (split-cost model)
    const grossSellerAmount = order.total_amount - (order.shipping_cost ?? 0) - (order.platform_fee ?? 0)
    await creditSellerWallet({
      sellerId: order.seller_id,
      orderId: order.id,
      grossSellerAmount,
      paymentGatewayFee: order.payment_gateway_fee ?? 0,
      txType: 'order_credit',
    })

    // Notify both parties
    try {
      await supabaseAdmin.from('notifications').insert([
        {
          user_id: order.buyer_id, type: 'order_completed',
          title: 'Pesanan otomatis selesai',
          body: 'Pesananmu sudah 7 hari sejak dikirim dan otomatis dikonfirmasi.',
          reference_id: order.id,
        },
        {
          user_id: order.seller_id, type: 'order_completed',
          title: 'Pesanan otomatis selesai',
          body: 'Pesanan otomatis selesai setelah 7 hari. Saldo penjualan sudah masuk ke wallet seller-mu.',
          reference_id: order.id,
        },
      ])
    } catch { /* best-effort */ }
  }
  results.autoCompletedOrders = autoCompleteOrders?.length ?? 0

  console.log('[cron/cleanup]', results)
  return { ok: true, ...results }
})
