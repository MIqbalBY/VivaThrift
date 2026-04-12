// ── Xendit Disbursement utility ─────────────────────────────────────────────
// Shared by order complete & confirm_meetup actions, and retry cron.
// Creates disbursements to seller + platform admin and tracks each attempt
// in the disbursement_attempts table via the injected AttemptStore.

import { buildAttemptInsertRow, type AttemptStore } from './disbursement-attempts'
import { getXenditSecretKey } from './xendit-config'

export interface DisbursementResult {
  sellerDisbursementId: string | null
  adminDisbursementId:  string | null
  skipped:              boolean
  error:                string | null
}

// Admin bank account for platform fee collection.
// Read from env so credentials can be rotated without redeploying.
function getAdminBank() {
  return {
    bank_code:           process.env.ADMIN_BANK_CODE           || 'BANK_JAGO',
    account_holder_name: process.env.ADMIN_BANK_ACCOUNT_NAME   || 'Muhammad Iqbal Baiduri Yamani',
    account_number:      process.env.ADMIN_BANK_ACCOUNT_NUMBER || '103438588617',
  }
}

export interface DisburseFundsParams {
  orderId:          string
  externalIdPrefix: string
  totalAmount:      number
  shippingCost:     number
  platformFee:      number
  seller: {
    bank_code?:           string | null
    account_holder_name?: string | null
    account_number?:      string | null
  }
  attemptStore: AttemptStore
  /** Attempt number, defaults to 1. Retry cron passes a higher value. */
  attemptNo?: number
  /**
   * When true, skip the seller disbursement entirely and only disburse the
   * platform fee to admin. Used by the full-refund dispute flow (seller gets
   * nothing, admin still keeps the fee per decision D2).
   */
  adminFeeOnly?: boolean
}

/**
 * Disburse funds after order completion:
 *   1) Seller receives: total_amount - shipping_cost - platform_fee
 *   2) Admin receives: platform_fee (if > 0)
 *
 * Attempt tracking:
 *   - A row is inserted in disbursement_attempts BEFORE each Xendit call.
 *   - On success, the row is updated to 'submitted' with the Xendit id.
 *   - On failure, the row is updated to 'failed' with the error message.
 *   - A failed seller call skips the admin fee call entirely (no half-work).
 *
 * Error behavior: non-fatal. Returns the result object; caller does not
 * block. Retry cron handles failed rows.
 */
export async function disburseFunds(params: DisburseFundsParams): Promise<DisbursementResult> {
  const xenditKey = getXenditSecretKey()

  if (!xenditKey) {
    console.warn('[disburse] XENDIT_KEY tidak dikonfigurasi.')
    return { sellerDisbursementId: null, adminDisbursementId: null, skipped: true, error: 'XENDIT_KEY tidak dikonfigurasi.' }
  }

  const hasBankInfo = params.seller.bank_code && params.seller.account_number && params.seller.account_holder_name

  if (!hasBankInfo) {
    console.warn('[disburse] Data rekening penjual belum dilengkapi.')
    return { sellerDisbursementId: null, adminDisbursementId: null, skipped: true, error: 'Data rekening penjual belum dilengkapi.' }
  }

  const attemptNo      = params.attemptNo ?? 1
  const credentials    = Buffer.from(`${xenditKey}:`).toString('base64')
  const headers        = { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }
  const sellerReceives = params.totalAmount - params.shippingCost - params.platformFee

  let sellerDisbursementId: string | null = null
  let adminDisbursementId:  string | null = null
  let error: string | null = null

  // ── 1) Disburse to seller ──────────────────────────────────────────────────
  const sellerAttempt = await params.attemptStore.insert(buildAttemptInsertRow({
    orderId:       params.orderId,
    recipientType: 'seller',
    amount:        sellerReceives,
    attemptNo,
  }))

  try {
    const res = await $fetch<{ id: string }>('https://api.xendit.co/disbursements', {
      method: 'POST',
      headers,
      body: {
        external_id:         `${params.externalIdPrefix}_seller_${params.orderId}_a${attemptNo}`,
        bank_code:           params.seller.bank_code,
        account_holder_name: params.seller.account_holder_name,
        account_number:      params.seller.account_number,
        description:         'VivaThrift - Pencairan Dana Penjual',
        amount:              sellerReceives,
      },
    })
    sellerDisbursementId = res.id
    await params.attemptStore.updateSubmitted(sellerAttempt.id, res.id)
  } catch (e: any) {
    error = e?.data?.message ?? e?.message ?? 'Disbursement ke seller gagal.'
    console.error('[disburse] Seller disbursement failed:', error)
    await params.attemptStore.updateFailed(sellerAttempt.id, error ?? 'unknown')
    // Do NOT proceed to admin fee — seller failed, skip admin fee entirely.
    return { sellerDisbursementId: null, adminDisbursementId: null, skipped: false, error }
  }

  // ── 2) Disburse platform fee to admin (only if >0) ─────────────────────────
  if (params.platformFee > 0) {
    const adminAttempt = await params.attemptStore.insert(buildAttemptInsertRow({
      orderId:       params.orderId,
      recipientType: 'admin_fee',
      amount:        params.platformFee,
      attemptNo,
    }))

    const adminBank = getAdminBank()

    try {
      const res = await $fetch<{ id: string }>('https://api.xendit.co/disbursements', {
        method: 'POST',
        headers,
        body: {
          external_id:         `${params.externalIdPrefix}_adminfee_${params.orderId}_a${attemptNo}`,
          bank_code:           adminBank.bank_code,
          account_holder_name: adminBank.account_holder_name,
          account_number:      adminBank.account_number,
          description:         'VivaThrift - Komisi Platform',
          amount:              params.platformFee,
        },
      })
      adminDisbursementId = res.id
      await params.attemptStore.updateSubmitted(adminAttempt.id, res.id)
    } catch (e: any) {
      const adminErr = e?.data?.message ?? e?.message ?? 'Disbursement fee ke admin gagal.'
      console.error('[disburse] Admin fee disbursement failed:', adminErr)
      await params.attemptStore.updateFailed(adminAttempt.id, adminErr)
      // Non-fatal — seller already got paid; admin fee is retryable.
    }
  }

  return { sellerDisbursementId, adminDisbursementId, skipped: false, error }
}
