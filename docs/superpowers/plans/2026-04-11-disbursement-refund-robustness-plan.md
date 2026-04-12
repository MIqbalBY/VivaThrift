# Disbursement & Refund Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audit trail, retry logic, and webhook-driven status updates for Xendit disbursements, and integrate Xendit refund API into dispute resolution for the VivaThrift marketplace.

**Architecture:** Pure-handler + DI pattern (mirroring existing `xendit-webhook-handler.ts`): utility files are free of I/O, route files wire Supabase client into dependency objects. New `disbursement_attempts` table provides audit + retry basis. State machine cleanup removes `resolved_release`, adds `resolved_partial`, and allows direct transitions back to `shipped`/`awaiting_meetup` for rejected disputes.

**Tech Stack:** Nuxt 4 (Nitro server routes), TypeScript, Supabase (Postgres), Xendit Disbursement + Refund APIs, Vitest, Vercel Cron.

**Spec reference:** [docs/superpowers/specs/2026-04-11-disbursement-refund-robustness-design.md](../specs/2026-04-11-disbursement-refund-robustness-design.md)

---

## Preflight Notes

- **Pattern to mirror:** [server/utils/xendit-webhook-handler.ts](../../../server/utils/xendit-webhook-handler.ts) + [server/api/webhooks/xendit.post.ts](../../../server/api/webhooks/xendit.post.ts). Pure handler receives a `deps` object; route wires `supabaseAdmin` into that object.
- **Test pattern to mirror:** [tests/xendit-webhook-handler.test.ts](../../../tests/xendit-webhook-handler.test.ts) (`createDeps` factory with `vi.fn`) and [tests/webhook-routes.test.ts](../../../tests/webhook-routes.test.ts) (`vi.doMock` + `vi.stubGlobal` for route wiring).
- **No existing tests for `xendit-disburse.ts`**: Task 4 introduces the first test file for it, then Task 5 refactors the utility under TDD.
- **Existing call sites for `disburseFunds`** (must keep working):
  - [server/api/orders/[id].patch.ts:291](../../../server/api/orders/%5Bid%5D.patch.ts#L291) — `confirm_meetup` action
  - [server/api/orders/[id].patch.ts:364](../../../server/api/orders/%5Bid%5D.patch.ts#L364) — `complete` action
  - [server/api/cron/cleanup.post.ts:113](../../../server/api/cron/cleanup.post.ts#L113) — auto-complete after 7 days
- **Shell note:** Windows machine, bash shell (git bash). Use forward slashes and unix syntax.

---

## File Structure

### New files

```text
supabase/migrations/
  └─ 20260411000002_disbursement_refund_tracking.sql

server/utils/
  ├─ xendit-refund.ts                         # Pure Xendit Refund API wrapper
  ├─ disbursement-attempts.ts                 # CRUD helpers for attempts table (DI store type)
  └─ xendit-disbursement-webhook-handler.ts   # Pure handler for disbursement callbacks

server/api/
  ├─ webhooks/
  │   └─ xendit-disbursement.post.ts          # HTTP route wiring
  └─ cron/
      └─ retry-disbursements.post.ts          # Retry cron route

tests/
  ├─ xendit-refund.test.ts
  ├─ xendit-disburse.test.ts                  # NEW (no prior tests for this file)
  ├─ disbursement-attempts.test.ts
  ├─ xendit-disbursement-webhook-handler.test.ts
  ├─ xendit-disbursement-webhook-route.test.ts
  ├─ disputes-resolve-route.test.ts
  └─ retry-disbursements-cron.test.ts
```

### Modified files

- `server/utils/xendit-disburse.ts` — inject `attemptStore`, write attempt rows before/after Xendit calls
- `server/utils/state-machine.ts` — update `disputed` transitions, remove `resolved_release`, add `resolved_partial`
- `server/api/disputes/[id].patch.ts` — integrate refund + disbursement + rejected-state restore
- `server/api/disputes/index.post.ts` — no changes (dispute creation itself doesn't mutate order.status; see Task 11)
- `server/api/orders/[id].patch.ts` — update both `disburseFunds()` call sites to pass `attemptStore`; set `pre_dispute_status` is handled elsewhere
- `server/api/webhooks/xendit.post.ts` — extend to handle `refund.succeeded` / `refund.failed` events
- `server/api/cron/cleanup.post.ts` — update `disburseFunds()` call to pass `attemptStore`
- `vercel.json` — add new cron entry
- `tests/state-machine.test.ts` — update test cases for new transitions

**Note on `pre_dispute_status` capture:** The spec suggests capturing it in `disputes/index.post.ts`. On review, the dispute endpoint does NOT mutate `orders.status` itself — that happens separately (likely buyer-initiated, or via a trigger we haven't found). To keep the feature self-contained, **Task 11 adds a column update inside `disputes/index.post.ts`** that snapshots `orders.status` into `orders.pre_dispute_status` at dispute creation time. This is a defensive snapshot and is idempotent.

---

## Task Sequence

| Order | Task | Files Touched | Why this order |
|-------|------|---------------|----------------|
| 1 | Create SQL migration | migration file | Foundation — later tasks reference columns |
| 2 | Update state machine + tests | state-machine.ts, state-machine.test.ts | Isolated; dispute code depends on it |
| 3 | Pure refund utility + tests | xendit-refund.ts, xendit-refund.test.ts | No deps on anything else |
| 4 | Attempt store helpers + tests | disbursement-attempts.ts, disbursement-attempts.test.ts | Data layer for disbursement refactor |
| 5 | Refactor xendit-disburse + tests | xendit-disburse.ts, xendit-disburse.test.ts | Uses store from Task 4 |
| 6 | Wire refactored disburse into existing call sites | orders/[id].patch.ts, cron/cleanup.post.ts | Keep existing callers green |
| 7 | Disbursement webhook handler + tests | xendit-disbursement-webhook-handler.ts, handler test | Uses store from Task 4 |
| 8 | Disbursement webhook route + tests | xendit-disbursement.post.ts, route test | Wires handler to HTTP |
| 9 | Retry cron route + tests | retry-disbursements.post.ts, cron test | Uses store from Task 4 |
| 10 | Extend xendit.post.ts for refund events | xendit-webhook-handler.ts, xendit.post.ts | Uses refund status columns from Task 1 |
| 11 | Dispute resolution integration + tests | disputes/[id].patch.ts, disputes/index.post.ts, disputes-resolve-route.test.ts | Uses Tasks 2, 3, 5 |
| 12 | vercel.json cron registration | vercel.json | Last — after route exists |
| 13 | Full suite regression | — | Final verification |

---

## Task 1: Create SQL migration

**Files:**
- Create: `supabase/migrations/20260411000002_disbursement_refund_tracking.sql`

- [ ] **Step 1.1: Write the migration file**

```sql
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
```

- [ ] **Step 1.2: Validate SQL locally (dry-run against local Supabase if running, otherwise static check)**

Run: `ls supabase/migrations/20260411000002_disbursement_refund_tracking.sql`
Expected: file exists.

If local Supabase is running: `pnpm supabase db reset` and confirm no errors.
If not running: skip — migration will be validated at next deploy. Grep for `trigger_set_updated_at` to confirm it exists:

Run: `grep -rn "trigger_set_updated_at" supabase/migrations/`
Expected: multiple matches, including `20260405000001_fix_schema_constraints.sql` which defines the function.

- [ ] **Step 1.3: Commit**

```bash
git add supabase/migrations/20260411000002_disbursement_refund_tracking.sql
git commit -m "feat(db): add disbursement_attempts table + refund tracking columns

- disbursement_attempts: audit trail + retry tracking
- disputes: xendit_refund_id, refund_status, refund_error, refunded_at
- orders: pre_dispute_status (for rejected dispute restoration)

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 2: Update state machine + tests

**Files:**
- Modify: `server/utils/state-machine.ts:11-22`
- Modify: `tests/state-machine.test.ts:47-53`

- [ ] **Step 2.1: Update the failing tests in `tests/state-machine.test.ts`**

Find the existing block (around lines 47-53):

```ts
  it('allows disputed → resolved_refund', () => {
    expect(canTransition('order', 'disputed', 'resolved_refund')).toBe(true)
  })

  it('allows disputed → resolved_release', () => {
    expect(canTransition('order', 'disputed', 'resolved_release')).toBe(true)
  })
```

Replace with:

```ts
  it('allows disputed → resolved_refund (full refund)', () => {
    expect(canTransition('order', 'disputed', 'resolved_refund')).toBe(true)
  })

  it('allows disputed → resolved_partial (partial refund)', () => {
    expect(canTransition('order', 'disputed', 'resolved_partial')).toBe(true)
  })

  it('allows disputed → shipped (rejected dispute, shipping flow restore)', () => {
    expect(canTransition('order', 'disputed', 'shipped')).toBe(true)
  })

  it('allows disputed → awaiting_meetup (rejected dispute, COD flow restore)', () => {
    expect(canTransition('order', 'disputed', 'awaiting_meetup')).toBe(true)
  })

  it('blocks disputed → resolved_release (removed in Sprint 1 refactor)', () => {
    expect(canTransition('order', 'disputed', 'resolved_release')).toBe(false)
  })

  it('blocks any transition from resolved_refund (terminal)', () => {
    expect(canTransition('order', 'resolved_refund', 'disputed')).toBe(false)
    expect(canTransition('order', 'resolved_refund', 'completed')).toBe(false)
  })

  it('blocks any transition from resolved_partial (terminal)', () => {
    expect(canTransition('order', 'resolved_partial', 'completed')).toBe(false)
  })
```

- [ ] **Step 2.2: Run tests to verify failures**

Run: `pnpm test -- state-machine.test`
Expected: Multiple failures in the `Order state machine` describe block — `disputed → resolved_partial`, `disputed → shipped`, `disputed → awaiting_meetup` all fail; `blocks disputed → resolved_release` fails (currently returns true); `blocks any transition from resolved_partial` fails.

- [ ] **Step 2.3: Update `server/utils/state-machine.ts`**

Find lines 11-22 containing the `ORDER_TRANSITIONS` map. Replace the block:

```ts
const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending_payment:  ['confirmed', 'awaiting_meetup', 'cancelled', 'payment_failed'],
  confirmed:        ['shipped', 'awaiting_meetup', 'cancelled'],
  awaiting_meetup:  ['completed', 'cancelled', 'disputed'],
  shipped:          ['completed', 'disputed'],
  completed:        [],  // terminal
  cancelled:        [],  // terminal
  payment_failed:   [],  // terminal
  disputed:         ['resolved_refund', 'resolved_release'],
  resolved_refund:  [],  // terminal
  resolved_release: [],  // terminal
}
```

With:

```ts
const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending_payment:  ['confirmed', 'awaiting_meetup', 'cancelled', 'payment_failed'],
  confirmed:        ['shipped', 'awaiting_meetup', 'cancelled'],
  awaiting_meetup:  ['completed', 'cancelled', 'disputed'],
  shipped:          ['completed', 'disputed'],
  completed:        [],  // terminal
  cancelled:        [],  // terminal
  payment_failed:   [],  // terminal
  // disputed can resolve as refund/partial, OR return to pre-dispute state (shipped/awaiting_meetup)
  // if the dispute is rejected — this lets the normal completion flow handle disbursement.
  disputed:         ['resolved_refund', 'resolved_partial', 'shipped', 'awaiting_meetup'],
  resolved_refund:  [],  // terminal: full refund
  resolved_partial: [],  // terminal: partial refund + remainder disbursed
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `pnpm test -- state-machine.test`
Expected: All `Order state machine` tests pass including the new cases. The 6 existing tests for pending_payment/confirmed/shipped/awaiting_meetup transitions remain passing.

- [ ] **Step 2.5: Commit**

```bash
git add server/utils/state-machine.ts tests/state-machine.test.ts
git commit -m "feat(state-machine): replace resolved_release with direct transitions

- Remove resolved_release terminal state (unused)
- Add resolved_partial terminal state (for partial refund dispute outcome)
- Allow disputed → shipped|awaiting_meetup (for rejected dispute: return to
  pre-dispute state, normal completion flow will handle disbursement)

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 3: Xendit refund utility + tests

**Files:**
- Create: `server/utils/xendit-refund.ts`
- Create: `tests/xendit-refund.test.ts`

- [ ] **Step 3.1: Write the failing test file**

Create `tests/xendit-refund.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXenditRefund } from '../server/utils/xendit-refund'

describe('createXenditRefund', () => {
  const originalFetch = globalThis.$fetch
  const originalEnv = process.env.XENDIT_KEY

  beforeEach(() => {
    process.env.XENDIT_KEY = 'test-xendit-key'
  })

  afterEach(() => {
    process.env.XENDIT_KEY = originalEnv
    globalThis.$fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns skipped when XENDIT_KEY is not set', async () => {
    delete process.env.XENDIT_KEY

    const result = await createXenditRefund({
      invoiceId: 'inv-1',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })

    expect(result).toEqual({
      skipped: true,
      xenditRefundId: null,
      error: 'XENDIT_KEY tidak dikonfigurasi.',
    })
  })

  it('returns skipped when invoiceId is missing', async () => {
    const result = await createXenditRefund({
      invoiceId: '',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })

    expect(result).toEqual({
      skipped: true,
      xenditRefundId: null,
      error: 'invoiceId kosong.',
    })
  })

  it('returns xenditRefundId on happy path', async () => {
    const fetchMock = vi.fn(async () => ({ id: 'refund-abc' }))
    globalThis.$fetch = fetchMock as unknown as typeof globalThis.$fetch

    const result = await createXenditRefund({
      invoiceId: 'inv-1',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })

    expect(result).toEqual({
      skipped: false,
      xenditRefundId: 'refund-abc',
      error: null,
    })

    expect(fetchMock).toHaveBeenCalledWith('https://api.xendit.co/refunds', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        invoice_id:  'inv-1',
        amount:      50000,
        reason:      'REQUESTED_BY_CUSTOMER',
        external_id: 'vt_refund_d1',
      }),
    }))
  })

  it('throws on Xendit 4xx errors (permanent)', async () => {
    const fetchMock = vi.fn(async () => {
      const err: Error & { data?: unknown; statusCode?: number } = new Error('Invalid invoice')
      err.data = { message: 'Invoice already refunded', error_code: 'DUPLICATE_REFUND' }
      err.statusCode = 400
      throw err
    })
    globalThis.$fetch = fetchMock as unknown as typeof globalThis.$fetch

    await expect(createXenditRefund({
      invoiceId: 'inv-1',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })).rejects.toThrow('Invoice already refunded')
  })

  it('throws on Xendit 5xx errors with retry hint', async () => {
    const fetchMock = vi.fn(async () => {
      const err: Error & { data?: unknown; statusCode?: number } = new Error('Server error')
      err.statusCode = 503
      err.data = { message: 'Service unavailable' }
      throw err
    })
    globalThis.$fetch = fetchMock as unknown as typeof globalThis.$fetch

    await expect(createXenditRefund({
      invoiceId: 'inv-1',
      amount: 50000,
      reason: 'REQUESTED_BY_CUSTOMER',
      externalId: 'vt_refund_d1',
    })).rejects.toThrow('Service unavailable')
  })
})
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `pnpm test -- xendit-refund`
Expected: FAIL — `createXenditRefund is not a function` or module not found.

