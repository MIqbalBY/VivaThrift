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
  | 'awaiting_meetup'
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
  awaiting_meetup: 48,   // COD meetup SLA — auto-escalate if no meetup
  shipped: 168,          // 7 days → auto-complete
  disputed: 336,         // 14 days → escalate
}

// ── Shipping & COD ────────────────────────────────────────────────────────────

export type ShippingMethod = 'cod' | 'shipping'

/** Campus meetup locations for COD handover (sorted alphabetically) */
export const MEETUP_LOCATIONS = [
  { id: 'aula_asrama',     label: 'Aula Asrama ITS' },
  { id: 'rektorat',        label: 'Depan Rektorat ITS' },
  { id: 'gedung_robotika', label: 'Gedung Robotika ITS' },
  { id: 'kantin_pusat',    label: 'Kantin Pusat ITS' },
  { id: 'masjid_manarul',  label: 'Masjid Manarul Ilmi ITS' },
  { id: 'research_center', label: 'Research Center ITS' },
  { id: 'taman_alumni',    label: 'Taman Alumni ITS' },
  { id: 'taman_infinits',  label: 'Taman Infinits' },
  { id: 'tower_1',         label: 'Tower 1 ITS' },
  { id: 'tower_2',         label: 'Tower 2 ITS' },
  { id: 'tower_3',         label: 'Tower 3 ITS' },
] as const

export type MeetupLocationId = typeof MEETUP_LOCATIONS[number]['id'] | 'other'

/** OTP configuration for COD meetup handover */
export const MEETUP_OTP = {
  length: 6,
  /** OTP valid for the lifetime of the order (no expiry separate from order SLA) */
} as const

/** Validates meetup location: accepts known IDs or any custom text (>= 2 chars) from "Lainnya" option */
export function isValidMeetupLocation(id: string): boolean {
  if (!id || !id.trim()) return false
  if (MEETUP_LOCATIONS.some(loc => loc.id === id)) return true
  // Custom text entered via "Lainnya" option must be at least 2 characters
  return id.trim().length >= 2
}

/** Generates a numeric OTP of the configured length */
export function generateMeetupOTP(): string {
  const { length } = MEETUP_OTP
  const digits: string[] = []
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < length; i++) {
    digits.push(String(randomValues[i]! % 10))
  }
  return digits.join('')
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
