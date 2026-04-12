import { supabaseAdmin } from './supabase-admin'

interface CreditParams {
  sellerId: string
  orderId: string
  grossSellerAmount: number
  paymentGatewayFee: number
  txType?: 'order_credit' | 'partial_refund_credit'
}

export async function creditSellerWallet(params: CreditParams): Promise<{ credited: boolean; amount: number }> {
  const txType = params.txType ?? 'order_credit'
  const amount = Math.max(0, Math.round(params.grossSellerAmount - params.paymentGatewayFee))
  if (amount <= 0) return { credited: false, amount: 0 }

  // Idempotency guard: one credit per order/tx type.
  const { data: existingTx } = await supabaseAdmin
    .from('seller_wallet_transactions')
    .select('id')
    .eq('order_id', params.orderId)
    .eq('tx_type', txType)
    .maybeSingle()

  if (existingTx) return { credited: false, amount }

  const { data: wallet } = await supabaseAdmin
    .from('seller_wallets')
    .select('seller_id, available_balance, total_credited')
    .eq('seller_id', params.sellerId)
    .maybeSingle()

  const before = Number(wallet?.available_balance ?? 0)
  const after = before + amount

  if (!wallet) {
    const { error: insWalletErr } = await supabaseAdmin
      .from('seller_wallets')
      .insert({
        seller_id: params.sellerId,
        available_balance: after,
        total_credited: amount,
        total_withdrawn: 0,
      })

    if (insWalletErr) {
      throw createError({ statusCode: 500, statusMessage: `Gagal membuat wallet seller: ${insWalletErr.message}` })
    }
  } else {
    const { error: updWalletErr } = await supabaseAdmin
      .from('seller_wallets')
      .update({
        available_balance: after,
        total_credited: Number(wallet.total_credited ?? 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_id', params.sellerId)

    if (updWalletErr) {
      throw createError({ statusCode: 500, statusMessage: `Gagal update wallet seller: ${updWalletErr.message}` })
    }
  }

  const { error: txErr } = await supabaseAdmin
    .from('seller_wallet_transactions')
    .insert({
      seller_id: params.sellerId,
      order_id: params.orderId,
      tx_type: txType,
      amount,
      balance_before: before,
      balance_after: after,
      meta: {
        gross_seller_amount: Math.round(params.grossSellerAmount),
        payment_gateway_fee: Math.round(params.paymentGatewayFee),
      },
    })

  if (txErr) {
    throw createError({ statusCode: 500, statusMessage: `Gagal mencatat wallet transaction: ${txErr.message}` })
  }

  return { credited: true, amount }
}

interface WithdrawParams {
  sellerId: string
  requestedAmount: number
  disbursementFee: number
}

export async function reserveWithdrawFromWallet(params: WithdrawParams): Promise<{
  before: number
  after: number
  transferAmount: number
  totalWithdrawnBefore: number
  transactionId: string
}> {
  const requestedAmount = Math.max(0, Math.round(params.requestedAmount))
  const disbursementFee = Math.max(0, Math.round(params.disbursementFee))
  const transferAmount = requestedAmount - disbursementFee

  if (requestedAmount <= 0 || transferAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nominal withdraw tidak valid.' })
  }

  const { data: wallet } = await supabaseAdmin
    .from('seller_wallets')
    .select('available_balance, total_withdrawn')
    .eq('seller_id', params.sellerId)
    .maybeSingle()

  const before = Number(wallet?.available_balance ?? 0)
  const totalWithdrawnBefore = Number(wallet?.total_withdrawn ?? 0)
  if (before < requestedAmount) {
    throw createError({ statusCode: 422, statusMessage: 'Saldo tidak cukup untuk withdraw.' })
  }

  const after = before - requestedAmount
  const { error: updErr } = await supabaseAdmin
    .from('seller_wallets')
    .update({
      available_balance: after,
      total_withdrawn: totalWithdrawnBefore + requestedAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('seller_id', params.sellerId)

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: `Gagal update saldo wallet: ${updErr.message}` })
  }

  const { data: txRow, error: txErr } = await supabaseAdmin
    .from('seller_wallet_transactions')
    .insert({
      seller_id: params.sellerId,
      tx_type: 'withdraw',
      amount: -requestedAmount,
      balance_before: before,
      balance_after: after,
      meta: {
        transfer_amount: transferAmount,
        disbursement_fee: disbursementFee,
      },
    })
    .select('id')
    .single()

  if (txErr) {
    throw createError({ statusCode: 500, statusMessage: `Gagal mencatat transaksi withdraw: ${txErr.message}` })
  }

  return {
    before,
    after,
    transferAmount,
    totalWithdrawnBefore,
    transactionId: txRow.id,
  }
}