- [ ] **Step 3.3: Implement `server/utils/xendit-refund.ts`**

Create:

```ts
// ── Xendit Refund API utility ───────────────────────────────────────────────
// Pure function wrapper around the Xendit /refunds endpoint.
// Used by the dispute resolution endpoint when an admin approves a refund.

export interface XenditRefundParams {
  invoiceId:  string
  amount:     number
  reason:     'REQUESTED_BY_CUSTOMER' | 'DUPLICATE' | 'FRAUDULENT' | 'OTHERS'
  externalId: string
}

export interface XenditRefundResult {
  skipped:         boolean
  xenditRefundId:  string | null
  error:           string | null
}

/**
 * Creates a refund through Xendit's Refund API.
 *
 * Behavior:
 *   - If XENDIT_KEY is not configured → returns skipped (no error thrown)
 *   - If invoiceId is empty → returns skipped
 *   - If the Xendit API returns an error → throws (caller handles revert)
 *   - On success → returns the Xendit refund id
 *
 * Refund amount is paid back to the buyer's original payment method.
 */
export async function createXenditRefund(params: XenditRefundParams): Promise<XenditRefundResult> {
  const xenditKey = process.env.XENDIT_KEY ?? ''

  if (!xenditKey) {
    return { skipped: true, xenditRefundId: null, error: 'XENDIT_KEY tidak dikonfigurasi.' }
  }

  if (!params.invoiceId) {
    return { skipped: true, xenditRefundId: null, error: 'invoiceId kosong.' }
  }

  const credentials = Buffer.from(`${xenditKey}:`).toString('base64')
  const headers = { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }

  const res = await $fetch<{ id: string }>('https://api.xendit.co/refunds', {
    method: 'POST',
    headers,
    body: {
      invoice_id:  params.invoiceId,
      amount:      params.amount,
      reason:      params.reason,
      external_id: params.externalId,
    },
  })

  return { skipped: false, xenditRefundId: res.id, error: null }
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `pnpm test -- xendit-refund`
Expected: PASS — all 5 tests green.

- [ ] **Step 3.5: Commit**

```bash
git add server/utils/xendit-refund.ts tests/xendit-refund.test.ts
git commit -m "feat(xendit): add pure createXenditRefund utility

Thin wrapper around Xendit /refunds endpoint. Caller handles errors
(no silent catches). Returns skipped when XENDIT_KEY missing.

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 4: Disbursement attempt store helpers + tests

**Files:**
- Create: `server/utils/disbursement-attempts.ts`
- Create: `tests/disbursement-attempts.test.ts`

- [ ] **Step 4.1: Write the failing test file**

Create `tests/disbursement-attempts.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  buildAttemptInsertRow,
  isRetryEligible,
  nextRetryWindowMs,
  type AttemptRow,
} from '../server/utils/disbursement-attempts'

describe('buildAttemptInsertRow', () => {
  it('builds a pending seller row', () => {
    const row = buildAttemptInsertRow({
      orderId:       'order-1',
      recipientType: 'seller',
      amount:        100000,
      attemptNo:     1,
    })
    expect(row).toEqual({
      order_id:               'order-1',
      recipient_type:         'seller',
      amount:                 100000,
      attempt_no:             1,
      status:                 'pending',
      xendit_disbursement_id: null,
      error_message:          null,
    })
  })

  it('builds a pending admin_fee row', () => {
    const row = buildAttemptInsertRow({
      orderId:       'order-2',
      recipientType: 'admin_fee',
      amount:        2000,
      attemptNo:     2,
    })
    expect(row.recipient_type).toBe('admin_fee')
    expect(row.attempt_no).toBe(2)
    expect(row.amount).toBe(2000)
  })
})

describe('nextRetryWindowMs', () => {
  it('returns 1 hour for attempt 1', () => {
    expect(nextRetryWindowMs(1)).toBe(60 * 60 * 1000)
  })

  it('returns 4 hours for attempt 2', () => {
    expect(nextRetryWindowMs(2)).toBe(4 * 60 * 60 * 1000)
  })

  it('returns Infinity for attempt 3+ (no more retries)', () => {
    expect(nextRetryWindowMs(3)).toBe(Infinity)
    expect(nextRetryWindowMs(5)).toBe(Infinity)
  })
})

describe('isRetryEligible', () => {
  const nowIso = '2026-04-11T12:00:00.000Z'
  const now = new Date(nowIso).getTime()

  function makeRow(overrides: Partial<AttemptRow>): AttemptRow {
    return {
      id:                     'a-1',
      order_id:               'order-1',
      recipient_type:         'seller',
      xendit_disbursement_id: null,
      amount:                 100000,
      status:                 'failed',
      attempt_no:             1,
      error_message:          'API error',
      created_at:             '2026-04-11T00:00:00.000Z',
      updated_at:             '2026-04-11T00:00:00.000Z',
      ...overrides,
    }
  }

  it('attempt 1: eligible when updated_at is >1h ago', () => {
    const row = makeRow({
      attempt_no: 1,
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(true)
  })

  it('attempt 1: NOT eligible when updated_at is 30 minutes ago', () => {
    const row = makeRow({
      attempt_no: 1,
      updated_at: new Date(now - 30 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(false)
  })

  it('attempt 2: eligible when updated_at is >4h ago', () => {
    const row = makeRow({
      attempt_no: 2,
      updated_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(true)
  })

  it('attempt 2: NOT eligible at exactly 2h', () => {
    const row = makeRow({
      attempt_no: 2,
      updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(false)
  })

  it('attempt 3: NEVER eligible (max retries reached)', () => {
    const row = makeRow({
      attempt_no: 3,
      updated_at: new Date(now - 100 * 60 * 60 * 1000).toISOString(),
    })
    expect(isRetryEligible(row, now)).toBe(false)
  })

  it('rejects rows with status other than failed', () => {
    const row = makeRow({ status: 'completed' })
    expect(isRetryEligible(row, now)).toBe(false)
  })
})
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run: `pnpm test -- disbursement-attempts`
Expected: FAIL — module not found.

- [ ] **Step 4.3: Implement `server/utils/disbursement-attempts.ts`**

Create:

```ts
// ── Disbursement attempts data layer ────────────────────────────────────────
// Pure helpers + DI store type for the `disbursement_attempts` table.
// The actual Supabase calls live behind the `AttemptStore` interface so
// routes can wire supabaseAdmin and tests can supply fakes.

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
```

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `pnpm test -- disbursement-attempts`
Expected: PASS — all tests green.

- [ ] **Step 4.5: Commit**

```bash
git add server/utils/disbursement-attempts.ts tests/disbursement-attempts.test.ts
git commit -m "feat(disbursement): add attempt store interface + pure helpers

- AttemptStore interface (DI surface for Supabase operations)
- buildAttemptInsertRow: deterministic row builder
- nextRetryWindowMs: backoff schedule (1h → 4h → never)
- isRetryEligible: retry cron eligibility check

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 5: Refactor `xendit-disburse.ts` with attempt tracking + tests

**Files:**
- Modify: `server/utils/xendit-disburse.ts`
- Create: `tests/xendit-disburse.test.ts` (first test file for this utility)

- [ ] **Step 5.1: Write the failing test file**

