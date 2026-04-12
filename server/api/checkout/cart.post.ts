import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUser } from '../../utils/resolve-server-uid'
import { supabaseAdmin } from '../../utils/supabase-admin'
import { getXenditSecretKey } from '../../utils/xendit-config'
import { getXenditPaymentMethodsForChannel } from '../../utils/xendit-payment-methods'
import { isSupportedPaymentChannel } from '../../utils/xendit-payment-methods'
import {
  isValidMeetupLocation,
  generateMeetupOTP,
  calculatePlatformFee,
  calculatePaymentChargeBreakdown,
} from '../../utils/domain-rules'
import type { ShippingMethod } from '../../utils/domain-rules'

// POST /api/checkout/cart
//
// Cart-based checkout (berbeda dari offer-based /api/checkout).
// Semua item di keranjang diproses sekaligus menjadi satu Xendit Invoice.
// Satu invoice bisa mencakup banyak order (satu per seller).
//
// Body (NEW):
//   shippingMethod: 'cod' | 'shipping'
//   meetupLocation?: string  ← required when COD
//   shippingCost?: number    ← total ongkir for shipping
//   courierCode?: string     ← courier identifier
//
// Flow:
//   1. Auth check
//   2. Fetch cart + items
//   3. Validasi stok semua item
//   4. Idempotency: kalau sudah ada pending invoice → return URL lama
//   5. Buat orders per seller (with shipping info + OTP if COD)
//   6. Buat satu Xendit Invoice untuk total keseluruhan (incl ongkir)
//   7. Update semua orders dengan xendit_invoice_id + payment_url
//   8. Return { paymentUrl, orderIds, grandTotal }

