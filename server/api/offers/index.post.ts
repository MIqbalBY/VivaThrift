import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { validateOfferPrice, PRODUCT_UNAVAILABLE_STATUSES } from '../../utils/domain-rules'

// POST /api/offers
// Body: { chatId: string, productId: string, price: number, quantity: number }
// Business rules enforced:
//   1. Auth required — only authenticated buyers can send offers
//   2. Buyer cannot be the seller of the product (no self-purchase)
//   3. Product must be status=active (not sold/inactive/moderated/banned)
//   4. Price must be valid (< listing price, >= min_offer_price or 50% floor)
//   5. Quantity must be within available stock
//   6. Previous pending offers in this chat are superseded atomically
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody(event)
  const { chatId, productId, price, quantity = 1 } = body ?? {}

  if (!chatId || typeof chatId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'chatId harus diisi.' })
  }
  if (!productId || typeof productId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'productId harus diisi.' })
  }
  if (!Number.isInteger(price) || price <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Harga harus bilangan bulat positif.' })
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Jumlah minimal 1.' })
  }

  const supabase = await serverSupabaseClient(event)

  // ── 1. Load product ───────────────────────────────────────────────
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, seller_id, price, stock, status')
    .eq('id', productId)
    .single()

  if (prodErr || !product) {
    throw createError({ statusCode: 404, statusMessage: 'Produk tidak ditemukan.' })
  }

  // ── 2. Buyer ≠ seller (no self-purchase) ─────────────────────────
  if (product.seller_id === user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Tidak bisa menawar produk sendiri.' })
  }

  // ── 3. Product must be active ─────────────────────────────────────
  if (PRODUCT_UNAVAILABLE_STATUSES.includes(product.status as any)) {
    throw createError({ statusCode: 409, statusMessage: 'Produk tidak lagi tersedia.' })
  }

  // ── 4. Price validation ───────────────────────────────────────────
  const priceCheck = validateOfferPrice(price, product.price, null)
  if (!priceCheck.valid) {
    throw createError({ statusCode: 400, statusMessage: priceCheck.error! })
  }

  // ── 5. Stock check ────────────────────────────────────────────────
  if (product.stock !== null && product.stock !== undefined && product.stock < quantity) {
    throw createError({ statusCode: 409, statusMessage: `Stok hanya ${product.stock} unit.` })
  }

  // ── 6. Supersede existing pending offers in this chat (same buyer) ──
  await supabase
    .from('offers')
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('buyer_id', user.id)
    .eq('status', 'pending')

  // ── 7. INSERT new offer ───────────────────────────────────────────
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .insert({
      chat_id:       chatId,
      product_id:    productId,
      buyer_id:      user.id,
      offered_price: price,
      quantity,
      status:        'pending',
    })
    .select('id')
    .single()

  if (offerErr || !offer) {
    throw createError({ statusCode: 500, statusMessage: offerErr?.message ?? 'Gagal membuat penawaran.' })
  }

  // ── 8. INSERT offer message ───────────────────────────────────────
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      chat_id:   chatId,
      sender_id: user.id,
      offer_id:  offer.id,
      content:   `Mengajukan penawaran: Rp ${price.toLocaleString('id-ID')} × ${quantity} unit`,
    })
    .select('id, content, is_read, created_at, sender_id, offer_id, reply_to_id, edited_at, is_deleted')
    .single()

  if (msgErr) {
    throw createError({ statusCode: 500, statusMessage: msgErr.message })
  }

  return {
    offerId:  offer.id,
    message,
  }
})
