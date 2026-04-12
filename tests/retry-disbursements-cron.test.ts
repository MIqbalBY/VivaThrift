import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

describe('retry-disbursements cron route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CRON_SECRET
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/disbursement-attempts')
    vi.doUnmock('../server/utils/xendit-disburse')
  })

  it('returns 401 when cron secret is wrong', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'Bearer wrong'))

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({ listRetryable: vi.fn(async () => []) })),
      isRetryEligible: vi.fn(),
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds: vi.fn() }))

    const { default: handler } = await import('../server/api/cron/retry-disbursements.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns summary with 0 retried when no eligible rows', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'Bearer test-cron-secret'))

    vi.doMock('../server/utils/supabase-admin', () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null })),
            })),
          })),
        })),
      },
    }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({
        listRetryable: vi.fn(async () => []),
      })),
      isRetryEligible: vi.fn(() => true),
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds: vi.fn() }))

    const { default: handler } = await import('../server/api/cron/retry-disbursements.post')

    const result = await handler({})
    expect(result).toMatchObject({ ok: true, eligible: 0, retried: 0 })
  })

  it('retries only rows filtered by isRetryEligible', async () => {
    const now = new Date('2026-04-11T12:00:00.000Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    vi.stubGlobal('getHeader', vi.fn(() => 'Bearer test-cron-secret'))

    const rows = [
      { id: 'a-1', order_id: 'order-1', status: 'failed', attempt_no: 1, updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), recipient_type: 'seller', amount: 50000 },
      { id: 'a-2', order_id: 'order-1', status: 'failed', attempt_no: 1, updated_at: new Date(now - 10 * 60 * 1000).toISOString(),   recipient_type: 'seller', amount: 50000 }, // too recent
      { id: 'a-3', order_id: 'order-2', status: 'failed', attempt_no: 3, updated_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(), recipient_type: 'seller', amount: 50000 }, // max
    ]

    const getOrder = vi.fn(async () => ({
      data: {
        id: 'order-1',
        total_amount: 120000,
        shipping_cost: 20000,
        platform_fee: 2000,
        seller: { bank_code: 'BCA', account_holder_name: 'X', account_number: '1' },
      },
    }))

    vi.doMock('../server/utils/supabase-admin', () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: getOrder,
            })),
          })),
        })),
      },
    }))

    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({
        listRetryable: vi.fn(async () => rows),
      })),
      isRetryEligible: vi.fn((row: { attempt_no: number; updated_at: string; status: string }, nowMs: number) => {
        if (row.status !== 'failed') return false
        const updatedMs = new Date(row.updated_at).getTime()
        if (row.attempt_no === 1) return nowMs - updatedMs >= 60 * 60 * 1000
        if (row.attempt_no === 2) return nowMs - updatedMs >= 4 * 60 * 60 * 1000
        return false
      }),
    }))

    const disburseMock = vi.fn(async () => ({
      sellerDisbursementId: 'xd-retry',
      adminDisbursementId: null,
      skipped: false,
      error: null,
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds: disburseMock }))

    const { default: handler } = await import('../server/api/cron/retry-disbursements.post')

    const result = await handler({})

    expect(result.retried).toBe(1)
    expect(disburseMock).toHaveBeenCalledTimes(1)
    expect(disburseMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      attemptNo: 2,
      externalIdPrefix: 'vt_retry',
    }))

    vi.useRealTimers()
  })
})
