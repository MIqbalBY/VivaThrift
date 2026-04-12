import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXenditRefund } from '../server/utils/xendit-refund'

describe('createXenditRefund', () => {
  const originalFetch = globalThis.$fetch
  const originalEnv = process.env.XENDIT_KEY

  beforeEach(() => {
    process.env.XENDIT_KEY = 'test-xendit-key'
  })

  afterEach(() => {
    process.env.XENDIT_KEY = originalEnv
    globalThis.$fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns skipped when XENDIT_KEY is not set', async () => {
    delete process.env.XENDIT_KEY

    const result = await createXenditRefund({
      invoiceId: 'inv-1',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })

    expect(result).toEqual({
      skipped: true,
      xenditRefundId: null,
      error: 'XENDIT_KEY tidak dikonfigurasi.',
    })
  })

  it('returns skipped when invoiceId is missing', async () => {
    const result = await createXenditRefund({
      invoiceId: '',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })

    expect(result).toEqual({
      skipped: true,
      xenditRefundId: null,
      error: 'invoiceId kosong.',
    })
  })

  it('returns xenditRefundId on happy path', async () => {
    const fetchMock = vi.fn(async () => ({ id: 'refund-abc' }))
    globalThis.$fetch = fetchMock as unknown as typeof globalThis.$fetch

    const result = await createXenditRefund({
      invoiceId: 'inv-1',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })

    expect(result).toEqual({
      skipped: false,
      xenditRefundId: 'refund-abc',
      error: null,
    })

    expect(fetchMock).toHaveBeenCalledWith('https://api.xendit.co/refunds', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        invoice_id:  'inv-1',
        amount:      50000,
        reason:      'REQUESTED_BY_CUSTOMER',
        external_id: 'vt_refund_d1',
      }),
    }))
  })

  it('throws on Xendit 4xx errors (permanent)', async () => {
    const fetchMock = vi.fn(async () => {
      const err: Error & { data?: unknown; statusCode?: number } = new Error('Invalid invoice')
      err.data = { message: 'Invoice already refunded', error_code: 'DUPLICATE_REFUND' }
      err.statusCode = 400
      throw err
    })
    globalThis.$fetch = fetchMock as unknown as typeof globalThis.$fetch

    await expect(createXenditRefund({
      invoiceId: 'inv-1',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })).rejects.toThrow('Invalid invoice')
  })

  it('throws on Xendit 5xx errors with retry hint', async () => {
    const fetchMock = vi.fn(async () => {
      const err: Error & { data?: unknown; statusCode?: number } = new Error('Server error')
      err.statusCode = 503
      err.data = { message: 'Service unavailable' }
      throw err
    })
    globalThis.$fetch = fetchMock as unknown as typeof globalThis.$fetch

    await expect(createXenditRefund({
      invoiceId: 'inv-1',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })).rejects.toThrow('Server error')
  })
})