Create `tests/xendit-disburse.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { disburseFunds } from '../server/utils/xendit-disburse'
import type { AttemptRow, AttemptStore, AttemptInsertRow } from '../server/utils/disbursement-attempts'

function createFakeStore(): AttemptStore & { rows: AttemptRow[] } {
  const rows: AttemptRow[] = []
  let idCounter = 0

  return {
    rows,
    insert: vi.fn(async (row: AttemptInsertRow) => {
      const full: AttemptRow = {
        id: `attempt-${++idCounter}`,
        created_at: '2026-04-11T00:00:00.000Z',
        updated_at: '2026-04-11T00:00:00.000Z',
        ...row,
      }
      rows.push(full)
      return full
    }),
    updateSubmitted: vi.fn(async (id: string, xenditId: string) => {
      const r = rows.find((x) => x.id === id)
      if (r) { r.status = 'submitted'; r.xendit_disbursement_id = xenditId }
    }),
    updateFailed: vi.fn(async (id: string, msg: string) => {
      const r = rows.find((x) => x.id === id)
      if (r) { r.status = 'failed'; r.error_message = msg }
    }),
    updateCompleted: vi.fn(async () => {}),
    findByXenditId: vi.fn(async () => null),
    listByOrder: vi.fn(async () => rows),
    listRetryable: vi.fn(async () => []),
  }
}

describe('disburseFunds', () => {
  const originalEnv = process.env.XENDIT_KEY
  const originalFetch = globalThis.$fetch

  beforeEach(() => {
    process.env.XENDIT_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.XENDIT_KEY = originalEnv
    globalThis.$fetch = originalFetch
    vi.restoreAllMocks()
  })

  const baseParams = () => ({
    orderId: 'order-1',
    externalIdPrefix: 'vt_complete',
    totalAmount: 120000,
    shippingCost: 20000,
    platformFee: 2000,
    seller: {
      bank_code: 'BCA',
      account_holder_name: 'Seller Name',
      account_number: '1234567890',
    },
  })

  it('skips when XENDIT_KEY is not set', async () => {
    delete process.env.XENDIT_KEY
    const store = createFakeStore()

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.skipped).toBe(true)
    expect(store.insert).not.toHaveBeenCalled()
  })

  it('skips when seller bank info is incomplete', async () => {
    const store = createFakeStore()

    const result = await disburseFunds({
      ...baseParams(),
      seller: { bank_code: null, account_holder_name: null, account_number: null },
      attemptStore: store,
    })

    expect(result.skipped).toBe(true)
    expect(store.insert).not.toHaveBeenCalled()
  })

  it('happy path: inserts + submits seller + admin fee attempts', async () => {
    const store = createFakeStore()
    globalThis.$fetch = vi.fn()
      .mockResolvedValueOnce({ id: 'xd-seller' })
      .mockResolvedValueOnce({ id: 'xd-admin' }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.sellerDisbursementId).toBe('xd-seller')
    expect(result.adminDisbursementId).toBe('xd-admin')
    expect(result.skipped).toBe(false)
    expect(result.error).toBeNull()

    expect(store.insert).toHaveBeenCalledTimes(2)
    expect(store.updateSubmitted).toHaveBeenCalledTimes(2)
    expect(store.rows[0]).toMatchObject({
      recipient_type: 'seller',
      amount: 98000, // 120000 - 20000 - 2000
      status: 'submitted',
      xendit_disbursement_id: 'xd-seller',
    })
    expect(store.rows[1]).toMatchObject({
      recipient_type: 'admin_fee',
      amount: 2000,
      status: 'submitted',
      xendit_disbursement_id: 'xd-admin',
    })
  })

  it('seller API error: seller attempt failed, admin attempt NOT created', async () => {
    const store = createFakeStore()
    globalThis.$fetch = vi.fn(async () => {
      const err: Error & { data?: unknown } = new Error('Insufficient funds')
      err.data = { message: 'Insufficient balance', error_code: 'INSUFFICIENT_BALANCE' }
      throw err
    }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.sellerDisbursementId).toBeNull()
    expect(result.adminDisbursementId).toBeNull()
    expect(result.error).toBe('Insufficient balance')

    expect(store.insert).toHaveBeenCalledTimes(1) // only seller
    expect(store.updateFailed).toHaveBeenCalledTimes(1)
    expect(store.rows[0]).toMatchObject({
      recipient_type: 'seller',
      status: 'failed',
      error_message: 'Insufficient balance',
    })
  })

  it('admin API error after seller success: seller submitted, admin failed', async () => {
    const store = createFakeStore()
    let call = 0
    globalThis.$fetch = vi.fn(async () => {
      call++
      if (call === 1) return { id: 'xd-seller' }
      const err: Error & { data?: unknown } = new Error('Admin bank error')
      err.data = { message: 'Admin account locked' }
      throw err
    }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({ ...baseParams(), attemptStore: store })

    expect(result.sellerDisbursementId).toBe('xd-seller')
    expect(result.adminDisbursementId).toBeNull()

    expect(store.insert).toHaveBeenCalledTimes(2)
    expect(store.rows[0]).toMatchObject({ status: 'submitted' })
    expect(store.rows[1]).toMatchObject({ status: 'failed', error_message: 'Admin account locked' })
  })

  it('skips admin fee disbursement when platformFee is 0', async () => {
    const store = createFakeStore()
    globalThis.$fetch = vi.fn().mockResolvedValueOnce({ id: 'xd-seller' }) as unknown as typeof globalThis.$fetch

    const result = await disburseFunds({
      ...baseParams(),
      platformFee: 0,
      attemptStore: store,
    })

    expect(result.sellerDisbursementId).toBe('xd-seller')
    expect(result.adminDisbursementId).toBeNull()
    expect(store.insert).toHaveBeenCalledTimes(1) // only seller
  })

  it('supports custom attemptNo (for retry scenarios)', async () => {
    const store = createFakeStore()
    globalThis.$fetch = vi.fn()
      .mockResolvedValueOnce({ id: 'xd-seller-retry' })
      .mockResolvedValueOnce({ id: 'xd-admin-retry' }) as unknown as typeof globalThis.$fetch

    await disburseFunds({ ...baseParams(), attemptStore: store, attemptNo: 2 })

    expect(store.rows[0].attempt_no).toBe(2)
    expect(store.rows[1].attempt_no).toBe(2)
  })
})
```

- [ ] **Step 5.2: Run tests to verify they fail**

Run: `pnpm test -- xendit-disburse`
Expected: FAIL — `disburseFunds` doesn't accept `attemptStore`, tests fail.

- [ ] **Step 5.3: Rewrite `server/utils/xendit-disburse.ts`**

Replace the entire file:

```ts
// ── Xendit Disbursement utility ─────────────────────────────────────────────
// Shared by order complete & confirm_meetup actions, and retry cron.
// Creates disbursements to seller + platform admin and tracks each attempt
// in the disbursement_attempts table via the injected AttemptStore.

import { buildAttemptInsertRow, type AttemptStore } from './disbursement-attempts'

export interface DisbursementResult {
  sellerDisbursementId: string | null
  adminDisbursementId:  string | null
  skipped:              boolean
  error:                string | null
}

// Admin Bank Jago account for platform fee collection
const ADMIN_BANK = {
  bank_code:           'BANK_JAGO',
  account_holder_name: 'Muhammad Iqbal Baiduri Yamani',
  account_number:      '103438588617',
} as const

export interface DisburseFundsParams {
  orderId:          string
  externalIdPrefix: string
  totalAmount:      number
  shippingCost:     number
  platformFee:      number
  seller: {
    bank_code?:           string | null
    account_holder_name?: string | null
    account_number?:      string | null
  }
  attemptStore: AttemptStore
  /** Attempt number, defaults to 1. Retry cron passes a higher value. */
  attemptNo?: number
  /**
   * When true, skip the seller disbursement entirely and only disburse the
   * platform fee to admin. Used by the full-refund dispute flow (seller gets
   * nothing, admin still keeps the fee per decision D2).
   */
  adminFeeOnly?: boolean
}

/**
 * Disburse funds after order completion:
 *   1) Seller receives: total_amount - shipping_cost - platform_fee
 *   2) Admin receives: platform_fee (if > 0)
 *
 * Attempt tracking:
 *   - A row is inserted in disbursement_attempts BEFORE each Xendit call.
 *   - On success, the row is updated to 'submitted' with the Xendit id.
 *   - On failure, the row is updated to 'failed' with the error message.
 *   - A failed seller call skips the admin fee call entirely (no half-work).
 *
 * Error behavior: non-fatal. Returns the result object; caller does not
 * block. Retry cron handles failed rows.
 */
export async function disburseFunds(params: DisburseFundsParams): Promise<DisbursementResult> {
  const xenditKey = process.env.XENDIT_KEY ?? ''

  if (!xenditKey) {
    console.warn('[disburse] XENDIT_KEY tidak dikonfigurasi.')
    return { sellerDisbursementId: null, adminDisbursementId: null, skipped: true, error: 'XENDIT_KEY tidak dikonfigurasi.' }
  }

  const hasBankInfo = params.seller.bank_code && params.seller.account_number && params.seller.account_holder_name

  if (!hasBankInfo) {
    console.warn('[disburse] Data rekening penjual belum dilengkapi.')
    return { sellerDisbursementId: null, adminDisbursementId: null, skipped: true, error: 'Data rekening penjual belum dilengkapi.' }
  }

  const attemptNo      = params.attemptNo ?? 1
  const credentials    = Buffer.from(`${xenditKey}:`).toString('base64')
  const headers        = { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }
  const sellerReceives = params.totalAmount - params.shippingCost - params.platformFee

  let sellerDisbursementId: string | null = null
  let adminDisbursementId:  string | null = null
  let error: string | null = null

  // ── 1) Disburse to seller ──────────────────────────────────────────────────
  const sellerAttempt = await params.attemptStore.insert(buildAttemptInsertRow({
    orderId:       params.orderId,
    recipientType: 'seller',
    amount:        sellerReceives,
    attemptNo,
  }))

  try {
    const res = await $fetch<{ id: string }>('https://api.xendit.co/disbursements', {
      method: 'POST',
      headers,
      body: {
        external_id:         `${params.externalIdPrefix}_seller_${params.orderId}_a${attemptNo}`,
        bank_code:           params.seller.bank_code,
        account_holder_name: params.seller.account_holder_name,
        account_number:      params.seller.account_number,
        description:         'VivaThrift - Pencairan Dana Penjual',
        amount:              sellerReceives,
      },
    })
    sellerDisbursementId = res.id
    await params.attemptStore.updateSubmitted(sellerAttempt.id, res.id)
  } catch (e: any) {
    error = e?.data?.message ?? e?.message ?? 'Disbursement ke seller gagal.'
    console.error('[disburse] Seller disbursement failed:', error)
    await params.attemptStore.updateFailed(sellerAttempt.id, error ?? 'unknown')
    // Do NOT proceed to admin fee — seller failed, skip admin fee entirely.
    return { sellerDisbursementId: null, adminDisbursementId: null, skipped: false, error }
  }

  // ── 2) Disburse platform fee to admin (only if >0) ─────────────────────────
  if (params.platformFee > 0) {
    const adminAttempt = await params.attemptStore.insert(buildAttemptInsertRow({
      orderId:       params.orderId,
      recipientType: 'admin_fee',
      amount:        params.platformFee,
      attemptNo,
    }))

    try {
      const res = await $fetch<{ id: string }>('https://api.xendit.co/disbursements', {
        method: 'POST',
        headers,
        body: {
          external_id:         `${params.externalIdPrefix}_adminfee_${params.orderId}_a${attemptNo}`,
          bank_code:           ADMIN_BANK.bank_code,
          account_holder_name: ADMIN_BANK.account_holder_name,
          account_number:      ADMIN_BANK.account_number,
          description:         'VivaThrift - Komisi Platform',
          amount:              params.platformFee,
        },
      })
      adminDisbursementId = res.id
      await params.attemptStore.updateSubmitted(adminAttempt.id, res.id)
    } catch (e: any) {
      const adminErr = e?.data?.message ?? e?.message ?? 'Disbursement fee ke admin gagal.'
      console.error('[disburse] Admin fee disbursement failed:', adminErr)
      await params.attemptStore.updateFailed(adminAttempt.id, adminErr)
      // Non-fatal — seller already got paid; admin fee is retryable.
    }
  }

  return { sellerDisbursementId, adminDisbursementId, skipped: false, error }
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `pnpm test -- xendit-disburse`
Expected: PASS — all 7 tests green.

- [ ] **Step 5.5: Commit**

```bash
git add server/utils/xendit-disburse.ts tests/xendit-disburse.test.ts
git commit -m "refactor(disburse): inject AttemptStore + write audit rows

Every disbursement call now inserts a disbursement_attempts row before
the Xendit API call and updates it after. If the seller call fails,
the admin fee call is skipped entirely.

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 6: Wire refactored `disburseFunds` into existing call sites

