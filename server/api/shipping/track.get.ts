import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { getBiteshipTracking } from '../../utils/biteship'

// GET /api/shipping/track?order_id=<uuid>
// Returns Biteship tracking history for an order.
// Caller must be the buyer or seller of the order.

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)

  const query   = getQuery(event)
  const orderId = String(query.order_id ?? '').trim()
  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'order_id wajib diisi.' })
  }

  // Load order — only fields needed for auth + Biteship ID
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, buyer_id, seller_id, biteship_order_id, tracking_number, courier_name')
    .eq('id', orderId)
    .single()

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Pesanan tidak ditemukan.' })
  }

  // Authorization: must be buyer or seller
  if (order.buyer_id !== userId && order.seller_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak.' })
  }

  if (!order.biteship_order_id) {
    throw createError({ statusCode: 422, statusMessage: 'Pesanan ini tidak menggunakan Biteship — tidak ada data pelacakan.' })
  }

  let tracking: any
  try {
    tracking = await getBiteshipTracking(order.biteship_order_id)
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: e?.data?.message ?? e?.message ?? 'Gagal memuat data pelacakan dari Biteship.' })
  }

  return {
    biteship_order_id: order.biteship_order_id,
    tracking_number:   order.tracking_number,
    courier_name:      order.courier_name,
    status:            tracking?.status ?? null,
    courier:           tracking?.courier ?? null,
    history:           tracking?.courier?.history ?? [],
  }
})
