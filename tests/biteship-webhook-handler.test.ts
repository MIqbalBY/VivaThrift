import { describe, expect, it, vi } from 'vitest'
import { processBiteshipWebhook, type BiteshipOrder, type BiteshipWebhookDeps } from '../server/utils/biteship-webhook-handler'

function createDeps(overrides: Partial<BiteshipWebhookDeps> = {}): BiteshipWebhookDeps {
  return {
    now: () => '2026-04-11T14:00:00.000Z',
    findOrderByBiteshipId: vi.fn(async () => null),
    updateOrder: vi.fn(async () => {}),
    getAdminIds: vi.fn(async () => []),
    filterDuplicateNotifications: vi.fn(async (rows) => rows),
    insertNotifications: vi.fn(async () => {}),
    ...overrides,
  }
}

function createOrder(overrides: Partial<BiteshipOrder> = {}): BiteshipOrder {
  return {
    id: 'order-1',
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    status: 'confirmed',
    tracking_number: null,
    courier_name: null,
    shipped_at: null,
    shipping_method: 'shipping',
    ...overrides,
  }
}

describe('processBiteshipWebhook', () => {
  it('ignores unsupported events before querying the order', async () => {
    const deps = createDeps()

    const result = await processBiteshipWebhook({
      eventType: 'order.created',
      biteshipOrderId: 'biteship-1',
      courierStatus: 'picked',
    }, deps)

    expect(result).toEqual({ received: true, action: 'ignored', reason: 'unsupported event: order.created' })
    expect(deps.findOrderByBiteshipId).not.toHaveBeenCalled()
  })

  it('updates the order and inserts incident notifications for exception statuses', async () => {
    const deps = createDeps({
      findOrderByBiteshipId: vi.fn(async () => createOrder()),
      getAdminIds: vi.fn(async () => ['admin-1', 'admin-2']),
    })

    const result = await processBiteshipWebhook({
      eventType: 'order.status',
      biteshipOrderId: 'biteship-1',
      courierStatus: 'rejected',
      courierWaybillId: 'WB-123',
      courierCompany: 'jne',
    }, deps)

    expect(result).toEqual({
      received: true,
      action: 'updated',
      orderId: 'order-1',
      status: 'rejected',
    })
    expect(deps.updateOrder).toHaveBeenCalledWith('order-1', {
      updated_at: '2026-04-11T14:00:00.000Z',
      tracking_number: 'WB-123',
      courier_name: 'JNE',
    })
    expect(deps.filterDuplicateNotifications).toHaveBeenCalledTimes(1)
    expect(deps.insertNotifications).toHaveBeenCalledTimes(1)
  })

  it('marks eligible in-transit shipping orders as shipped and skips inserts when duplicates are filtered out', async () => {
    const deps = createDeps({
      findOrderByBiteshipId: vi.fn(async () => createOrder()),
      filterDuplicateNotifications: vi.fn(async () => []),
    })

    const result = await processBiteshipWebhook({
      eventType: 'order.status',
      biteshipOrderId: 'biteship-2',
      courierStatus: 'picked',
      courierWaybillId: null,
      courierCompany: null,
    }, deps)

    expect(result).toEqual({
      received: true,
      action: 'updated',
      orderId: 'order-1',
      status: 'picked',
    })
    expect(deps.updateOrder).toHaveBeenCalledWith('order-1', {
      updated_at: '2026-04-11T14:00:00.000Z',
      status: 'shipped',
      shipped_at: '2026-04-11T14:00:00.000Z',
    })
    expect(deps.insertNotifications).not.toHaveBeenCalled()
  })

  it('returns noop when no order fields change and the status has no mapped notification', async () => {
    const deps = createDeps({
      findOrderByBiteshipId: vi.fn(async () => createOrder({
        tracking_number: 'WB-123',
        courier_name: 'JNE',
        status: 'shipped',
        shipped_at: '2026-04-10T10:00:00.000Z',
      })),
    })

    const result = await processBiteshipWebhook({
      eventType: 'order.waybill_id',
      biteshipOrderId: 'biteship-3',
      courierStatus: 'allocated',
      courierWaybillId: 'WB-123',
      courierCompany: 'jne',
    }, deps)

    expect(result).toEqual({
      received: true,
      action: 'noop',
      orderId: 'order-1',
      status: 'allocated',
    })
    expect(deps.updateOrder).not.toHaveBeenCalled()
    expect(deps.insertNotifications).not.toHaveBeenCalled()
  })
})