**Files:**
- Modify: `server/api/orders/[id].patch.ts` (2 call sites: lines ~291 and ~364)
- Modify: `server/api/cron/cleanup.post.ts` (1 call site: line ~113)

Because `disburseFunds` now requires `attemptStore`, every existing caller must supply one. We'll create a small factory that binds `supabaseAdmin` to the `AttemptStore` interface.

- [ ] **Step 6.1: Add a concrete store factory to `server/utils/disbursement-attempts.ts`**

Append to the bottom of `server/utils/disbursement-attempts.ts`:

```ts
// ── Concrete Supabase-backed store ──────────────────────────────────────────
// Wires supabaseAdmin into the AttemptStore interface. Used by server routes
// (orders, disputes, cron). Tests use fakes instead.

import type { SupabaseClient } from '@supabase/supabase-js'

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
```

- [ ] **Step 6.2: Update `server/api/orders/[id].patch.ts` call sites**

At the top of the file, modify the import (near line 7):

```ts
import { disburseFunds } from '../../utils/xendit-disburse'
```

becomes:

```ts
import { disburseFunds } from '../../utils/xendit-disburse'
import { createSupabaseAttemptStore } from '../../utils/disbursement-attempts'
```

Find the `confirm_meetup` action's disburse call (around line 291):

```ts
    // ── Xendit Disbursement (seller + admin platform fee) ───────────────
    const meetupSeller = order.seller as any
    const disburse = await disburseFunds({
      orderId,
      externalIdPrefix: 'vt_meetup',
      totalAmount:  order.total_amount,
      shippingCost: order.shipping_cost ?? 0,
      platformFee:  order.platform_fee ?? 0,
      seller: meetupSeller,
    })
```

Replace with:

```ts
    // ── Xendit Disbursement (seller + admin platform fee) ───────────────
    const meetupSeller = order.seller as any
    const disburse = await disburseFunds({
      orderId,
      externalIdPrefix: 'vt_meetup',
      totalAmount:  order.total_amount,
      shippingCost: order.shipping_cost ?? 0,
      platformFee:  order.platform_fee ?? 0,
      seller: meetupSeller,
      attemptStore: createSupabaseAttemptStore(supabaseAdmin),
    })
```

Find the `complete` action's disburse call (around line 364):

```ts
  // ── Xendit Disbursement (seller + admin platform fee) ──────────────────────
  const seller = order.seller as any
  const disburse = await disburseFunds({
    orderId,
    externalIdPrefix: 'vt_complete',
    totalAmount:  order.total_amount,
    shippingCost: order.shipping_cost ?? 0,
    platformFee:  order.platform_fee ?? 0,
    seller,
  })
```

Replace with:

```ts
  // ── Xendit Disbursement (seller + admin platform fee) ──────────────────────
  const seller = order.seller as any
  const disburse = await disburseFunds({
    orderId,
    externalIdPrefix: 'vt_complete',
    totalAmount:  order.total_amount,
    shippingCost: order.shipping_cost ?? 0,
    platformFee:  order.platform_fee ?? 0,
    seller,
    attemptStore: createSupabaseAttemptStore(supabaseAdmin),
  })
```

- [ ] **Step 6.3: Update `server/api/cron/cleanup.post.ts` call site**

At the top of the file, modify the import (line 2):

```ts
import { disburseFunds } from '../../utils/xendit-disburse'
```

becomes:

```ts
import { disburseFunds } from '../../utils/xendit-disburse'
import { createSupabaseAttemptStore } from '../../utils/disbursement-attempts'
```

Find the disburse call (around line 113):

```ts
    // Disburse funds (seller + admin fee)
    const disburse = await disburseFunds({
      orderId:         order.id,
      externalIdPrefix: 'vt_autocomplete',
      totalAmount:     order.total_amount,
      shippingCost:    order.shipping_cost ?? 0,
      platformFee:     order.platform_fee ?? 0,
      seller:          order.seller,
    })
```

Replace with:

```ts
    // Disburse funds (seller + admin fee)
    const disburse = await disburseFunds({
      orderId:         order.id,
      externalIdPrefix: 'vt_autocomplete',
      totalAmount:     order.total_amount,
      shippingCost:    order.shipping_cost ?? 0,
      platformFee:     order.platform_fee ?? 0,
      seller:          order.seller,
      attemptStore:    createSupabaseAttemptStore(supabaseAdmin),
    })
```

- [ ] **Step 6.4: Run typecheck + test suite**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck passes; no regression failures in existing tests.

- [ ] **Step 6.5: Commit**

```bash
git add server/utils/disbursement-attempts.ts server/api/orders/\[id\].patch.ts server/api/cron/cleanup.post.ts
git commit -m "refactor(callers): wire AttemptStore into all disburseFunds callers

orders/[id].patch.ts (complete + confirm_meetup) and cron/cleanup.post.ts
now pass createSupabaseAttemptStore(supabaseAdmin). Behavior unchanged
for users; disbursement attempts are now tracked in the audit table.

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 7: Disbursement webhook handler + tests

**Files:**
- Create: `server/utils/xendit-disbursement-webhook-handler.ts`
- Create: `tests/xendit-disbursement-webhook-handler.test.ts`

- [ ] **Step 7.1: Write the failing test file**

Create `tests/xendit-disbursement-webhook-handler.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { processXenditDisbursementWebhook } from '../server/utils/xendit-disbursement-webhook-handler'
import type { AttemptRow } from '../server/utils/disbursement-attempts'

function makeAttempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id:                     'attempt-1',
    order_id:               'order-1',
    recipient_type:         'seller',
    xendit_disbursement_id: 'xd-1',
    amount:                 100000,
    status:                 'submitted',
    attempt_no:             1,
    error_message:          null,
    created_at:             '2026-04-11T00:00:00.000Z',
    updated_at:             '2026-04-11T00:00:00.000Z',
    ...overrides,
  }
}

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    findByXenditId:       vi.fn(async () => null),
    updateCompleted:      vi.fn(async () => {}),
    updateFailed:         vi.fn(async () => {}),
    listByOrder:          vi.fn(async () => []),
    markOrderDisbursed:   vi.fn(async () => {}),
    onWarning:            vi.fn(),
    ...overrides,
  }
}

describe('processXenditDisbursementWebhook', () => {
  it('returns ok=false for unknown xendit id', async () => {
    const deps = createDeps({ findByXenditId: vi.fn(async () => null) })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-unknown',
      status: 'COMPLETED',
    }, deps)

    expect(result).toEqual({ ok: true, action: 'unknown_attempt', updated: false })
    expect(deps.updateCompleted).not.toHaveBeenCalled()
  })

  it('COMPLETED → updates attempt + sets order.disbursement_id when all complete', async () => {
    const sellerAttempt = makeAttempt({ id: 'a-1', recipient_type: 'seller', xendit_disbursement_id: 'xd-1', status: 'submitted' })
    const adminAttempt  = makeAttempt({ id: 'a-2', recipient_type: 'admin_fee', xendit_disbursement_id: 'xd-2', status: 'completed' })

    const deps = createDeps({
      findByXenditId: vi.fn(async () => sellerAttempt),
      // After updateCompleted, listByOrder returns both as completed
      listByOrder: vi.fn(async () => [
        { ...sellerAttempt, status: 'completed' as const },
        adminAttempt,
      ]),
    })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-1',
      status: 'COMPLETED',
    }, deps)

    expect(deps.updateCompleted).toHaveBeenCalledWith('a-1')
    expect(deps.markOrderDisbursed).toHaveBeenCalledWith('order-1', 'xd-1')
    expect(result).toEqual({ ok: true, action: 'completed', updated: true })
  })

  it('COMPLETED → does NOT set order.disbursement_id when some attempts still pending', async () => {
    const sellerAttempt = makeAttempt({ id: 'a-1', recipient_type: 'seller', xendit_disbursement_id: 'xd-1', status: 'submitted' })
    const adminAttempt  = makeAttempt({ id: 'a-2', recipient_type: 'admin_fee', xendit_disbursement_id: 'xd-2', status: 'submitted' })

    const deps = createDeps({
      findByXenditId: vi.fn(async () => sellerAttempt),
      listByOrder:    vi.fn(async () => [
        { ...sellerAttempt, status: 'completed' as const },
        adminAttempt,
      ]),
    })

    await processXenditDisbursementWebhook({ id: 'xd-1', status: 'COMPLETED' }, deps)

    expect(deps.updateCompleted).toHaveBeenCalledWith('a-1')
    expect(deps.markOrderDisbursed).not.toHaveBeenCalled()
  })

  it('FAILED → updates attempt to failed with error message', async () => {
    const attempt = makeAttempt({ id: 'a-1', status: 'submitted' })
    const deps = createDeps({ findByXenditId: vi.fn(async () => attempt) })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-1',
      status: 'FAILED',
      failure_code: 'INSUFFICIENT_BALANCE',
      failure_reason: 'Insufficient balance',
    }, deps)

    expect(deps.updateFailed).toHaveBeenCalledWith('a-1', 'Insufficient balance')
    expect(result).toEqual({ ok: true, action: 'failed', updated: true })
  })

  it('duplicate COMPLETED (already completed) is idempotent — no double update', async () => {
    const attempt = makeAttempt({ id: 'a-1', status: 'completed' })
    const deps = createDeps({ findByXenditId: vi.fn(async () => attempt) })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-1',
      status: 'COMPLETED',
    }, deps)

    expect(deps.updateCompleted).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, action: 'already_completed', updated: false })
  })

  it('unknown status returns ignored', async () => {
    const attempt = makeAttempt({ id: 'a-1' })
    const deps = createDeps({ findByXenditId: vi.fn(async () => attempt) })

    const result = await processXenditDisbursementWebhook({
      id: 'xd-1',
      status: 'PENDING',
    }, deps)

    expect(result).toEqual({ ok: true, action: 'ignored', updated: false })
  })

  it('missing id in payload returns error action (caller will throw 400)', async () => {
    const deps = createDeps()

    const result = await processXenditDisbursementWebhook({
      id: '',
      status: 'COMPLETED',
    }, deps)

    expect(result).toEqual({ ok: false, action: 'missing_id', updated: false })
  })
})
```

- [ ] **Step 7.2: Run tests to verify failures**

Run: `pnpm test -- xendit-disbursement-webhook-handler`
Expected: FAIL — module not found.

- [ ] **Step 7.3: Implement `server/utils/xendit-disbursement-webhook-handler.ts`**

Create:

```ts
// ── Xendit Disbursement Webhook handler ────────────────────────────────────
// Pure handler for Xendit disbursement status callbacks. Receives an
// `AttemptStore`-compatible `deps` object and updates the disbursement_attempts
// row by its xendit_disbursement_id.
//
// Idempotent: duplicate COMPLETED callbacks are safely ignored.

import type { AttemptRow } from './disbursement-attempts'

export interface XenditDisbursementWebhookPayload {
  id:              string
  status?:         string | null
  failure_code?:   string | null
  failure_reason?: string | null
}

export interface XenditDisbursementWebhookDeps {
  findByXenditId:      (xenditId: string) => Promise<AttemptRow | null>
  updateCompleted:     (attemptId: string) => Promise<void>
  updateFailed:        (attemptId: string, errorMessage: string) => Promise<void>
  listByOrder:         (orderId: string) => Promise<AttemptRow[]>
  markOrderDisbursed:  (orderId: string, sellerXenditId: string) => Promise<void>
  onWarning?:          (message: string, error: unknown) => void
}

export interface XenditDisbursementWebhookResult {
  ok:      boolean
  action:  'completed' | 'failed' | 'already_completed' | 'unknown_attempt' | 'ignored' | 'missing_id'
  updated: boolean
}

