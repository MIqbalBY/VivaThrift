-- =============================================================================
-- Migration 010 — Admin Infrastructure
-- VivaThrift · 2026-04-07
-- =============================================================================
-- Adds:
--   1. role column to users (user, moderator, admin)
--   2. Ban tracking columns to users
--   3. Moderation tracking columns to products
--   4. Helper function is_admin() for RLS/server checks
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. User role column
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Safe CHECK: drop if exists then add
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'moderator', 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Ban tracking columns on users
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS banned_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_by     UUID REFERENCES users(id);

-- ---------------------------------------------------------------------------
-- 3. Moderation tracking columns on products
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS moderated_at     TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 4. Helper function: is current user an admin?
--    SECURITY DEFINER so it can read users.role without extra RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Index on users.role for fast admin queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ---------------------------------------------------------------------------
-- 6. Index on products for moderation queue (newest active first)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_moderation_queue
  ON products (created_at DESC)
  WHERE status IN ('active', 'moderated');