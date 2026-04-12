import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { disburseFunds } from '../server/utils/xendit-disburse'
import type { AttemptRow, AttemptStore, AttemptInsertRow } from '../server/utils/disbursement-attempts'

function createFakeStore(): AttemptStore & { rows: AttemptRow[] } {
  const rows: AttemptRow[] = []
  let idCounter = 0

  return {
    rows,
    insert: vi.fn(async (row: AttemptInsertRow) => {
      const full: AttemptRow = {
        id: `attempt-${++idCounter}`,
        created_at: '2026-04-11T00:00:00.000Z',
        updated_at: '2026-04-11T00:00:00.000Z',
        ...row,
      }
      rows.push(full)
      return full
    }),
    updateSubmitted: vi.fn(async (id: string, xenditId: string) => {
      const r = rows.find((x) => x.id === id)
      if (r) { r.status = 'submitted'; r.xendit_disbursement_id = xenditId }
    }),
    updateFailed: vi.fn(async (id: string, msg: string) => {
      const r = rows.find((x) => x.id === id)
      if (r) { r.status = 'failed'; r.error_message = msg }
    }),
    updateCompleted: vi.fn(async () => {}),
    findByXenditId: vi.fn(async () => null),
    listByOrder: vi.fn(async () => rows),
    listRetryable: vi.fn(async () => []),
  }
}