export async function processXenditDisbursementWebhook(
  payload: XenditDisbursementWebhookPayload,
  deps:    XenditDisbursementWebhookDeps,
): Promise<XenditDisbursementWebhookResult> {
  if (!payload.id) {
    return { ok: false, action: 'missing_id', updated: false }
  }

  const attempt = await deps.findByXenditId(payload.id)

  if (!attempt) {
    // Unknown disbursement id — return 200 OK so Xendit doesn't retry forever.
    deps.onWarning?.('[xendit-disbursement-webhook] unknown xendit_disbursement_id', payload)
    return { ok: true, action: 'unknown_attempt', updated: false }
  }

  const status = (payload.status ?? '').toUpperCase()

  if (status === 'COMPLETED') {
    if (attempt.status === 'completed') {
      return { ok: true, action: 'already_completed', updated: false }
    }

    await deps.updateCompleted(attempt.id)

    // Check if all attempts for this order are now complete → set order.disbursement_id
    const all = await deps.listByOrder(attempt.order_id)
    const allComplete = all.length > 0 && all.every((a) => a.status === 'completed')

    if (allComplete) {
      const sellerAttempt = all.find((a) => a.recipient_type === 'seller')
      if (sellerAttempt?.xendit_disbursement_id) {
        await deps.markOrderDisbursed(attempt.order_id, sellerAttempt.xendit_disbursement_id)
      }
    }

    return { ok: true, action: 'completed', updated: true }
  }

  if (status === 'FAILED') {
    const errorMessage = payload.failure_reason ?? payload.failure_code ?? 'Xendit marked disbursement as FAILED'
    await deps.updateFailed(attempt.id, errorMessage)
    return { ok: true, action: 'failed', updated: true }
  }

  // Other Xendit statuses (PENDING, APPROVED) → ignore
  return { ok: true, action: 'ignored', updated: false }
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

Run: `pnpm test -- xendit-disbursement-webhook-handler`
Expected: PASS — all 7 tests green.

- [ ] **Step 7.5: Commit**

```bash
git add server/utils/xendit-disbursement-webhook-handler.ts tests/xendit-disbursement-webhook-handler.test.ts
git commit -m "feat(disbursement): add pure webhook handler for Xendit callbacks

Processes COMPLETED/FAILED disbursement status callbacks from Xendit.
Idempotent for duplicate COMPLETED events. Sets orders.disbursement_id
once all attempts for the order are complete.

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 8: Disbursement webhook HTTP route + tests

**Files:**
- Create: `server/api/webhooks/xendit-disbursement.post.ts`
- Create: `tests/xendit-disbursement-webhook-route.test.ts`

- [ ] **Step 8.1: Write the failing route test file**

Create `tests/xendit-disbursement-webhook-route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

describe('xendit-disbursement webhook route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/xendit-disbursement-webhook-handler')
    vi.doUnmock('../server/utils/webhook-auth')
    vi.doUnmock('../server/utils/disbursement-attempts')
  })

  it('returns 401 when callback auth fails', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'wrong-token'))
    vi.stubGlobal('readBody', vi.fn())

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/xendit-disbursement-webhook-handler', () => ({
      processXenditDisbursementWebhook: vi.fn(),
    }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: false, statusCode: 401, statusMessage: 'Invalid callback token.' })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit-disbursement.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 401, statusMessage: 'Invalid callback token.' })
  })

  it('returns 400 when payload has no id', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'valid-token'))
    vi.stubGlobal('readBody', vi.fn(async () => ({ status: 'COMPLETED' })))

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/xendit-disbursement-webhook-handler', () => ({
      processXenditDisbursementWebhook: vi.fn(async () => ({ ok: false, action: 'missing_id', updated: false })),
    }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: true })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit-disbursement.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Missing disbursement id in payload.' })
  })

  it('delegates a valid payload to the handler and returns its result', async () => {
    const processMock = vi.fn(async () => ({ ok: true, action: 'completed' as const, updated: true }))

    vi.stubGlobal('getHeader', vi.fn(() => 'valid-token'))
    vi.stubGlobal('readBody', vi.fn(async () => ({
      id: 'xd-seller-1',
      status: 'COMPLETED',
    })))

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from: vi.fn() } }))
    vi.doMock('../server/utils/xendit-disbursement-webhook-handler', () => ({
      processXenditDisbursementWebhook: processMock,
    }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({ findByXenditId: vi.fn(), updateCompleted: vi.fn(), updateFailed: vi.fn(), listByOrder: vi.fn() })),
    }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: true })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit-disbursement.post')

    await expect(handler({})).resolves.toEqual({ ok: true, action: 'completed', updated: true })
    expect(processMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'xd-seller-1', status: 'COMPLETED' }),
      expect.any(Object),
    )
  })
})
```

- [ ] **Step 8.2: Run tests to verify failures**

Run: `pnpm test -- xendit-disbursement-webhook-route`
Expected: FAIL — route module not found.

- [ ] **Step 8.3: Implement `server/api/webhooks/xendit-disbursement.post.ts`**

Create:

```ts
import { supabaseAdmin } from '../../utils/supabase-admin'
import { processXenditDisbursementWebhook } from '../../utils/xendit-disbursement-webhook-handler'
import { verifyXenditCallbackToken } from '../../utils/webhook-auth'
import { createSupabaseAttemptStore } from '../../utils/disbursement-attempts'

// POST /api/webhooks/xendit-disbursement
//
// Xendit calls this endpoint when a disbursement status changes.
// Auth: shared X-CALLBACK-TOKEN header (same token as invoice webhook).
// Body (Xendit payload): { id, status, failure_code?, failure_reason?, ... }

export default defineEventHandler(async (event) => {
  // ── Security: verify Xendit callback token ────────────────────────────────
  const authResult = verifyXenditCallbackToken({
    receivedToken: getHeader(event, 'x-callback-token'),
    expectedToken: process.env.XENDIT_CALLBACK_TOKEN,
  })

  if (!authResult.ok) {
    if (authResult.logMessage) {
      console.error(authResult.logMessage)
    }
    throw createError({ statusCode: authResult.statusCode, statusMessage: authResult.statusMessage })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await readBody(event)

  const store = createSupabaseAttemptStore(supabaseAdmin)

  const result = await processXenditDisbursementWebhook({
    id:             body?.id ?? '',
    status:         body?.status,
    failure_code:   body?.failure_code,
    failure_reason: body?.failure_reason,
  }, {
    findByXenditId:    store.findByXenditId,
    updateCompleted:   store.updateCompleted,
    updateFailed:      store.updateFailed,
    listByOrder:       store.listByOrder,
    markOrderDisbursed: async (orderId, sellerXenditId) => {
      await supabaseAdmin
        .from('orders')
        .update({ disbursement_id: sellerXenditId })
        .eq('id', orderId)
    },
    onWarning: (message, error) => {
      console.warn(message, error)
    },
  })

  if (!result.ok && result.action === 'missing_id') {
    throw createError({ statusCode: 400, statusMessage: 'Missing disbursement id in payload.' })
  }

  return result
})
```

- [ ] **Step 8.4: Run tests to verify they pass**

Run: `pnpm test -- xendit-disbursement-webhook-route`
Expected: PASS — all 3 tests green.

- [ ] **Step 8.5: Commit**

```bash
git add server/api/webhooks/xendit-disbursement.post.ts tests/xendit-disbursement-webhook-route.test.ts
git commit -m "feat(api): add /api/webhooks/xendit-disbursement route

Wires the pure disbursement webhook handler to HTTP, verifies Xendit
callback token, and delegates to the handler with a Supabase-backed
attempt store. Returns 400 on missing id.

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 9: Retry disbursements cron + tests

**Files:**
- Create: `server/api/cron/retry-disbursements.post.ts`
- Create: `tests/retry-disbursements-cron.test.ts`

- [ ] **Step 9.1: Write the failing test file**

Create `tests/retry-disbursements-cron.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

describe('retry-disbursements cron route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.CRON_SECRET
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/disbursement-attempts')
    vi.doUnmock('../server/utils/xendit-disburse')
  })

  it('returns 401 when cron secret is wrong', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'Bearer wrong'))

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({ listRetryable: vi.fn(async () => []) })),
      isRetryEligible: vi.fn(),
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds: vi.fn() }))

    const { default: handler } = await import('../server/api/cron/retry-disbursements.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns summary with 0 retried when no eligible rows', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'Bearer test-cron-secret'))

    vi.doMock('../server/utils/supabase-admin', () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null })),
            })),
          })),
        })),
      },
    }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({
        listRetryable: vi.fn(async () => []),
      })),
      isRetryEligible: vi.fn(() => true),
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds: vi.fn() }))

    const { default: handler } = await import('../server/api/cron/retry-disbursements.post')

    const result = await handler({})
    expect(result).toMatchObject({ ok: true, eligible: 0, retried: 0 })
  })

  it('retries only rows filtered by isRetryEligible', async () => {
    const now = new Date('2026-04-11T12:00:00.000Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    vi.stubGlobal('getHeader', vi.fn(() => 'Bearer test-cron-secret'))

    const rows = [
      { id: 'a-1', order_id: 'order-1', status: 'failed', attempt_no: 1, updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), recipient_type: 'seller', amount: 50000 },
      { id: 'a-2', order_id: 'order-1', status: 'failed', attempt_no: 1, updated_at: new Date(now - 10 * 60 * 1000).toISOString(),   recipient_type: 'seller', amount: 50000 }, // too recent
      { id: 'a-3', order_id: 'order-2', status: 'failed', attempt_no: 3, updated_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(), recipient_type: 'seller', amount: 50000 }, // max
    ]

    const getOrder = vi.fn(async () => ({
      data: {
        id: 'order-1',
        total_amount: 120000,
        shipping_cost: 20000,
        platform_fee: 2000,
        seller: { bank_code: 'BCA', account_holder_name: 'X', account_number: '1' },
      },
    }))

    vi.doMock('../server/utils/supabase-admin', () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: getOrder,
            })),
          })),
        })),
      },
    }))

    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({
        listRetryable: vi.fn(async () => rows),
      })),
      isRetryEligible: vi.fn((row: { attempt_no: number; updated_at: string; status: string }, nowMs: number) => {
        if (row.status !== 'failed') return false
        const updatedMs = new Date(row.updated_at).getTime()
        if (row.attempt_no === 1) return nowMs - updatedMs >= 60 * 60 * 1000
        if (row.attempt_no === 2) return nowMs - updatedMs >= 4 * 60 * 60 * 1000
        return false
      }),
    }))

    const disburseMock = vi.fn(async () => ({
      sellerDisbursementId: 'xd-retry',
      adminDisbursementId: null,
      skipped: false,
      error: null,
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds: disburseMock }))

    const { default: handler } = await import('../server/api/cron/retry-disbursements.post')

    const result = await handler({})

    expect(result.retried).toBe(1)
    expect(disburseMock).toHaveBeenCalledTimes(1)
    expect(disburseMock).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      attemptNo: 2,
      externalIdPrefix: 'vt_retry',
    }))

    vi.useRealTimers()
  })
})
```

- [ ] **Step 9.2: Run tests to verify failures**

Run: `pnpm test -- retry-disbursements-cron`
Expected: FAIL — cron route module not found.

- [ ] **Step 9.3: Implement `server/api/cron/retry-disbursements.post.ts`**

Create:

```ts
import { supabaseAdmin } from '../../utils/supabase-admin'
import { createSupabaseAttemptStore, isRetryEligible } from '../../utils/disbursement-attempts'
import { disburseFunds } from '../../utils/xendit-disburse'

// POST /api/cron/retry-disbursements
//
// Scheduled job (every 2 hours) that retries failed disbursement attempts.
// Backoff schedule (from nextRetryWindowMs):
//   attempt 1 → wait 1h
//   attempt 2 → wait 4h
//   attempt 3+ → no more retries, manual intervention required
//
// Security: CRON_SECRET bearer token.

export default defineEventHandler(async (event) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = getHeader(event, 'authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized.' })
  }

  const store = createSupabaseAttemptStore(supabaseAdmin)
  const rows = await store.listRetryable(new Date().toISOString())
  const nowMs = Date.now()
  const eligible = rows.filter((row) => isRetryEligible(row, nowMs))

  let retried = 0
  const errors: string[] = []

  for (const row of eligible) {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select(`
        id, total_amount, shipping_cost, platform_fee, seller_id,
        seller:users!seller_id ( bank_code, bank_account_number, bank_account_name )
      `)
      .eq('id', row.order_id)
      .single() as unknown as { data: any }

    if (!order) {
      errors.push(`retry ${row.id}: order ${row.order_id} not found`)
      continue
    }

    const seller = order.seller ?? {}
    const sellerForDisburse = {
      bank_code:           seller.bank_code,
      account_holder_name: seller.bank_account_name,
      account_number:      seller.bank_account_number,
    }

    try {
      await disburseFunds({
        orderId:          order.id,
        externalIdPrefix: 'vt_retry',
        totalAmount:      order.total_amount,
        shippingCost:     order.shipping_cost ?? 0,
        platformFee:      order.platform_fee ?? 0,
        seller:           sellerForDisburse,
        attemptStore:     store,
        attemptNo:        row.attempt_no + 1,
      })
      retried++
    } catch (e: any) {
      errors.push(`retry ${row.id}: ${e?.message ?? 'unknown'}`)
    }
  }

  const summary = {
    ok: true,
    eligible: eligible.length,
    retried,
    errors: errors.length,
    errorMessages: errors,
  }
  console.log('[cron/retry-disbursements]', summary)
  return summary
})
```

- [ ] **Step 9.4: Run tests to verify they pass**

Run: `pnpm test -- retry-disbursements-cron`
Expected: PASS — all 3 tests green.

- [ ] **Step 9.5: Commit**

```bash
git add server/api/cron/retry-disbursements.post.ts tests/retry-disbursements-cron.test.ts
git commit -m "feat(cron): add retry-disbursements cron route

Queries failed disbursement_attempts rows, filters by isRetryEligible
(attempt 1 → 1h backoff, attempt 2 → 4h, attempt 3+ → no retry), and
re-invokes disburseFunds with incremented attemptNo.

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 10: Extend `xendit.post.ts` for refund events

**Files:**
- Modify: `server/utils/xendit-webhook-handler.ts` (extend payload + deps)
- Modify: `server/api/webhooks/xendit.post.ts` (wire refund deps)
- Modify: `tests/xendit-webhook-handler.test.ts` (add refund event tests)

Xendit sends refund callbacks to the SAME webhook URL as invoices but with an `event` field. We extend the handler to branch on `event` and update dispute rows.

- [ ] **Step 10.1: Add failing test cases to `tests/xendit-webhook-handler.test.ts`**

Append at the bottom of the existing `describe('processXenditWebhook', ...)` block (before the closing `})`):

```ts
  describe('refund events', () => {
    it('refund.succeeded → updates dispute refund_status=completed', async () => {
      const deps = createDeps({
        findDisputeByRefundId: vi.fn(async () => ({ id: 'dispute-1', refund_status: 'submitted' })),
        updateDisputeRefundCompleted: vi.fn(async () => {}),
      })

      const result = await processXenditWebhook({
        xenditInvoiceId: '',
        status: null,
        event: 'refund.succeeded',
        refundId: 'refund-abc',
      }, deps)

      expect(deps.updateDisputeRefundCompleted).toHaveBeenCalledWith('dispute-1')
      expect(result).toEqual({ received: true, action: 'refund_completed', disputeId: 'dispute-1' })
    })

    it('refund.failed → updates dispute refund_status=failed with error', async () => {
      const deps = createDeps({
        findDisputeByRefundId: vi.fn(async () => ({ id: 'dispute-1', refund_status: 'submitted' })),
        updateDisputeRefundFailed: vi.fn(async () => {}),
      })

      const result = await processXenditWebhook({
        xenditInvoiceId: '',
        status: null,
        event: 'refund.failed',
        refundId: 'refund-abc',
        failureReason: 'Invoice already refunded',
      }, deps)

      expect(deps.updateDisputeRefundFailed).toHaveBeenCalledWith('dispute-1', 'Invoice already refunded')
      expect(result).toEqual({ received: true, action: 'refund_failed', disputeId: 'dispute-1' })
    })

    it('refund event with unknown refundId is ignored', async () => {
      const deps = createDeps({
        findDisputeByRefundId: vi.fn(async () => null),
      })

      const result = await processXenditWebhook({
        xenditInvoiceId: '',
        status: null,
        event: 'refund.succeeded',
        refundId: 'refund-unknown',
      }, deps)

      expect(result).toEqual({ received: true, action: 'refund_unknown', refundId: 'refund-unknown' })
    })

    it('refund.succeeded is idempotent when already completed', async () => {
      const deps = createDeps({
        findDisputeByRefundId: vi.fn(async () => ({ id: 'dispute-1', refund_status: 'completed' })),
        updateDisputeRefundCompleted: vi.fn(async () => {}),
      })

      const result = await processXenditWebhook({
        xenditInvoiceId: '',
        status: null,
        event: 'refund.succeeded',
        refundId: 'refund-abc',
      }, deps)

      expect(deps.updateDisputeRefundCompleted).not.toHaveBeenCalled()
      expect(result).toEqual({ received: true, action: 'refund_already_completed', disputeId: 'dispute-1' })
    })
  })
