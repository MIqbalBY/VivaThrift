import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

/**
 * Build a mock supabase admin client that returns predictable data
 * for the orders/[id].patch handler's queries.
 */
function createOrderMock(overrides: {
  order?: Record<string, unknown>
  orderUpdate?: { error: null | { message: string } }
  offerUpdate?: { error: null | { message: string } }
  notificationInsert?: { error: null | { message: string } }
} = {}) {
  const baseOrder = {
    id: 'order-1',
    status: 'confirmed',
    total_amount: 120000,
    offer_id: 'offer-1',
    seller_id: 'seller-1',
    buyer_id: 'buyer-1',
    shipping_method: 'shipping',
    shipping_cost: 20000,
    platform_fee: 2000,
    meetup_otp: null,
    meetup_location: null,
    courier_code: 'jne',
    courier_service: 'REG',
    seller: { id: 'seller-1', name: 'Seller', email: 'seller@test.com', bank_code: 'BCA', bank_account_number: '1234', bank_account_name: 'Seller' },
    buyer: { id: 'buyer-1', name: 'Buyer', email: 'buyer@test.com' },
    order_items: [{ quantity: 1, product: { title: 'Kaos Vintage' } }],
    ...overrides.order,
  }

  const orderSelectSingle = vi.fn(async () => ({ data: baseOrder, error: null }))
  const orderUpdate = vi.fn(async () => (overrides.orderUpdate ?? { error: null }))
  const offerUpdate = vi.fn(async () => (overrides.offerUpdate ?? { error: null }))
  const notificationInsert = vi.fn(async () => (overrides.notificationInsert ?? { error: null }))

  const from = vi.fn((table: string) => {
    if (table === 'orders') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: orderSelectSingle,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => orderUpdate()),
        })),
      }
    }
    if (table === 'offers') {
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => offerUpdate()),
        })),
      }
    }
    if (table === 'notifications') {
      return { insert: notificationInsert }
    }
    // Fallback for addresses, order_items, etc.
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: null, error: null })),
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    }
  })

  return { from, orderSelectSingle, orderUpdate, offerUpdate, notificationInsert }
}

