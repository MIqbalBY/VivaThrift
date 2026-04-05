-- =============================================================================
-- Migration 003 — Row Level Security Policies
-- VivaThrift · 2026-04-05
-- =============================================================================
-- Architecture rules:
--   • Default DENY — RLS enabled on ALL tables, no policy = no access
--   • auth.uid() is the identity anchor for all ownership checks
--   • service_role bypasses RLS automatically (used in supabase-admin.ts)
--   • anon role gets only public SELECT on public-facing tables
--   • Bilateral access (buyer OR seller) uses OR conditions — index on both FKs
--
-- Policy naming: <table>_<role>_<operation>
--   e.g. products_public_select, orders_buyer_select, offers_seller_update
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENABLE RLS ON ALL TABLES (default DENY)
-- ---------------------------------------------------------------------------
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- HELPER: check if a user is a participant of an order
--   Used for orders/order_items/payments access
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_order_participant(p_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_order_id
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- HELPER: check if a user is a participant of a chat
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_chat_participant(p_chat_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM chats
    WHERE id = p_chat_id
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  );
$$;

-- =============================================================================
-- TABLE: users
-- Public fields visible to all (profiles are public).
-- Only owner can update their own profile.
-- Insert is handled by auth trigger (service role); blocked for clients.
-- =============================================================================
DROP POLICY IF EXISTS users_public_select   ON users;
DROP POLICY IF EXISTS users_owner_update    ON users;

CREATE POLICY users_public_select
  ON users FOR SELECT
  USING (true);

CREATE POLICY users_owner_update
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- TABLE: user_settings
-- Fully private — owner only.
-- =============================================================================
DROP POLICY IF EXISTS user_settings_owner_all ON user_settings;

CREATE POLICY user_settings_owner_all
  ON user_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- TABLE: addresses
-- Private — owner only. Shipping address referenced by orders uses service role.
-- =============================================================================
DROP POLICY IF EXISTS addresses_owner_all ON addresses;

CREATE POLICY addresses_owner_all
  ON addresses FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- TABLE: categories
-- Public read-only. No client mutations (admin manages via service role).
-- =============================================================================
DROP POLICY IF EXISTS categories_public_select ON categories;

CREATE POLICY categories_public_select
  ON categories FOR SELECT
  USING (true);

-- =============================================================================
-- TABLE: products
-- • Public SELECT: only active products visible to anonymous/non-owner
-- • Seller SELECT: owner sees all their own products (incl. draft/inactive)
-- • INSERT/UPDATE/DELETE: only the authenticated seller (owner)
-- =============================================================================
DROP POLICY IF EXISTS products_public_select  ON products;
DROP POLICY IF EXISTS products_seller_select  ON products;
DROP POLICY IF EXISTS products_seller_insert  ON products;
DROP POLICY IF EXISTS products_seller_update  ON products;
DROP POLICY IF EXISTS products_seller_delete  ON products;

-- Non-owners can only see active products
CREATE POLICY products_public_select
  ON products FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid());

-- Sellers can insert their own products
CREATE POLICY products_seller_insert
  ON products FOR INSERT
  WITH CHECK (seller_id = auth.uid());

-- Sellers can update their own products
CREATE POLICY products_seller_update
  ON products FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Sellers can delete only draft products (not sold/active listings with orders)
CREATE POLICY products_seller_delete
  ON products FOR DELETE
  USING (seller_id = auth.uid() AND status = 'draft');

-- =============================================================================
-- TABLE: product_media
-- • Public SELECT: anyone can view media for visible products
-- • INSERT/UPDATE/DELETE: only the seller who owns the product
-- =============================================================================
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
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY product_media_seller_update
  ON product_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY product_media_seller_delete
  ON product_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

-- =============================================================================
-- TABLE: chats
-- • SELECT: only participants (buyer OR seller)
-- • INSERT: authenticated buyer (buyer_id must equal auth.uid())
-- • UPDATE: participants (e.g., update updated_at via trigger)
-- =============================================================================
DROP POLICY IF EXISTS chats_participant_select ON chats;
DROP POLICY IF EXISTS chats_buyer_insert       ON chats;
DROP POLICY IF EXISTS chats_participant_update ON chats;

