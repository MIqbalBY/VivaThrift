-- =============================================================================
-- Migration: Fix disputes RLS policies
-- VivaThrift · 2026-04-10
-- =============================================================================
-- Audit findings:
--   1. disputes uses bare auth.uid() — should use (select auth.uid()) for perf
--   2. Missing buyer UPDATE policy — buyer can't cancel own open dispute
--   3. Missing admin/moderator SELECT policy — admin can't query via client
-- =============================================================================

-- ── Drop existing policies ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Buyers view own disputes"    ON public.disputes;
DROP POLICY IF EXISTS "Sellers view order disputes"  ON public.disputes;
DROP POLICY IF EXISTS "Buyers create disputes"       ON public.disputes;

-- ── Recreate with (select auth.uid()) wrapper ───────────────────────────────

-- Buyers can view their own disputes
CREATE POLICY disputes_buyer_select
  ON public.disputes FOR SELECT
  USING (buyer_id = (select auth.uid()));

-- Sellers can view disputes on their orders
CREATE POLICY disputes_seller_select
  ON public.disputes FOR SELECT
  USING (seller_id = (select auth.uid()));

-- Admin/moderator can view all disputes
CREATE POLICY disputes_admin_select
  ON public.disputes FOR SELECT
  USING (is_admin());

-- Buyers can create disputes (must be the buyer)
CREATE POLICY disputes_buyer_insert
  ON public.disputes FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

-- Buyers can cancel their own open disputes
CREATE POLICY disputes_buyer_cancel
  ON public.disputes FOR UPDATE
  USING (
    buyer_id = (select auth.uid())
    AND status = 'open'
  )
  WITH CHECK (status = 'cancelled');

-- Admin/moderator can update any dispute (resolve, review, etc.)
CREATE POLICY disputes_admin_update
  ON public.disputes FOR UPDATE
  USING (is_admin());
