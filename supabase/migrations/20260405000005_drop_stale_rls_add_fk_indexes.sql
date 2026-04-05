-- ============================================================
-- Migration 005: Drop stale RLS policies (wrong names from
-- migration 003 that were NOT dropped by migration 004) and
-- add missing foreign-key indexes flagged by performance advisor.
-- All replacement policies with (select auth.uid()) are already
-- live from migration 004.
-- ============================================================

-- ── addresses ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own addresses"         ON addresses;

-- ── users ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update own profile"           ON users;
DROP POLICY IF EXISTS "Users can insert own profile"           ON users;
DROP POLICY IF EXISTS "users_update_last_seen"                 ON users;

-- ── user_settings ─────────────────────────────────────────────
DROP POLICY IF EXISTS "user_settings_select_own"               ON user_settings;
DROP POLICY IF EXISTS "user_settings_insert_own"               ON user_settings;
DROP POLICY IF EXISTS "user_settings_update_own"               ON user_settings;

-- ── offers ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "offers_select_participant"              ON offers;
DROP POLICY IF EXISTS "offers_insert_buyer"                    ON offers;
DROP POLICY IF EXISTS "offers_update_seller"                   ON offers;
DROP POLICY IF EXISTS "offers_update_buyer_expire"             ON offers;

-- ── chats ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chats_select_participant"               ON chats;
DROP POLICY IF EXISTS "chats_insert_buyer"                     ON chats;

-- ── messages ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_select_participant"            ON messages;
DROP POLICY IF EXISTS "messages_insert_participant"            ON messages;
DROP POLICY IF EXISTS "Users can update own messages"          ON messages;
DROP POLICY IF EXISTS "messages_update_is_read"                ON messages;

-- ── follows ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can follow others"                ON follows;
DROP POLICY IF EXISTS "Users can unfollow"                     ON follows;

-- ── notifications ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own notifications"       ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications"     ON notifications;

-- ── carts ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own cart"          ON carts;
DROP POLICY IF EXISTS "Users can insert their own cart"        ON carts;
DROP POLICY IF EXISTS "Users can update their own cart"        ON carts;
DROP POLICY IF EXISTS "Users can delete their own cart"        ON carts;

-- ── cart_items ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own cart items"    ON cart_items;
DROP POLICY IF EXISTS "Users can insert into their own cart"   ON cart_items;
DROP POLICY IF EXISTS "Users can update their own cart items"  ON cart_items;
DROP POLICY IF EXISTS "Users can delete their own cart items"  ON cart_items;

-- ── wishlists ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own wishlists"         ON wishlists;
DROP POLICY IF EXISTS "Users can insert into their own wishlists"  ON wishlists;
DROP POLICY IF EXISTS "Users can delete their own wishlists"       ON wishlists;

-- ============================================================
-- Add missing FK covering indexes (flagged as unindexed FKs)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_actor_id
  ON notifications (actor_id);

CREATE INDEX IF NOT EXISTS idx_notifications_product_id
  ON notifications (product_id);

CREATE INDEX IF NOT EXISTS idx_orders_shipping_address_id
  ON orders (shipping_address_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id
  ON reports (reporter_id);
