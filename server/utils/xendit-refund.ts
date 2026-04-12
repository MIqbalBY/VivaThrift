// ── Xendit Refund API utility ───────────────────────────────────────────────
// Pure function wrapper around the Xendit /refunds endpoint.
// Used by the dispute resolution endpoint when an admin approves a refund.

export interface XenditRefundParams {
  invoiceId:  string
  amount:     number
  reason:     'REQUESTED_BY_CUSTOMER' | 'DUPLICATE' | 'FRAUDULENT' | 'OTHERS'
  externalId: string
}

export interface XenditRefundResult {
  skipped:         boolean
  xenditRefundId:  string | null
  error:           string | null
}

/**
 * Creates a refund through Xendit's Refund API.
 *
 * Behavior:
 *   - If XENDIT_KEY is not configured → returns skipped (no error thrown)
 *   - If invoiceId is empty → returns skipped
 *   - If the Xendit API returns an error → throws (caller handles revert)
 *   - On success → returns the Xendit refund id
 *
 * Refund amount is paid back to the buyer's original payment method.
 */
export async function createXenditRefund(params: XenditRefundParams): Promise<XenditRefundResult> {
  const xenditKey = process.env.XENDIT_KEY ?? ''

  if (!xenditKey) {
    return { skipped: true, xenditRefundId: null, error: 'XENDIT_KEY tidak dikonfigurasi.' }
  }

  if (!params.invoiceId) {
    return { skipped: true, xenditRefundId: null, error: 'invoiceId kosong.' }
  }

  const credentials = Buffer.from(`${xenditKey}:`).toString('base64')
  const headers = { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }

  const res = await $fetch<{ id: string }>('https://api.xendit.co/refunds', {
    method: 'POST',
    headers,
    body: {
      invoice_id:  params.invoiceId,
      amount:      params.amount,
      reason:      params.reason,
      external_id: params.externalId,
    },
  })

  return { skipped: false, xenditRefundId: res.id, error: null }
}
