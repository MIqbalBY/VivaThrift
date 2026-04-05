-- =============================================================================
-- Migration 001 — Schema Constraints & Data Integrity
-- VivaThrift · 2026-04-05
-- =============================================================================
-- Fixes:
--   1. Drop redundant order_items.unit_price (keep price_at_time)
--   2. Make critical FK columns NOT NULL
--   3. Add CHECK constraints on all status/condition/rating columns
--   4. Add UNIQUE constraints to prevent duplicates
--   5. Add missing updated_at columns + auto-update trigger
--   6. Fix lat/lng precision (FLOAT → NUMERIC)
--   7. Add positive-value guards on monetary/quantity columns
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Reusable updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Drop redundant column: order_items.unit_price
--    Canonical column is price_at_time (used by all server routes).
--    SAFETY: run this only after confirming unit_price is NULLable / unused.
--    If column is already absent, this is a no-op.
-- ---------------------------------------------------------------------------
ALTER TABLE order_items DROP COLUMN IF EXISTS unit_price;

-- ---------------------------------------------------------------------------
-- 2. NOT NULL constraints on critical FK columns
--    SAFETY: only applies if existing rows already have values.
--    If migration fails, backfill NULLs first in Supabase SQL editor.
-- ---------------------------------------------------------------------------

-- chats — a chat without buyer, seller, or product is orphaned
ALTER TABLE chats
  ALTER COLUMN buyer_id   SET NOT NULL,
  ALTER COLUMN seller_id  SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL;

-- messages — a message without a chat or sender is corrupt data
ALTER TABLE messages
  ALTER COLUMN chat_id   SET NOT NULL,
  ALTER COLUMN sender_id SET NOT NULL;

-- offers — core transaction entity; all principals required
ALTER TABLE offers
  ALTER COLUMN buyer_id   SET NOT NULL,
  ALTER COLUMN chat_id    SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL;

-- orders — both parties required at insert time
ALTER TABLE orders
  ALTER COLUMN buyer_id  SET NOT NULL,
  ALTER COLUMN seller_id SET NOT NULL;

-- order_items — must belong to an order and a product
ALTER TABLE order_items
  ALTER COLUMN order_id   SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN quantity   SET NOT NULL;

-- products — every product must have a seller
ALTER TABLE products
  ALTER COLUMN seller_id SET NOT NULL;

-- product_media — media must belong to a product
ALTER TABLE product_media
  ALTER COLUMN product_id SET NOT NULL;

-- reviews — all parties required
ALTER TABLE reviews
  ALTER COLUMN reviewer_id  SET NOT NULL,
  ALTER COLUMN reviewee_id  SET NOT NULL,
  ALTER COLUMN order_id     SET NOT NULL,
  ALTER COLUMN product_id   SET NOT NULL;

-- payments — must belong to an order
ALTER TABLE payments
  ALTER COLUMN order_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints — status columns
-- ---------------------------------------------------------------------------

-- offers.status
ALTER TABLE offers
  ADD CONSTRAINT offers_status_check
  CHECK (status IN (
    'pending', 'accepted', 'rejected', 'expired',
    'superseded', 'completed', 'cancelled', 'expired_checkout'
  ));

-- orders.status
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending_payment', 'confirmed', 'shipped',
    'completed', 'cancelled', 'payment_failed', 'disputed'
  ));

-- products.status
ALTER TABLE products
  ADD CONSTRAINT products_status_check
  CHECK (status IN (
    'draft', 'active', 'inactive', 'sold', 'moderated', 'banned'
  ));

-- products.condition (Indonesian values matching frontend CONDITIONS constant)
ALTER TABLE products
  ADD CONSTRAINT products_condition_check
  CHECK (condition IN ('Baru', 'Seperti Baru', 'Baik', 'Cukup Baik', 'Bekas'));

-- payments.status
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'refunded'));

-- reports.status
ALTER TABLE reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed'));

