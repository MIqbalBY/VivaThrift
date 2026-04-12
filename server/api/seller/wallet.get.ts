import { resolveServerUid } from '../../utils/resolve-server-uid'
import { supabaseAdmin } from '../../utils/supabase-admin'

export default defineEventHandler(async (event) => {
  const sellerId = await resolveServerUid(event)

  const { data: wallet, error: walletErr } = await supabaseAdmin
    .from('seller_wallets')
    .select('available_balance, total_credited, total_withdrawn, updated_at')
    .eq('seller_id', sellerId)
    .maybeSingle()

  if (walletErr) throw createError({ statusCode: 500, statusMessage: walletErr.message })

  const { data: recentTx, error: txErr } = await supabaseAdmin
    .from('seller_wallet_transactions')
    .select('id, tx_type, amount, balance_before, balance_after, meta, created_at, order_id')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (txErr) throw createError({ statusCode: 500, statusMessage: txErr.message })

  return {
    wallet: wallet ?? {
      available_balance: 0,
      total_credited: 0,
      total_withdrawn: 0,
      updated_at: null,
    },
    transactions: recentTx ?? [],
  }
})
