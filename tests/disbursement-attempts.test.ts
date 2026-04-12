import { describe, expect, it } from 'vitest'
import {
  buildAttemptInsertRow,
  isRetryEligible,
  nextRetryWindowMs,
  type AttemptRow,
} from '../server/utils/disbursement-attempts'

describe('buildAttemptInsertRow', () => {
  it('builds a pending seller row', () => {
    const row = buildAttemptInsertRow({
      orderId:       'order-1',
      recipientType: 'seller',
      amount:        100000,
      attemptNo:     1,
    })
    expect(row).toEqual({
      order_id:               'order-1',
      recipient_type:         'seller',
      amount:                 100000,
      attempt_no:             1,
      status:                 'pending',
      xendit_disbursement_id: null,
      error_message:          null,
    })
  })

  it('builds a pending admin_fee row', () => {
    const row = buildAttemptInsertRow({
      orderId:       'order-2',
      recipientType: 'admin_fee',
      amount:        2000,
      attemptNo:     2,
    })
    expect(row.recipient_type).toBe('admin_fee')
    expect(row.attempt_no).toBe(2)
    expect(row.amount).toBe(2000)
  })
})

describe('nextRetryWindowMs', () => {
  it('returns 1 hour for attempt 1', () => {
    expect(nextRetryWindowMs(1)).toBe(60 * 60 * 1000)
  })

  it('returns 4 hours for attempt 2', () => {
    expect(nextRetryWindowMs(2)).toBe(4 * 60 * 60 * 1000)
  })

  it('returns Infinity for attempt 3+ (no more retries)', () => {
    expect(nextRetryWindowMs(3)).toBe(Infinity)
    expect(nextRetryWindowMs(5)).toBe(Infinity)
  })
})

describe('isRetryEligible', () => {
  const nowIso = '2026-04-11T12:00:00.000Z'
  const now = new Date(nowIso).getTime()

  function makeRow(overrides: Partial<AttemptRow>): AttemptRow {
    return {
      id:                     'a-1',
      order_id:               'order-1',
      recipient_type:         'seller',
      xendit_disbursement_id: null,
      amount:                 100000,
      status:                 'failed',
      attempt_no:             1,
      error_message:          'API error',
      created_at:             '2026-04-11T00:00:00.000Z',
      updated_at:             '2026-04-11T00:00:00.000Z',
      ...overrides,
    }
  }

  it('attempt 1: eligible when updated_at is >1h ago', () => {
    const row = makeRow({
      attempt_no: 1,
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(true)
  })

  it('attempt 1: NOT eligible when updated_at is 30 minutes ago', () => {
    const row = makeRow({
      attempt_no: 1,
      updated_at: new Date(now - 30 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(false)
  })

  it('attempt 2: eligible when updated_at is >4h ago', () => {
    const row = makeRow({
      attempt_no: 2,
      updated_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(true)
  })

  it('attempt 2: NOT eligible at exactly 2h', () => {
    const row = makeRow({
      attempt_no: 2,
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(false)
  })

  it('attempt 3: NEVER eligible (max retries reached)', () => {
    const row = makeRow({
      attempt_no: 3,
      updated_at: new Date(now - 100 * 60 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(false)
  })

  it('rejects rows with status other than failed', () => {
    const row = makeRow({ status: 'completed' })
    expect(isRetryEligible(row, now)).toBe(false)
  })
})
