import { resolveServerUid } from '../../../utils/resolve-server-uid'
import { supabaseAdmin } from '../../../utils/supabase-admin'
import { createXenditWithdraw } from '../../../utils/xendit-withdraw'
import { reserveWithdrawFromWallet } from '../../../utils/seller-wallet'

export default defineEventHandler(async (event) => {
  const sellerId = await resolveServerUid(event)
  const body = await readBody(event)

  const requestedAmount = Math.max(0, Math.round(Number(body?.amount ?? 0)))
  const disbursementFee = Math.max(0, Math.round(Number(process.env.XENDIT_DISBURSEMENT_FEE_SELLER_FLAT ?? 2500)))

  if (requestedAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'amount harus lebih besar dari 0.' })
  }

  const { data: seller, error: sellerErr } = await supabaseAdmin
    .from('users')
    .select('bank_code, bank_account_name, bank_account_number, name')
    .eq('id', sellerId)
    .single()

  if (sellerErr || !seller) {
    throw createError({ statusCode: 404, statusMessage: 'Data seller tidak ditemukan.' })
  }

  if (!seller.bank_code || !seller.bank_account_name || !seller.bank_account_number) {
    throw createError({ statusCode: 422, statusMessage: 'Lengkapi data rekening bank sebelum withdraw.' })
  }

  const { before, after, transferAmount, totalWithdrawnBefore, transactionId } = await reserveWithdrawFromWallet({
    sellerId,
    requestedAmount,
    disbursementFee,
  })

  try {
    const externalId = `vt_withdraw_${sellerId}_${Date.now()}`
    const { disbursementId } = await createXenditWithdraw({
      externalId,
      amount: transferAmount,
      bankCode: seller.bank_code,
      accountHolderName: seller.bank_account_name,
      accountNumber: seller.bank_account_number,
      description: `VivaThrift - Withdraw Seller ${seller.name ?? sellerId}`,
    })

    return {
      ok: true,
      disbursementId,
      requestedAmount,
      transferAmount,
      disbursementFee,
      balanceBefore: before,
      balanceAfter: after,
    }
  } catch (e: any) {
    // Compensating write: rollback wallet debit when Xendit call fails.
    await supabaseAdmin
      .from('seller_wallets')
      .update({
        available_balance: before,
        total_withdrawn: totalWithdrawnBefore,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_id', sellerId)

    await supabaseAdmin
      .from('seller_wallet_transactions')
      .delete()
      .eq('id', transactionId)

    throw createError({ statusCode: 502, statusMessage: e?.data?.message ?? e?.message ?? 'Withdraw Xendit gagal.' })
  }
})