-- ---------------------------------------------------------------------------
-- 4. CHECK constraints — ratings (must be 1–5)
-- ---------------------------------------------------------------------------
ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_product_check
  CHECK (rating_product IS NULL OR (rating_product >= 1 AND rating_product <= 5)),
  ADD CONSTRAINT reviews_rating_seller_check
  CHECK (rating_seller IS NULL OR (rating_seller >= 1 AND rating_seller <= 5));

-- ---------------------------------------------------------------------------
-- 5. CHECK constraints — positive monetary & quantity values
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD CONSTRAINT products_price_positive    CHECK (price > 0),
  ADD CONSTRAINT products_stock_nonneg      CHECK (stock IS NULL OR stock >= 0);

ALTER TABLE offers
  ADD CONSTRAINT offers_price_positive      CHECK (offered_price > 0),
  ADD CONSTRAINT offers_quantity_positive   CHECK (quantity > 0);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_quantity_pos   CHECK (quantity > 0),
  ADD CONSTRAINT order_items_price_pos      CHECK (price_at_time > 0);

ALTER TABLE orders
  ADD CONSTRAINT orders_amount_positive     CHECK (total_amount > 0);

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive   CHECK (amount > 0);

-- ---------------------------------------------------------------------------
-- 6. UNIQUE constraints — prevent duplicate rows
-- ---------------------------------------------------------------------------

-- One chat thread per (buyer, seller, product) triplet
ALTER TABLE chats
  ADD CONSTRAINT chats_unique_thread
  UNIQUE (buyer_id, seller_id, product_id);

-- A user can follow another user only once
ALTER TABLE follows
  ADD CONSTRAINT follows_unique
  UNIQUE (follower_id, following_id);

-- A user cannot self-follow
ALTER TABLE follows
  ADD CONSTRAINT follows_no_self
  CHECK (follower_id <> following_id);

-- A product can only be wishlisted once per user
ALTER TABLE wishlists
  ADD CONSTRAINT wishlists_unique
  UNIQUE (user_id, product_id);

-- A product can only appear once per cart
ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_unique
  UNIQUE (cart_id, product_id);

-- One review per reviewer per order
ALTER TABLE reviews
  ADD CONSTRAINT reviews_unique_per_order
  UNIQUE (reviewer_id, order_id);

-- ---------------------------------------------------------------------------
-- 7. Fix lat/lng column type for precision
--    addresses.lat and addresses.lng stored as FLOAT → NUMERIC(10,7)
--    Silently skips if columns are already NUMERIC.
-- ---------------------------------------------------------------------------
ALTER TABLE addresses
  ALTER COLUMN lat TYPE NUMERIC(10, 7) USING lat::NUMERIC(10, 7),
  ALTER COLUMN lng TYPE NUMERIC(10, 7) USING lng::NUMERIC(10, 7);

-- ---------------------------------------------------------------------------
-- 8. Missing updated_at columns
--    Add to tables that need mutation tracking.
-- ---------------------------------------------------------------------------

-- orders — needs status progression tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- messages — needs edit tracking (edited_at already exists for content edits;
--             updated_at is for row-level tracking in RLS/audit)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- chats — needs last_activity tracking
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- reviews — allow reviewer edits
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- 9. Auto-update triggers for updated_at columns
-- ---------------------------------------------------------------------------

-- offers (already has updated_at; add trigger if not present)
DROP TRIGGER IF EXISTS set_updated_at_offers ON offers;
CREATE TRIGGER set_updated_at_offers
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- orders
DROP TRIGGER IF EXISTS set_updated_at_orders ON orders;
CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- products (likely already has updated_at; ensure trigger exists)
DROP TRIGGER IF EXISTS set_updated_at_products ON products;
CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- messages
DROP TRIGGER IF EXISTS set_updated_at_messages ON messages;
CREATE TRIGGER set_updated_at_messages
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- chats
DROP TRIGGER IF EXISTS set_updated_at_chats ON chats;
CREATE TRIGGER set_updated_at_chats
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- reviews
DROP TRIGGER IF EXISTS set_updated_at_reviews ON reviews;
CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- user_settings
DROP TRIGGER IF EXISTS set_updated_at_user_settings ON user_settings;
CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