describe('orders lifecycle (ship → complete → disburse)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
    vi.stubGlobal('getRouterParam', vi.fn(() => 'order-1'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/resolve-server-uid')
    vi.doUnmock('../server/utils/state-machine')
    vi.doUnmock('../server/utils/biteship')
    vi.doUnmock('../server/utils/send-email')
    vi.doUnmock('../server/utils/email-templates')
    vi.doUnmock('../server/utils/seller-wallet')
  })

  // ── Ship action ────────────────────────────────────────────────────────────
  it('ship: seller ships order with manual tracking number', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({
      action: 'ship',
      tracking_number: 'JNE-123456',
      courier_name: 'JNE',
    })))

    const { from } = createOrderMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'seller-1') }))
    vi.doMock('../server/utils/state-machine', () => ({ assertTransition: vi.fn() }))
    vi.doMock('../server/utils/biteship', () => ({ createBiteshipOrder: vi.fn() }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn(async () => {}) }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderShipped: vi.fn(() => ({ subject: 'Shipped', html: '<p>Shipped</p>' })),
      emailOrderCompletedSeller: vi.fn(),
    }))
    vi.doMock('../server/utils/seller-wallet', () => ({
      creditSellerWallet: vi.fn(async () => ({ credited: true, amount: 98000 })),
    }))

    const { default: handler } = await import('../server/api/orders/[id].patch')
    const result = await handler({})

    expect(result).toMatchObject({
      orderId: 'order-1',
      status: 'shipped',
      tracking_number: 'JNE-123456',
    })
  })

  it('ship: non-seller gets 403', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'ship', tracking_number: 'X' })))

    const { from } = createOrderMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'random-user') }))
    vi.doMock('../server/utils/state-machine', () => ({ assertTransition: vi.fn() }))
    vi.doMock('../server/utils/biteship', () => ({ createBiteshipOrder: vi.fn() }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn() }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderShipped: vi.fn(),
      emailOrderCompletedSeller: vi.fn(),
    }))
    vi.doMock('../server/utils/seller-wallet', () => ({
      creditSellerWallet: vi.fn(async () => ({ credited: true, amount: 98000 })),
    }))

    const { default: handler } = await import('../server/api/orders/[id].patch')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
  })

  // ── Complete action ────────────────────────────────────────────────────────
  it('complete: buyer confirms receipt, triggers disbursement', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'complete' })))

    const creditSellerWallet = vi.fn(async () => ({ credited: true, amount: 98000 }))

    const { from } = createOrderMock({ order: { status: 'shipped' } })
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'buyer-1') }))
    vi.doMock('../server/utils/state-machine', () => ({ assertTransition: vi.fn() }))
    vi.doMock('../server/utils/biteship', () => ({ createBiteshipOrder: vi.fn() }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn(async () => {}) }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderShipped: vi.fn(),
      emailOrderCompletedSeller: vi.fn(() => ({ subject: 'Done', html: '<p>Done</p>' })),
    }))
    vi.doMock('../server/utils/seller-wallet', () => ({ creditSellerWallet }))

    const { default: handler } = await import('../server/api/orders/[id].patch')
    const result = await handler({})

    expect(result).toMatchObject({
      orderId: 'order-1',
      status: 'completed',
      wallet_credited: true,
      wallet_credit_amount: 98000,
    })
    expect(creditSellerWallet).toHaveBeenCalledWith(expect.objectContaining({
      sellerId: 'seller-1',
      orderId: 'order-1',
      grossSellerAmount: 98000,
      txType: 'order_credit',
    }))
  })

  it('complete: non-buyer gets 403', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'complete' })))

    const { from } = createOrderMock({ order: { status: 'shipped' } })
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'seller-1') }))
    vi.doMock('../server/utils/state-machine', () => ({ assertTransition: vi.fn() }))
    vi.doMock('../server/utils/biteship', () => ({ createBiteshipOrder: vi.fn() }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn() }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderShipped: vi.fn(),
      emailOrderCompletedSeller: vi.fn(),
    }))
    vi.doMock('../server/utils/seller-wallet', () => ({
      creditSellerWallet: vi.fn(async () => ({ credited: true, amount: 98000 })),
    }))

    const { default: handler } = await import('../server/api/orders/[id].patch')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
  })

  // ── COD / Meetup flow ──────────────────────────────────────────────────────
  it('confirm_meetup: seller confirms with OTP, triggers disbursement', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'confirm_meetup', otp: '1234' })))

    const creditSellerWallet = vi.fn(async () => ({ credited: true, amount: 98000 }))

    const { from } = createOrderMock({
      order: {
        status: 'awaiting_meetup',
        shipping_method: 'cod',
        meetup_otp: '1234',
        meetup_location: 'Kampus ITS Surabaya',
      },
    })
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'seller-1') }))
    vi.doMock('../server/utils/state-machine', () => ({ assertTransition: vi.fn() }))
    vi.doMock('../server/utils/biteship', () => ({ createBiteshipOrder: vi.fn() }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn(async () => {}) }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderShipped: vi.fn(),
      emailOrderCompletedSeller: vi.fn(() => ({ subject: 'Done', html: '<p>Done</p>' })),
    }))
    vi.doMock('../server/utils/seller-wallet', () => ({ creditSellerWallet }))

    const { default: handler } = await import('../server/api/orders/[id].patch')
    const result = await handler({})

    expect(result).toMatchObject({
      orderId: 'order-1',
      status: 'completed',
      meetup_confirmed: true,
      wallet_credited: true,
      wallet_credit_amount: 98000,
    })
    expect(creditSellerWallet).toHaveBeenCalled()
  })

  it('confirm_meetup: wrong OTP gets 422', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'confirm_meetup', otp: '9999' })))

    const { from } = createOrderMock({
      order: {
        status: 'awaiting_meetup',
        shipping_method: 'cod',
        meetup_otp: '1234',
      },
    })
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'seller-1') }))
    vi.doMock('../server/utils/state-machine', () => ({ assertTransition: vi.fn() }))
    vi.doMock('../server/utils/biteship', () => ({ createBiteshipOrder: vi.fn() }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn() }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderShipped: vi.fn(),
      emailOrderCompletedSeller: vi.fn(),
    }))
    vi.doMock('../server/utils/seller-wallet', () => ({
      creditSellerWallet: vi.fn(async () => ({ credited: true, amount: 98000 })),
    }))

    const { default: handler } = await import('../server/api/orders/[id].patch')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 422,
      statusMessage: expect.stringContaining('OTP'),
    })
  })
})
