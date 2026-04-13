-- =============================================================================
-- Migration 20260413000015 — Add categories(name) index
-- VivaThrift · 2026-04-13
-- =============================================================================
-- Supports frequent category listing query ordered by name.

CREATE INDEX IF NOT EXISTS idx_categories_name
  ON public.categories (name);
