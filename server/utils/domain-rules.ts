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

// ── Platform Fee ──────────────────────────────────────────────────────────────
//
// Fee dibebankan ke PENJUAL (dipotong saat settlement/disbursement),
// bukan ditambahkan ke tagihan pembeli.
// Pembeli hanya membayar subtotal (+ ongkir bila shipping).
//
// Tier berdasarkan subtotal (harga × kuantitas, tanpa ongkir):
//   ≤ Rp 100.000       → + Rp   1.000 flat
//   Rp 100.001–500.000 → + Rp   2.000 flat
//   > Rp 500.000       → + 0,5% × subtotal (dibulatkan)

export function calculatePlatformFee(subtotal: number): number {
  if (subtotal <= 100_000) return 1_000
  if (subtotal <= 500_000) return 2_000
  return Math.round(subtotal * 0.005)
}

// ── Payment Gateway Fee (Xendit) ───────────────────────────────────────────
//
// Dibebankan ke penjual agar total checkout buyer tetap bersih.
// Rumus: round(baseAmount * percent / 100) + flat
// Nilai percent dan flat dikontrol via env untuk menyesuaikan dashboard Xendit.

function toSafeNumber(value: string | undefined, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

interface GatewayFeeRule {
  percent: number
  flat: number
}

function parseGatewayFeeByChannelMap(): Record<string, GatewayFeeRule> {
  const raw = process.env.XENDIT_PAYMENT_FEE_BY_CHANNEL_JSON
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, { percent?: unknown; flat?: unknown }>
    const entries = Object.entries(parsed)
    const normalized: Record<string, GatewayFeeRule> = {}
    for (const [key, val] of entries) {
      const percent = Math.max(0, Number(val?.percent ?? 0))
      const flat = Math.max(0, Math.round(Number(val?.flat ?? 0)))
      if (!Number.isFinite(percent) || !Number.isFinite(flat)) continue
      normalized[key.toLowerCase()] = { percent, flat }
    }
    return normalized
  } catch {
    console.warn('[domain-rules] XENDIT_PAYMENT_FEE_BY_CHANNEL_JSON invalid, fallback to global fee.')
    return {}
  }
}

export function calculatePaymentGatewayFee(baseAmount: number, channel?: string | null): number {
  const safeBase = Math.max(0, Math.round(baseAmount))
  if (safeBase <= 0) return 0

  const byChannel = parseGatewayFeeByChannelMap()
  const channelKey = String(channel ?? '').trim().toLowerCase()
  const selected = channelKey ? byChannel[channelKey] : undefined

  const percent = selected?.percent ?? Math.max(0, toSafeNumber(process.env.XENDIT_PAYMENT_FEE_PERCENT, 0))
  const flat = selected?.flat ?? Math.max(0, Math.round(toSafeNumber(process.env.XENDIT_PAYMENT_FEE_FLAT, 0)))
  const feeFromPercent = Math.round((safeBase * percent) / 100)

  return feeFromPercent + flat
}

export interface CommissionResult {
  subtotal: number
  platformFee: number
  /** Estimasi transfer ke penjual setelah biaya layanan (belum termasuk fee gateway). */
  sellerReceives: number
}

export interface PaymentChargeBreakdown {
  gatewayFeeBase: number
  gatewayFeeTax: number
  sellerDisbursementFee: number
  adminDisbursementFee: number
  total: number
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export function calculatePaymentChargeBreakdown(baseAmount: number, channel?: string | null): PaymentChargeBreakdown {
  const safeBase = Math.max(0, Math.round(baseAmount))
  if (safeBase <= 0) {
    return {
      gatewayFeeBase: 0,
      gatewayFeeTax: 0,
      sellerDisbursementFee: 0,
      adminDisbursementFee: 0,
      total: 0,
    }
  }

  const byChannel = parseGatewayFeeByChannelMap()
  const channelKey = String(channel ?? '').trim().toLowerCase()
  const selected = channelKey ? byChannel[channelKey] : undefined

  const percent = selected?.percent ?? Math.max(0, toSafeNumber(process.env.XENDIT_PAYMENT_FEE_PERCENT, 0))
  const flat = selected?.flat ?? Math.max(0, Math.round(toSafeNumber(process.env.XENDIT_PAYMENT_FEE_FLAT, 0)))
  const taxPercent = Math.max(0, toSafeNumber(process.env.XENDIT_PAYMENT_FEE_TAX_PERCENT, 11))
  const sellerDisbursementFee = Math.max(0, Math.round(toSafeNumber(process.env.XENDIT_DISBURSEMENT_FEE_SELLER_FLAT, 2500)))
  const autoAdminDisburse = isTruthyEnv(process.env.XENDIT_AUTO_DISBURSE_ADMIN_FEE)
  const adminDisbursementFee = autoAdminDisburse
    ? Math.max(0, Math.round(toSafeNumber(process.env.XENDIT_DISBURSEMENT_FEE_ADMIN_FLAT, 2500)))
    : 0

  const gatewayFeeBase = Math.round((safeBase * percent) / 100) + flat
  const gatewayFeeTax = Math.round((gatewayFeeBase * taxPercent) / 100)
  // Split-cost model: buyer is charged only payment processing fee + tax.
  // Disbursement fees are charged later at seller/admin withdrawal time.
  const total = gatewayFeeBase + gatewayFeeTax

  return {
    gatewayFeeBase,
    gatewayFeeTax,
    sellerDisbursementFee,
    adminDisbursementFee,
    total,
  }
}

/** @deprecated Gunakan calculatePlatformFee secara langsung. */
export function calculateCommission(
  offeredPrice: number,
  quantity: number,
): CommissionResult {
  const subtotal = offeredPrice * quantity
  const platformFee = calculatePlatformFee(subtotal)
  return {
    subtotal,
    platformFee,
    sellerReceives: Math.max(0, subtotal - platformFee),
  }
}
