// ── Xendit Disbursement utility ─────────────────────────────────────────────
// Shared by order complete & confirm_meetup actions.
// Creates disbursements to seller + platform admin.

export interface DisbursementResult {
  sellerDisbursementId: string | null
  adminDisbursementId: string | null
  skipped: boolean
  error: string | null
}

// Admin Bank Jago account for platform fee collection
const ADMIN_BANK = {
  bank_code:           'BANK_JAGO',         // Xendit bank code for Bank Jago
  account_holder_name: 'Muhammad Iqbal Baiduri Yamani',
  account_number:      '103438588617',
} as const

/**
 * Disburse funds after order completion:
 * 1) Seller receives: total_amount - shipping_cost - platform_fee
 * 2) Admin receives: platform_fee (if > 0)
 */
export async function disburseFunds(params: {
  orderId: string
  externalIdPrefix: string
  totalAmount: number
  shippingCost: number
  platformFee: number
  seller: {
    bank_code?: string | null
    account_holder_name?: string | null
    account_number?: string | null
  }
}): Promise<DisbursementResult> {
  const xenditKey = process.env.XENDIT_KEY ?? ''

  if (!xenditKey) {
    console.warn('[disburse] XENDIT_KEY tidak dikonfigurasi.')
    return { sellerDisbursementId: null, adminDisbursementId: null, skipped: true, error: 'XENDIT_KEY tidak dikonfigurasi.' }
  }

  const hasBankInfo = params.seller.bank_code && params.seller.account_number && params.seller.account_holder_name

  if (!hasBankInfo) {
    console.warn('[disburse] Data rekening penjual belum dilengkapi.')
    return { sellerDisbursementId: null, adminDisbursementId: null, skipped: true, error: 'Data rekening penjual belum dilengkapi.' }
  }

  const credentials = Buffer.from(`${xenditKey}:`).toString('base64')
  const headers = { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }
  const sellerReceives = params.totalAmount - params.shippingCost - params.platformFee

  let sellerDisbursementId: string | null = null
  let adminDisbursementId: string | null = null
  let error: string | null = null

  // ── 1) Disburse to seller ──────────────────────────────────────────────────
  try {
    const res = await $fetch<{ id: string }>('https://api.xendit.co/disbursements', {
      method: 'POST',
      headers,
      body: {
        external_id:         `${params.externalIdPrefix}_seller_${params.orderId}`,
        bank_code:           params.seller.bank_code,
        account_holder_name: params.seller.account_holder_name,
        account_number:      params.seller.account_number,
        description:         'VivaThrift - Pencairan Dana Penjual',
        amount:              sellerReceives,
      },
    })
    sellerDisbursementId = res.id
  } catch (e: any) {
    error = e?.data?.message ?? e?.message ?? 'Disbursement ke seller gagal.'
    console.error('[disburse] Seller disbursement failed:', error)
  }

  // ── 2) Disburse platform fee to admin ──────────────────────────────────────
  if (params.platformFee > 0) {
    try {
      const res = await $fetch<{ id: string }>('https://api.xendit.co/disbursements', {
        method: 'POST',
        headers,
        body: {
          external_id:         `${params.externalIdPrefix}_adminfee_${params.orderId}`,
          bank_code:           ADMIN_BANK.bank_code,
          account_holder_name: ADMIN_BANK.account_holder_name,
          account_number:      ADMIN_BANK.account_number,
          description:         'VivaThrift - Komisi Platform',
          amount:              params.platformFee,
        },
      })
      adminDisbursementId = res.id
    } catch (e: any) {
      const adminErr = e?.data?.message ?? e?.message ?? 'Disbursement fee ke admin gagal.'
      console.error('[disburse] Admin fee disbursement failed:', adminErr)
      // Non-fatal — seller already got paid, admin fee can be reconciled later
    }
  }

  return { sellerDisbursementId, adminDisbursementId, skipped: false, error }
}
