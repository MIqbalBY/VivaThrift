// ── Disbursement attempts data layer ────────────────────────────────────────
// Pure helpers + DI store type for the `disbursement_attempts` table.
// The actual Supabase calls live behind the `AttemptStore` interface so
// routes can wire supabaseAdmin and tests can supply fakes.

import type { SupabaseClient } from '@supabase/supabase-js'

export type RecipientType = 'seller' | 'admin_fee'

export type AttemptStatus =
  | 'pending'
  | 'submitted'
  | 'completed'
  | 'failed'
  | 'reversed'

export interface AttemptRow {
  id:                     string
  order_id:               string
  recipient_type:         RecipientType
  xendit_disbursement_id: string | null
  amount:                 number
  status:                 AttemptStatus
  attempt_no:             number
  error_message:          string | null
  created_at:             string
  updated_at:             string
}

export interface AttemptInsertRow {
  order_id:               string
  recipient_type:         RecipientType
  amount:                 number
  attempt_no:             number
  status:                 AttemptStatus
  xendit_disbursement_id: string | null
  error_message:          string | null
}

/** DI surface for all DB access — routes wire supabaseAdmin, tests inject fakes. */
export interface AttemptStore {
  insert: (row: AttemptInsertRow) => Promise<AttemptRow>
  updateSubmitted: (id: string, xenditDisbursementId: string) => Promise<void>
  updateFailed:    (id: string, errorMessage: string) => Promise<void>
  updateCompleted: (id: string) => Promise<void>
  findByXenditId:  (xenditDisbursementId: string) => Promise<AttemptRow | null>
  listByOrder:     (orderId: string) => Promise<AttemptRow[]>
  listRetryable:   (nowIso: string) => Promise<AttemptRow[]>
}

/** Build the row an attempt-create call will insert. Used by disburse utility. */
export function buildAttemptInsertRow(params: {
  orderId:       string
  recipientType: RecipientType
  amount:        number
  attemptNo:     number
}): AttemptInsertRow {
  return {
    order_id:               params.orderId,
    recipient_type:         params.recipientType,
    amount:                 params.amount,
    attempt_no:             params.attemptNo,
    status:                 'pending',
    xendit_disbursement_id: null,
    error_message:          null,
  }
}

/**
 * Backoff schedule for disbursement retries.
 *   attempt 1 → wait 1h before retry
 *   attempt 2 → wait 4h before retry
 *   attempt 3+ → no more retries (Infinity)
 */
export function nextRetryWindowMs(attemptNo: number): number {
  if (attemptNo === 1) return 60 * 60 * 1000
  if (attemptNo === 2) return 4 * 60 * 60 * 1000
  return Infinity
}

/** Retry eligibility check used by the cron job. */
export function isRetryEligible(row: AttemptRow, nowMs: number): boolean {
  if (row.status !== 'failed') return false
  const window = nextRetryWindowMs(row.attempt_no)
  if (window === Infinity) return false
  const updatedMs = new Date(row.updated_at).getTime()
  return nowMs - updatedMs >= window
}

// ── Concrete Supabase-backed store ──────────────────────────────────────────
// Wires supabaseAdmin into the AttemptStore interface. Used by server routes
// (orders, disputes, cron). Tests use fakes instead.

export function createSupabaseAttemptStore(client: SupabaseClient): AttemptStore {
  return {
    insert: async (row) => {
      const { data, error } = await client
        .from('disbursement_attempts')
        .insert(row)
        .select('*')
        .single()
      if (error || !data) throw new Error(`insert disbursement_attempts failed: ${error?.message ?? 'unknown'}`)
      return data as AttemptRow
    },
    updateSubmitted: async (id, xenditDisbursementId) => {
      const { error } = await client
        .from('disbursement_attempts')
        .update({ status: 'submitted', xendit_disbursement_id: xenditDisbursementId })
        .eq('id', id)
      if (error) throw new Error(`update submitted failed: ${error.message}`)
    },
    updateFailed: async (id, errorMessage) => {
      const { error } = await client
        .from('disbursement_attempts')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', id)
      if (error) throw new Error(`update failed: ${error.message}`)
    },
    updateCompleted: async (id) => {
      const { error } = await client
        .from('disbursement_attempts')
        .update({ status: 'completed' })
        .eq('id', id)
      if (error) throw new Error(`update completed failed: ${error.message}`)
    },
    findByXenditId: async (xenditDisbursementId) => {
      const { data } = await client
        .from('disbursement_attempts')
        .select('*')
        .eq('xendit_disbursement_id', xenditDisbursementId)
        .maybeSingle()
      return (data as AttemptRow | null) ?? null
    },
    listByOrder: async (orderId) => {
      const { data } = await client
        .from('disbursement_attempts')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
      return (data ?? []) as AttemptRow[]
    },
    listRetryable: async () => {
      // Return all failed rows; cron applies isRetryEligible() filter in memory
      // so the attempt_no backoff window logic stays in pure code.
      const { data } = await client
        .from('disbursement_attempts')
        .select('*')
        .eq('status', 'failed')
        .order('updated_at', { ascending: true })
        .limit(100)
      return (data ?? []) as AttemptRow[]
    },
  }
}
