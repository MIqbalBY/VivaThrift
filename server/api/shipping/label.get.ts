import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { extractBiteshipLabelUrl, getBiteshipTracking } from '../../utils/biteship'
import { renderShippingLabelHtml } from '../../utils/shipping-label'

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)
  const query = getQuery(event)
  const orderId = String(query.order_id ?? '').trim()

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'order_id wajib diisi.' })
  }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select(`
      id, status, buyer_id, seller_id, tracking_number, courier_name, biteship_order_id,
      shipping_is_fragile, shipping_is_insured, shipping_insurance_fee,
      order_items ( quantity, product:products ( title ) ),
      seller:users!seller_id ( name, phone ),
      buyer:users!buyer_id ( name, phone )
    `)
    .eq('id', orderId)
    .single()

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Pesanan tidak ditemukan.' })
  }

  if (order.buyer_id !== userId && order.seller_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak.' })
  }

  const [{ data: sellerAddr }, { data: buyerAddr }] = await Promise.all([
    supabaseAdmin
      .from('addresses')
      .select('full_address, city, postal_code')
      .eq('user_id', order.seller_id)
      .eq('address_type', 'seller')
      .maybeSingle(),
    supabaseAdmin
      .from('addresses')
      .select('full_address, city, postal_code')
      .eq('user_id', order.buyer_id)
      .eq('address_type', 'shipping')
      .maybeSingle(),
  ])

  let officialLabelUrl: string | null = null
  if (order.biteship_order_id) {
    try {
      const tracking = await getBiteshipTracking(order.biteship_order_id)
      officialLabelUrl = extractBiteshipLabelUrl(tracking)
    } catch {
      officialLabelUrl = null
    }
  }

  const items = ((order.order_items ?? []) as any[])
    .map((item) => `${item.quantity ?? 1}x ${item.product?.title ?? 'Produk VivaThrift'}`)
    .join('<br/>') || 'Produk VivaThrift'

  const seller = order.seller as any
  const buyer = order.buyer as any

  setHeader(event, 'content-type', 'text/html; charset=utf-8')

  return renderShippingLabelHtml({
    orderId: order.id,
    courierName: order.courier_name,
    trackingNumber: order.tracking_number,
    biteshipOrderId: order.biteship_order_id,
    sellerName: seller?.name,
    sellerPhone: seller?.phone,
    sellerAddress: [sellerAddr?.full_address, sellerAddr?.city, sellerAddr?.postal_code].filter(Boolean).join(' '),
    buyerName: buyer?.name,
    buyerPhone: buyer?.phone,
    buyerAddress: [buyerAddr?.full_address, buyerAddr?.city, buyerAddr?.postal_code].filter(Boolean).join(' '),
    itemsHtml: items,
    shippingIsFragile: (order as any).shipping_is_fragile,
    shippingIsInsured: (order as any).shipping_is_insured,
    shippingInsuranceFee: (order as any).shipping_insurance_fee,
    officialLabelUrl,
  })
})
