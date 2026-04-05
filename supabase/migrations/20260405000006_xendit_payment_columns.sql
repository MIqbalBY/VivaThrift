-- =============================================================================
-- Migration 006 — Xendit Payment Gateway Columns
-- VivaThrift · 2026-04-05
-- =============================================================================
-- Adds Xendit-specific columns to the orders table to support the payment
-- gateway flow: Invoice creation → redirect → webhook confirmation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add Xendit columns to orders
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS xendit_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_url       TEXT,
  ADD COLUMN IF NOT EXISTS payment_method    TEXT;

-- ---------------------------------------------------------------------------
-- 2. Unique partial index on xendit_invoice_id
--    Ensures no two orders share the same Xendit invoice.
--    Partial (WHERE NOT NULL) so NULL rows don't conflict.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_xendit_invoice_id
  ON orders (xendit_invoice_id)
  WHERE xendit_invoice_id IS NOT NULL;
