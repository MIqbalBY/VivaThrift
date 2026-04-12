# Sub-Project A — Disbursement & Refund Robustness

**Date:** 2026-04-11
**Sprint:** Sprint 1 (Revenue & Production Blocking)
**Covers TODO items:** 1.1, 1.2, 1.3
**Status:** Design approved, pending implementation plan

---

## Context

VivaThrift is a C2C thrift marketplace for Institut Teknologi Sepuluh Nopember students. Buyers pay via Xendit Invoice, and after order completion the platform disburses funds: the seller gets `total_amount - shipping_cost - platform_fee`, and the admin (Bank Jago `103438588617` a.n. Muhammad Iqbal Baiduri Yamani) gets `platform_fee`.

The current implementation in [server/utils/xendit-disburse.ts](../../../server/utils/xendit-disburse.ts) already handles both recipients, but lacks:

1. **Observability** into disbursement outcomes (Xendit sends async status callbacks that are not processed)
2. **Retry logic** for failed disbursement calls
3. **Audit trail** of attempts per order
4. **Refund integration** when admin resolves a dispute as `refund` or `partial` — currently the dispute handler only updates status and sends notifications, it does not call Xendit's refund API

This sub-project closes those gaps with database-backed tracking, webhook-driven status updates, cron-based retry, and a refund integration in the dispute resolution endpoint.

---

