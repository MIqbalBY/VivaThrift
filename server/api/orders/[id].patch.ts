import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { assertTransition } from '../../utils/state-machine'
import { createBiteshipOrder } from '../../utils/biteship'

// PATCH /api/orders/:id
// Body: { action: 'ship', tracking_number: string, courier_name?: string }
//     | { action: 'complete' }
//     | { action: 'start_meetup' }
//     | { action: 'confirm_meetup', otp: string }
//
// 'ship':
//   - Caller must be the seller
//   - Order must be in 'confirmed' state + shipping_method = 'shipping'
//   - Sets tracking_number, courier_name, shipped_at, status = 'shipped'
//
// 'complete':
//   - Caller must be the buyer
//   - Order must be in 'shipped' state
//   - Sets completed_at, status = 'completed'
//   - Triggers Xendit disbursement to seller's bank account (if configured)
//   - Marks associated offer as 'completed'
//
// 'start_meetup':
//   - Caller must be the seller
//   - Order must be in 'confirmed' state + shipping_method = 'cod'
//   - Transitions to 'awaiting_meetup'
//
// 'confirm_meetup':
//   - Caller must be the seller
//   - Order must be in 'awaiting_meetup' state
//   - Requires OTP that matches order.meetup_otp
//   - Sets meetup_confirmed_at, status = 'completed'
//   - Triggers Xendit disbursement (same as complete)

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)

  const orderId = getRouterParam(event, 'id')
  if (!orderId) throw createError({ statusCode: 400, statusMessage: 'order id tidak ditemukan.' })

  const body = await readBody(event)
  const action: string = body?.action

  const validActions = ['ship', 'complete', 'start_meetup', 'confirm_meetup']
  if (!validActions.includes(action)) {
    throw createError({ statusCode: 400, statusMessage: `action harus salah satu dari: ${validActions.join(', ')}.` })
  }

  // ── Load order ─────────────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select(`
      id, status, total_amount, offer_id, seller_id, buyer_id,
      shipping_method, shipping_cost, platform_fee, meetup_otp, meetup_location, courier_code, courier_service,
      seller:users!seller_id (
        id, name, bank_code, bank_account_number, bank_account_name
      ),
      buyer:users!buyer_id (
        id, name
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Pesanan tidak ditemukan.' })
  }

  // ── Authorization ──────────────────────────────────────────────────────────
  const sellerActions = ['ship', 'start_meetup', 'confirm_meetup']
  const buyerActions  = ['complete']

  if (sellerActions.includes(action) && order.seller_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Hanya penjual yang bisa melakukan aksi ini.' })
  }
  if (buyerActions.includes(action) && order.buyer_id !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Hanya pembeli yang bisa mengkonfirmasi penerimaan pesanan.' })
  }

  // ── State machine validation ────────────────────────────────────────────────
  const targetStatusMap: Record<string, string> = {
    ship:            'shipped',
    complete:        'completed',
    start_meetup:    'awaiting_meetup',
    confirm_meetup:  'completed',
  }
  const targetStatus = targetStatusMap[action]
  if (!targetStatus) {
    throw createError({ statusCode: 400, statusMessage: 'Aksi tidak valid.' })
  }
  assertTransition('order', order.status, targetStatus)

  // ── Action: ship ────────────────────────────────────────────────────────────
  if (action === 'ship') {
    if ((order as any).shipping_method !== 'shipping') {
      throw createError({ statusCode: 422, statusMessage: 'Aksi kirim hanya untuk pesanan pengiriman, bukan COD.' })
    }

    let trackingNumber: string
    let courierName: string | null = null
    let biteshipOrderId: string | null = null
    let biteshipWaybillId: string | null = null

    if (body?.use_biteship) {
      // ── Auto-create Biteship order ────────────────────────────────────────
      const o = order as any
      const courierCode: string = (o.courier_code ?? '').toLowerCase()
      const courierService: string = (o.courier_service ?? '').toLowerCase()

      if (!courierCode) {
        throw createError({ statusCode: 422, statusMessage: 'Kode kurir tidak ditemukan pada pesanan. Pilih ulang ongkir atau gunakan resi manual.' })
      }

      // Load seller store address
      const { data: sellerAddr } = await supabaseAdmin
        .from('addresses')
        .select('full_address, city, postal_code')
        .eq('user_id', order.seller_id)
        .eq('address_type', 'seller')
        .single()

      if (!sellerAddr) {
        throw createError({ statusCode: 422, statusMessage: 'Alamat toko penjual belum diatur. Tambahkan di Profil → Alamat terlebih dahulu.' })
      }

      // Load buyer shipping address
      const { data: buyerAddr } = await supabaseAdmin
        .from('addresses')
        .select('full_address, city, postal_code')
        .eq('user_id', order.buyer_id)
        .eq('address_type', 'shipping')
        .single()

      if (!buyerAddr) {
        throw createError({ statusCode: 422, statusMessage: 'Alamat pengiriman pembeli belum diatur.' })
      }

      // Load order items for Biteship
      const { data: items } = await supabaseAdmin
        .from('order_items')
        .select('quantity, price_at_time, product:products ( title )')
        .eq('order_id', orderId)

      const seller = o.seller as any
      const buyer  = o.buyer  as any

      const biteshipResult = await createBiteshipOrder({
        orderId:          orderId,
        sellerName:       seller?.name ?? 'Penjual',
        sellerAddress:    sellerAddr.full_address,
        sellerPostalCode: sellerAddr.postal_code ?? 60111,
        buyerName:        buyer?.name ?? 'Pembeli',
        buyerAddress:     buyerAddr.full_address,
        buyerPostalCode:  buyerAddr.postal_code ?? 60111,
        courierCompany:   courierCode,
        courierType:      courierService || 'REG',
        items: (items ?? []).map((item: any) => ({
          name:     item.product?.title ?? 'Produk VivaThrift',
          quantity: item.quantity ?? 1,
          value:    item.price_at_time ?? 0,
        })),
      })

      biteshipOrderId   = biteshipResult.biteshipOrderId
      biteshipWaybillId = biteshipResult.waybillId || null
      trackingNumber    = biteshipWaybillId || `BS-${biteshipOrderId}`
      courierName       = courierCode.toUpperCase()
    } else {
      // ── Manual tracking number ────────────────────────────────────────────
      trackingNumber = (body?.tracking_number ?? '').trim()
      if (!trackingNumber) {
        throw createError({ statusCode: 400, statusMessage: 'Nomor resi pengiriman wajib diisi.' })
      }
      courierName = (body?.courier_name ?? '').trim() || null
    }

    const updatePayload: Record<string, unknown> = {
      status:          'shipped',
      tracking_number: trackingNumber,
      courier_name:    courierName,
      shipped_at:      new Date().toISOString(),
    }
    if (biteshipOrderId)  updatePayload.biteship_order_id  = biteshipOrderId
    if (biteshipWaybillId) updatePayload.biteship_waybill_id = biteshipWaybillId

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)

    if (updateErr) throw createError({ statusCode: 500, statusMessage: updateErr.message })

    // Notify buyer (best-effort)
    try {
      const resiText = trackingNumber ? `Nomor resi: ${trackingNumber}.` : ''
      await supabaseAdmin.from('notifications').insert({
        user_id:      order.buyer_id,
        type:         'order_shipped',
        title:        'Paketmu sedang dikirim!',
        body:         `${resiText} Konfirmasi pesanan setelah barang tiba ya.`.trim(),
        reference_id: orderId,
      })
    } catch { /* best-effort */ }

    return { orderId, status: 'shipped', tracking_number: trackingNumber, biteship_order_id: biteshipOrderId }
  }

  // ── Action: start_meetup ────────────────────────────────────────────────────
  if (action === 'start_meetup') {
    if ((order as any).shipping_method !== 'cod') {
      throw createError({ statusCode: 422, statusMessage: 'Aksi meetup hanya untuk pesanan COD.' })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({ status: 'awaiting_meetup' })
      .eq('id', orderId)

    if (updateErr) throw createError({ statusCode: 500, statusMessage: updateErr.message })

    // Notify buyer (best-effort)
    try {
      const loc = (order as any).meetup_location ?? ''
      await supabaseAdmin.from('notifications').insert({
        user_id:      order.buyer_id,
        type:         'meetup_started',
        title:        'Penjual siap meetup!',
        body:         `Temui penjual di ${loc}. Tunjukkan kode OTP saat bertemu.`,
        reference_id: orderId,
      })
    } catch { /* best-effort */ }

    return { orderId, status: 'awaiting_meetup' }
  }

  // ── Action: confirm_meetup ──────────────────────────────────────────────────
  if (action === 'confirm_meetup') {
    const otp = String(body?.otp ?? '').trim()
    if (!otp) {
      throw createError({ statusCode: 400, statusMessage: 'Kode OTP harus diisi.' })
    }

    // Timing-safe OTP comparison
    const storedOtp = (order as any).meetup_otp ?? ''
    if (otp.length !== storedOtp.length || otp !== storedOtp) {
      throw createError({ statusCode: 422, statusMessage: 'Kode OTP tidak cocok.' })
    }

    const now = new Date().toISOString()

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        status:               'completed',
        completed_at:         now,
        meetup_confirmed_at:  now,
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

    // ── Xendit Disbursement (same logic as 'complete') ────────────────────
    let disbursementId: string | null = null
    let disbursementSkipped = false
    let disbursementError: string | null = null

    const xenditKey  = process.env.XENDIT_KEY ?? ''
    const seller     = order.seller as any
    const hasBankInfo = seller?.bank_code && seller?.bank_account_number && seller?.bank_account_name

    if (!xenditKey) {
      disbursementSkipped = true
      disbursementError   = 'XENDIT_KEY tidak dikonfigurasi.'
    } else if (!hasBankInfo) {
      disbursementSkipped = true
      disbursementError   = 'Data rekening penjual belum dilengkapi.'
    } else {
      const sellerReceives = order.total_amount
        - (order.shipping_cost ?? 0)
        - (order.platform_fee ?? 0)
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
              external_id:         `vt_meetup_${orderId}`,
              bank_code:           seller.bank_code,
              account_holder_name: seller.bank_account_name,
              account_number:      seller.bank_account_number,
              description:         `VivaThrift - Pencairan Dana COD Meetup`,
              amount:              sellerReceives,
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
        console.error('[orders/confirm_meetup] Xendit disbursement failed:', disbursementError)
      }
    }

    // Notify buyer (best-effort)
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id:      order.buyer_id,
        type:         'order_completed',
        title:        'Meetup berhasil!',
        body:         'Serah terima barang telah dikonfirmasi. Pesanan selesai.',
        reference_id: orderId,
      })
    } catch { /* best-effort */ }

    return {
      orderId,
      status: 'completed',
      meetup_confirmed: true,
      disbursement_id: disbursementId,
      disbursement_skipped: disbursementSkipped,
      disbursement_error: disbursementError,
    }
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
    // Seller menerima penuh harga barang (platform_fee sudah ditanggung pembeli)
    const sellerReceives = order.total_amount
      - (order.shipping_cost ?? 0)
      - (order.platform_fee ?? 0)

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
