-- ============================================================================
-- Migration 012: Shipping & COD Tracking
-- Adds shipping_method flow, meetup OTP, shipping cost, and awaiting_meetup status.
-- ============================================================================

-- ── 1. Add new columns to orders ──────────────────────────────────────────────

-- meetup_location: campus meetup point selected at checkout (COD only)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS meetup_location text;

-- meetup_otp: 6-digit numeric OTP for physical handover verification (COD only)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS meetup_otp text;

-- shipping_cost: ongkir amount from Biteship (shipping only), defaults to 0
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;

-- meetup_confirmed_at: timestamp when seller confirmed meetup via OTP
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS meetup_confirmed_at timestamptz;

-- courier_code: machine-readable courier code for shipping (e.g. 'jne', 'jnt')
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_code text;

-- ── 2. Update status CHECK constraint to include awaiting_meetup ─────────────

-- Drop existing constraint if any, then re-add with new status
DO $$
BEGIN
  -- Try dropping existing constraint names (varies by migration history)
  BEGIN ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_status; EXCEPTION WHEN OTHERS THEN NULL; END;

  ALTER TABLE public.orders ADD CONSTRAINT chk_orders_status CHECK (
    status IN (
      'pending_payment', 'confirmed', 'shipped', 'completed',
      'cancelled', 'payment_failed', 'disputed',
      'resolved_refund', 'resolved_release',
      'awaiting_meetup'
    )
  );
END $$;

-- ── 3. Add CHECK constraint for shipping_method ──────────────────────────────

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_orders_shipping_method;

ALTER TABLE public.orders ADD CONSTRAINT chk_orders_shipping_method CHECK (
  shipping_method IS NULL OR shipping_method IN ('cod', 'shipping')
);

-- ── 4. Add partial indexes for new queries ───────────────────────────────────

-- Fast lookup of orders awaiting meetup
CREATE INDEX IF NOT EXISTS idx_orders_awaiting_meetup
  ON public.orders (seller_id, created_at DESC)
  WHERE status = 'awaiting_meetup';

-- ── 5. Grant access via existing RLS (no new policies needed) ────────────────
-- The existing orders RLS policies allow:
--   - buyer_id = auth.uid() → SELECT
--   - seller_id = auth.uid() → SELECT + UPDATE (tracking, status)
-- These cover the new columns (meetup_location, meetup_otp, shipping_cost, etc.)
-- since they are on the same orders table.

COMMENT ON COLUMN public.orders.meetup_location IS 'Campus meetup point for COD orders';
COMMENT ON COLUMN public.orders.meetup_otp IS '6-digit OTP for meetup handover verification';
COMMENT ON COLUMN public.orders.shipping_cost IS 'Shipping cost (ongkir) from courier API';
COMMENT ON COLUMN public.orders.meetup_confirmed_at IS 'Timestamp when seller confirmed meetup via OTP';
COMMENT ON COLUMN public.orders.courier_code IS 'Machine-readable courier code, e.g. jne, jnt';
