import { supabaseAdmin } from '../../utils/supabase-admin'

// POST /api/webhooks/biteship
//
// Receives Biteship order status updates.
// Register this URL in Biteship Dashboard → Settings → Webhook URL:
//   https://www.vivathrift.store/api/webhooks/biteship
//
// Biteship webhook payload (order_status type):
//   { event: "order.status", order_id, courier_tracking_id, status, ... }
//
// Statuses: confirmed, allocated, picking_up, picked, dropping_off, delivered, rejected, cancelled, on_hold, courier_not_found

const BITESHIP_TO_NOTIF: Record<string, { title: string; body: string } | null> = {
  picked:       { title: 'Paketmu sudah dipickup kurir!', body: 'Kurir sudah mengambil paketmu dari penjual.' },
  dropping_off: { title: 'Paketmu sedang diantar!', body: 'Kurir sedang dalam perjalanan ke alamatmu.' },
  delivered:    { title: 'Paket sudah sampai!', body: 'Paketmu sudah diterima. Jangan lupa konfirmasi pesanan ya.' },
  rejected:     { title: 'Pengiriman bermasalah', body: 'Kurir menolak pengiriman. Hubungi penjual untuk info lebih lanjut.' },
  on_hold:      { title: 'Pengiriman tertahan', body: 'Paketmu sedang ditahan di gudang kurir. Hubungi kurir untuk detail.' },
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // ── Validate payload ──────────────────────────────────────────────────────
  const biteshipOrderId = body?.order_id ?? body?.id
  const courierStatus   = body?.status ?? body?.courier_status

  if (!biteshipOrderId) {
    return { received: true, action: 'ignored', reason: 'no order_id' }
  }

  // ── Find matching order by biteship_order_id ──────────────────────────────
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, buyer_id, status, tracking_number, courier_name')
    .eq('biteship_order_id', biteshipOrderId)
    .single()

  if (!order) {
    // Could be a test webhook or an order we don't track
    return { received: true, action: 'no_matching_order' }
  }

  // ── Update tracking info on the order ─────────────────────────────────────
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  // Update tracking number if Biteship now provides a waybill
  const waybillId = body?.courier_waybill_id ?? body?.courier?.waybill_id
  if (waybillId && !order.tracking_number) {
    updates.tracking_number = waybillId
  }

  // Update courier name if available
  const courierCompany = body?.courier_company ?? body?.courier?.company
  if (courierCompany && !order.courier_name) {
    updates.courier_name = courierCompany.toUpperCase()
  }

  if (Object.keys(updates).length > 1) {
    await supabaseAdmin.from('orders').update(updates).eq('id', order.id)
  }

  // ── Send notification to buyer ────────────────────────────────────────────
  const notif = BITESHIP_TO_NOTIF[courierStatus]
  if (notif && order.buyer_id) {
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id:      order.buyer_id,
        type:         'order_shipped',
        title:        notif.title,
        body:         notif.body,
        reference_id: order.id,
      })
    } catch { /* best-effort */ }
  }

  return {
    received: true,
    action:   'updated',
    orderId:  order.id,
    status:   courierStatus,
  }
})
