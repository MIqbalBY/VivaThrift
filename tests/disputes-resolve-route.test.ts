import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

function createSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chains = {
    disputes_select: vi.fn(async () => ({ data: {
      id: 'dispute-1',
      order_id: 'order-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'open',
      refund_status: null,
    } })),
    orders_select: vi.fn(async () => ({ data: {
      id: 'order-1',
      status: 'disputed',
      total_amount: 120000,
      shipping_cost: 20000,
      platform_fee: 2000,
      xendit_invoice_id: 'inv-1',
      pre_dispute_status: 'shipped',
      seller: { bank_code: 'BCA', bank_account_number: '1', bank_account_name: 'Seller' },
    } })),
    disputes_update: vi.fn(async () => ({ error: null })),
    orders_update: vi.fn(async () => ({ error: null })),
    notifications_insert: vi.fn(async () => ({ error: null })),
    ...overrides,
  }

  const from = vi.fn((table: string) => {
    if (table === 'disputes') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: chains.disputes_select,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => chains.disputes_update()),
        })),
      }
    }
    if (table === 'orders') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: chains.orders_select,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => chains.orders_update()),
        })),
      }
    }
    if (table === 'notifications') {
      return {
        insert: chains.notifications_insert,
      }
    }
    return { select: vi.fn(), update: vi.fn(), insert: vi.fn() }
  })

  return { from, chains }
}

describe('disputes resolve route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
    vi.stubGlobal('getRouterParam', vi.fn(() => 'dispute-1'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/resolve-server-uid')
    vi.doUnmock('../server/utils/assert-admin')
    vi.doUnmock('../server/utils/xendit-refund')
    vi.doUnmock('../server/utils/xendit-disburse')
    vi.doUnmock('../server/utils/disbursement-attempts')
  })

  it('full refund: calls refund API, updates dispute + order, returns 200', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'resolve', resolution: 'refund' })))

    const { from } = createSupabaseMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'admin-1') }))
    vi.doMock('../server/utils/assert-admin', () => ({ assertAdmin: vi.fn(async () => {}) }))

    const createXenditRefund = vi.fn(async () => ({ skipped: false, xenditRefundId: 'refund-abc', error: null }))
    vi.doMock('../server/utils/xendit-refund', () => ({ createXenditRefund }))

    const disburseFunds = vi.fn(async () => ({
      sellerDisbursementId: null,
      adminDisbursementId: 'xd-admin',
      skipped: false,
      error: null,
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))

    const { default: handler } = await import('../server/api/disputes/[id].patch')

    const result = await handler({})
    expect(result).toMatchObject({ id: 'dispute-1', status: 'resolved_refund' })
    expect(createXenditRefund).toHaveBeenCalledWith(expect.objectContaining({
      invoiceId: 'inv-1',
      amount: 118000, // 120000 - 2000 platform fee
      reason: 'REQUESTED_BY_CUSTOMER',
    }))
  })

  it('full refund: Xendit refund failure → 502, order status unchanged', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'resolve', resolution: 'refund' })))

    const { from } = createSupabaseMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'admin-1') }))
    vi.doMock('../server/utils/assert-admin', () => ({ assertAdmin: vi.fn(async () => {}) }))

    const createXenditRefund = vi.fn(async () => {
      throw new Error('Invoice already refunded')
    })
    vi.doMock('../server/utils/xendit-refund', () => ({ createXenditRefund }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds: vi.fn() }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))

    const { default: handler } = await import('../server/api/disputes/[id].patch')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: expect.stringContaining('Invoice already refunded'),
    })
  })

  it('partial refund: refund API called with partial amount, seller disburse also triggered', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({
      action: 'resolve',
      resolution: 'partial',
      refund_amount: 30000,
    })))

    const { from } = createSupabaseMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'admin-1') }))
    vi.doMock('../server/utils/assert-admin', () => ({ assertAdmin: vi.fn(async () => {}) }))

    const createXenditRefund = vi.fn(async () => ({ skipped: false, xenditRefundId: 'refund-partial', error: null }))
    vi.doMock('../server/utils/xendit-refund', () => ({ createXenditRefund }))

    const disburseFunds = vi.fn(async () => ({
      sellerDisbursementId: 'xd-seller-partial',
      adminDisbursementId: 'xd-admin-partial',
      skipped: false,
      error: null,
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))

    const { default: handler } = await import('../server/api/disputes/[id].patch')

    const result = await handler({})
    expect(result).toMatchObject({ id: 'dispute-1', status: 'resolved_partial' })
    expect(createXenditRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 30000 }))
    expect(disburseFunds).toHaveBeenCalled()
  })

  it('rejected: order restored to pre_dispute_status (shipped), no Xendit calls', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'resolve', resolution: 'rejected' })))

    const { from, chains } = createSupabaseMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'admin-1') }))
    vi.doMock('../server/utils/assert-admin', () => ({ assertAdmin: vi.fn(async () => {}) }))

    const createXenditRefund = vi.fn()
    vi.doMock('../server/utils/xendit-refund', () => ({ createXenditRefund }))
    const disburseFunds = vi.fn()
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))

    const { default: handler } = await import('../server/api/disputes/[id].patch')

    const result = await handler({})
    expect(result).toMatchObject({ id: 'dispute-1', status: 'resolved_rejected', orderRestoredTo: 'shipped' })
    expect(createXenditRefund).not.toHaveBeenCalled()
    expect(disburseFunds).not.toHaveBeenCalled()
    expect(chains.orders_update).toHaveBeenCalled()
  })
})
