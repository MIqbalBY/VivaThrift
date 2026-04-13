-- =============================================================================
-- Migration 20260413000012 — Database linter fixes (safe subset)
-- VivaThrift · 2026-04-13
-- =============================================================================
-- Fixes applied here are intentionally limited to low-risk items from the
-- Supabase linter output:
--   1. Enable RLS on public.disbursement_attempts
--   2. Recreate a few auth.uid()-based policies with (select auth.uid())
--   3. Drop stale duplicate public-read policies if they still exist
--   4. Add missing foreign-key indexes flagged by the linter
--
-- We do NOT consolidate the remaining multiple permissive policies for
-- orders/offers/disputes in this migration because those policies encode
-- different role-specific access paths and need a separate semantics review.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Critical security fix: enable RLS on disbursement_attempts
--    App access goes through the service role for payout automation, so this
--    does not block existing server-side flows.
-- ---------------------------------------------------------------------------
ALTER TABLE public.disbursement_attempts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS auth.uid() initplan fixes
--    Wrap auth.uid() in (select auth.uid()) so Postgres evaluates it once per
--    statement instead of once per scanned row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_seller_update ON public.orders;
CREATE POLICY orders_seller_update
  ON public.orders FOR UPDATE
  USING (seller_id = (select auth.uid()))
  WITH CHECK (seller_id = (select auth.uid()));

DROP POLICY IF EXISTS orders_buyer_update ON public.orders;
CREATE POLICY orders_buyer_update
  ON public.orders FOR UPDATE
  USING (buyer_id = (select auth.uid()))
  WITH CHECK (buyer_id = (select auth.uid()));

DROP POLICY IF EXISTS seller_wallets_select_own ON public.seller_wallets;
CREATE POLICY seller_wallets_select_own
  ON public.seller_wallets
  FOR SELECT
  TO authenticated
  USING (seller_id = (select auth.uid()));

DROP POLICY IF EXISTS seller_wallet_tx_select_own ON public.seller_wallet_transactions;
CREATE POLICY seller_wallet_tx_select_own
  ON public.seller_wallet_transactions
  FOR SELECT
  TO authenticated
  USING (seller_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Drop stale duplicate public-read policies when older/manual policy names
--    are still present in the database. Current canonical policies are:
--      - follows_public_select
--      - users_public_select
--      - product_media_public_select
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read follows" ON public.follows;
DROP POLICY IF EXISTS "Anyone can read public profiles" ON public.users;
DROP POLICY IF EXISTS "public read product_media" ON public.product_media;

-- ---------------------------------------------------------------------------
-- 4. Missing foreign-key indexes flagged by the linter
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_disputes_resolved_by
  ON public.disputes (resolved_by);

CREATE INDEX IF NOT EXISTS idx_products_moderated_by
  ON public.products (moderated_by);

CREATE INDEX IF NOT EXISTS idx_reports_resolved_by
  ON public.reports (resolved_by);

CREATE INDEX IF NOT EXISTS idx_users_banned_by
  ON public.users (banned_by);

-- ---------------------------------------------------------------------------
-- 5. Safe duplicate-index cleanup
--    users.nrp already has a unique constraint-backed index (`users_nrp_key`),
--    so the standalone idx_users_nrp is redundant.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_users_nrp;
