import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// POST /api/disputes
// Body: { order_id, reason, evidence_urls?: string[] }
// Creates a new dispute. Caller must be the buyer of the order.
// Order must be in 'shipped' or 'completed' status.

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)

  const body = await readBody(event)
  const orderId = String(body?.order_id ?? '').trim()
  const reason  = String(body?.reason ?? '').trim()
  const evidenceUrls: string[] = Array.isArray(body?.evidence_urls) ? body.evidence_urls : []

  if (!orderId) throw createError({ statusCode: 400, statusMessage: 'order_id wajib diisi.' })
  if (!reason || reason.length < 10) {
    throw createError({ statusCode: 400, statusMessage: 'Alasan dispute minimal 10 karakter.' })
  }

  // Load order
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, buyer_id, seller_id, status')
    .eq('id', orderId)
    .single()

  if (!order) throw createError({ statusCode: 404, statusMessage: 'Pesanan tidak ditemukan.' })
  if (order.buyer_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Hanya pembeli yang bisa membuka dispute.' })
  }
  if (!['shipped', 'completed', 'awaiting_meetup'].includes(order.status)) {
    throw createError({ statusCode: 422, statusMessage: 'Dispute hanya bisa dibuka untuk pesanan yang sudah dikirim atau selesai.' })
  }

  // Check no existing open dispute
  const { data: existing } = await supabaseAdmin
    .from('disputes')
    .select('id')
    .eq('order_id', orderId)
    .in('status', ['open', 'in_review'])
    .limit(1)

  if (existing?.length) {
    throw createError({ statusCode: 409, statusMessage: 'Sudah ada dispute aktif untuk pesanan ini.' })
  }

  // Snapshot the current order status so we can restore it if dispute is rejected.
  // Also transition order.status → 'disputed' (state machine will block invalid transitions).
  const { error: snapshotErr } = await supabaseAdmin
    .from('orders')
    .update({ pre_dispute_status: order.status, status: 'disputed' })
    .eq('id', orderId)
    .in('status', ['shipped', 'completed', 'awaiting_meetup'])

  if (snapshotErr) {
    throw createError({ statusCode: 500, statusMessage: `Gagal menandai pesanan sebagai disputed: ${snapshotErr.message}` })
  }

  // Create dispute
  const { data: dispute, error } = await supabaseAdmin
    .from('disputes')
    .insert({
      order_id:      orderId,
      buyer_id:      userId,
      seller_id:     order.seller_id,
      reason,
      evidence_urls: evidenceUrls,
    })
    .select('id, status, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Notify seller (best-effort)
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id:      order.seller_id,
      actor_id:     userId,
      type:         'dispute_opened',
      title:        'Dispute dibuka pada pesananmu',
      body:         reason.length > 80 ? reason.slice(0, 80) + '…' : reason,
      reference_id: orderId,
    })
  } catch { /* best-effort */ }

  return dispute
})
