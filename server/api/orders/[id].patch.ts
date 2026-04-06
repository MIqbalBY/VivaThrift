import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { assertTransition } from '../../utils/state-machine'
import { calculateCommission } from '../../utils/domain-rules'

// PATCH /api/orders/:id
// Body: { action: 'ship', tracking_number: string, courier_name?: string }
//     | { action: 'complete' }
//
// 'ship':
//   - Caller must be the seller
//   - Order must be in 'confirmed' state
//   - Sets tracking_number, courier_name, shipped_at, status = 'shipped'
//
// 'complete':
//   - Caller must be the buyer
//   - Order must be in 'shipped' state
//   - Sets completed_at, status = 'completed'
//   - Triggers Xendit disbursement to seller's bank account (if configured)
//   - Marks associated offer as 'completed'

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)

  const orderId = getRouterParam(event, 'id')
  if (!orderId) throw createError({ statusCode: 400, statusMessage: 'order id tidak ditemukan.' })

  const body = await readBody(event)
  const action: string = body?.action

  if (action !== 'ship' && action !== 'complete') {
    throw createError({ statusCode: 400, statusMessage: 'action harus "ship" atau "complete".' })
  }

  // ── Load order ─────────────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select(`
      id, status, total_amount, offer_id, seller_id, buyer_id,
      seller:users!seller_id (
        id, name, bank_code, bank_account_number, bank_account_name
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Pesanan tidak ditemukan.' })
  }

  // ── Authorization ──────────────────────────────────────────────────────────
  if (action === 'ship' && order.seller_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Hanya penjual yang bisa mengubah status pengiriman.' })
  }
  if (action === 'complete' && order.buyer_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Hanya pembeli yang bisa mengkonfirmasi penerimaan pesanan.' })
  }

  // ── State machine validation ────────────────────────────────────────────────
  const targetStatus = action === 'ship' ? 'shipped' : 'completed'
  assertTransition('order', order.status, targetStatus)

  // ── Action: ship ────────────────────────────────────────────────────────────
  if (action === 'ship') {
    const trackingNumber: string = (body?.tracking_number ?? '').trim()
    if (!trackingNumber) {
      throw createError({ statusCode: 400, statusMessage: 'Nomor resi pengiriman wajib diisi.' })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        status:          'shipped',
        tracking_number: trackingNumber,
        courier_name:    (body?.courier_name ?? '').trim() || null,
        shipped_at:      new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateErr) throw createError({ statusCode: 500, statusMessage: updateErr.message })

    // Notify buyer via notifications table (best-effort)
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id:      order.buyer_id,
        type:         'order_shipped',
        title:        'Paketmu sedang dikirim!',
        body:         `Nomor resi: ${trackingNumber}. Konfirmasi pesanan setelah barang tiba ya.`,
        reference_id: orderId,
      })
    } catch { /* best-effort */ }

    return { orderId, status: 'shipped', tracking_number: trackingNumber }
  }

  // ── Action: complete ────────────────────────────────────────────────────────
  const now = new Date().toISOString()

  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({
      status:       'completed',
      completed_at: now,
    })
    .eq('id', orderId)

  if (updateErr) throw createError({ statusCode: 500, statusMessage: updateErr.message })

  // Mark associated offer as completed
  if (order.offer_id) {
    await supabaseAdmin
      .from('offers')
      .update({ status: 'completed', updated_at: now })
      .eq('id', order.offer_id)
  }

  // ── Xendit Disbursement (pencairan dana ke seller) ─────────────────────────
  let disbursementId: string | null = null
  let disbursementSkipped = false
  let disbursementError: string | null = null

  const xenditKey  = process.env.XENDIT_KEY ?? ''
  const seller     = order.seller as any
  const hasBankInfo = seller?.bank_code && seller?.bank_account_number && seller?.bank_account_name

  if (!xenditKey) {
    disbursementSkipped = true
    disbursementError   = 'XENDIT_KEY tidak dikonfigurasi.'
    console.warn('[orders/complete] Disbursement skipped: XENDIT_KEY missing')
  } else if (!hasBankInfo) {
    disbursementSkipped = true
    disbursementError   = 'Data rekening penjual belum dilengkapi.'
    console.warn('[orders/complete] Disbursement skipped: seller bank info missing for seller', seller?.id)
  } else {
    // Calculate seller's net amount after VivaThrift commission (5% standard)
    const { sellerReceives } = calculateCommission(
      order.total_amount,
      1, // already multiplied in total_amount
      'standard',
    )

    try {
      const credentials = Buffer.from(`${xenditKey}:`).toString('base64')
      const disburseRes = await $fetch<{ id: string; status: string }>(
        'https://api.xendit.co/disbursements',
        {
          method: 'POST',
          headers: {
            Authorization:  `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: {
            external_id:          `vt_complete_${orderId}`,
            bank_code:            seller.bank_code,
            account_holder_name:  seller.bank_account_name,
            account_number:       seller.bank_account_number,
            description:          `VivaThrift - Pencairan Dana Order`,
            amount:               sellerReceives,
          },
        },
      )

      disbursementId = disburseRes.id

      await supabaseAdmin
        .from('orders')
        .update({ disbursement_id: disbursementId })
        .eq('id', orderId)
    } catch (e: any) {
      disbursementError = e?.data?.message ?? e?.message ?? 'Disbursement gagal.'
      console.error('[orders/complete] Xendit disbursement failed:', disbursementError)
      // Non-fatal — order is still completed; manual disbursement can be triggered later
    }
  }

  // Notify seller (best-effort)
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id:      order.seller_id,
      type:         'order_completed',
      title:        'Pesanan selesai!',
      body:         disbursementSkipped
        ? 'Pembeli telah menerima pesanan. Dana akan ditransfer setelah kamu melengkapi data rekening.'
        : 'Pembeli telah menerima pesanan. Pencairan dana sedang diproses.',
      reference_id: orderId,
    })
  } catch { /* best-effort */ }

  return {
    orderId,
    status: 'completed',
    disbursement_id: disbursementId,
    disbursement_skipped: disbursementSkipped,
    disbursement_error: disbursementError,
  }
})
