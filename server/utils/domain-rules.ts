/**
 * VivaThrift Domain Rules — Single source of truth for all business constants.
 * Used by server routes only. Never import this in client code.
 */

// ── Product ──────────────────────────────────────────────────────────────────

/** Product statuses that block checkout and new offers */
export const PRODUCT_UNAVAILABLE_STATUSES = [
  'sold', 'inactive', 'moderated', 'banned', 'deleted',
] as const

export type ProductStatus = 'draft' | 'active' | 'inactive' | 'sold' | 'moderated' | 'banned'

export function isProductAvailable(status: string | null): boolean {
  return status === 'active'
}

// ── Offer ─────────────────────────────────────────────────────────────────────

export const OFFER_RULES = {
  /** Seller must respond within this many hours or offer auto-expires */
  expiryHours: 24,
  /** Buyer must checkout within this many minutes after offer is accepted */
  checkoutWindowMinutes: 60,
  /** Minimum offer = 50% of listing price if no min_offer_price is set */
  minOfferPercent: 0.5,
  /** Max pending offers per (product, buyer) pair before superseding */
  maxOffersPerChat: 10,
} as const

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'superseded' | 'completed' | 'cancelled' | 'expired_checkout'

/**
 * Validates offer price against product constraints.
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateOfferPrice(
  offeredPrice: number,
  productPrice: number,
  minOfferPrice: number | null,
): { valid: boolean; error?: string } {
  if (!Number.isInteger(offeredPrice) || offeredPrice <= 0) {
    return { valid: false, error: 'Harga harus bilangan bulat positif.' }
  }

  if (offeredPrice >= productPrice) {
    return { valid: false, error: 'Penawaran harus lebih rendah dari harga listing.' }
  }

  const effectiveMin = minOfferPrice ?? Math.floor(productPrice * OFFER_RULES.minOfferPercent)
  if (offeredPrice < effectiveMin) {
    return {
      valid: false,
      error: `Penawaran minimum Rp ${effectiveMin.toLocaleString('id-ID')}.`,
    }
  }

  return { valid: true }
}

// ── Order ─────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'payment_failed'
  | 'disputed'
  | 'resolved_refund'
  | 'resolved_release'

/** SLA in hours per order state before auto-action */
export const ORDER_SLA_HOURS: Partial<Record<OrderStatus, number>> = {
  pending_payment: 1,    // auto-cancel + release offer
  confirmed: 72,         // reminder to seller
  shipped: 168,          // 7 days → auto-complete
  disputed: 336,         // 14 days → escalate
}

// ── Commission ────────────────────────────────────────────────────────────────

export const COMMISSION_RATES = {
  standard:       0.05,   // 5% for all transactions
  premium_seller: 0.04,   // 4% for rating >= 4.8 and 50+ completed orders
  new_seller:     0.03,   // 3% for first 3 months (onboarding incentive)
} as const

export type SellerTier = keyof typeof COMMISSION_RATES

export interface CommissionResult {
  subtotal: number
  platformFee: number
  sellerReceives: number
}

export function calculateCommission(
  offeredPrice: number,
  quantity: number,
  sellerTier: SellerTier = 'standard',
): CommissionResult {
  const subtotal = offeredPrice * quantity
  const rate = COMMISSION_RATES[sellerTier]
  const platformFee = Math.round(subtotal * rate)
  return {
    subtotal,
    platformFee,
    sellerReceives: subtotal - platformFee,
  }
}
