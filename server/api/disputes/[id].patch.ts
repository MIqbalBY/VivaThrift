import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { assertAdmin } from '../../utils/assert-admin'

// PATCH /api/disputes/:id
// Body: { action: 'resolve', resolution: 'refund'|'partial'|'rejected', refund_amount?, resolution_note? }
//     | { action: 'cancel' }
//
// 'resolve': admin only — resolves the dispute
// 'cancel':  buyer only — cancels their own open dispute

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)

  const disputeId = getRouterParam(event, 'id')
  if (!disputeId) throw createError({ statusCode: 400, statusMessage: 'dispute id tidak ditemukan.' })

  const body = await readBody(event)
  const action: string = body?.action

  if (!['resolve', 'cancel'].includes(action)) {
    throw createError({ statusCode: 400, statusMessage: 'action harus "resolve" atau "cancel".' })
  }

  // Load dispute
  const { data: dispute } = await supabaseAdmin
    .from('disputes')
    .select('id, order_id, buyer_id, seller_id, status')
    .eq('id', disputeId)
    .single()

  if (!dispute) throw createError({ statusCode: 404, statusMessage: 'Dispute tidak ditemukan.' })

  // ── Cancel (buyer only) ──────────────────────────────────────────────────
  if (action === 'cancel') {
    if (dispute.buyer_id !== userId) {
      throw createError({ statusCode: 403, statusMessage: 'Hanya pembeli yang bisa membatalkan dispute.' })
    }
    if (dispute.status !== 'open') {
      throw createError({ statusCode: 422, statusMessage: 'Hanya dispute berstatus "open" yang bisa dibatalkan.' })
    }

    const { error } = await supabaseAdmin
      .from('disputes')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', disputeId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { id: disputeId, status: 'cancelled' }
  }

  // ── Resolve (admin only) ─────────────────────────────────────────────────
  await assertAdmin(event)

  if (!['open', 'in_review'].includes(dispute.status)) {
    throw createError({ statusCode: 422, statusMessage: 'Dispute ini sudah di-resolve.' })
  }

  const resolution = String(body?.resolution ?? '')
  if (!['refund', 'partial', 'rejected'].includes(resolution)) {
    throw createError({ statusCode: 400, statusMessage: 'resolution harus "refund", "partial", atau "rejected".' })
  }

  const statusMap: Record<string, string> = {
    refund:   'resolved_refund',
    partial:  'resolved_partial',
    rejected: 'resolved_rejected',
  }

  const refundAmount = resolution === 'rejected' ? 0 : Number(body?.refund_amount ?? 0)
  const resolutionNote = String(body?.resolution_note ?? '').trim()

  const { error } = await supabaseAdmin
    .from('disputes')
    .update({
      status:          statusMap[resolution],
      refund_amount:   refundAmount,
      resolution_note: resolutionNote || null,
      resolved_by:     userId,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', disputeId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Notify both parties (best-effort)
  const notifBody = resolution === 'rejected'
    ? 'Dispute ditolak oleh admin.'
    : `Dispute disetujui — refund ${resolution === 'partial' ? 'sebagian' : 'penuh'} akan diproses.`

  try {
    await supabaseAdmin.from('notifications').insert([
      {
        user_id:      dispute.buyer_id,
        type:         'dispute_resolved',
        title:        'Dispute telah di-resolve',
        body:         notifBody,
        reference_id: dispute.order_id,
      },
      {
        user_id:      dispute.seller_id,
        type:         'dispute_resolved',
        title:        'Dispute telah di-resolve',
        body:         notifBody,
        reference_id: dispute.order_id,
      },
    ])
  } catch { /* best-effort */ }

  return { id: disputeId, status: statusMap[resolution], refund_amount: refundAmount }
})