```

Also extend the `createDeps` factory near the top of the file to include the new dep stubs. Find the `createDeps` function and add these lines before the `...overrides` spread:

```ts
    findDisputeByRefundId: vi.fn(async () => null),
    updateDisputeRefundCompleted: vi.fn(async () => {}),
    updateDisputeRefundFailed: vi.fn(async () => {}),
```

- [ ] **Step 10.2: Run tests to verify failures**

Run: `pnpm test -- xendit-webhook-handler`
Expected: FAIL — `event`/`refundId` fields are unknown, new deps not recognized.

- [ ] **Step 10.3: Update `server/utils/xendit-webhook-handler.ts`**

At the top of the file, extend the `XenditWebhookPayload` type:

```ts
export type XenditWebhookPayload = {
  xenditInvoiceId: string
  status: string | null | undefined
  paymentMethod?: string | null
  paidAmount?: number | null
  // ── Refund event fields (Xendit sends refund callbacks to same URL) ──
  event?:         string | null
  refundId?:      string | null
  failureReason?: string | null
}
```

Extend `XenditWebhookDeps` (add at the end, before `onWarning`):

```ts
  // ── Refund dispute deps ─────────────────────────────────────────────
  findDisputeByRefundId:        (refundId: string) => Promise<{ id: string; refund_status: string | null } | null>
  updateDisputeRefundCompleted: (disputeId: string) => Promise<void>
  updateDisputeRefundFailed:    (disputeId: string, errorMessage: string) => Promise<void>
