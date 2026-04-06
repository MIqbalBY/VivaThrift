-- =============================================================================
-- Migration 008 — Reviews: Add comment column
-- VivaThrift · 2026-04-07
-- =============================================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS comment TEXT;