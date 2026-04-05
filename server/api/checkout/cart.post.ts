import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUser } from '../../utils/resolve-server-uid'
import { supabaseAdmin } from '../../utils/supabase-admin'

// POST /api/checkout/cart
//
// Cart-based checkout (berbeda dari offer-based /api/checkout).
// Semua item di keranjang diproses sekaligus menjadi satu Xendit Invoice.
// Satu invoice bisa mencakup banyak order (satu per seller).
//
// Flow:
//   1. Auth check
//   2. Fetch cart + items
//   3. Validasi stok semua item
//   4. Idempotency: kalau sudah ada pending invoice → return URL lama
//   5. Buat orders per seller
//   6. Buat satu Xendit Invoice untuk total keseluruhan
//   7. Update semua orders dengan xendit_invoice_id + payment_url
//   8. Return { paymentUrl, orderIds, grandTotal }

export default defineEventHandler(async (event) => {
  const user = await resolveServerUser(event)

  const supabase = await serverSupabaseClient(event)

  // ── 1. Fetch cart ─────────────────────────────────────────────────────────
  const { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!cart) throw createError({ statusCode: 404, statusMessage: 'Keranjang tidak ditemukan.' })

  // ── 2. Fetch cart items ───────────────────────────────────────────────────
  const { data: items, error: itemsErr } = await supabase
    .from('cart_items')
    .select(`
      id, product_id, quantity,
      product:products ( id, title, price, status, stock, seller_id )
    `)
    .eq('cart_id', cart.id)

  if (itemsErr) throw createError({ statusCode: 500, statusMessage: itemsErr.message })
  if (!items?.length) throw createError({ statusCode: 400, statusMessage: 'Keranjang kosong.' })

  // ── 3. Validasi stok + self-purchase ─────────────────────────────────────
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

  // ── 4. Idempotency: cek pending orders yang sudah punya payment_url ────────
  // Kolom payment_url / xendit_invoice_id ditambah via migration 006.
  // Tipe Supabase belum di-regenerate → await dulu, baru cast hasilnya ke any.
  type PendingOrder = { id: string; payment_url: string; xendit_invoice_id: string; total_amount: number }
  const existingRaw: any = await supabase
    .from('orders')
    .select('id, payment_url, xendit_invoice_id, total_amount')
    .eq('buyer_id', user.id)
    .eq('status', 'pending_payment')
    .not('payment_url', 'is', null)
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

  const grandTotal = [...sellerMap.values()].reduce((sum, g) => sum + g.total, 0)

  // ── 6. Buat orders per seller ─────────────────────────────────────────────
  const orderIds: string[] = []

  for (const [sellerId, group] of sellerMap.entries()) {
    // Admin client: buyer cannot INSERT orders that reference other sellers via
    // user-JWT + RLS alone because the orders_buyer_insert policy only checks
    // buyer_id = auth.uid() but auth.uid() can be null on Vercel serverless.
    // Business rules (buyer ≠ seller, stock, self-purchase) are already validated above.
    const { data: order, error: ordErr } = await supabaseAdmin
      .from('orders')
      .insert({
        buyer_id:     user.id,
        seller_id:    sellerId,
        total_amount: group.total,
        status:       'pending_payment',
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
  }

  // ── 7. Buat satu Xendit Invoice untuk total keseluruhan ───────────────────
  // external_id = semua order ID dipisah underscore
  // Webhook akan update semua orders berdasarkan xendit_invoice_id
  const xenditKey   = process.env.XENDIT_KEY ?? ''
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
          invoice_duration:     86400,
        },
      }
    )
    xenditInvoiceId = invoiceRes.id
    paymentUrl      = invoiceRes.invoice_url
  } catch (e: any) {
    // Rollback orders (best-effort) jika Xendit gagal
    await supabaseAdmin.from('orders').delete().in('id', orderIds)
    throw createError({ statusCode: 502, statusMessage: e?.data?.message ?? 'Gagal membuat invoice Xendit.' })
  }

  // ── 8. Simpan xendit data ke semua orders ─────────────────────────────────
  // Admin client: buyer tidak punya UPDATE policy untuk xendit columns (RLS: seller-only update).
  await (supabaseAdmin.from('orders') as any)
    .update({ xendit_invoice_id: xenditInvoiceId, payment_url: paymentUrl })
    .in('id', orderIds)

  return { paymentUrl, orderIds, grandTotal, alreadyExisted: false }
})
