-- =============================================================================
-- Migration — Biteship shipping integration columns
-- VivaThrift · 2026-04-09
-- =============================================================================
-- Adds:
--   1. biteship_order_id  — Biteship order ID (used for tracking lookup)
--   2. biteship_waybill_id — Biteship waybill/resi number
--   3. courier_service    — Courier service code e.g. "reg", "ctc", "yes"
--                           (stored at checkout alongside courier_code)
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS biteship_order_id   TEXT,
  ADD COLUMN IF NOT EXISTS biteship_waybill_id TEXT,
  ADD COLUMN IF NOT EXISTS courier_service     TEXT;

COMMENT ON COLUMN public.orders.biteship_order_id   IS 'Biteship order ID for tracking retrieval via GET /v1/orders/:id';
COMMENT ON COLUMN public.orders.biteship_waybill_id IS 'Courier waybill / resi number from Biteship';
COMMENT ON COLUMN public.orders.courier_service     IS 'Courier service code e.g. reg, ctc, yes (from Biteship pricing.courier_service_code)';

-- Index for future tracking lookups
CREATE INDEX IF NOT EXISTS idx_orders_biteship_order_id
  ON public.orders (biteship_order_id)
  WHERE biteship_order_id IS NOT NULL;
