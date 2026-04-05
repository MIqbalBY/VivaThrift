-- =============================================================================
-- Migration 004 — RLS auth.uid() Performance Fix + Stored FTS Column
-- VivaThrift · 2026-04-05
-- =============================================================================
-- PROBLEM 1: auth.uid() called per-row in RLS policies
--   PostgreSQL evaluates USING/WITH CHECK expressions per row.
--   Each bare auth.uid() call hits the auth subsystem for EVERY scanned row.
--   On a table with 100k rows, that means 100k auth.uid() invocations.
--
-- FIX: Wrap all auth.uid() calls in (select auth.uid()) — the planner hoists
--   the sub-select into an InitPlan, evaluating it exactly ONCE per query.
--   This can be 100x+ faster on large tables.
--   Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- PROBLEM 2: Full-text search using .ilike('%term%') — can't use any index,
--   forces full table scan. 100x slower than FTS on large tables.
--
-- FIX: Add stored generated tsvector column + GIN index for true FTS.
--   The stored column is maintained automatically on INSERT/UPDATE.
--   .textSearch('search_vector', query, { type: 'websearch', config: 'indonesian' })
-- =============================================================================

-- =============================================================================
-- PART A: Stored tsvector column for Full-Text Search
-- =============================================================================

-- Drop old functional GIN index (cannot index text columns, only tsvector)
DROP INDEX IF EXISTS idx_products_title_fts;

-- Add stored generated tsvector column (maintained automatically by Postgres)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'indonesian',
      coalesce(title, '') || ' ' || coalesce(description, '')
    )
  ) STORED;

-- GIN index on the stored column — used by to_tsquery / websearch_to_tsquery
CREATE INDEX IF NOT EXISTS idx_products_search_vector
  ON products USING gin(search_vector);

-- Backfill comment: generated columns auto-populate on ADD COLUMN; no backfill needed.

-- =============================================================================
-- PART B: Update helper functions to use (select auth.uid())
-- =============================================================================

-- is_order_participant — hoists auth.uid() out of per-row loop
CREATE OR REPLACE FUNCTION is_order_participant(p_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_order_id
      AND (buyer_id  = (select auth.uid())
        OR seller_id = (select auth.uid()))
  );
$$;

-- is_chat_participant — hoists auth.uid() out of per-row loop
CREATE OR REPLACE FUNCTION is_chat_participant(p_chat_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM chats
    WHERE id = p_chat_id
      AND (buyer_id  = (select auth.uid())
        OR seller_id = (select auth.uid()))
  );
$$;

-- =============================================================================
-- PART C: Re-create ALL RLS policies with (select auth.uid()) wrapper
--   Policies are DROPPED then RECREATED — safe to run multiple times.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_public_select ON users;
DROP POLICY IF EXISTS users_owner_update  ON users;

CREATE POLICY users_public_select
  ON users FOR SELECT
  USING (true);

CREATE POLICY users_owner_update
  ON users FOR UPDATE
  USING    (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: user_settings
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_settings_owner_all ON user_settings;

CREATE POLICY user_settings_owner_all
  ON user_settings FOR ALL
  USING    (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: addresses
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS addresses_owner_all ON addresses;

CREATE POLICY addresses_owner_all
  ON addresses FOR ALL
  USING    (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: categories  (public read-only — no auth.uid() needed)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS categories_public_select ON categories;

CREATE POLICY categories_public_select
  ON categories FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- TABLE: products
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS products_public_select ON products;
DROP POLICY IF EXISTS products_seller_select ON products;
DROP POLICY IF EXISTS products_seller_insert ON products;
DROP POLICY IF EXISTS products_seller_update ON products;
DROP POLICY IF EXISTS products_seller_delete ON products;

CREATE POLICY products_public_select
  ON products FOR SELECT
  USING (status = 'active' OR seller_id = (select auth.uid()));

CREATE POLICY products_seller_insert
  ON products FOR INSERT
  WITH CHECK (seller_id = (select auth.uid()));

CREATE POLICY products_seller_update
  ON products FOR UPDATE
  USING    (seller_id = (select auth.uid()))
  WITH CHECK (seller_id = (select auth.uid()));

CREATE POLICY products_seller_delete
  ON products FOR DELETE
  USING (seller_id = (select auth.uid()) AND status = 'draft');

-- ---------------------------------------------------------------------------
-- TABLE: product_media
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS product_media_public_select ON product_media;
DROP POLICY IF EXISTS product_media_seller_insert ON product_media;
DROP POLICY IF EXISTS product_media_seller_update ON product_media;
DROP POLICY IF EXISTS product_media_seller_delete ON product_media;

CREATE POLICY product_media_public_select
  ON product_media FOR SELECT
  USING (true);

CREATE POLICY product_media_seller_insert
  ON product_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = (select auth.uid())
    )
  );

CREATE POLICY product_media_seller_update
  ON product_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = (select auth.uid())
    )
  );

CREATE POLICY product_media_seller_delete
  ON product_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- TABLE: chats
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS chats_participant_select ON chats;
DROP POLICY IF EXISTS chats_buyer_insert       ON chats;
DROP POLICY IF EXISTS chats_participant_update ON chats;

CREATE POLICY chats_participant_select
  ON chats FOR SELECT
  USING (buyer_id = (select auth.uid()) OR seller_id = (select auth.uid()));

CREATE POLICY chats_buyer_insert
  ON chats FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY chats_participant_update
  ON chats FOR UPDATE
  USING (buyer_id = (select auth.uid()) OR seller_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: messages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS messages_participant_select ON messages;
DROP POLICY IF EXISTS messages_sender_insert      ON messages;
DROP POLICY IF EXISTS messages_sender_update      ON messages;

CREATE POLICY messages_participant_select
  ON messages FOR SELECT
  USING (is_chat_participant(chat_id));

CREATE POLICY messages_sender_insert
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = (select auth.uid())
    AND is_chat_participant(chat_id)
  );

