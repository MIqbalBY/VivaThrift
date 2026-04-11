import { describe, expect, it } from 'vitest'
import {
  buildShippingNotificationRows,
  dedupeNotificationRows,
  isSupportedBiteshipEvent,
  shouldMarkOrderShipped,
} from '../server/utils/biteship-webhook'

describe('isSupportedBiteshipEvent', () => {
  it('accepts the events handled by the webhook route', () => {
    expect(isSupportedBiteshipEvent('order.status')).toBe(true)
    expect(isSupportedBiteshipEvent('order.waybill_id')).toBe(true)
  })

  it('rejects unsupported events', () => {
    expect(isSupportedBiteshipEvent('ping')).toBe(false)
    expect(isSupportedBiteshipEvent('order.created')).toBe(false)
  })
})

describe('shouldMarkOrderShipped', () => {
  it('marks shipping orders as shipped when courier status is in transit and transition is allowed', () => {
    expect(shouldMarkOrderShipped({
      shippingMethod: 'shipping',
      courierStatus: 'picked',
      currentStatus: 'confirmed',
    })).toBe(true)
  })

  it('does not mark non-shipping or invalid-state orders as shipped', () => {
    expect(shouldMarkOrderShipped({
      shippingMethod: 'cod',
      courierStatus: 'picked',
      currentStatus: 'confirmed',
    })).toBe(false)

    expect(shouldMarkOrderShipped({
      shippingMethod: 'shipping',
      courierStatus: 'picked',
      currentStatus: 'completed',
    })).toBe(false)
  })
})

describe('buildShippingNotificationRows', () => {
  it('builds a buyer notification for non-incident courier updates', () => {
    expect(buildShippingNotificationRows({
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      adminIds: ['admin-1'],
      orderId: 'order-1',
      courierStatus: 'dropping_off',
    })).toEqual([
      {
        user_id: 'buyer-1',
        type: 'order_shipped',
        title: 'Paketmu sedang diantar!',
        body: 'Kurir sedang dalam perjalanan ke alamatmu.',
        reference_id: 'order-1',
      },
    ])
  })

  it('builds buyer, seller, and admin notifications for shipping incidents', () => {
    expect(buildShippingNotificationRows({
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      adminIds: ['admin-1', 'admin-2'],
      orderId: 'order-1',
      courierStatus: 'rejected',
    })).toEqual([
      {
        user_id: 'buyer-1',
        type: 'shipping_exception',
        title: 'Pengiriman bermasalah',
        body: 'Kurir menolak pengiriman. Hubungi penjual atau admin untuk tindak lanjut.',
        reference_id: 'order-1',
      },
      {
        user_id: 'seller-1',
        type: 'shipping_exception',
        title: 'Perlu tindak lanjut pengiriman',
        body: 'Status kurir: rejected. Cek dashboard pesanan dan hubungi kurir jika diperlukan.',
        reference_id: 'order-1',
      },
      {
        user_id: 'admin-1',
        type: 'shipping_incident_admin',
        title: 'Incident pengiriman perlu review',
        body: "Order order-1 menerima status kurir 'rejected'. Review tindak lanjut operasional jika seller butuh bantuan.",
        reference_id: 'order-1',
      },
      {
        user_id: 'admin-2',
        type: 'shipping_incident_admin',
        title: 'Incident pengiriman perlu review',
        body: "Order order-1 menerima status kurir 'rejected'. Review tindak lanjut operasional jika seller butuh bantuan.",
        reference_id: 'order-1',
      },
    ])
  })

  it('returns an empty list when the courier status is not mapped or buyer is missing', () => {
    expect(buildShippingNotificationRows({
      buyerId: null,
      sellerId: 'seller-1',
      adminIds: ['admin-1'],
      orderId: 'order-1',
      courierStatus: 'picked',
    })).toEqual([])

    expect(buildShippingNotificationRows({
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      adminIds: ['admin-1'],
      orderId: 'order-1',
      courierStatus: 'allocated',
    })).toEqual([])
  })
})

describe('dedupeNotificationRows', () => {
  it('removes duplicate notification rows with the same delivery signature', () => {
    expect(dedupeNotificationRows([
      {
        user_id: 'buyer-1',
        type: 'shipping_exception',
        title: 'Pengiriman bermasalah',
        body: 'Kurir menolak pengiriman.',
        reference_id: 'order-1',
      },
      {
        user_id: 'buyer-1',
        type: 'shipping_exception',
        title: 'Pengiriman bermasalah',
        body: 'Kurir menolak pengiriman.',
        reference_id: 'order-1',
      },
      {
        user_id: 'seller-1',
        type: 'shipping_exception',
        title: 'Perlu tindak lanjut pengiriman',
        body: 'Status kurir: rejected.',
        reference_id: 'order-1',
      },
    ])).toEqual([
      {
        user_id: 'buyer-1',
        type: 'shipping_exception',
        title: 'Pengiriman bermasalah',
        body: 'Kurir menolak pengiriman.',
        reference_id: 'order-1',
      },
      {
        user_id: 'seller-1',
        type: 'shipping_exception',
        title: 'Perlu tindak lanjut pengiriman',
        body: 'Status kurir: rejected.',
        reference_id: 'order-1',
      },
    ])
  })
})