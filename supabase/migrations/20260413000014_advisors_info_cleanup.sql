-- =============================================================================
-- Migration 20260413000014 — Advisor info cleanup
-- VivaThrift · 2026-04-13
-- =============================================================================
-- Purpose:
--   1) Remove unused indexes flagged by advisor.
--   2) Recreate only required FK covering indexes.
--   3) Add explicit deny policy on disbursement_attempts to satisfy
--      rls_enabled_no_policy while keeping table inaccessible to clients.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Drop advisor-reported unused indexes
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public."cart_items_product_id_idx";
DROP INDEX IF EXISTS public."idx_addresses_user_id";
DROP INDEX IF EXISTS public."idx_chats_buyer_hidden";
DROP INDEX IF EXISTS public."idx_chats_buyer_id";
DROP INDEX IF EXISTS public."idx_chats_buyer_updated";
DROP INDEX IF EXISTS public."idx_chats_product_id";
DROP INDEX IF EXISTS public."idx_chats_seller_hidden";
DROP INDEX IF EXISTS public."idx_chats_seller_id";
DROP INDEX IF EXISTS public."idx_chats_seller_updated";
DROP INDEX IF EXISTS public."idx_disbursement_attempts_order";
DROP INDEX IF EXISTS public."idx_disbursement_attempts_retry";
DROP INDEX IF EXISTS public."idx_disputes_order_id";
DROP INDEX IF EXISTS public."idx_disputes_resolved_by";
DROP INDEX IF EXISTS public."idx_messages_chat_created";
DROP INDEX IF EXISTS public."idx_messages_offer_id";
DROP INDEX IF EXISTS public."idx_messages_reply_to";
DROP INDEX IF EXISTS public."idx_messages_unread";
DROP INDEX IF EXISTS public."idx_notifications_actor_id";
DROP INDEX IF EXISTS public."idx_notifications_product_id";
DROP INDEX IF EXISTS public."idx_notifications_reference_id";
DROP INDEX IF EXISTS public."idx_notifications_unread";
DROP INDEX IF EXISTS public."idx_offers_buyer_id";
DROP INDEX IF EXISTS public."idx_offers_chat_id";
DROP INDEX IF EXISTS public."idx_offers_product_id";
DROP INDEX IF EXISTS public."idx_order_items_order_id";
DROP INDEX IF EXISTS public."idx_order_items_product_id";
DROP INDEX IF EXISTS public."idx_orders_awaiting_meetup";
DROP INDEX IF EXISTS public."idx_orders_biteship_order_id";
DROP INDEX IF EXISTS public."idx_orders_buyer_id";
DROP INDEX IF EXISTS public."idx_orders_offer_id";
DROP INDEX IF EXISTS public."idx_orders_seller_id";
DROP INDEX IF EXISTS public."idx_orders_seller_status";
DROP INDEX IF EXISTS public."idx_orders_shipping_address_id";
DROP INDEX IF EXISTS public."idx_payments_xendit_invoice_id";
DROP INDEX IF EXISTS public."idx_product_media_primary";
DROP INDEX IF EXISTS public."idx_product_media_product_id";
DROP INDEX IF EXISTS public."idx_products_moderated_by";
DROP INDEX IF EXISTS public."idx_products_search_vector";
DROP INDEX IF EXISTS public."idx_reports_resolved_by";
DROP INDEX IF EXISTS public."idx_reviews_order_item_id";
DROP INDEX IF EXISTS public."idx_reviews_reviewer_id";
DROP INDEX IF EXISTS public."idx_reviews_seller_rating";
DROP INDEX IF EXISTS public."idx_users_banned_by";
DROP INDEX IF EXISTS public."wishlists_product_id_idx";

-- ---------------------------------------------------------------------------
-- B) Restore FK covering indexes required by advisor
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items (product_id);
CREATE INDEX IF NOT EXISTS idx_chats_seller_id ON chats (seller_id);
CREATE INDEX IF NOT EXISTS idx_disbursement_attempts_order_id ON disbursement_attempts (order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes (order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_resolved_by ON disputes (resolved_by);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_offer_id ON messages (offer_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications (actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_product_id ON notifications (product_id);
CREATE INDEX IF NOT EXISTS idx_offers_chat_id ON offers (chat_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_address_id ON orders (shipping_address_id);
CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON product_media (product_id);
CREATE INDEX IF NOT EXISTS idx_products_moderated_by ON products (moderated_by);
CREATE INDEX IF NOT EXISTS idx_reports_resolved_by ON reports (resolved_by);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_users_banned_by ON users (banned_by);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON wishlists (product_id);

-- ---------------------------------------------------------------------------
-- C) Keep disbursement_attempts inaccessible for authenticated clients while
--    satisfying advisor recommendation that RLS-enabled tables should have policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS disbursement_attempts_deny_all ON public.disbursement_attempts;
CREATE POLICY disbursement_attempts_deny_all
  ON public.disbursement_attempts
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
