import { describe, expect, it, vi } from 'vitest'
import { processXenditDisbursementWebhook } from '../server/utils/xendit-disbursement-webhook-handler'
import type { AttemptRow } from '../server/utils/disbursement-attempts'

function makeAttempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id:                     'attempt-1',
    order_id:               'order-1',
    recipient_type:         'seller',
    xendit_disbursement_id: 'xd-1',
    amount:                 100000,
    status:                 'submitted',
    attempt_no:             1,
    error_message:          null,
    created_at:             '2026-04-11T00:00:00.000Z',
    updated_at:             '2026-04-11T00:00:00.000Z',
    ...overrides,
  }
}

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    findByXenditId:       vi.fn(async () => null),
    updateCompleted:      vi.fn(async () => {}),
    updateFailed:         vi.fn(async () => {}),
    listByOrder:          vi.fn(async () => []),
    markOrderDisbursed:   vi.fn(async () => {}),
    onWarning:            vi.fn(),
    ...overrides,
  }
}

describe('processXenditDisbursementWebhook', () => {
  it('returns ok=false for unknown xendit id', async () => {
    const deps = createDeps({ findByXenditId: vi.fn(async () => null) })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-unknown',
      status: 'COMPLETED',
    }, deps)

    expect(result).toEqual({ ok: true, action: 'unknown_attempt', updated: false })
    expect(deps.updateCompleted).not.toHaveBeenCalled()
  })

  it('COMPLETED → updates attempt + sets order.disbursement_id when all complete', async () => {
    const sellerAttempt = makeAttempt({ id: 'a-1', recipient_type: 'seller', xendit_disbursement_id: 'xd-1', status: 'submitted' })
    const adminAttempt  = makeAttempt({ id: 'a-2', recipient_type: 'admin_fee', xendit_disbursement_id: 'xd-2', status: 'completed' })

    const deps = createDeps({
      findByXenditId: vi.fn(async () => sellerAttempt),
      // After updateCompleted, listByOrder returns both as completed
      listByOrder: vi.fn(async () => [
        { ...sellerAttempt, status: 'completed' as const },
        adminAttempt,
      ]),
    })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-1',
      status: 'COMPLETED',
    }, deps)

    expect(deps.updateCompleted).toHaveBeenCalledWith('a-1')
    expect(deps.markOrderDisbursed).toHaveBeenCalledWith('order-1', 'xd-1')
    expect(result).toEqual({ ok: true, action: 'completed', updated: true })
  })

  it('COMPLETED → does NOT set order.disbursement_id when some attempts still pending', async () => {
    const sellerAttempt = makeAttempt({ id: 'a-1', recipient_type: 'seller', xendit_disbursement_id: 'xd-1', status: 'submitted' })
    const adminAttempt  = makeAttempt({ id: 'a-2', recipient_type: 'admin_fee', xendit_disbursement_id: 'xd-2', status: 'submitted' })

    const deps = createDeps({
      findByXenditId: vi.fn(async () => sellerAttempt),
      listByOrder:    vi.fn(async () => [
        { ...sellerAttempt, status: 'completed' as const },
        adminAttempt,
      ]),
    })

    await processXenditDisbursementWebhook({ id: 'xd-1', status: 'COMPLETED' }, deps)

    expect(deps.updateCompleted).toHaveBeenCalledWith('a-1')
    expect(deps.markOrderDisbursed).not.toHaveBeenCalled()
  })

  it('FAILED → updates attempt to failed with error message', async () => {
    const attempt = makeAttempt({ id: 'a-1', status: 'submitted' })
    const deps = createDeps({ findByXenditId: vi.fn(async () => attempt) })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-1',
      status: 'FAILED',
      failure_code: 'INSUFFICIENT_BALANCE',
      failure_reason: 'Insufficient balance',
    }, deps)

    expect(deps.updateFailed).toHaveBeenCalledWith('a-1', 'Insufficient balance')
    expect(result).toEqual({ ok: true, action: 'failed', updated: true })
  })

  it('duplicate COMPLETED (already completed) is idempotent — no double update', async () => {
    const attempt = makeAttempt({ id: 'a-1', status: 'completed' })
    const deps = createDeps({ findByXenditId: vi.fn(async () => attempt) })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-1',
      status: 'COMPLETED',
    }, deps)

    expect(deps.updateCompleted).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, action: 'already_completed', updated: false })
  })

  it('unknown status returns ignored', async () => {
    const attempt = makeAttempt({ id: 'a-1' })
    const deps = createDeps({ findByXenditId: vi.fn(async () => attempt) })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-1',
      status: 'PENDING',
    }, deps)

    expect(result).toEqual({ ok: true, action: 'ignored', updated: false })
  })

  it('missing id in payload returns error action (caller will throw 400)', async () => {
    const deps = createDeps()

    const result = await processXenditDisbursementWebhook({
      id: '',
      status: 'COMPLETED',
    }, deps)

    expect(result).toEqual({ ok: false, action: 'missing_id', updated: false })
  })
})