CREATE POLICY messages_sender_update
  ON messages FOR UPDATE
  USING (
    sender_id = (select auth.uid())
    OR is_chat_participant(chat_id)
  );

-- ---------------------------------------------------------------------------
-- TABLE: offers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS offers_buyer_select   ON offers;
DROP POLICY IF EXISTS offers_seller_select  ON offers;
DROP POLICY IF EXISTS offers_buyer_insert   ON offers;
DROP POLICY IF EXISTS offers_buyer_cancel   ON offers;
DROP POLICY IF EXISTS offers_seller_respond ON offers;

CREATE POLICY offers_buyer_select
  ON offers FOR SELECT
  USING (buyer_id = (select auth.uid()));

CREATE POLICY offers_seller_select
  ON offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = offers.product_id AND seller_id = (select auth.uid())
    )
  );

CREATE POLICY offers_buyer_insert
  ON offers FOR INSERT
  WITH CHECK (
    buyer_id = (select auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = (select auth.uid())
    )
  );

CREATE POLICY offers_buyer_cancel
  ON offers FOR UPDATE
  USING    (buyer_id = (select auth.uid()) AND status = 'pending')
  WITH CHECK (
    buyer_id = (select auth.uid())
    AND status IN ('cancelled', 'superseded')
  );

CREATE POLICY offers_seller_respond
  ON offers FOR UPDATE
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM products
      WHERE id = offers.product_id AND seller_id = (select auth.uid())
    )
  )
  WITH CHECK (status IN ('accepted', 'rejected'));

-- ---------------------------------------------------------------------------
-- TABLE: orders
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_participant_select ON orders;
DROP POLICY IF EXISTS orders_buyer_insert       ON orders;
DROP POLICY IF EXISTS orders_seller_update      ON orders;
DROP POLICY IF EXISTS orders_buyer_cancel       ON orders;

CREATE POLICY orders_participant_select
  ON orders FOR SELECT
  USING (buyer_id = (select auth.uid()) OR seller_id = (select auth.uid()));

CREATE POLICY orders_buyer_insert
  ON orders FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY orders_seller_update
  ON orders FOR UPDATE
  USING    (seller_id = (select auth.uid()))
  WITH CHECK (seller_id = (select auth.uid()));

CREATE POLICY orders_buyer_cancel
  ON orders FOR UPDATE
  USING (
    buyer_id = (select auth.uid())
    AND status = 'pending_payment'
  )
  WITH CHECK (status = 'cancelled');

-- ---------------------------------------------------------------------------
-- TABLE: order_items  (service role for writes; SELECT via helper)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS order_items_participant_select ON order_items;

CREATE POLICY order_items_participant_select
  ON order_items FOR SELECT
  USING (is_order_participant(order_id));

-- ---------------------------------------------------------------------------
-- TABLE: payments  (service role for writes; SELECT via helper)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_participant_select ON payments;

CREATE POLICY payments_participant_select
  ON payments FOR SELECT
  USING (is_order_participant(order_id));

-- ---------------------------------------------------------------------------
-- TABLE: notifications
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS notifications_recipient_select ON notifications;
DROP POLICY IF EXISTS notifications_recipient_update ON notifications;

CREATE POLICY notifications_recipient_select
  ON notifications FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY notifications_recipient_update
  ON notifications FOR UPDATE
  USING    (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: reviews
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS reviews_public_select   ON reviews;
DROP POLICY IF EXISTS reviews_buyer_insert    ON reviews;
DROP POLICY IF EXISTS reviews_reviewer_update ON reviews;

CREATE POLICY reviews_public_select
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY reviews_buyer_insert
  ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE id = reviews.order_id
        AND buyer_id = (select auth.uid())
        AND status = 'completed'
    )
  );

CREATE POLICY reviews_reviewer_update
  ON reviews FOR UPDATE
  USING    (reviewer_id = (select auth.uid()))
  WITH CHECK (reviewer_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: wishlists
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS wishlists_owner_all ON wishlists;

CREATE POLICY wishlists_owner_all
  ON wishlists FOR ALL
  USING    (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: carts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS carts_owner_all ON carts;

CREATE POLICY carts_owner_all
  ON carts FOR ALL
  USING    (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: cart_items
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS cart_items_owner_all ON cart_items;

CREATE POLICY cart_items_owner_all
  ON cart_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE id = cart_id AND user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE id = cart_id AND user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- TABLE: follows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS follows_public_select ON follows;
DROP POLICY IF EXISTS follows_owner_insert  ON follows;
DROP POLICY IF EXISTS follows_owner_delete  ON follows;

CREATE POLICY follows_public_select
  ON follows FOR SELECT
  USING (true);

CREATE POLICY follows_owner_insert
  ON follows FOR INSERT
  WITH CHECK (follower_id = (select auth.uid()));

CREATE POLICY follows_owner_delete
  ON follows FOR DELETE
  USING (follower_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- TABLE: reports
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS reports_reporter_select ON reports;
DROP POLICY IF EXISTS reports_auth_insert     ON reports;

CREATE POLICY reports_reporter_select
  ON reports FOR SELECT
  USING (reporter_id = (select auth.uid()));

CREATE POLICY reports_auth_insert
  ON reports FOR INSERT
  WITH CHECK (
    reporter_id = (select auth.uid())
    AND reported_user_id IS DISTINCT FROM (select auth.uid())
  );

-- =============================================================================
-- END OF MIGRATION 004
-- =============================================================================
