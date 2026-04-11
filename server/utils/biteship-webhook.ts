import { canTransition } from './state-machine'

export const BITESHIP_TO_NOTIF: Record<string, { type: string; title: string; body: string } | null> = {
  picked: { type: 'order_shipped', title: 'Paketmu sudah dipickup kurir!', body: 'Kurir sudah mengambil paketmu dari penjual.' },
  dropping_off: { type: 'order_shipped', title: 'Paketmu sedang diantar!', body: 'Kurir sedang dalam perjalanan ke alamatmu.' },
  delivered: { type: 'order_shipped', title: 'Paket sudah sampai!', body: 'Paketmu sudah diterima. Jangan lupa konfirmasi pesanan ya.' },
  rejected: { type: 'shipping_exception', title: 'Pengiriman bermasalah', body: 'Kurir menolak pengiriman. Hubungi penjual atau admin untuk tindak lanjut.' },
  on_hold: { type: 'shipping_exception', title: 'Pengiriman tertahan', body: 'Paketmu sedang ditahan di gudang kurir. Pantau status pesanan untuk update berikutnya.' },
  cancelled: { type: 'shipping_exception', title: 'Pengiriman dibatalkan kurir', body: 'Pengiriman dibatalkan oleh pihak kurir. Tim penjual perlu menindaklanjuti pengiriman ini.' },
  courier_not_found: { type: 'shipping_exception', title: 'Kurir belum tersedia', body: 'Kurir belum ditemukan untuk pengiriman ini. Tim penjual perlu mengecek ulang pemesanan kurir.' },
}

export const BITESHIP_IN_TRANSIT_STATUSES = new Set([
  'allocated',
  'picking_up',
  'picked',
  'dropping_off',
  'delivered',
  'on_hold',
])

const SUPPORTED_BITESHIP_EVENTS = new Set(['order.status', 'order.waybill_id'])

type ShippingNotificationRow = {
  user_id: string
  type: string
  title: string
  body: string
  reference_id: string
}

export function isSupportedBiteshipEvent(eventType: string) {
  return SUPPORTED_BITESHIP_EVENTS.has(eventType)
}

export function shouldMarkOrderShipped(params: {
  shippingMethod: string | null
  courierStatus: string | null
  currentStatus: string | null
}) {
  return params.shippingMethod === 'shipping'
    && BITESHIP_IN_TRANSIT_STATUSES.has(String(params.courierStatus ?? ''))
    && canTransition('order', params.currentStatus, 'shipped')
}

export function buildShippingNotificationRows(params: {
  buyerId: string | null
  sellerId: string | null
  adminIds?: string[]
  orderId: string
  courierStatus: string | null
}) {
  const notif = params.courierStatus ? BITESHIP_TO_NOTIF[params.courierStatus] : null

  if (!notif || !params.buyerId) {
    return [] as ShippingNotificationRow[]
  }

  const rows: ShippingNotificationRow[] = [
    {
      user_id: params.buyerId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      reference_id: params.orderId,
    },
  ]

  if (notif.type === 'shipping_exception' && params.sellerId) {
    rows.push({
      user_id: params.sellerId,
      type: notif.type,
      title: 'Perlu tindak lanjut pengiriman',
      body: `Status kurir: ${params.courierStatus}. Cek dashboard pesanan dan hubungi kurir jika diperlukan.`,
      reference_id: params.orderId,
    })

    for (const adminId of params.adminIds ?? []) {
      rows.push({
        user_id: adminId,
        type: 'shipping_incident_admin',
        title: 'Incident pengiriman perlu review',
        body: `Order ${params.orderId} menerima status kurir '${params.courierStatus}'. Review tindak lanjut operasional jika seller butuh bantuan.`,
        reference_id: params.orderId,
      })
    }
  }

  return dedupeNotificationRows(rows)
}

export function dedupeNotificationRows(rows: ShippingNotificationRow[]) {
  const seen = new Set<string>()

  return rows.filter((row) => {
    const key = `${row.user_id}::${row.type}::${row.reference_id}::${row.title}::${row.body}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}