CREATE POLICY chats_participant_select
  ON chats FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY chats_buyer_insert
  ON chats FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY chats_participant_update
  ON chats FOR UPDATE
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- =============================================================================
-- TABLE: messages
-- • SELECT: chat participants only
-- • INSERT: chat participant AND sender_id = auth.uid()
-- • UPDATE: own messages only (edit) OR participant (for is_read flag)
-- • DELETE: not allowed (soft delete via is_deleted = true)
-- =============================================================================
DROP POLICY IF EXISTS messages_participant_select ON messages;
DROP POLICY IF EXISTS messages_sender_insert      ON messages;
DROP POLICY IF EXISTS messages_sender_update      ON messages;

CREATE POLICY messages_participant_select
  ON messages FOR SELECT
  USING (is_chat_participant(chat_id));

CREATE POLICY messages_sender_insert
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_chat_participant(chat_id)
  );

-- Sender can edit own message content; either participant can mark is_read
CREATE POLICY messages_sender_update
  ON messages FOR UPDATE
  USING (
    sender_id = auth.uid()
    OR is_chat_participant(chat_id)
  );

-- =============================================================================
-- TABLE: offers
-- • SELECT: buyer sees own offers; seller sees offers on their products
-- • INSERT: authenticated buyer (buyer_id = auth.uid(), not the product seller)
-- • UPDATE: seller can accept/reject; buyer can cancel own pending offer
-- =============================================================================
DROP POLICY IF EXISTS offers_buyer_select     ON offers;
DROP POLICY IF EXISTS offers_seller_select    ON offers;
DROP POLICY IF EXISTS offers_buyer_insert     ON offers;
DROP POLICY IF EXISTS offers_buyer_cancel     ON offers;
DROP POLICY IF EXISTS offers_seller_respond   ON offers;

-- Buyer can see their own offers
CREATE POLICY offers_buyer_select
  ON offers FOR SELECT
  USING (buyer_id = auth.uid());

-- Seller can see offers on their products
CREATE POLICY offers_seller_select
  ON offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = offers.product_id AND seller_id = auth.uid()
    )
  );

-- Buyer inserts offer; must not be the product seller
CREATE POLICY offers_buyer_insert
  ON offers FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

-- Buyer can cancel their own pending offers
CREATE POLICY offers_buyer_cancel
  ON offers FOR UPDATE
  USING (buyer_id = auth.uid() AND status = 'pending')
  WITH CHECK (
    buyer_id = auth.uid()
    AND status IN ('cancelled', 'superseded')
  );

-- Seller can accept/reject offers on their products
CREATE POLICY offers_seller_respond
  ON offers FOR UPDATE
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM products
      WHERE id = offers.product_id AND seller_id = auth.uid()
    )
  )
  WITH CHECK (status IN ('accepted', 'rejected'));

-- =============================================================================
-- TABLE: orders
-- • SELECT: buyer or seller of the order
-- • INSERT: buyer (via server route; buyer_id = auth.uid())
-- • UPDATE: seller (status updates) or buyer (cancellation)
-- =============================================================================
DROP POLICY IF EXISTS orders_participant_select ON orders;
DROP POLICY IF EXISTS orders_buyer_insert       ON orders;
DROP POLICY IF EXISTS orders_seller_update      ON orders;
DROP POLICY IF EXISTS orders_buyer_cancel       ON orders;

CREATE POLICY orders_participant_select
  ON orders FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY orders_buyer_insert
  ON orders FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

-- Seller can advance order status (confirmed → shipped → completed)
CREATE POLICY orders_seller_update
  ON orders FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Buyer can cancel pending_payment orders only
CREATE POLICY orders_buyer_cancel
  ON orders FOR UPDATE
  USING (
    buyer_id = auth.uid()
    AND status = 'pending_payment'
  )
  WITH CHECK (status = 'cancelled');

