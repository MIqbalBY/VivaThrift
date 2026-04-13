-- =============================================================================
-- Migration 20260413000013 — Advisors phase 2 (RLS consolidation + duplicate indexes)
-- VivaThrift · 2026-04-13
-- =============================================================================
-- Goal:
--   1) Eliminate multiple_permissive_policies warnings by consolidating
--      table/action policies to a single policy per action.
--   2) Eliminate duplicate_index warnings by dropping redundant indexes and
--      duplicate unique constraints that produce identical backing indexes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Consolidate permissive RLS policies
-- ---------------------------------------------------------------------------

-- disputes: SELECT and UPDATE currently split by actor role (admin/buyer/seller)
DROP POLICY IF EXISTS disputes_admin_select ON public.disputes;
DROP POLICY IF EXISTS disputes_buyer_select ON public.disputes;
DROP POLICY IF EXISTS disputes_seller_select ON public.disputes;

CREATE POLICY disputes_select_participant
  ON public.disputes
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR buyer_id = (select auth.uid())
    OR seller_id = (select auth.uid())
  );

DROP POLICY IF EXISTS disputes_admin_update ON public.disputes;
DROP POLICY IF EXISTS disputes_buyer_cancel ON public.disputes;

CREATE POLICY disputes_update_participant
  ON public.disputes
  FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR (buyer_id = (select auth.uid()) AND status = 'open')
  )
  WITH CHECK (
    is_admin()
    OR (buyer_id = (select auth.uid()) AND status = 'cancelled')
  );

-- offers: SELECT and UPDATE currently split by buyer/seller
DROP POLICY IF EXISTS offers_buyer_select ON public.offers;
DROP POLICY IF EXISTS offers_seller_select ON public.offers;

CREATE POLICY offers_select_participant
  ON public.offers
  FOR SELECT
  TO authenticated
  USING (
    buyer_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = offers.product_id
        AND p.seller_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS offers_buyer_cancel ON public.offers;
DROP POLICY IF EXISTS offers_seller_respond ON public.offers;

CREATE POLICY offers_update_participant
  ON public.offers
  FOR UPDATE
  TO authenticated
  USING (
    (
      buyer_id = (select auth.uid())
      AND status = 'pending'
    )
    OR (
      status = 'pending'
      AND EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.id = offers.product_id
          AND p.seller_id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    (
      buyer_id = (select auth.uid())
      AND status IN ('cancelled', 'superseded')
    )
    OR (
      status IN ('accepted', 'rejected')
      AND EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.id = offers.product_id
          AND p.seller_id = (select auth.uid())
      )
    )
  );

-- orders: UPDATE currently split into buyer_cancel + buyer_update + seller_update
DROP POLICY IF EXISTS orders_buyer_cancel ON public.orders;
DROP POLICY IF EXISTS orders_buyer_update ON public.orders;
DROP POLICY IF EXISTS orders_seller_update ON public.orders;

CREATE POLICY orders_update_participant
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    buyer_id = (select auth.uid())
    OR seller_id = (select auth.uid())
  )
  WITH CHECK (
    buyer_id = (select auth.uid())
    OR seller_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- B) Remove duplicate indexes/constraints
-- ---------------------------------------------------------------------------

-- cart_items duplicates
DROP INDEX IF EXISTS public.idx_cart_items_cart_id;
DROP INDEX IF EXISTS public.idx_cart_items_product_id;
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_unique;

-- notifications duplicates
DROP INDEX IF EXISTS public.idx_notifications_user_id;

-- wishlists duplicates
DROP INDEX IF EXISTS public.idx_wishlists_product_id;
DROP INDEX IF EXISTS public.idx_wishlists_user_id;
ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_unique;
