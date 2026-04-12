import { describe, it, expect } from 'vitest'
import { canTransition } from '../server/utils/state-machine'

// ── Order transitions ─────────────────────────────────────────────────────────

describe('Order state machine', () => {
  it('allows pending_payment → confirmed', () => {
    expect(canTransition('order', 'pending_payment', 'confirmed')).toBe(true)
  })

  it('allows pending_payment → awaiting_meetup (COD flow)', () => {
    expect(canTransition('order', 'pending_payment', 'awaiting_meetup')).toBe(true)
  })

  it('allows pending_payment → cancelled', () => {
    expect(canTransition('order', 'pending_payment', 'cancelled')).toBe(true)
  })

  it('allows pending_payment → payment_failed', () => {
    expect(canTransition('order', 'pending_payment', 'payment_failed')).toBe(true)
  })

  it('allows confirmed → shipped', () => {
    expect(canTransition('order', 'confirmed', 'shipped')).toBe(true)
  })

  it('allows confirmed → cancelled', () => {
    expect(canTransition('order', 'confirmed', 'cancelled')).toBe(true)
  })

  it('allows shipped → completed', () => {
    expect(canTransition('order', 'shipped', 'completed')).toBe(true)
  })

  it('allows shipped → disputed', () => {
    expect(canTransition('order', 'shipped', 'disputed')).toBe(true)
  })

  it('allows awaiting_meetup → completed', () => {
    expect(canTransition('order', 'awaiting_meetup', 'completed')).toBe(true)
  })

  it('allows awaiting_meetup → disputed', () => {
    expect(canTransition('order', 'awaiting_meetup', 'disputed')).toBe(true)
  })

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

  // Terminal states
  it('blocks any transition from completed (terminal)', () => {
    expect(canTransition('order', 'completed', 'shipped')).toBe(false)
    expect(canTransition('order', 'completed', 'disputed')).toBe(false)
    expect(canTransition('order', 'completed', 'cancelled')).toBe(false)
  })

  it('blocks any transition from cancelled (terminal)', () => {
    expect(canTransition('order', 'cancelled', 'confirmed')).toBe(false)
    expect(canTransition('order', 'cancelled', 'completed')).toBe(false)
  })

  it('blocks any transition from payment_failed (terminal)', () => {
    expect(canTransition('order', 'payment_failed', 'pending_payment')).toBe(false)
  })

  it('blocks invalid skip transitions', () => {
    expect(canTransition('order', 'pending_payment', 'completed')).toBe(false)
    expect(canTransition('order', 'confirmed', 'completed')).toBe(false)
    expect(canTransition('order', 'pending_payment', 'shipped')).toBe(false)
  })

  it('returns false for null from state', () => {
    expect(canTransition('order', null, 'confirmed')).toBe(false)
  })

  it('returns false for unknown states', () => {
    expect(canTransition('order', 'ghost_state', 'confirmed')).toBe(false)
  })
})

// ── Offer transitions ─────────────────────────────────────────────────────────

describe('Offer state machine', () => {
  it('allows pending → accepted', () => {
    expect(canTransition('offer', 'pending', 'accepted')).toBe(true)
  })

  it('allows pending → rejected', () => {
    expect(canTransition('offer', 'pending', 'rejected')).toBe(true)
  })

  it('allows pending → expired', () => {
    expect(canTransition('offer', 'pending', 'expired')).toBe(true)
  })

  it('allows pending → superseded', () => {
    expect(canTransition('offer', 'pending', 'superseded')).toBe(true)
  })

  it('allows accepted → completed', () => {
    expect(canTransition('offer', 'accepted', 'completed')).toBe(true)
  })

  it('allows accepted → cancelled', () => {
    expect(canTransition('offer', 'accepted', 'cancelled')).toBe(true)
  })

  it('allows accepted → expired_checkout', () => {
    expect(canTransition('offer', 'accepted', 'expired_checkout')).toBe(true)
  })

  it('blocks any transition from rejected (terminal)', () => {
    expect(canTransition('offer', 'rejected', 'pending')).toBe(false)
    expect(canTransition('offer', 'rejected', 'accepted')).toBe(false)
  })

  it('blocks any transition from completed (terminal)', () => {
    expect(canTransition('offer', 'completed', 'accepted')).toBe(false)
  })

  it('blocks invalid skip: pending → completed', () => {
    expect(canTransition('offer', 'pending', 'completed')).toBe(false)
  })
})

// ── Product transitions ───────────────────────────────────────────────────────

describe('Product state machine', () => {
  it('allows draft → active', () => {
    expect(canTransition('product', 'draft', 'active')).toBe(true)
  })

  it('allows active → inactive', () => {
    expect(canTransition('product', 'active', 'inactive')).toBe(true)
  })

  it('allows active → sold', () => {
    expect(canTransition('product', 'active', 'sold')).toBe(true)
  })

  it('allows active → moderated', () => {
    expect(canTransition('product', 'active', 'moderated')).toBe(true)
  })

  it('allows inactive → active (reactivate)', () => {
    expect(canTransition('product', 'inactive', 'active')).toBe(true)
  })

  it('allows moderated → active (approved)', () => {
    expect(canTransition('product', 'moderated', 'active')).toBe(true)
  })

  it('allows moderated → banned', () => {
    expect(canTransition('product', 'moderated', 'banned')).toBe(true)
  })

  it('blocks any transition from sold (terminal)', () => {
    expect(canTransition('product', 'sold', 'active')).toBe(false)
    expect(canTransition('product', 'sold', 'inactive')).toBe(false)
  })

  it('blocks any transition from banned (terminal)', () => {
    expect(canTransition('product', 'banned', 'active')).toBe(false)
    expect(canTransition('product', 'banned', 'moderated')).toBe(false)
  })

  it('blocks draft → sold (must activate first)', () => {
    expect(canTransition('product', 'draft', 'sold')).toBe(false)
  })
})