## Decisions Made During Brainstorming

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Option B — Medium reconciliation** (attempts table + webhook + retry cron) | Balances robustness with scope; avoids admin dashboard UI (Sprint 3 territory) |
| D2 | **A2 — Platform fee tetap dipotong saat full refund** | Industry standard (Tokopedia/Shopee); platform did the work of handling transaction + dispute |
| D3 | **B1 — Partial refund: sisa dicairkan ke seller** | Clean state; no hanging balance requiring manual reconciliation |
| D4 | **C2 — Rejected dispute: order kembali ke pre-dispute state** | Non-destructive; reuses normal completion flow without duplicating disbursement logic |
| D5 | **Track `pre_dispute_status` on orders** | Simpler than audit log; explicit single-column restore target |
| D6 | **State transition `disputed → shipped/awaiting_meetup` direct** (no loop via `resolved_rejected`) | Avoids double-transition complexity; dispute row carries the audit trail |
| D7 | **Refund is fatal at API level** (revert dispute status on Xendit error) | Admin must know + retry; bad UX to mark resolved when money didn't move |
| D8 | **Disbursement is non-fatal at API level** (order completion succeeds even if disburse fails) | Preserves existing behavior; retry cron handles failures |
| D9 | **Extend existing `xendit.post.ts` webhook for refund events** (don't create separate route) | Xendit uses single callback URL; simpler dashboard config |

---

## Architecture Overview

### Components

```text
┌────────────────────────────────────────────────────────────────┐
│                      Dispute Resolution                         │
│  server/api/disputes/[id].patch.ts                             │
│     ├─ refund    → createXenditRefund + disburse platform_fee  │
│     ├─ partial   → refund + disburse seller + disburse fee     │
│     └─ rejected  → restore orders.status = pre_dispute_status  │
└──────────┬─────────────────────────────────────┬───────────────┘
           │                                     │
           ▼                                     ▼
┌──────────────────────┐              ┌──────────────────────────┐
│ xendit-refund.ts     │              │ xendit-disburse.ts       │
│ (NEW utility)        │              │ (REFACTORED utility)     │
│ createXenditRefund() │              │ disburseFunds()          │
└──────────┬───────────┘              │  + attemptStore inject   │
           │                          └────────────┬─────────────┘
           │                                       │
           ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────────┐
│ disputes table       │              │ disbursement_attempts    │
│ + xendit_refund_id   │              │ (NEW table)              │
│ + refund_status      │              │ audit trail + retry      │
│ + refund_error       │              └────────────┬─────────────┘
│ + refunded_at        │                           │
└──────────────────────┘                           │
                                                   │
           ┌───────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────┐
│  server/api/webhooks/xendit-disbursement   │
│  (NEW route)                                │
│  processXenditDisbursementWebhook()         │
│    ├─ COMPLETED → attempt.status=completed │
│    ├─ FAILED    → attempt.status=failed    │
│    └─ idempotent (check before update)     │
└────────────────────────────────────────────┘

           ┌────────────────────────────────┐
           │  server/api/cron/retry-        │
           │  disbursements.post.ts         │
           │  (NEW cron, 0 */2 * * *)       │
           │    - query failed + eligible   │
           │    - exponential backoff       │
           │    - max 3 attempts            │
           │    - Sentry alert on max       │
           └────────────────────────────────┘
```

---

## Database Schema

### Migration: `20260411000002_disbursement_refund_tracking.sql`

```sql
-- ============================================================================
-- Disbursement attempts — audit trail + retry tracking
-- ============================================================================
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

-- Auto-update updated_at (reuses existing trigger_set_updated_at() from migration 20260405000001)
CREATE TRIGGER set_disbursement_attempts_updated_at
  BEFORE UPDATE ON disbursement_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- Disputes: refund tracking columns
-- ============================================================================
ALTER TABLE disputes
  ADD COLUMN xendit_refund_id TEXT,
  ADD COLUMN refund_status    TEXT CHECK (refund_status IN ('pending', 'submitted', 'completed', 'failed')),
  ADD COLUMN refund_error     TEXT,
  ADD COLUMN refunded_at      TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_disputes_xendit_refund_id
  ON disputes(xendit_refund_id)
  WHERE xendit_refund_id IS NOT NULL;

-- ============================================================================
-- Orders: pre_dispute_status for rejected dispute restoration
-- ============================================================================
ALTER TABLE orders
  ADD COLUMN pre_dispute_status TEXT;
```

**Rollback considerations:** All additions are reversible. If the migration is rolled back, existing disbursement flow (unchanged behavior) continues to work without the audit trail.

---

## State Machine Updates

**File:** [server/utils/state-machine.ts](../../../server/utils/state-machine.ts)

### Before

```ts
disputed:         ['resolved_refund', 'resolved_release'],
resolved_refund:  [],
resolved_release: [],
```

### After

```ts
disputed:         ['resolved_refund', 'resolved_partial', 'shipped', 'awaiting_meetup'],
resolved_refund:  [],  // terminal: full refund done
resolved_partial: [],  // terminal: partial refund + sisa disbursed
// resolved_release REMOVED (replaced by direct transition back to shipped/awaiting_meetup)
```

**Migration note for state machine:** `resolved_release` is removed entirely. Any orders in the database with this legacy status (likely zero since production hasn't launched) would fail transitions. If they exist in prod, a data migration is required to map them to `resolved_refund`.

---

## New / Modified Files

### NEW Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260411000002_disbursement_refund_tracking.sql` | Schema changes |
| `server/utils/xendit-refund.ts` | Pure Xendit Refund API wrapper |
| `server/utils/disbursement-attempts.ts` | CRUD helpers for attempts table (injectable store) |
| `server/utils/xendit-disbursement-webhook-handler.ts` | Pure handler for disbursement webhook events |
| `server/api/webhooks/xendit-disbursement.post.ts` | HTTP route for Xendit disbursement callbacks |
| `server/api/cron/retry-disbursements.post.ts` | Cron route for failed-attempt retry |
| `tests/xendit-refund.test.ts` | Unit tests for refund utility |
| `tests/xendit-disburse.test.ts` | Unit tests for refactored disburse |
| `tests/disbursement-attempts.test.ts` | Unit tests for store helpers |
| `tests/xendit-disbursement-webhook-handler.test.ts` | Handler tests |
| `tests/xendit-disbursement-webhook-route.test.ts` | Route wiring tests |
| `tests/disputes-resolve-route.test.ts` | Integration test for dispute resolution with refund |
| `tests/retry-disbursements-cron.test.ts` | Retry cron eligibility tests |

### MODIFIED Files

| File | Changes |
|------|---------|
| `server/utils/xendit-disburse.ts` | Inject `attemptStore`; write attempt rows before/after Xendit API call |
| `server/utils/state-machine.ts` | Update `disputed` transitions (add `resolved_partial`, `shipped`, `awaiting_meetup`; remove `resolved_release`) |
| `server/api/disputes/[id].patch.ts` | Integrate refund + disbursement + state restoration |
| `server/api/orders/[id].patch.ts` | Set `pre_dispute_status` when dispute is created (if dispute creation is handled here; otherwise dispute creation endpoint) |
| `server/api/disputes/index.post.ts` | Capture `pre_dispute_status` from current order status when creating dispute |
| `server/api/webhooks/xendit.post.ts` | Extend to handle refund event types (`refund.succeeded`, `refund.failed`) |
| `server/api/cron/cleanup.post.ts` | Use refactored `disburseFunds` with attempt store |
| `vercel.json` | Add new cron entry for `/api/cron/retry-disbursements` |
| `tests/state-machine.test.ts` | New test cases for updated transitions |

---

## Data Flow Diagrams

### Flow A: Happy Path Disbursement

1. Buyer clicks "Complete" → `PATCH /api/orders/[id] {action: 'complete'}`
2. `orders/[id].patch.ts`:
   - `assertTransition('order', 'shipped', 'completed')`
   - `UPDATE orders SET status='completed'`
   - `disburseFunds({orderId, seller, platformFee, attemptStore})`
3. `disburseFunds`:
   - `INSERT disbursement_attempts (recipient_type='seller', status='pending', attempt_no=1)`
   - `POST api.xendit.co/disbursements` (seller payload)
   - On success: `UPDATE disbursement_attempts SET status='submitted', xendit_disbursement_id=X`
   - `INSERT disbursement_attempts (recipient_type='admin_fee', status='pending', attempt_no=1)`
   - `POST api.xendit.co/disbursements` (admin fee payload)
   - On success: `UPDATE disbursement_attempts SET status='submitted', xendit_disbursement_id=Y`
4. Later (async): Xendit sends `POST /api/webhooks/xendit-disbursement`
   - `verifyXenditCallbackToken`
   - `processXenditDisbursementWebhook`:
     - `findAttemptByXenditId(X)` → found, currently `submitted`
     - Status is `COMPLETED` → `UPDATE attempts SET status='completed'`
     - If all attempts for `order_id` now `completed` → `UPDATE orders SET disbursement_id=<seller id>`

### Flow B: Failed Disbursement → Retry

1. `disburseFunds` hits Xendit API error:
   - Attempt row already inserted (status=`pending`)
   - On `catch`: `UPDATE disbursement_attempts SET status='failed', error_message='<msg>'`
   - Return `{ error, skipped: false }` — caller does not block on this
2. Cron `/api/cron/retry-disbursements` runs every 2 hours:
   - Query: `SELECT * FROM disbursement_attempts WHERE status='failed' AND attempt_no < 3 AND updated_at < now() - retry_window(attempt_no)`
   - `retry_window`: `attempt_no=1 → 1h`, `attempt_no=2 → 4h`, `attempt_no=3 → never (max reached)`
   - For each eligible row:
     - `INSERT disbursement_attempts (attempt_no = prev + 1, status='pending', ...)`
     - Retry Xendit POST with same external_id (Xendit idempotency)
     - Update new row with result
3. If `attempt_no` reaches 3 and still fails → Sentry alert + admin notification (non-blocking)

### Flow C: Full Refund via Dispute Resolution

1. Admin → `PATCH /api/disputes/[id] {resolution: 'refund'}`
2. `disputes/[id].patch.ts`:
   - `assertAdmin`
   - Load `dispute` + join `orders` (need `xendit_invoice_id`, `total_amount`, `platform_fee`, `pre_dispute_status`)
   - `refundAmount = order.total_amount - order.platform_fee` (decision A2)
   - Begin optimistic update: `UPDATE disputes SET refund_status='pending'`
   - Call `createXenditRefund({invoiceId, amount: refundAmount, reason: 'REQUESTED_BY_CUSTOMER', externalId: 'vt_refund_<disputeId>'})`
   - On error:
     - `UPDATE disputes SET refund_status='failed', refund_error='<msg>'`
     - Throw 502 with user-friendly message
   - On success:
     - `UPDATE disputes SET xendit_refund_id=<id>, refund_status='submitted', status='resolved_refund'`
     - `assertTransition('order', 'disputed', 'resolved_refund')` → `UPDATE orders SET status='resolved_refund'`
     - Call `disburseFunds` for platform fee only → admin gets fee (async, non-blocking)
     - Notify buyer + seller
     - Return 200
3. Later: Xendit sends refund webhook (`refund.succeeded`) to `xendit.post.ts`
   - Handler updates `UPDATE disputes SET refund_status='completed', refunded_at=now()`

### Flow D: Partial Refund

Same as Flow C but with 3 parallel money movements:

1. Refund `body.refund_amount` to buyer via Xendit Refund API
2. Disburse `total_amount - refund_amount - platform_fee` to seller via `disburseFunds`
3. Disburse `platform_fee` to admin (part of step 2 via existing helper)

Admin sees success response as soon as refund API call returns `submitted`. Disbursements are async and tracked via `disbursement_attempts` (subject to retry cron if they fail).

Order status: `disputed → resolved_partial`

### Flow E: Rejected Dispute

1. Admin → `PATCH /api/disputes/[id] {resolution: 'rejected'}`
2. `disputes/[id].patch.ts`:
   - Load dispute + order
   - `preStatus = order.pre_dispute_status` (must not be null; if null, fallback to `'shipped'` with warning log)
   - `assertTransition('order', 'disputed', preStatus)` — valid per updated state machine
   - `UPDATE orders SET status=preStatus, pre_dispute_status=NULL`
   - `UPDATE disputes SET status='resolved_rejected'` (dispute status, NOT order status)
   - Notify buyer ("dispute ditolak, pesanan dilanjutkan") + seller ("dispute ditolak")
   - No Xendit API calls — normal completion flow will handle disbursement when buyer/cron completes order
3. Later: buyer clicks "Complete" → normal `disburseFunds` flow runs

---

## Error Handling Rules

| Scenario | Behavior |
|----------|----------|
| Xendit disbursement API returns 5xx | Write attempt row as `failed`; do not throw; order status update stays |
| Xendit disbursement API returns 4xx (permanent) | Write attempt as `failed`; cap retry at 1 attempt for 4xx (not 3); flag for admin review |
| Xendit refund API fails | Revert `disputes.refund_status='failed'`; do NOT update order status; throw 502 to admin |
| Webhook receives unknown `xendit_disbursement_id` | Log warning; return 200 OK (don't trigger Xendit retry) |
| Webhook receives duplicate callback (already `completed`) | Skip update; return 200 OK (idempotent) |
| Cron overlap (two invocations for same attempt) | Use optimistic concurrency on `attempt_no` to prevent double-retry |
| Partial refund: refund succeeds but seller disburse fails | Refund stays, seller disburse enters retry queue — no blocking |

---

## Testing Strategy

### Test Pyramid

```text
Layer 1: Pure utility tests (fastest)
  ├─ xendit-refund.test.ts
  ├─ xendit-disburse.test.ts (refactored)
  └─ disbursement-attempts.test.ts

Layer 2: Handler service tests
  └─ xendit-disbursement-webhook-handler.test.ts

Layer 3: Route wiring tests
  ├─ xendit-disbursement-webhook-route.test.ts
  └─ disputes-resolve-route.test.ts

Layer 4: State machine tests (extend existing)
  └─ state-machine.test.ts (edited)

Layer 5: Cron logic tests
  └─ retry-disbursements-cron.test.ts
```

### Key Test Cases

Tests for `xendit-disburse.ts`:

- Happy path: 2 attempts inserted (seller + admin_fee), both marked `submitted`
- Seller API error: seller attempt `failed`, admin attempt not created
- Admin API error after seller success: seller `submitted`, admin `failed`, returns partial success
- Missing bank info: skipped=true, no attempts inserted

Tests for `xendit-refund.ts`:

- Happy path: returns `xenditRefundId`
- Xendit 4xx: throws with error message
- Xendit 5xx: throws with retry hint
- Missing invoice id: returns `skipped=true`

Tests for `disbursement-attempts.ts`:

- create: inserts row
- findByXenditId: returns match or null
- findFailedRetryable: correctly filters by attempt_no + time window
- updateStatus: happy path + concurrent update guard

Tests for `xendit-disbursement-webhook-handler.ts`:

- COMPLETED → attempt updated, order disbursement_id set if all complete
- FAILED → attempt updated, retry eligible
- Duplicate COMPLETED → idempotent (no double update)
- Unknown xendit disbursement id → ok=true, updated=false
- Malformed payload → throws handled upstream

Tests for `xendit-disbursement-webhook-route.ts`:

- Valid signature → 200 OK
- Invalid signature → 401
- Missing payload → 400
- Delegates to handler correctly

Tests for `disputes-resolve-route.ts`:

- Full refund: refund API called, dispute + order updated
- Full refund Xendit error: dispute status NOT changed, 502 returned
- Partial refund: refund API + seller disburse both triggered
- Rejected: order.status restored from pre_dispute_status
- Rejected without pre_dispute_status: fallback to 'shipped' + warning
- Non-admin caller: 403

Tests for `retry-disbursements-cron.ts`:

- attempt_no=1, updated_at < now-1h → eligible
- attempt_no=1, updated_at < now-30m → NOT eligible
- attempt_no=2, updated_at < now-4h → eligible
- attempt_no=3 → NOT eligible (max)
- Auth: missing CRON_SECRET → 401

New cases for `state-machine.test.ts`:

- `disputed → resolved_refund` ✓
- `disputed → resolved_partial` ✓
- `disputed → shipped` ✓
- `disputed → awaiting_meetup` ✓
- `disputed → resolved_release` ✗ (removed)

### Coverage Target

≥ 90% branch coverage on all new files.

---

## Acceptance Criteria

1. Migration `20260411000002_disbursement_refund_tracking.sql` applies successfully to local Supabase
2. All new test files pass (`pnpm test`)
3. State machine test file passes with updated cases
4. Existing test suite passes without regression
5. `pnpm typecheck` passes
6. `server/api/webhooks/xendit-disbursement.post.ts` route is importable and responds to mock POST
7. Dispute resolution with `refund` / `partial` / `rejected` works end-to-end in integration tests
8. `orders.pre_dispute_status` is set on dispute creation and cleared on resolution
9. Retry cron is registered in `vercel.json` with schedule `0 */2 * * *`

---

## Out of Scope (Deferred)

- Admin UI for manual retry of failed disbursements (Sprint 3 item 8.5)
- E2E test against Xendit sandbox (Sprint 4 item 13.5)
- Real-time disbursement dashboard (Sprint 3 item 8.1)
- Biteship webhook enrichment (Sub-Project C, deferred)
- Production environment verification (Sub-Project B, next in this session)

---

## References

- [server/utils/xendit-disburse.ts](../../../server/utils/xendit-disburse.ts) — current disbursement utility
- [server/api/disputes/[id].patch.ts](../../../server/api/disputes/%5Bid%5D.patch.ts) — dispute resolution endpoint
- [server/utils/state-machine.ts](../../../server/utils/state-machine.ts) — order lifecycle
- [server/api/webhooks/xendit.post.ts](../../../server/api/webhooks/xendit.post.ts) — invoice webhook pattern to mirror
- [tests/webhook-routes.test.ts](../../../tests/webhook-routes.test.ts) — route test pattern to mirror
- [Xendit Disbursement API](https://developers.xendit.co/api-reference/#create-disbursement)
- [Xendit Refund API](https://developers.xendit.co/api-reference/#create-refund)
