-- =============================================================================
-- Migration 007 — Orders: Tracking, Fulfillment & Seller Disbursement
-- VivaThrift · 2026-04-07
-- =============================================================================
-- Adds:
--   1. Fulfillment columns to orders (tracking_number, courier_name, timestamps)
--   2. Xendit disbursement tracking column on orders
--   3. Bank account columns to users (for seller disbursement via Xendit)
--   4. RLS policy: seller can update order (ship action)
--   5. RLS policy: buyer can update order (complete action)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fulfillment columns on orders
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_number  TEXT,
  ADD COLUMN IF NOT EXISTS courier_name     TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbursement_id  TEXT;

-- ---------------------------------------------------------------------------
-- 2. Bank account columns on users (needed for Xendit disbursement to sellers)
--    bank_code: Xendit bank code, e.g. "BCA", "MANDIRI", "BNI", "BRI"
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_code            TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number  TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name    TEXT;

-- ---------------------------------------------------------------------------
-- 3. Partial unique index on disbursement_id (no two orders share same disbursal)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_disbursement_id
  ON orders (disbursement_id)
  WHERE disbursement_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. RLS: seller can update their own order (ship action: confirmed → shipped)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_seller_update ON orders;
CREATE POLICY orders_seller_update
  ON orders FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. RLS: buyer can update their own order (complete action: shipped → completed)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_buyer_update ON orders;
CREATE POLICY orders_buyer_update
  ON orders FOR UPDATE
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Index on orders(buyer_id, status) and orders(seller_id, status)
--    for fast tab-based queries on /orders page
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status
  ON orders (buyer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_seller_status
  ON orders (seller_id, status, created_at DESC);
