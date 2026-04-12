import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUser } from '../../utils/resolve-server-uid'
import { supabaseAdmin } from '../../utils/supabase-admin'
import { getXenditSecretKey } from '../../utils/xendit-config'
import { getXenditPaymentMethodsForChannel } from '../../utils/xendit-payment-methods'
import { isSupportedPaymentChannel } from '../../utils/xendit-payment-methods'
import {
  PRODUCT_UNAVAILABLE_STATUSES,
  isValidMeetupLocation,
  generateMeetupOTP,
  calculatePlatformFee,
  calculatePaymentChargeBreakdown,
} from '../../utils/domain-rules'
import type { ShippingMethod } from '../../utils/domain-rules'

// POST /api/checkout
// Body: {
//   offerId: string,
//   shippingMethod: 'cod' | 'shipping',       ← NEW
//   meetupLocation?: string,                   ← required when COD
//   shippingCost?: number,                     ← required when shipping
//   courierCode?: string,                      ← optional courier identifier
// }
//
// Flow (Xendit Escrow / Rekening Bersama):
//   1. Validate offer belongs to caller and is accepted
//   2. Idempotency: return existing payment_url if order already has one
//   3. Real-time stock re-check (TOCTOU prevention)
//   4. INSERT order + order_items (with shipping info + OTP if COD)
//   5. Decrement product stock
//   6. Call Xendit API → create Invoice (amount includes shipping_cost)
//   7. Persist xendit_invoice_id + payment_url to order
//   8. Mark offer as expired
//   9. Return { orderId, paymentUrl }

export default defineEventHandler(async (event) => {
  const user = await resolveServerUser(event)

  const body = await readBody(event)
  const offerId: string | undefined = body?.offerId
  const paymentChannel = String(body?.paymentChannel ?? '').trim().toLowerCase()
  if (!offerId || typeof offerId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'offerId harus diisi.' })
  }
  if (!paymentChannel) {
    throw createError({ statusCode: 400, statusMessage: 'paymentChannel harus diisi.' })
  }
  if (!isSupportedPaymentChannel(paymentChannel)) {
    throw createError({ statusCode: 400, statusMessage: 'paymentChannel tidak didukung.' })
  }

  // ── Shipping method validation ──────────────────────────────────────────
  const shippingMethod: ShippingMethod | undefined = body?.shippingMethod
  if (!shippingMethod || !['cod', 'shipping'].includes(shippingMethod)) {
    throw createError({ statusCode: 400, statusMessage: 'shippingMethod harus "cod" atau "shipping".' })
  }

  let meetupLocation: string | null = null
  let meetupOtp: string | null = null
  let shippingCost: number = 0
  const courierCode: string | null    = body?.courierCode    ?? null
  const courierService: string | null = body?.courierService ?? null

  if (shippingMethod === 'cod') {
    meetupLocation = body?.meetupLocation
    if (!meetupLocation || !isValidMeetupLocation(meetupLocation)) {
      throw createError({ statusCode: 400, statusMessage: 'Lokasi meetup tidak valid.' })
    }
    meetupOtp = generateMeetupOTP()
  } else {
    shippingCost = Math.max(0, Math.round(Number(body?.shippingCost) || 0))
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

  // Only short-circuit if payment is still in progress (pending_payment + URL exists).
  // A payment_failed order must be treated as a fresh retry — fall through.
  if (existingOrder?.payment_url && existingOrder.status === 'pending_payment') {
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
  const subtotal: number    = offer.offered_price * offer.quantity
  const platformFee: number = calculatePlatformFee(subtotal)
  const baseAmount: number = subtotal + platformFee + shippingCost
  const paymentGatewayFee: number = calculatePaymentChargeBreakdown(baseAmount, paymentChannel).total
  const totalAmount: number = baseAmount

  // ── 5. INSERT order ───────────────────────────────────────────────────────
  let orderId: string

  if (existingOrder && existingOrder.status === 'pending_payment') {
    // Idempotency: order row exists without a payment_url yet — reuse it.
    orderId = existingOrder.id
  } else {
    if (existingOrder?.status === 'payment_failed') {
      // Retry after a failed payment: restore the existing order to pending_payment.
      // (stock + offer were already restored by the webhook/verify handler)
      await supabaseAdmin
        .from('orders')
        .update({ status: 'pending_payment', updated_at: new Date().toISOString() })
        .eq('id', existingOrder.id)
      orderId = existingOrder.id
    } else {
      // Fresh checkout: create a new order row + items.
      const { data: order, error: ordErr } = await supabaseAdmin
        .from('orders')
        .insert({
          buyer_id:        user.id,
          seller_id:       sellerId,
          total_amount:    totalAmount,
          platform_fee:    platformFee,
          payment_gateway_fee: paymentGatewayFee,
          payment_method:    paymentChannel,
          status:          'pending_payment',
          offer_id:        offerId,
          shipping_method: shippingMethod,
          shipping_cost:   shippingCost,
          meetup_location: meetupLocation,
          meetup_otp:      meetupOtp,
          courier_code:    courierCode,
          courier_service: courierService,
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

      orderId = order.id
    }

    // Decrement stock & mark sold (runs for both fresh checkout and retry).
    // Always mark sold (secondhand = each item is unique); only update stock if tracked.
    const stockUpdate: Record<string, unknown> = { status: 'sold' }
    if (currentProduct.stock !== null && currentProduct.stock !== undefined) {
      stockUpdate.stock = Math.max(0, currentProduct.stock - offer.quantity)
    }
    await supabaseAdmin
      .from('products')
      .update(stockUpdate)
      .eq('id', offer.product_id as string)

    // Expire all remaining pending/accepted offers for this product
    await supabaseAdmin
      .from('offers')
      .update({ status: 'expired' })
      .eq('product_id', offer.product_id as string)
      .in('status', ['pending', 'accepted'])
  }

  // ── 6. Call Xendit API — create Invoice ───────────────────────────────────
  const xenditKey = getXenditSecretKey()
  const xenditPaymentMethods = getXenditPaymentMethodsForChannel(paymentChannel)
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
          success_redirect_url: `${siteUrl}/cart/success?order_id=${orderId}`,
          failure_redirect_url: `${siteUrl}/checkout?offer_id=${offerId}&payment_failed=1`,
          currency:             'IDR',
          invoice_duration:     900, // 15 menit
          payment_methods:      xenditPaymentMethods,
        },
      },
    )

    xenditInvoiceId = invoiceRes.id
    paymentUrl      = invoiceRes.invoice_url
  } catch (e: any) {
    // Rollback: restore product status/stock and offer so buyer can retry.
    const { data: prod } = await supabaseAdmin
      .from('products')
      .select('stock')
      .eq('id', offer.product_id as string)
      .single()
    await supabaseAdmin
      .from('products')
      .update({ status: 'active', stock: (prod?.stock ?? 0) + offer.quantity })
      .eq('id', offer.product_id as string)
    await supabaseAdmin
      .from('offers')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', offerId)
    await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', orderId)

    const detail = e?.data?.message ?? e?.message ?? 'Gagal membuat invoice Xendit.'
    throw createError({ statusCode: 502, statusMessage: detail })
  }

  // ── 7. Persist Xendit data to order ──────────────────────────────────────
  await supabaseAdmin
    .from('orders')
    .update({ xendit_invoice_id: xenditInvoiceId, payment_url: paymentUrl })
    .eq('id', orderId)

  // ── 8. Mark offer as completed (checkout done) ───────────────────────────
  await supabaseAdmin
    .from('offers')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', offerId)

  return { orderId, paymentUrl, alreadyExisted: false }
})