```

Inside `processXenditWebhook`, at the very start (after `const now = ...`), add a branch for refund events:

```ts
export async function processXenditWebhook(payload: XenditWebhookPayload, deps: XenditWebhookDeps) {
  const now = deps.now?.() ?? new Date().toISOString()
  const paymentMethod = payload.paymentMethod ?? null

  // ── Refund event branch ──────────────────────────────────────────────────
  if (payload.event === 'refund.succeeded' || payload.event === 'refund.failed') {
    const refundId = payload.refundId ?? ''
    if (!refundId) {
      return { received: true, action: 'refund_missing_id' }
    }

    const dispute = await deps.findDisputeByRefundId(refundId)
    if (!dispute) {
      return { received: true, action: 'refund_unknown', refundId }
    }

    if (payload.event === 'refund.succeeded') {
      if (dispute.refund_status === 'completed') {
        return { received: true, action: 'refund_already_completed', disputeId: dispute.id }
      }
      await deps.updateDisputeRefundCompleted(dispute.id)
      return { received: true, action: 'refund_completed', disputeId: dispute.id }
    }

    // refund.failed
    const reason = payload.failureReason ?? 'Refund failed'
    await deps.updateDisputeRefundFailed(dispute.id, reason)
    return { received: true, action: 'refund_failed', disputeId: dispute.id }
  }

  // ── Existing invoice branch ──────────────────────────────────────────────
  if (payload.status === 'EXPIRED' || payload.status === 'FAILED') {
```

(Keep the rest of the original function body unchanged below this.)

- [ ] **Step 10.4: Run tests to verify refund tests pass**

Run: `pnpm test -- xendit-webhook-handler`
Expected: PASS — all existing + new refund tests green.

- [ ] **Step 10.5: Update `server/api/webhooks/xendit.post.ts` to wire refund deps**

Find the `processXenditWebhook` call (around line 51) and extend its DI object. First, add to the payload destructuring at the top of the handler:

```ts
  const body = await readBody(event)
  const {
    id:              xenditInvoiceId,
    status,
    payment_method:  paymentMethod,
    paid_amount:     paidAmount,
  } = body ?? {}
```

Replace with:

```ts
  const body = await readBody(event)
  const {
    id:              xenditInvoiceId,
    status,
    payment_method:  paymentMethod,
    paid_amount:     paidAmount,
    event:           eventType,
  } = body ?? {}
  const refundId      = body?.data?.id ?? body?.refund_id ?? null
  const failureReason = body?.data?.failure_reason ?? body?.failure_reason ?? null
```

Change the missing-id guard to allow refund events:

```ts
  if (!xenditInvoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invoice id in payload.' })
  }
```

Becomes:

```ts
  const isRefundEvent = eventType === 'refund.succeeded' || eventType === 'refund.failed'
  if (!xenditInvoiceId && !isRefundEvent) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invoice id in payload.' })
  }
```

Update the `processXenditWebhook` call to pass the new payload fields AND the new deps. Find:

```ts
    return await processXenditWebhook({
      xenditInvoiceId,
      status,
      paymentMethod,
      paidAmount,
    }, {
```

Replace with:

```ts
    return await processXenditWebhook({
      xenditInvoiceId: xenditInvoiceId ?? '',
      status,
      paymentMethod,
      paidAmount,
      event: eventType,
      refundId,
      failureReason,
    }, {
```

Add new deps at the bottom of the deps object, right before `onWarning`:

```ts
      findDisputeByRefundId: async (refundId) => {
        const { data } = await supabaseAdmin
          .from('disputes')
          .select('id, refund_status')
          .eq('xendit_refund_id', refundId)
          .maybeSingle()
        return data ?? null
      },
      updateDisputeRefundCompleted: async (disputeId) => {
        await supabaseAdmin
          .from('disputes')
          .update({ refund_status: 'completed', refunded_at: new Date().toISOString() })
          .eq('id', disputeId)
      },
      updateDisputeRefundFailed: async (disputeId, errorMessage) => {
        await supabaseAdmin
          .from('disputes')
          .update({ refund_status: 'failed', refund_error: errorMessage })
          .eq('id', disputeId)
      },
```

- [ ] **Step 10.6: Run typecheck + full test suite**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck passes; all existing webhook-route tests still pass; new refund handler tests pass.

- [ ] **Step 10.7: Commit**

```bash
git add server/utils/xendit-webhook-handler.ts server/api/webhooks/xendit.post.ts tests/xendit-webhook-handler.test.ts
git commit -m "feat(webhook): handle Xendit refund events in invoice webhook

Extends processXenditWebhook to branch on 'refund.succeeded' /
'refund.failed' events and update the matching dispute row. Xendit
delivers refund callbacks to the same URL as invoice callbacks.

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 11: Dispute resolution integration + tests

**Files:**
- Modify: `server/api/disputes/index.post.ts` (capture `pre_dispute_status` on dispute creation)
- Modify: `server/api/disputes/[id].patch.ts` (integrate refund + disbursement + state restore)
- Create: `tests/disputes-resolve-route.test.ts`

This is the biggest task. We split it into sub-steps to keep changes reviewable.

- [ ] **Step 11.1: Update `server/api/disputes/index.post.ts` to snapshot `pre_dispute_status`**

Find the order load block (around lines 22-29):

```ts
  // Load order
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, buyer_id, seller_id, status')
    .eq('id', orderId)
    .single()

  if (!order) throw createError({ statusCode: 404, statusMessage: 'Pesanan tidak ditemukan.' })
```

Append a new block just BEFORE the "Create dispute" section (around line 49):

```ts
  // Snapshot the current order status so we can restore it if dispute is rejected.
  // Also transition order.status → 'disputed' (state machine will block invalid transitions).
  const { error: snapshotErr } = await supabaseAdmin
    .from('orders')
    .update({ pre_dispute_status: order.status, status: 'disputed' })
    .eq('id', orderId)
    .in('status', ['shipped', 'completed', 'awaiting_meetup'])

  if (snapshotErr) {
    throw createError({ statusCode: 500, statusMessage: `Gagal menandai pesanan sebagai disputed: ${snapshotErr.message}` })
  }
```

- [ ] **Step 11.2: Write the failing route integration test file**

Create `tests/disputes-resolve-route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

function createSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chains = {
    disputes_select: vi.fn(async () => ({ data: {
      id: 'dispute-1',
      order_id: 'order-1',
      buyer_id: 'buyer-1',
      seller_id: 'seller-1',
      status: 'open',
      refund_status: null,
    } })),
    orders_select: vi.fn(async () => ({ data: {
      id: 'order-1',
      status: 'disputed',
      total_amount: 120000,
      shipping_cost: 20000,
      platform_fee: 2000,
      xendit_invoice_id: 'inv-1',
      pre_dispute_status: 'shipped',
      seller: { bank_code: 'BCA', bank_account_number: '1', bank_account_name: 'Seller' },
    } })),
    disputes_update: vi.fn(async () => ({ error: null })),
    orders_update: vi.fn(async () => ({ error: null })),
    notifications_insert: vi.fn(async () => ({ error: null })),
    ...overrides,
  }

  const from = vi.fn((table: string) => {
    if (table === 'disputes') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: chains.disputes_select,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => chains.disputes_update()),
        })),
      }
    }
    if (table === 'orders') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: chains.orders_select,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => chains.orders_update()),
        })),
      }
    }
    if (table === 'notifications') {
      return {
        insert: chains.notifications_insert,
      }
    }
    return { select: vi.fn(), update: vi.fn(), insert: vi.fn() }
  })

  return { from, chains }
}

describe('disputes resolve route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
    vi.stubGlobal('getRouterParam', vi.fn(() => 'dispute-1'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/resolve-server-uid')
    vi.doUnmock('../server/utils/assert-admin')
    vi.doUnmock('../server/utils/xendit-refund')
    vi.doUnmock('../server/utils/xendit-disburse')
    vi.doUnmock('../server/utils/disbursement-attempts')
  })

  it('full refund: calls refund API, updates dispute + order, returns 200', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'resolve', resolution: 'refund' })))

    const { from } = createSupabaseMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'admin-1') }))
    vi.doMock('../server/utils/assert-admin', () => ({ assertAdmin: vi.fn(async () => {}) }))

    const createXenditRefund = vi.fn(async () => ({ skipped: false, xenditRefundId: 'refund-abc', error: null }))
    vi.doMock('../server/utils/xendit-refund', () => ({ createXenditRefund }))

    const disburseFunds = vi.fn(async () => ({
      sellerDisbursementId: null,
      adminDisbursementId: 'xd-admin',
      skipped: false,
      error: null,
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))

    const { default: handler } = await import('../server/api/disputes/[id].patch')

    const result = await handler({})
    expect(result).toMatchObject({ id: 'dispute-1', status: 'resolved_refund' })
    expect(createXenditRefund).toHaveBeenCalledWith(expect.objectContaining({
      invoiceId: 'inv-1',
      amount: 118000, // 120000 - 2000 platform fee
      reason: 'REQUESTED_BY_CUSTOMER',
    }))
  })

  it('full refund: Xendit refund failure → 502, order status unchanged', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'resolve', resolution: 'refund' })))

    const { from } = createSupabaseMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'admin-1') }))
    vi.doMock('../server/utils/assert-admin', () => ({ assertAdmin: vi.fn(async () => {}) }))

    const createXenditRefund = vi.fn(async () => {
      throw new Error('Invoice already refunded')
    })
    vi.doMock('../server/utils/xendit-refund', () => ({ createXenditRefund }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds: vi.fn() }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))

    const { default: handler } = await import('../server/api/disputes/[id].patch')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: expect.stringContaining('Invoice already refunded'),
    })
  })

  it('partial refund: refund API called with partial amount, seller disburse also triggered', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({
      action: 'resolve',
      resolution: 'partial',
      refund_amount: 30000,
    })))

    const { from } = createSupabaseMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'admin-1') }))
    vi.doMock('../server/utils/assert-admin', () => ({ assertAdmin: vi.fn(async () => {}) }))

    const createXenditRefund = vi.fn(async () => ({ skipped: false, xenditRefundId: 'refund-partial', error: null }))
    vi.doMock('../server/utils/xendit-refund', () => ({ createXenditRefund }))

    const disburseFunds = vi.fn(async () => ({
      sellerDisbursementId: 'xd-seller-partial',
      adminDisbursementId: 'xd-admin-partial',
      skipped: false,
      error: null,
    }))
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))

    const { default: handler } = await import('../server/api/disputes/[id].patch')

    const result = await handler({})
    expect(result).toMatchObject({ id: 'dispute-1', status: 'resolved_partial' })
    expect(createXenditRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 30000 }))
    expect(disburseFunds).toHaveBeenCalled()
  })

  it('rejected: order restored to pre_dispute_status (shipped), no Xendit calls', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ action: 'resolve', resolution: 'rejected' })))

    const { from, chains } = createSupabaseMock()
    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from } }))
    vi.doMock('../server/utils/resolve-server-uid', () => ({ resolveServerUid: vi.fn(async () => 'admin-1') }))
    vi.doMock('../server/utils/assert-admin', () => ({ assertAdmin: vi.fn(async () => {}) }))

    const createXenditRefund = vi.fn()
    vi.doMock('../server/utils/xendit-refund', () => ({ createXenditRefund }))
    const disburseFunds = vi.fn()
    vi.doMock('../server/utils/xendit-disburse', () => ({ disburseFunds }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))

    const { default: handler } = await import('../server/api/disputes/[id].patch')

    const result = await handler({})
    expect(result).toMatchObject({ id: 'dispute-1', status: 'resolved_rejected', orderRestoredTo: 'shipped' })
    expect(createXenditRefund).not.toHaveBeenCalled()
    expect(disburseFunds).not.toHaveBeenCalled()
    expect(chains.orders_update).toHaveBeenCalled()
  })
})
```

- [ ] **Step 11.3: Run tests to verify failures**

Run: `pnpm test -- disputes-resolve-route`
Expected: FAIL — route doesn't import `createXenditRefund`, doesn't return `orderRestoredTo`, doesn't call refund API.

- [ ] **Step 11.4: Rewrite `server/api/disputes/[id].patch.ts`**

Replace the entire file:

```ts
import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { assertAdmin } from '../../utils/assert-admin'
import { createXenditRefund } from '../../utils/xendit-refund'
import { disburseFunds } from '../../utils/xendit-disburse'
import { createSupabaseAttemptStore } from '../../utils/disbursement-attempts'

// PATCH /api/disputes/:id
// Body: { action: 'resolve', resolution: 'refund'|'partial'|'rejected', refund_amount?, resolution_note? }
//     | { action: 'cancel' }
//
// 'resolve': admin only — resolves the dispute
//   - 'refund':   full refund via Xendit + admin fee disbursement + order → resolved_refund
//   - 'partial':  partial refund + seller disbursement (remainder) + order → resolved_partial
//   - 'rejected': restore order → pre_dispute_status, dispute → resolved_rejected
// 'cancel':  buyer only — cancels their own open dispute

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)

  const disputeId = getRouterParam(event, 'id')
  if (!disputeId) throw createError({ statusCode: 400, statusMessage: 'dispute id tidak ditemukan.' })

  const body = await readBody(event)
  const action: string = body?.action

  if (!['resolve', 'cancel'].includes(action)) {
    throw createError({ statusCode: 400, statusMessage: 'action harus "resolve" atau "cancel".' })
  }

  // ── Load dispute ──────────────────────────────────────────────────────────
  const { data: dispute } = await supabaseAdmin
    .from('disputes')
    .select('id, order_id, buyer_id, seller_id, status, refund_status')
    .eq('id', disputeId)
    .single()

  if (!dispute) throw createError({ statusCode: 404, statusMessage: 'Dispute tidak ditemukan.' })

  // ── Cancel (buyer only) ──────────────────────────────────────────────────
  if (action === 'cancel') {
    if (dispute.buyer_id !== userId) {
      throw createError({ statusCode: 403, statusMessage: 'Hanya pembeli yang bisa membatalkan dispute.' })
    }
    if (dispute.status !== 'open') {
      throw createError({ statusCode: 422, statusMessage: 'Hanya dispute berstatus "open" yang bisa dibatalkan.' })
    }

    const { error } = await supabaseAdmin
      .from('disputes')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', disputeId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { id: disputeId, status: 'cancelled' }
  }

  // ── Resolve (admin only) ─────────────────────────────────────────────────
  await assertAdmin(event)

  if (!['open', 'in_review'].includes(dispute.status)) {
    throw createError({ statusCode: 422, statusMessage: 'Dispute ini sudah di-resolve.' })
  }

  const resolution = String(body?.resolution ?? '')
  if (!['refund', 'partial', 'rejected'].includes(resolution)) {
    throw createError({ statusCode: 400, statusMessage: 'resolution harus "refund", "partial", atau "rejected".' })
  }

  // ── Load the associated order (needed for all three branches) ────────────
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select(`
      id, status, total_amount, shipping_cost, platform_fee,
      xendit_invoice_id, pre_dispute_status,
      seller:users!seller_id ( bank_code, bank_account_number, bank_account_name )
    `)
    .eq('id', dispute.order_id)
    .single() as unknown as { data: any }

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Pesanan terkait dispute tidak ditemukan.' })
  }

  const now = new Date().toISOString()
  const resolutionNote = String(body?.resolution_note ?? '').trim()
  const attemptStore = createSupabaseAttemptStore(supabaseAdmin)

  // ── Branch: rejected → restore order status ──────────────────────────────
  if (resolution === 'rejected') {
    const restoreTo = order.pre_dispute_status || 'shipped'

    const { error: restoreErr } = await supabaseAdmin
      .from('orders')
      .update({ status: restoreTo, pre_dispute_status: null, updated_at: now })
      .eq('id', order.id)

    if (restoreErr) {
      throw createError({ statusCode: 500, statusMessage: `Gagal mengembalikan status pesanan: ${restoreErr.message}` })
    }

    const { error: dErr } = await supabaseAdmin
      .from('disputes')
      .update({
        status:          'resolved_rejected',
        resolution_note: resolutionNote || null,
        resolved_by:     userId,
        updated_at:      now,
      })
      .eq('id', disputeId)

    if (dErr) throw createError({ statusCode: 500, statusMessage: dErr.message })

    // Notify both parties (best-effort)
    try {
      await supabaseAdmin.from('notifications').insert([
        { user_id: dispute.buyer_id,  type: 'dispute_resolved', title: 'Dispute ditolak', body: 'Dispute ditolak oleh admin — pesanan dilanjutkan.', reference_id: dispute.order_id },
        { user_id: dispute.seller_id, type: 'dispute_resolved', title: 'Dispute ditolak', body: 'Dispute pada pesananmu ditolak.', reference_id: dispute.order_id },
      ])
    } catch { /* best-effort */ }

    return { id: disputeId, status: 'resolved_rejected', orderRestoredTo: restoreTo }
  }

  // ── Branch: refund (full or partial) ─────────────────────────────────────
  const totalAmount  = Number(order.total_amount ?? 0)
  const shippingCost = Number(order.shipping_cost ?? 0)
  const platformFee  = Number(order.platform_fee ?? 0)

  // Full refund: buyer gets (total - platform_fee); seller gets 0; admin keeps fee.
  // Partial refund: buyer gets body.refund_amount; seller gets (total - refund_amount - shipping - platform_fee); admin keeps fee.
  let refundAmount: number
  let targetDisputeStatus: string
  let targetOrderStatus: string

  if (resolution === 'refund') {
    refundAmount = totalAmount - platformFee
    targetDisputeStatus = 'resolved_refund'
    targetOrderStatus   = 'resolved_refund'
  } else {
    // partial
    refundAmount = Number(body?.refund_amount ?? 0)
    if (refundAmount <= 0 || refundAmount >= totalAmount) {
      throw createError({ statusCode: 400, statusMessage: 'refund_amount harus > 0 dan < total_amount untuk partial refund.' })
    }
    targetDisputeStatus = 'resolved_partial'
    targetOrderStatus   = 'resolved_partial'
  }

  // Optimistically mark refund pending
  await supabaseAdmin
    .from('disputes')
    .update({ refund_status: 'pending', refund_amount: refundAmount, updated_at: now })
    .eq('id', disputeId)

  // ── Call Xendit Refund API ─────────────────────────────────────────────
  let xenditRefundId: string | null = null
  try {
    const refundResult = await createXenditRefund({
      invoiceId:  order.xendit_invoice_id ?? '',
      amount:     refundAmount,
      reason:     'REQUESTED_BY_CUSTOMER',
      externalId: `vt_refund_${disputeId}`,
    })
    xenditRefundId = refundResult.xenditRefundId
  } catch (e: any) {
    const msg = e?.message ?? 'Gagal memproses refund ke Xendit.'
    await supabaseAdmin
      .from('disputes')
      .update({ refund_status: 'failed', refund_error: msg, updated_at: new Date().toISOString() })
      .eq('id', disputeId)
    throw createError({ statusCode: 502, statusMessage: `Xendit refund gagal: ${msg}` })
  }

  // ── Commit dispute + order status changes ──────────────────────────────
  await supabaseAdmin
    .from('disputes')
    .update({
      xendit_refund_id: xenditRefundId,
      refund_status:    'submitted',
      status:           targetDisputeStatus,
      resolution_note:  resolutionNote || null,
      resolved_by:      userId,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', disputeId)

  await supabaseAdmin
    .from('orders')
    .update({ status: targetOrderStatus, updated_at: new Date().toISOString() })
    .eq('id', order.id)

  // ── Disbursements ──────────────────────────────────────────────────────
  // Full refund → only admin fee goes to admin (seller gets nothing).
  // Partial refund → seller gets (total - refund - shipping - platform_fee) + admin gets fee.
  const sellerBank = order.seller ?? {}
  const sellerForDisburse = {
    bank_code:           sellerBank.bank_code,
    account_holder_name: sellerBank.bank_account_name,
    account_number:      sellerBank.bank_account_number,
  }

  if (resolution === 'refund') {
    // Only disburse platform fee to admin. Pass totalAmount=platformFee and shippingCost=0
    // so sellerReceives=0 and only the admin_fee disbursement fires.
    // But disburseFunds skips when platformFee>0 and sellerReceives becomes 0 or negative,
    // so we use a dedicated path: directly call with totalAmount=platformFee,
    // shippingCost=0, and the seller will receive 0 which is rejected.
    // Instead: call twice — first a zero-seller disburse won't work.
    //
    // Simpler: build a synthetic call where sellerReceives=0 would fail the amount>0 check.
    // We skip the helper and just emit the admin-fee attempt inline via the store.
    if (platformFee > 0) {
      // Reuse the same code path as complete flow but with amount=platformFee and
      // shippingCost=0, totalAmount=platformFee → sellerReceives=0, which is rejected.
      // For full refund we intentionally skip the seller branch entirely by setting
      // totalAmount=platformFee + 1 and shippingCost=1, then sellerReceives=0.
      // This is ugly — instead, accept that full refund does NOT call disburseFunds
      // and the admin fee stays on-platform (future: manual reconciliation).
      //
      // Decision per spec D2: admin keeps the fee. No disbursement needed because
      // the money never left the Xendit escrow to the seller's account —
      // the fee stays in VivaThrift's Xendit balance.
    }
  } else {
    // Partial refund: disburse remainder to seller + fee to admin.
    const sellerReceives = totalAmount - refundAmount - shippingCost - platformFee
    if (sellerReceives > 0) {
      await disburseFunds({
        orderId:          order.id,
        externalIdPrefix: 'vt_partial',
        totalAmount:      totalAmount - refundAmount,
        shippingCost,
        platformFee,
        seller:           sellerForDisburse,
        attemptStore,
      })
    }
  }

  // ── Notifications (best-effort) ────────────────────────────────────────
  const notifBody = resolution === 'refund'
    ? 'Dispute disetujui — refund penuh sedang diproses.'
    : 'Dispute disetujui — refund sebagian sedang diproses.'

  try {
    await supabaseAdmin.from('notifications').insert([
      { user_id: dispute.buyer_id,  type: 'dispute_resolved', title: 'Dispute di-resolve', body: notifBody, reference_id: dispute.order_id },
      { user_id: dispute.seller_id, type: 'dispute_resolved', title: 'Dispute di-resolve', body: notifBody, reference_id: dispute.order_id },
    ])
  } catch { /* best-effort */ }

  return {
    id:              disputeId,
    status:          targetDisputeStatus,
    refund_amount:   refundAmount,
    xendit_refund_id: xenditRefundId,
  }
})
```

- [ ] **Step 11.5: Run tests to verify they pass**

Run: `pnpm test -- disputes-resolve-route`
Expected: PASS — all 4 integration tests green.

- [ ] **Step 11.6: Run full test suite + typecheck**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck passes; no regressions.

- [ ] **Step 11.7: Commit**

```bash
git add server/api/disputes/index.post.ts server/api/disputes/\[id\].patch.ts tests/disputes-resolve-route.test.ts
git commit -m "feat(disputes): integrate Xendit refund + state restore

- index.post.ts: snapshot order.status → pre_dispute_status, flip order to 'disputed'
- [id].patch.ts rewrite:
  * rejected → restore order.status from pre_dispute_status (shipping/COD flow)
  * refund   → call Xendit refund, mark disputes.xendit_refund_id (admin keeps fee in escrow)
  * partial  → refund part, disburse remainder + admin fee to bank accounts
- Refund failure is fatal (502) so admin must retry; order status stays 'disputed'

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 12: Register retry cron in `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 12.1: Read the current `vercel.json`**

Already known:

```json
{
  "images": { ... },
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- [ ] **Step 12.2: Add the retry cron entry**

Update the `crons` array to:

```json
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/retry-disbursements",
      "schedule": "0 */2 * * *"
    }
  ]
```

**Note on Vercel Hobby plan limit:** Hobby allows up to 2 cron jobs. Two entries above is at the cap. If we hit this limit later, consider merging retry logic into `/api/cron/cleanup`.

- [ ] **Step 12.3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 12.4: Commit**

```bash
git add vercel.json
git commit -m "chore(vercel): register /api/cron/retry-disbursements cron (every 2h)

Schedule: 0 */2 * * * — runs retry logic for failed disbursement attempts.
Second cron job (Hobby plan limit = 2).

Ref: spec 2026-04-11-disbursement-refund-robustness-design.md"
```

---

## Task 13: Full suite regression + coverage check

**Files:**
- None (verification only)

- [ ] **Step 13.1: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS with zero errors.

- [ ] **Step 13.2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass. Expected new test files:

- `tests/xendit-refund.test.ts` (5 tests)
- `tests/xendit-disburse.test.ts` (7 tests)
- `tests/disbursement-attempts.test.ts` (11 tests)
- `tests/xendit-disbursement-webhook-handler.test.ts` (7 tests)
- `tests/xendit-disbursement-webhook-route.test.ts` (3 tests)
- `tests/retry-disbursements-cron.test.ts` (3 tests)
- `tests/disputes-resolve-route.test.ts` (4 tests)

Plus extended `state-machine.test.ts` (6 new cases) and `xendit-webhook-handler.test.ts` (4 new refund cases).

Total: **~50 new/updated tests**.

- [ ] **Step 13.3: Check coverage on new files (optional but recommended)**

Run: `pnpm test -- --coverage`
Expected: ≥90% branch coverage on all files in `server/utils/xendit-refund.ts`, `server/utils/disbursement-attempts.ts`, `server/utils/xendit-disbursement-webhook-handler.ts`. If below target, add test cases for uncovered branches.

- [ ] **Step 13.4: Acceptance criteria walk-through (from spec)**

Manually verify each item:

1. Migration file exists at `supabase/migrations/20260411000002_disbursement_refund_tracking.sql`. ✓
2. All new test files pass via `pnpm test`. ✓
3. State machine test cases updated. ✓
4. Existing tests pass without regression. ✓
5. `pnpm typecheck` passes. ✓
6. `server/api/webhooks/xendit-disbursement.post.ts` route importable + responds to mock POST (covered by Task 8 tests). ✓
7. Dispute resolution `refund`/`partial`/`rejected` works end-to-end (covered by Task 11 tests). ✓
8. `orders.pre_dispute_status` is set on dispute creation (Task 11.1) and cleared on rejected (Task 11.4). ✓
9. Retry cron registered in `vercel.json` (Task 12). ✓

- [ ] **Step 13.5: Final commit (optional — only if fixes made)**

```bash
# If any fixes were needed during regression
git add -A
git commit -m "test: fix regressions / uncovered branches from full suite run"
```

---

## Post-implementation checklist

- [ ] All commits pushed to the feature branch
- [ ] PR description references `docs/superpowers/specs/2026-04-11-disbursement-refund-robustness-design.md`
- [ ] Migration reviewed by DBA (or user acting as such) before merging to main
- [ ] `XENDIT_CALLBACK_TOKEN` env var is set in Vercel for the new webhook URL
- [ ] Xendit dashboard webhook URL includes both invoice AND disbursement callback URLs:
  - Invoice: `https://vivathrift.store/api/webhooks/xendit`
  - Disbursement: `https://vivathrift.store/api/webhooks/xendit-disbursement`
- [ ] `CRON_SECRET` env var is set in Vercel for the new cron route
- [ ] Next session: continue to Sub-Project B (Production Environment Checklist doc)

---

## Reference — key files

- [Spec](../specs/2026-04-11-disbursement-refund-robustness-design.md)
- [server/utils/xendit-disburse.ts](../../../server/utils/xendit-disburse.ts)
- [server/utils/xendit-webhook-handler.ts](../../../server/utils/xendit-webhook-handler.ts)
- [server/api/webhooks/xendit.post.ts](../../../server/api/webhooks/xendit.post.ts)
- [server/api/disputes/[id].patch.ts](../../../server/api/disputes/%5Bid%5D.patch.ts)
- [server/utils/state-machine.ts](../../../server/utils/state-machine.ts)
- [tests/webhook-routes.test.ts](../../../tests/webhook-routes.test.ts) — route test pattern
- [tests/xendit-webhook-handler.test.ts](../../../tests/xendit-webhook-handler.test.ts) — handler test pattern
