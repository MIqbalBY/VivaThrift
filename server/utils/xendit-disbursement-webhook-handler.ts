// ── Xendit Disbursement Webhook handler ────────────────────────────────────
// Pure handler for Xendit disbursement status callbacks. Receives an
// `AttemptStore`-compatible `deps` object and updates the disbursement_attempts
// row by its xendit_disbursement_id.
//
// Idempotent: duplicate COMPLETED callbacks are safely ignored.

import type { AttemptRow } from './disbursement-attempts'

export interface XenditDisbursementWebhookPayload {
  id:              string
  status?:         string | null
  failure_code?:   string | null
  failure_reason?: string | null
}

export interface XenditDisbursementWebhookDeps {
  findByXenditId:      (xenditId: string) => Promise<AttemptRow | null>
  updateCompleted:     (attemptId: string) => Promise<void>
  updateFailed:        (attemptId: string, errorMessage: string) => Promise<void>
  listByOrder:         (orderId: string) => Promise<AttemptRow[]>
  markOrderDisbursed:  (orderId: string, sellerXenditId: string) => Promise<void>
  onWarning?:          (message: string, error: unknown) => void
}

export interface XenditDisbursementWebhookResult {
  ok:      boolean
  action:  'completed' | 'failed' | 'already_completed' | 'unknown_attempt' | 'ignored' | 'missing_id'
  updated: boolean
}

export async function processXenditDisbursementWebhook(
  payload: XenditDisbursementWebhookPayload,
  deps:    XenditDisbursementWebhookDeps,
): Promise<XenditDisbursementWebhookResult> {
  if (!payload.id) {
    return { ok: false, action: 'missing_id', updated: false }
  }

  const attempt = await deps.findByXenditId(payload.id)

  if (!attempt) {
    // Unknown disbursement id — return 200 OK so Xendit doesn't retry forever.
    deps.onWarning?.('[xendit-disbursement-webhook] unknown xendit_disbursement_id', payload)
    return { ok: true, action: 'unknown_attempt', updated: false }
  }

  const status = (payload.status ?? '').toUpperCase()

  if (status === 'COMPLETED') {
    if (attempt.status === 'completed') {
      return { ok: true, action: 'already_completed', updated: false }
    }

    await deps.updateCompleted(attempt.id)

    // Check if all attempts for this order are now complete → set order.disbursement_id
    const all = await deps.listByOrder(attempt.order_id)
    const allComplete = all.length > 0 && all.every((a) => a.status === 'completed')

    if (allComplete) {
      const sellerAttempt = all.find((a) => a.recipient_type === 'seller')
      if (sellerAttempt?.xendit_disbursement_id) {
        await deps.markOrderDisbursed(attempt.order_id, sellerAttempt.xendit_disbursement_id)
      }
    }

    return { ok: true, action: 'completed', updated: true }
  }

  if (status === 'FAILED') {
    const errorMessage = payload.failure_reason ?? payload.failure_code ?? 'Xendit marked disbursement as FAILED'
    await deps.updateFailed(attempt.id, errorMessage)
    return { ok: true, action: 'failed', updated: true }
  }

  // Other Xendit statuses (PENDING, APPROVED) → ignore
  return { ok: true, action: 'ignored', updated: false }
}