describe('disburseFunds', () => {
  const originalEnv = process.env.XENDIT_KEY
  const originalAutoDisburseAdminFee = process.env.XENDIT_AUTO_DISBURSE_ADMIN_FEE
  const originalFetch = globalThis.$fetch

  beforeEach(() => {
    process.env.XENDIT_KEY = 'test-key'
    delete process.env.XENDIT_AUTO_DISBURSE_ADMIN_FEE
  })

  afterEach(() => {
    process.env.XENDIT_KEY = originalEnv
    process.env.XENDIT_AUTO_DISBURSE_ADMIN_FEE = originalAutoDisburseAdminFee
    globalThis.$fetch = originalFetch
    vi.restoreAllMocks()
  })

  const baseParams = () => ({
    orderId: 'order-1',
    externalIdPrefix: 'vt_complete',
    totalAmount: 120000,
    shippingCost: 20000,
    platformFee: 2000,
    seller: {
      bank_code: 'BCA',
      account_holder_name: 'Seller Name',
      account_number: '1234567890',
    },
  })

  it('skips when XENDIT_KEY is not set', async () => {
    delete process.env.XENDIT_KEY
    const store = createFakeStore()

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.skipped).toBe(true)
    expect(store.insert).not.toHaveBeenCalled()
  })

  it('skips when seller bank info is incomplete', async () => {
    const store = createFakeStore()

    const result = await disburseFunds({
      ...baseParams(),
      seller: { bank_code: null, account_holder_name: null, account_number: null },
      attemptStore: store,
    })

    expect(result.skipped).toBe(true)
    expect(store.insert).not.toHaveBeenCalled()
  })

  it('happy path (default): inserts + submits seller attempt only', async () => {
    const store = createFakeStore()
    globalThis.$fetch = vi.fn()
      .mockResolvedValueOnce({ id: 'xd-seller' }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.sellerDisbursementId).toBe('xd-seller')
    expect(result.adminDisbursementId).toBeNull()
    expect(result.skipped).toBe(false)
    expect(result.error).toBeNull()

    expect(store.insert).toHaveBeenCalledTimes(1)
    expect(store.updateSubmitted).toHaveBeenCalledTimes(1)
    expect(store.rows[0]).toMatchObject({
      recipient_type: 'seller',
      amount: 98000, // 120000 - 20000 - 2000
      status: 'submitted',
      xendit_disbursement_id: 'xd-seller',
    })
  })

  it('disburses admin fee when XENDIT_AUTO_DISBURSE_ADMIN_FEE is enabled', async () => {
    process.env.XENDIT_AUTO_DISBURSE_ADMIN_FEE = 'true'

    const store = createFakeStore()
    globalThis.$fetch = vi.fn()
      .mockResolvedValueOnce({ id: 'xd-seller' })
      .mockResolvedValueOnce({ id: 'xd-admin' }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.sellerDisbursementId).toBe('xd-seller')
    expect(result.adminDisbursementId).toBe('xd-admin')

    expect(store.insert).toHaveBeenCalledTimes(2)
    expect(store.updateSubmitted).toHaveBeenCalledTimes(2)
    expect(store.rows[1]).toMatchObject({
      recipient_type: 'admin_fee',
      amount: 2000,
      status: 'submitted',
      xendit_disbursement_id: 'xd-admin',
    })
  })

  it('seller API error: seller attempt failed, admin attempt NOT created', async () => {
    const store = createFakeStore()
    globalThis.$fetch = vi.fn(async () => {
      const err: Error & { data?: unknown } = new Error('Insufficient funds')
      err.data = { message: 'Insufficient balance', error_code: 'INSUFFICIENT_BALANCE' }
      throw err
    }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.sellerDisbursementId).toBeNull()
    expect(result.adminDisbursementId).toBeNull()
    expect(result.error).toBe('Insufficient balance')

    expect(store.insert).toHaveBeenCalledTimes(1) // only seller
    expect(store.updateFailed).toHaveBeenCalledTimes(1)
    expect(store.rows[0]).toMatchObject({
      recipient_type: 'seller',
      status: 'failed',
      error_message: 'Insufficient balance',
    })
  })

  it('admin API error after seller success: seller submitted, admin failed', async () => {
    process.env.XENDIT_AUTO_DISBURSE_ADMIN_FEE = '1'

    const store = createFakeStore()
    let call = 0
    globalThis.$fetch = vi.fn(async () => {
      call++
      if (call === 1) return { id: 'xd-seller' }
      const err: Error & { data?: unknown } = new Error('Admin bank error')
      err.data = { message: 'Admin account locked' }
      throw err
    }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.sellerDisbursementId).toBe('xd-seller')
    expect(result.adminDisbursementId).toBeNull()

    expect(store.insert).toHaveBeenCalledTimes(2)
    expect(store.rows[0]).toMatchObject({ status: 'submitted' })
    expect(store.rows[1]).toMatchObject({ status: 'failed', error_message: 'Admin account locked' })
  })

  it('skips admin fee disbursement when platformFee is 0', async () => {
    const store = createFakeStore()
    globalThis.$fetch = vi.fn().mockResolvedValueOnce({ id: 'xd-seller' }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({
      ...baseParams(),
      platformFee: 0,
      attemptStore: store,
    })

    expect(result.sellerDisbursementId).toBe('xd-seller')
    expect(result.adminDisbursementId).toBeNull()
    expect(store.insert).toHaveBeenCalledTimes(1) // only seller
  })

  it('reduces seller disbursement by paymentGatewayFee when present', async () => {
    const store = createFakeStore()
    globalThis.$fetch = vi.fn().mockResolvedValueOnce({ id: 'xd-seller-gw' }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({
      ...baseParams(),
      paymentGatewayFee: 1500,
      attemptStore: store,
    })

    expect(result.sellerDisbursementId).toBe('xd-seller-gw')
    expect(store.rows[0]).toMatchObject({
      recipient_type: 'seller',
      amount: 96500, // 120000 - 20000 - 2000 - 1500
      status: 'submitted',
    })
  })

  it('supports custom attemptNo (for retry scenarios)', async () => {
    process.env.XENDIT_AUTO_DISBURSE_ADMIN_FEE = 'yes'

    const store = createFakeStore()
    globalThis.$fetch = vi.fn()
      .mockResolvedValueOnce({ id: 'xd-seller-retry' })
      .mockResolvedValueOnce({ id: 'xd-admin-retry' }) as unknown as typeof globalThis.$fetch

    await disburseFunds({ ...baseParams(), attemptStore: store, attemptNo: 2 })

    expect(store.rows[0].attempt_no).toBe(2)
    expect(store.rows[1].attempt_no).toBe(2)
  })
})
