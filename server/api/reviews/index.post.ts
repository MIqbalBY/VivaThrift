import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// POST /api/reviews
// Body: {
//   order_item_id:  string,
//   rating_product: number (1-5),
//   rating_seller:  number (1-5),
//   comment?:       string
// }
//
// Rules:
//   1. Caller must be the buyer of the order containing order_item_id
//   2. Order must be 'completed'
//   3. One review per order_item — enforced by DB unique constraint
//   4. Ratings must be integer 1–5

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)
  const body   = await readBody(event)

  const {
    order_item_id,
    rating_product,
    rating_seller,
    comment,
  } = body ?? {}

  // ── Validate required fields ────────────────────────────────────────────────
  if (!order_item_id || typeof order_item_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'order_item_id wajib diisi.' })
  }

  // ── Validate ratings ────────────────────────────────────────────────────────
  for (const [label, val] of [['rating_product', rating_product], ['rating_seller', rating_seller]] as const) {
    if (val === undefined || val === null) {
      throw createError({ statusCode: 400, statusMessage: `${label} wajib diisi.` })
    }
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      throw createError({ statusCode: 400, statusMessage: `${label} harus antara 1-5.` })
    }
  }

  const supabase = await serverSupabaseClient(event)

  // ── Resolve order_item → order (with security checks) ────────────────────────
  const { data: orderItem, error: itemErr } = await supabase
    .from('order_items')
    .select('id, order_id, product_id, order:orders(id, status, buyer_id, seller_id)')
    .eq('id', order_item_id)
    .single()

  if (itemErr || !orderItem) {
    throw createError({ statusCode: 404, statusMessage: 'Item pesanan tidak ditemukan.' })
  }

  const order = Array.isArray(orderItem.order) ? orderItem.order[0] : orderItem.order
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Pesanan tidak ditemukan.' })
  }
  if (order.buyer_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Kamu bukan pembeli di pesanan ini.' })
  }
  if (order.status !== 'completed') {
    throw createError({ statusCode: 422, statusMessage: 'Pesanan belum selesai, tidak bisa di-review.' })
  }

  // ── Check for existing review (friendlier error than DB constraint) ──────────
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_item_id', order_item_id)
    .maybeSingle()

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Item ini sudah pernah diulas.' })
  }

  // ── Insert review ───────────────────────────────────────────────────────────
  // RLS policy reviews_buyer_insert handles final authorization gate.
  const { data: review, error: insertErr } = await supabase
    .from('reviews')
    .insert({
      reviewer_id:    userId,
      reviewee_id:    order.seller_id,
      order_id:       order.id,
      product_id:     orderItem.product_id,
      order_item_id,
      rating_product,
      rating_seller,
      comment:        (comment ?? '').trim() || null,
    })
    .select('id')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Item ini sudah pernah diulas.' })
    }
    throw createError({ statusCode: 500, statusMessage: insertErr.message })
  }

  return { reviewId: review.id }
})