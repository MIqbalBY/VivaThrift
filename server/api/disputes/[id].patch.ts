import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { assertAdmin } from '../../utils/assert-admin'
import { createXenditRefund } from '../../utils/xendit-refund'
import { creditSellerWallet } from '../../utils/seller-wallet'

// PATCH /api/disputes/:id
// Body: { action: 'resolve', resolution: 'refund'|'partial'|'rejected', refund_amount?, resolution_note? }
//     | { action: 'cancel' }
//
// 'resolve': admin only — resolves the dispute
//   - 'refund':   full refund via Xendit + order → resolved_refund
//   - 'partial':  partial refund + seller disbursement (remainder) + order → resolved_partial
//   - 'rejected': restore order → pre_dispute_status, dispute → resolved_rejected
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

  // ── Load dispute ──────────────────────────────────────────────────────────
  const { data: dispute } = await supabaseAdmin
    .from('disputes')
    .select('id, order_id, buyer_id, seller_id, status, refund_status')
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

  // ── Load the associated order (needed for all three branches) ────────────
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select(`
      id, status, total_amount, shipping_cost, platform_fee, payment_gateway_fee,
      xendit_invoice_id, pre_dispute_status
    `)
    .eq('id', dispute.order_id)
    .single() as unknown as { data: any }

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Pesanan terkait dispute tidak ditemukan.' })
  }

  const now = new Date().toISOString()
  const resolutionNote = String(body?.resolution_note ?? '').trim()

  // ── Branch: rejected → restore order status ──────────────────────────────
  if (resolution === 'rejected') {
    const restoreTo = order.pre_dispute_status || 'shipped'

    const { error: restoreErr } = await supabaseAdmin
      .from('orders')
      .update({ status: restoreTo, pre_dispute_status: null, updated_at: now })
      .eq('id', order.id)

    if (restoreErr) {
      throw createError({ statusCode: 500, statusMessage: `Gagal mengembalikan status pesanan: ${restoreErr.message}` })
    }

    const { error: dErr } = await supabaseAdmin
      .from('disputes')
      .update({
        status:          'resolved_rejected',
        resolution_note: resolutionNote || null,
        resolved_by:     userId,
        updated_at:      now,
      })
      .eq('id', disputeId)

    if (dErr) throw createError({ statusCode: 500, statusMessage: dErr.message })

    // Notify both parties (best-effort)
    try {
      await supabaseAdmin.from('notifications').insert([
        { user_id: dispute.buyer_id,  type: 'dispute_resolved', title: 'Dispute ditolak', body: 'Dispute ditolak oleh admin — pesanan dilanjutkan.', reference_id: dispute.order_id },
        { user_id: dispute.seller_id, type: 'dispute_resolved', title: 'Dispute ditolak', body: 'Dispute pada pesananmu ditolak.', reference_id: dispute.order_id },
      ])
    } catch { /* best-effort */ }

    return { id: disputeId, status: 'resolved_rejected', orderRestoredTo: restoreTo }
  }

  // ── Branch: refund (full or partial) ─────────────────────────────────────
  const totalAmount  = Number(order.total_amount ?? 0)
  const shippingCost = Number(order.shipping_cost ?? 0)
  const platformFee  = Number(order.platform_fee ?? 0)
  const paymentGatewayFee = Number(order.payment_gateway_fee ?? 0)

  let refundAmount: number
  let targetDisputeStatus: string
  let targetOrderStatus: string

  if (resolution === 'refund') {
    refundAmount = totalAmount - platformFee
    targetDisputeStatus = 'resolved_refund'
    targetOrderStatus   = 'resolved_refund'
  } else {
    // partial
    refundAmount = Number(body?.refund_amount ?? 0)
    if (refundAmount <= 0 || refundAmount >= totalAmount) {
      throw createError({ statusCode: 400, statusMessage: 'refund_amount harus > 0 dan < total_amount untuk partial refund.' })
    }
    targetDisputeStatus = 'resolved_partial'
    targetOrderStatus   = 'resolved_partial'
  }

  // Optimistically mark refund pending
  await supabaseAdmin
    .from('disputes')
    .update({ refund_status: 'pending', refund_amount: refundAmount, updated_at: now })
    .eq('id', disputeId)

  // ── Call Xendit Refund API ─────────────────────────────────────────────
  let xenditRefundId: string | null = null
  try {
    const refundResult = await createXenditRefund({
      invoiceId:  order.xendit_invoice_id ?? '',
      amount:     refundAmount,
      reason:     'REQUESTED_BY_CUSTOMER',
      externalId: `vt_refund_${disputeId}`,
    })
    xenditRefundId = refundResult.xenditRefundId
  } catch (e: any) {
    const msg = e?.message ?? 'Gagal memproses refund ke Xendit.'
    await supabaseAdmin
      .from('disputes')
      .update({ refund_status: 'failed', refund_error: msg, updated_at: new Date().toISOString() })
      .eq('id', disputeId)
    throw createError({ statusCode: 502, statusMessage: `Xendit refund gagal: ${msg}` })
  }

  // ── Commit dispute + order status changes ──────────────────────────────
  await supabaseAdmin
    .from('disputes')
    .update({
      xendit_refund_id: xenditRefundId,
      refund_status:    'submitted',
      status:           targetDisputeStatus,
      resolution_note:  resolutionNote || null,
      resolved_by:      userId,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', disputeId)

  await supabaseAdmin
    .from('orders')
    .update({ status: targetOrderStatus, updated_at: new Date().toISOString() })
    .eq('id', order.id)

  // ── Seller settlement ──────────────────────────────────────────────────
  // Full refund → admin keeps platform fee in Xendit balance, no disbursement needed.
  // Partial refund → seller gets (total - refund - shipping - platform_fee - payment_gateway_fee) + admin gets fee.
  if (resolution === 'partial') {
    const sellerReceives = totalAmount - refundAmount - shippingCost - platformFee - paymentGatewayFee
    if (sellerReceives > 0) {
      await creditSellerWallet({
        sellerId: dispute.seller_id,
        orderId: order.id,
        grossSellerAmount: sellerReceives,
        paymentGatewayFee: 0,
        txType: 'partial_refund_credit',
      })
    }
  }

  // ── Notifications (best-effort) ────────────────────────────────────────
  const notifBody = resolution === 'refund'
    ? 'Dispute disetujui — refund penuh sedang diproses.'
    : 'Dispute disetujui — refund sebagian sedang diproses.'

  try {
    await supabaseAdmin.from('notifications').insert([
      { user_id: dispute.buyer_id,  type: 'dispute_resolved', title: 'Dispute di-resolve', body: notifBody, reference_id: dispute.order_id },
      { user_id: dispute.seller_id, type: 'dispute_resolved', title: 'Dispute di-resolve', body: notifBody, reference_id: dispute.order_id },
    ])
  } catch { /* best-effort */ }

  return {
    id:              disputeId,
    status:          targetDisputeStatus,
    refund_amount:   refundAmount,
    xendit_refund_id: xenditRefundId,
  }
})
