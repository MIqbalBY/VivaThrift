/**
 * VivaThrift State Machine — Valid transitions for all lifecycle entities.
 * Enforced on server routes; never guard only on client.
 *
 * Usage:
 *   if (!canTransition(order.status, 'shipped')) throw createError(...)
 */

// ── Order State Machine ────────────────────────────────────────────────────────

const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending_payment:  ['confirmed', 'cancelled', 'payment_failed'],
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

// ── Offer State Machine ────────────────────────────────────────────────────────

const OFFER_TRANSITIONS: Record<string, string[]> = {
  pending:          ['accepted', 'rejected', 'expired', 'superseded'],
  accepted:         ['completed', 'cancelled', 'expired_checkout', 'expired'],
  rejected:         [],     // terminal
  expired:          [],     // terminal
  superseded:       [],     // terminal
  completed:        [],     // terminal
  cancelled:        [],     // terminal
  expired_checkout: [],     // terminal
}

// ── Product State Machine ──────────────────────────────────────────────────────

const PRODUCT_TRANSITIONS: Record<string, string[]> = {
  draft:     ['active'],
  active:    ['inactive', 'sold', 'moderated'],
  inactive:  ['active'],
  sold:      [],          // terminal — archived after 90 days
  moderated: ['active', 'banned'],
  banned:    [],          // terminal
}

// ── Generic helper ─────────────────────────────────────────────────────────────

export type EntityType = 'order' | 'offer' | 'product'

const TRANSITION_MAP: Record<EntityType, Record<string, string[]>> = {
  order:   ORDER_TRANSITIONS,
  offer:   OFFER_TRANSITIONS,
  product: PRODUCT_TRANSITIONS,
}

/**
 * Returns true if the `to` state is a valid successor of `from` for the given entity.
 */
export function canTransition(entity: EntityType, from: string | null, to: string): boolean {
  if (!from) return false
  return TRANSITION_MAP[entity][from]?.includes(to) ?? false
}

/**
 * Throws a 422 createError if the transition is not allowed.
 */
export function assertTransition(entity: EntityType, from: string | null, to: string): void {
  if (!canTransition(entity, from, to)) {
    throw createError({
      statusCode: 422,
      statusMessage: `Transisi ${entity} dari '${from}' ke '${to}' tidak valid.`,
    })
  }
}
