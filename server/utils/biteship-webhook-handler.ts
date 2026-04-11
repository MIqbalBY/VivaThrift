import { buildShippingNotificationRows, isSupportedBiteshipEvent, shouldMarkOrderShipped } from './biteship-webhook'

export type BiteshipOrder = {
  id: string
  buyer_id: string | null
  seller_id: string | null
  status: string | null
  tracking_number: string | null
  courier_name: string | null
  shipped_at: string | null
  shipping_method: string | null
}

export type BiteshipPayload = {
  eventType: string
  biteshipOrderId: string | null
  courierStatus: string | null
  courierWaybillId?: string | null
  courierCompany?: string | null
}

export type BiteshipWebhookDeps = {
  now?: () => string
  findOrderByBiteshipId: (biteshipOrderId: string) => Promise<BiteshipOrder | null>
  updateOrder: (orderId: string, updates: Record<string, unknown>) => Promise<void>
  getAdminIds: () => Promise<string[]>
  filterDuplicateNotifications: (rows: Array<Record<string, string>>) => Promise<Array<Record<string, string>>>
  insertNotifications: (rows: Array<Record<string, string>>) => Promise<void>
}

const INCIDENT_STATUSES = new Set(['rejected', 'on_hold', 'cancelled', 'courier_not_found'])

export async function processBiteshipWebhook(payload: BiteshipPayload, deps: BiteshipWebhookDeps) {
  if (payload.eventType && !isSupportedBiteshipEvent(payload.eventType)) {
    return { received: true, action: 'ignored', reason: `unsupported event: ${payload.eventType}` }
  }

  if (!payload.biteshipOrderId) {
    return { received: true, action: 'ignored', reason: 'no order_id' }
  }

  const order = await deps.findOrderByBiteshipId(payload.biteshipOrderId)

  if (!order) {
    return { received: true, action: 'no_matching_order' }
  }

  const now = deps.now?.() ?? new Date().toISOString()
  const updates: Record<string, unknown> = { updated_at: now }

  if (shouldMarkOrderShipped({
    shippingMethod: order.shipping_method,
    courierStatus: payload.courierStatus,
    currentStatus: order.status,
  })) {
    updates.status = 'shipped'

    if (!order.shipped_at) {
      updates.shipped_at = now
    }
  }

  if (payload.courierWaybillId && !order.tracking_number) {
    updates.tracking_number = payload.courierWaybillId
  }

  if (payload.courierCompany && !order.courier_name) {
    updates.courier_name = payload.courierCompany.toUpperCase()
  }

  const didPersistOrderUpdate = Object.keys(updates).length > 1

  if (didPersistOrderUpdate) {
    await deps.updateOrder(order.id, updates)
  }

  if (order.buyer_id) {
    try {
      const adminIds = payload.courierStatus && INCIDENT_STATUSES.has(payload.courierStatus)
        ? await deps.getAdminIds()
        : []

      const rows = buildShippingNotificationRows({
        buyerId: String(order.buyer_id),
        sellerId: order.seller_id ? String(order.seller_id) : null,
        adminIds,
        orderId: String(order.id),
        courierStatus: payload.courierStatus,
      })

      const rowsToInsert = await deps.filterDuplicateNotifications(rows)

      if (rowsToInsert.length) {
        await deps.insertNotifications(rowsToInsert)
      }
    } catch {
      // best-effort
    }
  }

  return {
    received: true,
    action: didPersistOrderUpdate ? 'updated' : 'noop',
    orderId: order.id,
    status: payload.courierStatus,
  }
}