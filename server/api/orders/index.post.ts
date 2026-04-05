import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { PRODUCT_UNAVAILABLE_STATUSES } from '../../utils/domain-rules'

// POST /api/orders
// Body: { offerId: string }
// Atomically places an order from an accepted offer:
//   1. Validate offer belongs to caller and is accepted
//   2. Idempotency guard (return existing order if already placed)
//   3. Real-time stock re-check (prevent TOCTOU race condition)
//   4. INSERT order + order_items in sequence
//   5. Decrement product stock (+ mark sold if stock hits 0)
//   6. Mark offer as expired so it cannot be checked out again
export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)

  const body = await readBody(event)
  const offerId = body?.offerId
  if (!offerId || typeof offerId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'offerId harus diisi.' })
  }

  const supabase = await serverSupabaseClient(event)

  // ── 1. Load offer (RLS ensures caller is buyer) ──────────────────
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .select('id, offered_price, quantity, status, buyer_id, product_id, chat:chats(id, seller_id), product:products(id, title, seller_id, stock, status)')
    .eq('id', offerId)
    .eq('buyer_id', userId)
    .single()

  if (offerErr || !offer) {
    throw createError({ statusCode: 404, statusMessage: 'Penawaran tidak ditemukan.' })
  }

  // ── 2. Idempotency guard ─────────────────────────────────────────
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('offer_id', offerId)
    .eq('buyer_id', userId)
    .maybeSingle()

  if (existingOrder) {
    return { orderId: existingOrder.id, alreadyExisted: true }
  }

  // ── 3. Validate offer status ─────────────────────────────────────
  if (offer.status !== 'accepted') {
    throw createError({ statusCode: 422, statusMessage: 'Penawaran belum diterima penjual.' })
  }

  // ── 4. Real-time stock check (re-fetch to prevent TOCTOU) ────────
  if (!offer.product_id) throw createError({ statusCode: 400, statusMessage: 'Produk tidak valid.' })

  const { data: currentProduct } = await supabase
    .from('products')
    .select('stock, status')
    .eq('id', offer.product_id)
    .single()

  const UNAVAILABLE_STATUSES = PRODUCT_UNAVAILABLE_STATUSES
  if (
    !currentProduct ||
    UNAVAILABLE_STATUSES.includes(currentProduct.status as any) ||
    (currentProduct.stock !== null && currentProduct.stock !== undefined && currentProduct.stock < offer.quantity)
  ) {
    throw createError({ statusCode: 409, statusMessage: 'stock_depleted' })
  }

  const product = offer.product as any
  const chat = offer.chat as any
  const sellerId = chat?.seller_id ?? product?.seller_id

  // ── 5. INSERT order ───────────────────────────────────────────────
  const { data: order, error: ordErr } = await supabase
    .from('orders')
    .insert({
      buyer_id:     userId,
      seller_id:    sellerId,
      total_amount: offer.offered_price * offer.quantity,
      status:       'pending_payment',
      offer_id:     offerId,
    })
    .select('id')
    .single()

  if (ordErr) throw createError({ statusCode: 500, statusMessage: ordErr.message })

  // ── 6. INSERT order_item ──────────────────────────────────────────
  const { error: itemErr } = await supabase
    .from('order_items')
    .insert({
      order_id:      order.id,
      product_id:    offer.product_id,
      quantity:      offer.quantity,
      price_at_time: offer.offered_price,
    })

  if (itemErr) throw createError({ statusCode: 500, statusMessage: itemErr.message })

  // ── 7. Decrement stock ────────────────────────────────────────────
  if (currentProduct.stock !== null && currentProduct.stock !== undefined) {
    const newStock = Math.max(0, currentProduct.stock - offer.quantity)
    const stockUpdate: Record<string, unknown> = { stock: newStock }
    if (newStock === 0) stockUpdate.status = 'sold'
    await supabase.from('products').update(stockUpdate).eq('id', offer.product_id as string)
  }

  // ── 8. Mark offer as expired ──────────────────────────────────────
  await supabase
    .from('offers')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', offerId)

  return { orderId: order.id, alreadyExisted: false }
})
