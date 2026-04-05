-- =============================================================================
-- Migration 002 — Performance Indexes
-- VivaThrift · 2026-04-05
-- =============================================================================
-- PostgreSQL does NOT auto-create indexes for FK columns.
-- Every FK column used in JOINs or WHERE clauses needs an explicit index.
-- RLS policies also use these columns in every query — missing indexes cause
-- full sequential scans for every authenticated request.
--
-- Strategy:
--   • B-Tree indexes for FK columns and equality/range lookups
--   • Partial indexes for hot partial-data queries (active/unread/pending)
--   • Composite indexes for common multi-column WHERE patterns
--   • CONCURRENTLY — avoids locking tables during creation in production
-- =============================================================================

-- ---------------------------------------------------------------------------
-- products — most-read table in the app
-- ---------------------------------------------------------------------------

-- Seller dashboard: all products by seller
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_seller_id
  ON products (seller_id);

-- Category browse
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_id
  ON products (category_id);

-- URL slug lookup (product detail page)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_products_slug
  ON products (slug);

-- Hot partial: public listing page only ever queries status='active'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active
  ON products (seller_id, created_at DESC)
  WHERE status = 'active';

-- Full-text search on title (for search bar)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_title_fts
  ON products USING gin(to_tsvector('indonesian', title));

-- ---------------------------------------------------------------------------
-- product_media — JOINed on every product page
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_media_product_id
  ON product_media (product_id);

-- Primary media lookup (DetailGallery shows primary first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_media_primary
  ON product_media (product_id, is_primary)
  WHERE is_primary = true;

-- ---------------------------------------------------------------------------
-- chats — participant lookups (buyer inbox + seller inbox)
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_buyer_id
  ON chats (buyer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_seller_id
  ON chats (seller_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_product_id
  ON chats (product_id);

-- Chat list: order by last activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_buyer_updated
  ON chats (buyer_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_seller_updated
  ON chats (seller_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- messages — most-written table; composite for cursor pagination
-- ---------------------------------------------------------------------------

-- Core chat message load: paginate by (chat_id, time)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_created
  ON messages (chat_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_id
  ON messages (sender_id);

-- Offer message lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_offer_id
  ON messages (offer_id)
  WHERE offer_id IS NOT NULL;

-- Reply thread lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_reply_to
  ON messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- Unread count (ChatHeader badge) — partial for hot path
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_unread
  ON messages (chat_id, sender_id)
  WHERE is_read = false AND is_deleted = false;

-- ---------------------------------------------------------------------------
-- offers — core transaction flow; multiple status lookups
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_buyer_id
  ON offers (buyer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_chat_id
  ON offers (chat_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_product_id
  ON offers (product_id);

-- Seller offer inbox: all pending offers for seller's products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_product_pending
  ON offers (product_id, created_at DESC)
  WHERE status = 'pending';

-- Buyer: view own offer history sorted by time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_buyer_status
  ON offers (buyer_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- orders — transaction status machine; buyer & seller views
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_buyer_id
  ON orders (buyer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_seller_id
  ON orders (seller_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_offer_id
  ON orders (offer_id);

-- Buyer order list sorted by recency
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_buyer_status
  ON orders (buyer_id, status, created_at DESC);

-- Seller order list sorted by recency
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_seller_status
  ON orders (seller_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- order_items — always JOINed to orders
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id
  ON order_items (product_id);

-- ---------------------------------------------------------------------------
-- payments — always looked up by order
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_id
  ON payments (order_id);

-- Xendit webhook reconciliation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_xendit_invoice_id
  ON payments (xendit_invoice_id)
  WHERE xendit_invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- notifications — recipient inbox + mark-as-read
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id
  ON notifications (user_id, created_at DESC);

-- Unread badge count — partial for hot path
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id)
  WHERE is_read = false;

-- ---------------------------------------------------------------------------
-- reviews — seller rating aggregation + item lookup
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_reviewer_id
  ON reviews (reviewer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_reviewee_id
  ON reviews (reviewee_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_order_id
  ON reviews (order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_product_id
  ON reviews (product_id);

-- Seller profile: all ratings for a seller (ProfileCard aggregation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_seller_rating
  ON reviews (reviewee_id, rating_seller)
  WHERE rating_seller IS NOT NULL;

-- ---------------------------------------------------------------------------
-- wishlists — user wishlist page + product wishlist count
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wishlists_user_id
  ON wishlists (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wishlists_product_id
  ON wishlists (product_id);

-- ---------------------------------------------------------------------------
-- cart_items — cart drawer
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_items_cart_id
  ON cart_items (cart_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_items_product_id
  ON cart_items (product_id);

-- ---------------------------------------------------------------------------
-- follows — follower/following lists
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_id
  ON follows (follower_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following_id
  ON follows (following_id);

-- ---------------------------------------------------------------------------
-- addresses — user address book
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_addresses_user_id
  ON addresses (user_id);

-- ---------------------------------------------------------------------------
-- reports — admin review queue
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_reported_user_id
  ON reports (reported_user_id)
  WHERE reported_user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_reported_product_id
  ON reports (reported_product_id)
  WHERE reported_product_id IS NOT NULL;

-- Pending reports queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_pending
  ON reports (created_at DESC)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- users — profile lookups
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username
  ON users (username)
  WHERE username IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_nrp
  ON users (nrp);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
  ON users (email)
  WHERE email IS NOT NULL;
