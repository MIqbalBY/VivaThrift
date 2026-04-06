import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// POST /api/reviews
// Body: {
//   order_id:       string,
//   product_id:     string,
//   seller_id:      string,
//   rating_product: number (1-5),
//   rating_seller:  number (1-5),
//   comment?:       string
// }
//
// Rules:
//   1. Caller must be the buyer of the order
//   2. Order must be 'completed'
//   3. One review per (reviewer, order) — enforced by DB unique constraint
//   4. Ratings must be integer 1–5

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)
  const body   = await readBody(event)

  const {
    order_id,
    product_id,
    seller_id,
    rating_product,
    rating_seller,
    comment,
  } = body ?? {}

  // ── Validate required fields ────────────────────────────────────────────────
  if (!order_id || typeof order_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'order_id wajib diisi.' })
  }
  if (!product_id || typeof product_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'product_id wajib diisi.' })
  }
  if (!seller_id || typeof seller_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'seller_id wajib diisi.' })
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

  // ── Validate order ownership & status ────────────────────────────────────────
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, buyer_id, seller_id')
    .eq('id', order_id)
    .single()

  if (orderErr || !order) {
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
    .eq('reviewer_id', userId)
    .eq('order_id', order_id)
    .maybeSingle()

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Kamu sudah memberikan ulasan untuk pesanan ini.' })
  }

  // ── Insert review ───────────────────────────────────────────────────────────
  // RLS policy reviews_buyer_insert handles final authorization gate.
  const { data: review, error: insertErr } = await supabase
    .from('reviews')
    .insert({
      reviewer_id:    userId,
      reviewee_id:    seller_id,
      order_id,
      product_id,
      rating_product,
      rating_seller,
      comment:        (comment ?? '').trim() || null,
    })
    .select('id')
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Kamu sudah memberikan ulasan untuk pesanan ini.' })
    }
    throw createError({ statusCode: 500, statusMessage: insertErr.message })
  }

  return { reviewId: review.id }
})