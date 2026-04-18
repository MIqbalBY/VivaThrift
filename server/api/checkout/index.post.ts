import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUser } from '../../utils/resolve-server-uid'
import { supabaseAdmin } from '../../utils/supabase-admin'
import { getXenditSecretKey } from '../../utils/xendit-config'
import { getXenditPaymentMethodsForChannel } from '../../utils/xendit-payment-methods'
import { isSupportedPaymentChannel } from '../../utils/xendit-payment-methods'
import { expireXenditInvoice } from '../../utils/xendit-invoice'
import {
  PRODUCT_UNAVAILABLE_STATUSES,
  isValidMeetupLocation,
  generateMeetupOTP,
  calculatePlatformFee,
  calculatePaymentChargeBreakdown,
  getProductStockUpdateAfterPurchase,
} from '../../utils/domain-rules'
import type { ShippingMethod } from '../../utils/domain-rules'
import { normalizeShippingCollectionType } from '../../../app/utils/shipping-checkout'

function paymentChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    qris: 'QRIS',
    bca_va: 'Virtual Account BCA',
    bni_va: 'Virtual Account BNI',
    bri_va: 'Virtual Account BRI',
    mandiri_va: 'Virtual Account Mandiri',
    gopay: 'GoPay',
    ovo: 'OVO',
    dana: 'DANA',
    shopeepay: 'ShopeePay',
  }
  return labels[channel] ?? channel
}

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
  const forceRegenerateInvoice = body?.forceRegenerateInvoice === true
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

  const xenditKey = getXenditSecretKey()
  if (!xenditKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_KEY belum dikonfigurasi.' })
  }

  // ── Shipping method validation ──────────────────────────────────────────
  const shippingMethod: ShippingMethod | undefined = body?.shippingMethod
  if (!shippingMethod || !['cod', 'shipping'].includes(shippingMethod)) {
    throw createError({ statusCode: 400, statusMessage: 'shippingMethod harus "cod" atau "shipping".' })
  }

  let meetupLocation: string | null = null
  let meetupOtp: string | null = null
  let shippingCost: number = 0
  let shippingInsuranceFee: number = 0
  let shippingIsInsured = false
  let shippingIsFragile = false
  let shippingCollectionType: 'pickup' | 'drop_off' | null = null
  const courierCode: string | null    = body?.courierCode    ?? null
  const courierName: string | null    = body?.courierName    ?? null
  const courierService: string | null = body?.courierService ?? null

  if (shippingMethod === 'cod') {
    meetupLocation = body?.meetupLocation
    if (!meetupLocation || !isValidMeetupLocation(meetupLocation)) {
      throw createError({ statusCode: 400, statusMessage: 'Lokasi meetup tidak valid.' })
    }
    meetupOtp = generateMeetupOTP()
  } else {
    shippingCost = Math.max(0, Math.round(Number(body?.shippingCost) || 0))
    shippingInsuranceFee = Math.max(0, Math.round(Number(body?.shippingInsuranceFee) || 0))
    shippingIsInsured = body?.shippingIsInsured === true && shippingInsuranceFee > 0
    shippingIsFragile = body?.shippingIsFragile === true
    shippingCollectionType = normalizeShippingCollectionType(body?.shippingCollectionType)
  }

  const supabase = await serverSupabaseClient(event)

  if (shippingMethod === 'shipping') {
    const [{ data: profile }, { data: address }] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('addresses')
        .select('full_address, postal_code')
        .eq('user_id', user.id)
        .eq('address_type', 'shipping')
        .maybeSingle(),
    ])

    if (!String(profile?.phone ?? '').trim()) {
      throw createError({ statusCode: 422, statusMessage: 'Nomor HP aktif wajib diisi di profil sebelum checkout pengiriman.' })
    }

    if (!String(address?.full_address ?? '').trim() || !String(address?.postal_code ?? '').trim()) {
      throw createError({ statusCode: 422, statusMessage: 'Alamat pengiriman belum lengkap. Lengkapi profil alamat terlebih dahulu.' })
    }
  }

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
    .select('id, payment_url, xendit_invoice_id, status, payment_method')
    .eq('offer_id', offerId)
    .eq('buyer_id', user.id)
    .maybeSingle()

  let isReissuing = false

  // Only short-circuit if payment is still in progress (pending_payment + URL exists).
  // A payment_failed order must be treated as a fresh retry — fall through.
  if (existingOrder?.payment_url && existingOrder.status === 'pending_payment') {
    const existingMethod = (existingOrder.payment_method ?? '').toLowerCase()
    if (existingMethod !== paymentChannel) {
      if (!forceRegenerateInvoice) {
        throw createError({
          statusCode: 409,
          statusMessage: `Masih ada invoice aktif dengan metode ${paymentChannelLabel(existingOrder.payment_method ?? '')}. Selesaikan atau tunggu invoice kadaluarsa sebelum ganti metode pembayaran.`,
          data: {
            existingPaymentUrl: existingOrder.payment_url,
            existingPaymentMethod: existingOrder.payment_method,
            canRegenerateInvoice: true,
          },
        })
      }

      if (existingOrder.xendit_invoice_id) {
        await expireXenditInvoice(existingOrder.xendit_invoice_id)
      }
      isReissuing = true
    }
  }

  if (existingOrder?.payment_url && existingOrder.status === 'pending_payment' && !isReissuing) {
    return {
      orderId: existingOrder.id,
      paymentUrl: existingOrder.payment_url,
      alreadyExisted: true,
    }
  }

  // ── 3. Validate offer status ─────────────────────────────────────────────
  if (!isReissuing && offer.status !== 'accepted') {
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

  if (!isReissuing && (
    !currentProduct ||
    PRODUCT_UNAVAILABLE_STATUSES.includes(currentProduct.status as any) ||
    (currentProduct.stock !== null &&
      currentProduct.stock !== undefined &&
      currentProduct.stock < offer.quantity)
  )) {
    throw createError({ statusCode: 409, statusMessage: 'stock_depleted' })
  }

  const product = offer.product as any
  const chat = offer.chat as any
  const sellerId: string = chat?.seller_id ?? product?.seller_id
  const subtotal: number    = offer.offered_price * offer.quantity
  const platformFee: number = calculatePlatformFee(subtotal)
  // Buyer only pays item subtotal + shipping. Platform + gateway fees are seller-borne.
  const buyerPayableAmount: number = subtotal + shippingCost + shippingInsuranceFee
  const paymentGatewayFee: number = calculatePaymentChargeBreakdown(buyerPayableAmount, paymentChannel).total
  const totalAmount: number = buyerPayableAmount

  // ── 5. INSERT order ───────────────────────────────────────────────────────
  let orderId: string

  if (existingOrder && existingOrder.status === 'pending_payment') {
    // Idempotency: order row exists without a payment_url yet — reuse it.
    await supabaseAdmin
      .from('orders')
      .update({
        total_amount: totalAmount,
        platform_fee: platformFee,
        payment_gateway_fee: paymentGatewayFee,
        payment_method: paymentChannel,
        shipping_method: shippingMethod,
        shipping_cost: shippingCost,
        shipping_collection_type: shippingCollectionType,
        shipping_insurance_fee: shippingInsuranceFee,
        shipping_is_insured: shippingIsInsured,
        shipping_is_fragile: shippingIsFragile,
        meetup_location: meetupLocation,
        meetup_otp: meetupOtp,
        courier_code: courierCode,
        courier_name: courierName,
        courier_service: courierService,
        xendit_invoice_id: null,
        payment_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingOrder.id)
    orderId = existingOrder.id
  } else {
    if (existingOrder?.status === 'payment_failed') {
      // Retry after a failed payment: restore the existing order to pending_payment.
      // (stock + offer were already restored by the webhook/verify handler)
      await supabaseAdmin
        .from('orders')
        .update({
          status: 'pending_payment',
          total_amount: totalAmount,
          platform_fee: platformFee,
          payment_gateway_fee: paymentGatewayFee,
          payment_method: paymentChannel,
          shipping_method: shippingMethod,
          shipping_cost: shippingCost,
          shipping_collection_type: shippingCollectionType,
          shipping_insurance_fee: shippingInsuranceFee,
          shipping_is_insured: shippingIsInsured,
          meetup_location: meetupLocation,
          meetup_otp: meetupOtp,
          courier_code: courierCode,
          courier_name: courierName,
          courier_service: courierService,
          updated_at: new Date().toISOString(),
        })
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
          shipping_collection_type: shippingCollectionType,
          shipping_insurance_fee: shippingInsuranceFee,
          shipping_is_insured: shippingIsInsured,
          shipping_is_fragile: shippingIsFragile,
          meetup_location: meetupLocation,
          meetup_otp:      meetupOtp,
          courier_code:    courierCode,
          courier_name:    courierName,
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

    // Decrement stock after checkout. Keep product active while units remain.
    if (!isReissuing) {
      const stockUpdate = getProductStockUpdateAfterPurchase(currentProduct?.stock, offer.quantity)
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
  }

  // ── 6. Call Xendit API — create Invoice ───────────────────────────────────
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
    if (isReissuing) {
      const detail = e?.data?.message ?? e?.message ?? 'Gagal membuat invoice Xendit.'
      throw createError({ statusCode: 502, statusMessage: detail })
    }
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