export default defineEventHandler(async (event) => {
  const user = await resolveServerUser(event)

  const body = await readBody(event)
  const paymentChannel = String(body?.paymentChannel ?? '').trim().toLowerCase()
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
  let shippingCost: number = 0
  const courierCode: string | null = body?.courierCode ?? null

  if (shippingMethod === 'cod') {
    meetupLocation = body?.meetupLocation
    if (!meetupLocation || !isValidMeetupLocation(meetupLocation)) {
      throw createError({ statusCode: 400, statusMessage: 'Lokasi meetup tidak valid.' })
    }
  } else {
    shippingCost = Math.max(0, Math.round(Number(body?.shippingCost) || 0))
  }

  const supabase = await serverSupabaseClient(event)

  // ── 1. Fetch cart ─────────────────────────────────────────────────────────
  const { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!cart) throw createError({ statusCode: 404, statusMessage: 'Keranjang tidak ditemukan.' })

  // ── 2. Idempotency check (sebelum validasi items) ─────────────────────────
  // Jika cart sudah dikosongkan oleh checkout sebelumnya, kembalikan payment URL lama
  // daripada melempar error "Keranjang kosong". Window 24 jam = Xendit invoice expiry.
  type PendingOrder = { id: string; payment_url: string; xendit_invoice_id: string; total_amount: number }
  const idempotencyWindow = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const existingRaw: any = await supabase
    .from('orders')
    .select('id, payment_url, xendit_invoice_id, total_amount')
    .eq('buyer_id', user.id)
    .eq('status', 'pending_payment')
    .is('offer_id', null)  // cart checkout orders tidak punya offer_id
    .not('payment_url', 'is', null)
    .gte('created_at', idempotencyWindow)
    .order('created_at', { ascending: false })
    .limit(1)
  const existingOrders = existingRaw?.data as PendingOrder[] | null

  if (existingOrders?.[0]?.payment_url) {
    return {
      paymentUrl:     existingOrders[0].payment_url,
      orderIds:       [existingOrders[0].id],
      grandTotal:     existingOrders[0].total_amount,
      alreadyExisted: true,
    }
  }

  // ── 3. Fetch cart items ───────────────────────────────────────────────────
  const { data: items, error: itemsErr } = await supabase
    .from('cart_items')
    .select(`
      id, product_id, quantity,
      product:products ( id, title, price, status, stock, seller_id )
    `)
    .eq('cart_id', cart.id)

  if (itemsErr) throw createError({ statusCode: 500, statusMessage: itemsErr.message })
  if (!items?.length) throw createError({ statusCode: 400, statusMessage: 'Keranjang kosong.' })

  // ── 4. Validasi stok + self-purchase ─────────────────────────────────────
  const depleted: string[] = []
  const ownProducts: string[] = []

  for (const item of items) {
    const p = item.product as any
    if (!p || p.status === 'sold' || p.status === 'deleted') {
      depleted.push(p?.title ?? item.product_id)
    } else if (p.stock !== null && p.stock < item.quantity) {
      depleted.push(`${p.title} (sisa ${p.stock})`)
    }
    if (p?.seller_id === user.id) {
      ownProducts.push(p.title ?? item.product_id)
    }
  }

  if (ownProducts.length > 0) {
    throw createError({
      statusCode: 422,
      statusMessage: `Tidak bisa membeli produk milikmu sendiri: ${ownProducts.join(', ')}`,
    })
  }
  if (depleted.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Stok tidak cukup: ${depleted.join(', ')}`,
    })
  }

  // ── 5. Group items per seller & hitung total ──────────────────────────────
  type SellerGroup = { items: typeof items; total: number }
  const sellerMap = new Map<string, SellerGroup>()

  for (const item of items) {
    const p = item.product as any
    const sellerId = p.seller_id as string
    if (!sellerMap.has(sellerId)) sellerMap.set(sellerId, { items: [], total: 0 })
    const group = sellerMap.get(sellerId)!
    group.items.push(item)
    group.total += (p.price ?? 0) * item.quantity
  }

  let grandTotal = 0

  // ── 6. Buat orders per seller ─────────────────────────────────────────────
  const orderIds: string[] = []

  // Split shippingCost evenly across seller groups (first group absorbs remainder)
  const sellerCount = sellerMap.size
  const costPerSeller = Math.floor(shippingCost / sellerCount)
  let remainderCost = shippingCost - costPerSeller * sellerCount
  let sellerIndex = 0

  for (const [sellerId, group] of sellerMap.entries()) {
    const orderShippingCost = costPerSeller + (sellerIndex === 0 ? remainderCost : 0)
    const meetupOtp = shippingMethod === 'cod' ? generateMeetupOTP() : null
    const platformFee = calculatePlatformFee(group.total)
    const baseAmount = group.total + orderShippingCost + platformFee
    const paymentGatewayFee = calculatePaymentChargeBreakdown(baseAmount, paymentChannel).total
    const orderTotalAmount = baseAmount
    grandTotal += orderTotalAmount

    const { data: order, error: ordErr } = await supabaseAdmin
      .from('orders')
      .insert({
        buyer_id:        user.id,
        seller_id:       sellerId,
        total_amount:    orderTotalAmount,
        platform_fee:    platformFee,
        payment_gateway_fee: paymentGatewayFee,
        payment_method:  paymentChannel,
        status:          'pending_payment',
        shipping_method: shippingMethod,
        shipping_cost:   orderShippingCost,
        meetup_location: meetupLocation,
        meetup_otp:      meetupOtp,
        courier_code:    courierCode,
      })
      .select('id')
      .single()

    if (ordErr || !order) throw createError({ statusCode: 500, statusMessage: ordErr?.message ?? 'Gagal membuat order.' })

    const { error: itemErr } = await supabaseAdmin.from('order_items').insert(
      group.items.map(item => ({
        order_id:      order.id,
        product_id:    item.product_id,
        quantity:      item.quantity,
        price_at_time: (item.product as any).price,
      }))
    )
    if (itemErr) throw createError({ statusCode: 500, statusMessage: itemErr.message })

    orderIds.push(order.id)
    sellerIndex++
  }

  // ── 6b. Decrement stock & mark sold per product (optimistic) ─────────────
  for (const item of items) {
    const p = item.product as any
    // Always mark sold (secondhand = each item is unique); only update stock if tracked
    const stockUpdate: Record<string, unknown> = { status: 'sold' }
    if (p.stock !== null && p.stock !== undefined) {
      stockUpdate.stock = Math.max(0, p.stock - item.quantity)
    }
    await supabaseAdmin
      .from('products')
      .update(stockUpdate)
      .eq('id', item.product_id)

    // Expire all remaining pending/accepted offers
    await supabaseAdmin
      .from('offers')
      .update({ status: 'expired' })
      .eq('product_id', item.product_id)
      .in('status', ['pending', 'accepted'])
  }

  // ── 7. Buat satu Xendit Invoice untuk total keseluruhan ───────────────────
  // external_id = semua order ID dipisah underscore
  // Webhook akan update semua orders berdasarkan xendit_invoice_id
  const xenditKey   = getXenditSecretKey()
  const xenditPaymentMethods = getXenditPaymentMethodsForChannel(paymentChannel)
  const siteUrl     = process.env.SITE_URL ?? 'https://vivathrift.store'
  const credentials = Buffer.from(`${xenditKey}:`).toString('base64')
  const externalId  = orderIds.join('_')
  const itemSummary = items.length === 1
    ? ((items[0]!.product as any)?.title ?? 'produk')
    : `${items.length} produk dari keranjang`

  let xenditInvoiceId: string
  let paymentUrl: string

  try {
    const invoiceRes = await $fetch<{ id: string; invoice_url: string }>(
      'https://api.xendit.co/v2/invoices',
      {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
        body: {
          external_id:          externalId,
          amount:               grandTotal,
          description:          `VivaThrift - ${itemSummary}`,
          customer: {
            given_names: user.fullName ?? user.email?.split('@')[0] ?? 'Pembeli',
            email:       user.email,
          },
          success_redirect_url: `${siteUrl}/cart/success?order_ids=${orderIds.join(',')}`,
          failure_redirect_url: `${siteUrl}/cart/checkout?payment_failed=1`,
          currency:             'IDR',
          invoice_duration:     900, // 15 menit
          payment_methods:      xenditPaymentMethods,
        },
      }
    )
    xenditInvoiceId = invoiceRes.id
    paymentUrl      = invoiceRes.invoice_url
  } catch (e: any) {
    // Rollback orders + restore stock (best-effort) jika Xendit gagal
    await supabaseAdmin.from('orders').delete().in('id', orderIds)
    for (const item of items) {
      const p = item.product as any
      const restoreUpdate: Record<string, unknown> = { status: p.status }
      if (p.stock !== null && p.stock !== undefined) {
        restoreUpdate.stock = p.stock
      }
      await supabaseAdmin
        .from('products')
        .update(restoreUpdate)
        .eq('id', item.product_id)
    }
    throw createError({ statusCode: 502, statusMessage: e?.data?.message ?? 'Gagal membuat invoice Xendit.' })
  }

  // ── 8. Simpan xendit data ke semua orders ─────────────────────────────────
  // Admin client: buyer tidak punya UPDATE policy untuk xendit columns (RLS: seller-only update).
  await (supabaseAdmin.from('orders') as any)
    .update({ xendit_invoice_id: xenditInvoiceId, payment_url: paymentUrl })
    .in('id', orderIds)

  // ── 9. Clear cart items (best-effort) ─────────────────────────────────────
  await supabaseAdmin.from('cart_items').delete().eq('cart_id', cart.id)

  return { paymentUrl, orderIds, grandTotal, alreadyExisted: false }
})