-- =============================================================================
-- TABLE: order_items
-- • SELECT: participant of the parent order
-- • INSERT/UPDATE/DELETE: service role only (server route creates items atomically)
-- =============================================================================
DROP POLICY IF EXISTS order_items_participant_select ON order_items;

CREATE POLICY order_items_participant_select
  ON order_items FOR SELECT
  USING (is_order_participant(order_id));

-- =============================================================================
-- TABLE: payments
-- • SELECT: participant of the parent order only
-- • INSERT/UPDATE: service role only (Xendit webhook handler via supabase-admin.ts)
-- =============================================================================
DROP POLICY IF EXISTS payments_participant_select ON payments;

CREATE POLICY payments_participant_select
  ON payments FOR SELECT
  USING (is_order_participant(order_id));

-- =============================================================================
-- TABLE: notifications
-- • SELECT: recipient only
-- • UPDATE: recipient can mark as read
-- • INSERT/DELETE: service role only
-- =============================================================================
DROP POLICY IF EXISTS notifications_recipient_select ON notifications;
DROP POLICY IF EXISTS notifications_recipient_update ON notifications;

CREATE POLICY notifications_recipient_select
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Recipient can only toggle is_read = true
CREATE POLICY notifications_recipient_update
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- TABLE: reviews
-- • SELECT: everyone (public ratings)
-- • INSERT: buyer must have a completed order for this product
-- • UPDATE: reviewer can edit their own review
-- =============================================================================
DROP POLICY IF EXISTS reviews_public_select   ON reviews;
DROP POLICY IF EXISTS reviews_buyer_insert    ON reviews;
DROP POLICY IF EXISTS reviews_reviewer_update ON reviews;

CREATE POLICY reviews_public_select
  ON reviews FOR SELECT
  USING (true);

-- Buyer can only review a product + seller if the order is completed
CREATE POLICY reviews_buyer_insert
  ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE id = reviews.order_id
        AND buyer_id = auth.uid()
        AND status = 'completed'
    )
  );

CREATE POLICY reviews_reviewer_update
  ON reviews FOR UPDATE
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- =============================================================================
-- TABLE: wishlists
-- • Owner only for all operations
-- =============================================================================
DROP POLICY IF EXISTS wishlists_owner_all ON wishlists;

CREATE POLICY wishlists_owner_all
  ON wishlists FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- TABLE: carts
-- • Owner only
-- =============================================================================
DROP POLICY IF EXISTS carts_owner_all ON carts;

CREATE POLICY carts_owner_all
  ON carts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- TABLE: cart_items
-- • Owner only (via their cart)
-- =============================================================================
DROP POLICY IF EXISTS cart_items_owner_all ON cart_items;

CREATE POLICY cart_items_owner_all
  ON cart_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE id = cart_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE id = cart_id AND user_id = auth.uid()
    )
  );

-- =============================================================================
-- TABLE: follows
-- • SELECT: public
-- • INSERT: authenticated, follower_id = auth.uid()
-- • DELETE: own follows only
-- =============================================================================
DROP POLICY IF EXISTS follows_public_select  ON follows;
DROP POLICY IF EXISTS follows_owner_insert   ON follows;
DROP POLICY IF EXISTS follows_owner_delete   ON follows;

CREATE POLICY follows_public_select
  ON follows FOR SELECT
  USING (true);

CREATE POLICY follows_owner_insert
  ON follows FOR INSERT
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY follows_owner_delete
  ON follows FOR DELETE
  USING (follower_id = auth.uid());

-- =============================================================================
-- TABLE: reports
-- • SELECT: own reports (as reporter) — service role sees all
-- • INSERT: any authenticated user
-- • UPDATE: service role only (status changes)
-- =============================================================================
DROP POLICY IF EXISTS reports_reporter_select ON reports;
DROP POLICY IF EXISTS reports_auth_insert     ON reports;

CREATE POLICY reports_reporter_select
  ON reports FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY reports_auth_insert
  ON reports FOR INSERT
  WITH CHECK (
    reporter_id = auth.uid()
    -- Cannot report yourself
    AND reported_user_id IS DISTINCT FROM auth.uid()
  );
