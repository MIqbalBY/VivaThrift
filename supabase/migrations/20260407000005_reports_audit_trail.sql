-- =============================================================================
-- Migration 011 — Reports: Audit trail columns
-- VivaThrift · 2026-04-07
-- =============================================================================

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS resolved_by  UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS resolved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes  TEXT;
