import { describe, expect, it, vi } from 'vitest'
import { processXenditWebhook, type XenditWebhookDeps, type WebhookOrder } from '../server/utils/xendit-webhook-handler'

function createDeps(overrides: Partial<XenditWebhookDeps> = {}): XenditWebhookDeps {
  return {
    now: () => '2026-04-11T13:00:00.000Z',
    markOrdersPaymentFailed: vi.fn(async () => []),
    getOrderItems: vi.fn(async () => []),
    getProductStock: vi.fn(async () => 0),
    restoreProduct: vi.fn(async () => {}),
    restoreOffer: vi.fn(async () => {}),
    getPendingOrders: vi.fn(async () => []),
    getProcessedOrders: vi.fn(async () => []),
    getPaidPaymentOrderIds: vi.fn(async () => []),
    upsertPayments: vi.fn(async () => null),
    updateShippingOrdersPaid: vi.fn(async () => ({ data: [], error: null })),
    updateCodOrdersPaid: vi.fn(async () => ({ data: [], error: null })),
    getBuyerCartId: vi.fn(async () => null),
    getOrderProductIds: vi.fn(async () => []),
    deleteCartItems: vi.fn(async () => {}),
    getOrderPrimaryItem: vi.fn(async () => ({ quantity: 1, productTitle: 'Produk test' })),
    renderBuyerEmail: vi.fn(() => ({ subject: 'Buyer subject', html: '<p>buyer</p>' })),
    renderSellerEmail: vi.fn(() => ({ subject: 'Seller subject', html: '<p>seller</p>' })),
    sendEmail: vi.fn(async () => true),
    onWarning: vi.fn(),
    ...overrides,
  }
}

function createOrder(overrides: Partial<WebhookOrder> = {}): WebhookOrder {
  return {
    id: 'order-1',
    shipping_method: 'shipping',
    shipping_cost: 20000,
    meetup_location: null,
    total_amount: 120000,
    offer_id: null,
    buyer: { id: 'buyer-1', name: 'Buyer', email: 'buyer@example.com' },
    seller: { id: 'seller-1', name: 'Seller', email: 'seller@example.com' },
    ...overrides,
  }
}

describe('processXenditWebhook', () => {
  it('confirms paid orders, clears cart items, upserts payments, and sends transactional emails', async () => {
    const orders = [
      createOrder(),
      createOrder({
        id: 'order-2',
        shipping_method: 'cod',
        meetup_location: 'ITS Library',
        total_amount: 80000,
      }),
    ]
    const deps = createDeps({
      getPendingOrders: vi.fn(async () => orders),
      updateShippingOrdersPaid: vi.fn(async () => ({ data: [{ id: 'order-1', total_amount: 120000 }], error: null })),
      updateCodOrdersPaid: vi.fn(async () => ({ data: [{ id: 'order-2', total_amount: 80000 }], error: null })),
      getBuyerCartId: vi.fn(async () => 'cart-1'),
      getOrderProductIds: vi.fn(async (orderId: string) => orderId === 'order-1' ? ['product-1'] : ['product-2']),
      getOrderPrimaryItem: vi.fn(async (orderId: string) => ({ quantity: orderId === 'order-1' ? 2 : 1, productTitle: `Produk ${orderId}` })),
    })

    const result = await processXenditWebhook({
      xenditInvoiceId: 'inv-1',
      status: 'PAID',
      paymentMethod: 'EWALLET',
      paidAmount: 200000,
    }, deps)

    expect(result).toEqual({
      received: true,
      action: 'confirmed',
      orderCount: 2,
      orderIds: ['order-1', 'order-2'],
    })
    expect(deps.deleteCartItems).toHaveBeenCalledWith('cart-1', ['product-1', 'product-2'])
    expect(deps.upsertPayments).toHaveBeenCalledTimes(1)
    expect(deps.renderBuyerEmail).toHaveBeenCalledTimes(2)
    expect(deps.renderSellerEmail).toHaveBeenCalledTimes(2)
    expect(deps.sendEmail).toHaveBeenCalledTimes(4)
  })

  it('reconciles missing payment rows for already processed invoices without sending emails', async () => {
    const processedOrders = [
      createOrder({ id: 'order-1', total_amount: 100000 }),
      createOrder({ id: 'order-2', total_amount: 50000 }),
    ]
    const deps = createDeps({
      getProcessedOrders: vi.fn(async () => processedOrders),
      getPaidPaymentOrderIds: vi.fn(async () => ['order-1']),
    })

    const result = await processXenditWebhook({
      xenditInvoiceId: 'inv-2',
      status: 'PAID',
      paymentMethod: 'CARD',
      paidAmount: 150000,
    }, deps)

    expect(result).toEqual({
      received: true,
      action: 'payments_reconciled',
      orderCount: 1,
      orderIds: ['order-2'],
    })
    expect(deps.upsertPayments).toHaveBeenCalledTimes(1)
    expect(deps.sendEmail).not.toHaveBeenCalled()
  })

  it('marks failed payments, restores stock, and restores offers', async () => {
    const deps = createDeps({
      markOrdersPaymentFailed: vi.fn(async () => [{ id: 'order-1', offer_id: 'offer-1' }]),
      getOrderItems: vi.fn(async () => [{ product_id: 'product-1', quantity: 2 }]),
      getProductStock: vi.fn(async () => 3),
    })

    const result = await processXenditWebhook({
      xenditInvoiceId: 'inv-3',
      status: 'FAILED',
      paymentMethod: null,
      paidAmount: null,
    }, deps)

    expect(result).toEqual({ received: true, action: 'payment_failed', orderCount: 1 })
    expect(deps.restoreProduct).toHaveBeenCalledWith('product-1', 5)
    expect(deps.restoreOffer).toHaveBeenCalledWith('offer-1', '2026-04-11T13:00:00.000Z')
    expect(deps.sendEmail).not.toHaveBeenCalled()
  })
})