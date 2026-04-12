-- ============================================================================
-- Migration: Disbursement & refund tracking
-- Sprint 1 item: disbursement robustness + dispute refund integration
-- ============================================================================

-- ── Disbursement attempts — audit trail + retry tracking ──────────────────
CREATE TABLE disbursement_attempts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  recipient_type          TEXT NOT NULL CHECK (recipient_type IN ('seller', 'admin_fee')),
  xendit_disbursement_id  TEXT,
  amount                  INTEGER NOT NULL CHECK (amount > 0),
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'submitted', 'completed', 'failed', 'reversed')),
  attempt_no              SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_no BETWEEN 1 AND 10),
  error_message           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disbursement_attempts_order
  ON disbursement_attempts(order_id);

CREATE INDEX idx_disbursement_attempts_retry
  ON disbursement_attempts(status, updated_at)
  WHERE status = 'failed';

CREATE UNIQUE INDEX idx_disbursement_attempts_xendit_id
  ON disbursement_attempts(xendit_disbursement_id)
  WHERE xendit_disbursement_id IS NOT NULL;

-- Auto-update updated_at (reuses existing trigger_set_updated_at() from 20260405000001)
CREATE TRIGGER set_disbursement_attempts_updated_at
  BEFORE UPDATE ON disbursement_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ── Disputes: refund tracking columns ─────────────────────────────────────
ALTER TABLE disputes
  ADD COLUMN xendit_refund_id TEXT,
  ADD COLUMN refund_status    TEXT CHECK (refund_status IN ('pending', 'submitted', 'completed', 'failed')),
  ADD COLUMN refund_error     TEXT,
  ADD COLUMN refunded_at      TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_disputes_xendit_refund_id
  ON disputes(xendit_refund_id)
  WHERE xendit_refund_id IS NOT NULL;

-- ── Orders: pre_dispute_status for rejected dispute restoration ───────────
ALTER TABLE orders
  ADD COLUMN pre_dispute_status TEXT;
