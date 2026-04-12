-- Seller wallet + ledger for split-cost settlement model
-- Buyer pays: item + shipping + platform fee
-- Seller bears: payment gateway fee + withdrawal disbursement fee

CREATE TABLE IF NOT EXISTS public.seller_wallets (
  seller_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  available_balance INTEGER NOT NULL DEFAULT 0,
  total_credited INTEGER NOT NULL DEFAULT 0,
  total_withdrawn INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('order_credit', 'partial_refund_credit', 'withdraw')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_wallet_tx_seller_created
  ON public.seller_wallet_transactions (seller_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_seller_wallet_order_credit
  ON public.seller_wallet_transactions (order_id, tx_type)
  WHERE order_id IS NOT NULL AND tx_type IN ('order_credit', 'partial_refund_credit');

ALTER TABLE public.seller_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seller_wallets_select_own ON public.seller_wallets;
CREATE POLICY seller_wallets_select_own
  ON public.seller_wallets
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS seller_wallet_tx_select_own ON public.seller_wallet_transactions;
CREATE POLICY seller_wallet_tx_select_own
  ON public.seller_wallet_transactions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());
