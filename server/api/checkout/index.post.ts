import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUser } from '../../utils/resolve-server-uid'
import { supabaseAdmin } from '../../utils/supabase-admin'
import { PRODUCT_UNAVAILABLE_STATUSES } from '../../utils/domain-rules'

// POST /api/checkout
// Body: { offerId: string }
//
// Flow (Xendit Escrow / Rekening Bersama):
//   1. Validate offer belongs to caller and is accepted
//   2. Idempotency: return existing payment_url if order already has one
//   3. Real-time stock re-check (TOCTOU prevention)
//   4. INSERT order + order_items
//   5. Decrement product stock
//   6. Call Xendit API → create Invoice
//   7. Persist xendit_invoice_id + payment_url to order
//   8. Mark offer as expired
//   9. Return { orderId, paymentUrl }

export default defineEventHandler(async (event) => {
  const user = await resolveServerUser(event)

  const body = await readBody(event)
  const offerId: string | undefined = body?.offerId
  if (!offerId || typeof offerId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'offerId harus diisi.' })
  }

  const supabase = await serverSupabaseClient(event)

  // ── 1. Load offer (RLS ensures caller is buyer) ──────────────────────────
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .select(`
      id, offered_price, quantity, status, buyer_id, product_id,
      chat:chats ( id, seller_id ),
      product:products ( id, title, seller_id, stock, status )
    `)
    .eq('id', offerId)
    .eq('buyer_id', user.id)
    .single()

  if (offerErr || !offer) {
    throw createError({ statusCode: 404, statusMessage: 'Penawaran tidak ditemukan.' })
  }

  // ── 2. Idempotency: return existing payment URL ──────────────────────────
  const { data: existingOrder } = await supabaseAdmin
    .from('orders')
    .select('id, payment_url, xendit_invoice_id, status')
    .eq('offer_id', offerId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (existingOrder?.payment_url) {
    return {
      orderId: existingOrder.id,
      paymentUrl: existingOrder.payment_url,
      alreadyExisted: true,
    }
  }

  // ── 3. Validate offer status ─────────────────────────────────────────────
  if (offer.status !== 'accepted') {
    throw createError({ statusCode: 422, statusMessage: 'Penawaran belum diterima penjual.' })
  }

  if (!offer.product_id) {
    throw createError({ statusCode: 400, statusMessage: 'Produk tidak valid.' })
  }

  // ── 4. Real-time stock re-check (prevents TOCTOU race) ───────────────────
  const { data: currentProduct } = await supabase
    .from('products')
    .select('stock, status')
    .eq('id', offer.product_id)
    .single()

  if (
    !currentProduct ||
    PRODUCT_UNAVAILABLE_STATUSES.includes(currentProduct.status as any) ||
    (currentProduct.stock !== null &&
      currentProduct.stock !== undefined &&
      currentProduct.stock < offer.quantity)
  ) {
    throw createError({ statusCode: 409, statusMessage: 'stock_depleted' })
  }

  const product = offer.product as any
  const chat = offer.chat as any
  const sellerId: string = chat?.seller_id ?? product?.seller_id
  const totalAmount: number = offer.offered_price * offer.quantity

  // ── 5. INSERT order ───────────────────────────────────────────────────────
  let orderId: string

  if (existingOrder) {
    // Order row exists but has no payment_url yet → reuse it
    orderId = existingOrder.id
  } else {
    const { data: order, error: ordErr } = await supabaseAdmin
      .from('orders')
      .insert({
        buyer_id:     user.id,
        seller_id:    sellerId,
        total_amount: totalAmount,
        status:       'pending_payment',
        offer_id:     offerId,
      })
      .select('id')
      .single()

    if (ordErr) throw createError({ statusCode: 500, statusMessage: ordErr.message })

    // INSERT order_item
    const { error: itemErr } = await supabaseAdmin
      .from('order_items')
      .insert({
        order_id:      order.id,
        product_id:    offer.product_id,
        quantity:      offer.quantity,
        price_at_time: offer.offered_price,
      })

    if (itemErr) throw createError({ statusCode: 500, statusMessage: itemErr.message })

    // Decrement stock (optimistic — webhook will not change stock)
    if (currentProduct.stock !== null && currentProduct.stock !== undefined) {
      const newStock = Math.max(0, currentProduct.stock - offer.quantity)
      const stockUpdate: Record<string, unknown> = { stock: newStock }
      if (newStock === 0) stockUpdate.status = 'sold'
      await supabaseAdmin
        .from('products')
        .update(stockUpdate)
        .eq('id', offer.product_id as string)
    }

    orderId = order.id
  }

  // ── 6. Call Xendit API — create Invoice ───────────────────────────────────
  const xenditKey = process.env.XENDIT_KEY ?? ''
  const siteUrl   = process.env.SITE_URL ?? 'https://vivathrift.store'
  const credentials = Buffer.from(`${xenditKey}:`).toString('base64')

  let xenditInvoiceId: string
  let paymentUrl: string

  try {
    const invoiceRes = await $fetch<{ id: string; invoice_url: string }>(
      'https://api.xendit.co/v2/invoices',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: {
          external_id:          orderId,
          amount:               totalAmount,
          description:          `VivaThrift - ${product?.title ?? 'Produk'}`,
          customer: {
            given_names: user.fullName ?? user.email?.split('@')[0] ?? 'Pembeli',
            email:       user.email,
          },
          success_redirect_url: `${siteUrl}/checkout/success?order_id=${orderId}`,
          failure_redirect_url: `${siteUrl}/checkout?offer_id=${offerId}&payment_failed=1`,
          currency:             'IDR',
          invoice_duration:     86400, // 24 jam
        },
      },
    )

    xenditInvoiceId = invoiceRes.id
    paymentUrl      = invoiceRes.invoice_url
  } catch (e: any) {
    const detail = e?.data?.message ?? e?.message ?? 'Gagal membuat invoice Xendit.'
    throw createError({ statusCode: 502, statusMessage: detail })
  }

  // ── 7. Persist Xendit data to order ──────────────────────────────────────
  await supabaseAdmin
    .from('orders')
    .update({ xendit_invoice_id: xenditInvoiceId, payment_url: paymentUrl })
    .eq('id', orderId)

  // ── 8. Mark offer as expired (cannot be checked out again) ───────────────
  await supabaseAdmin
    .from('offers')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', offerId)

  return { orderId, paymentUrl, alreadyExisted: false }
})
