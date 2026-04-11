import { describe, it, expect } from 'vitest'
import {
  calculatePlatformFee,
  validateOfferPrice,
  isProductAvailable,
  isValidMeetupLocation,
  generateMeetupOTP,
  MEETUP_OTP,
} from '../server/utils/domain-rules'

// ── calculatePlatformFee ──────────────────────────────────────────────────────

describe('calculatePlatformFee', () => {
  it('returns Rp 1.000 for subtotal exactly Rp 100.000 (tier boundary)', () => {
    expect(calculatePlatformFee(100_000)).toBe(1_000)
  })

  it('returns Rp 1.000 for subtotal below Rp 100.000', () => {
    expect(calculatePlatformFee(50_000)).toBe(1_000)
    expect(calculatePlatformFee(1)).toBe(1_000)
    expect(calculatePlatformFee(99_999)).toBe(1_000)
  })

  it('returns Rp 2.000 for subtotal Rp 100.001', () => {
    expect(calculatePlatformFee(100_001)).toBe(2_000)
  })

  it('returns Rp 2.000 for subtotal exactly Rp 500.000 (tier boundary)', () => {
    expect(calculatePlatformFee(500_000)).toBe(2_000)
  })

  it('returns 0.5% for subtotal above Rp 500.000', () => {
    expect(calculatePlatformFee(500_001)).toBe(Math.round(500_001 * 0.005))
    expect(calculatePlatformFee(1_000_000)).toBe(5_000)
    expect(calculatePlatformFee(2_000_000)).toBe(10_000)
  })

  it('rounds 0.5% fee correctly', () => {
    // 600.001 * 0.005 = 3000.005 → rounds to 3001
    expect(calculatePlatformFee(600_001)).toBe(Math.round(600_001 * 0.005))
  })
})

// ── validateOfferPrice ────────────────────────────────────────────────────────

describe('validateOfferPrice', () => {
  it('rejects non-integer prices', () => {
    expect(validateOfferPrice(50_000.5, 100_000, null).valid).toBe(false)
  })

  it('rejects zero or negative prices', () => {
    expect(validateOfferPrice(0, 100_000, null).valid).toBe(false)
    expect(validateOfferPrice(-1, 100_000, null).valid).toBe(false)
  })

  it('rejects offer >= listing price', () => {
    expect(validateOfferPrice(100_000, 100_000, null).valid).toBe(false)
    expect(validateOfferPrice(200_000, 100_000, null).valid).toBe(false)
  })

  it('rejects offer below default 50% minimum', () => {
    // 50% of 100.000 = 50.000 — offer of 49.999 should be rejected
    expect(validateOfferPrice(49_999, 100_000, null).valid).toBe(false)
  })

  it('accepts offer at exactly 50% of listing price', () => {
    expect(validateOfferPrice(50_000, 100_000, null).valid).toBe(true)
  })

  it('respects custom minOfferPrice over default 50%', () => {
    // Custom min = 70.000, so 60.000 should fail even though > 50%
    expect(validateOfferPrice(60_000, 100_000, 70_000).valid).toBe(false)
    expect(validateOfferPrice(70_000, 100_000, 70_000).valid).toBe(true)
  })

  it('accepts valid offer between min and listing price', () => {
    expect(validateOfferPrice(75_000, 100_000, null).valid).toBe(true)
  })
})

// ── isProductAvailable ────────────────────────────────────────────────────────

describe('isProductAvailable', () => {
  it('returns true only for active status', () => {
    expect(isProductAvailable('active')).toBe(true)
  })

  it('returns false for all non-active statuses', () => {
    const unavailable = ['sold', 'inactive', 'moderated', 'banned', 'draft', 'deleted', null, '']
    for (const s of unavailable) {
      expect(isProductAvailable(s), `status: ${s}`).toBe(false)
    }
  })
})

// ── isValidMeetupLocation ─────────────────────────────────────────────────────

describe('isValidMeetupLocation', () => {
  it('accepts known meetup location IDs', () => {
    expect(isValidMeetupLocation('rektorat')).toBe(true)
    expect(isValidMeetupLocation('tower_1')).toBe(true)
    expect(isValidMeetupLocation('masjid_manarul')).toBe(true)
  })

  it('accepts custom text of 2+ chars (from Lainnya option)', () => {
    expect(isValidMeetupLocation('Kantin FTI')).toBe(true)
    expect(isValidMeetupLocation('ab')).toBe(true)
  })

  it('rejects empty or whitespace-only strings', () => {
    expect(isValidMeetupLocation('')).toBe(false)
    expect(isValidMeetupLocation('   ')).toBe(false)
  })

  it('rejects single character custom text', () => {
    // Single char that is not a known ID
    expect(isValidMeetupLocation('X')).toBe(false)
  })
})

// ── generateMeetupOTP ─────────────────────────────────────────────────────────

describe('generateMeetupOTP', () => {
  it('returns a string of exactly configured length', () => {
    const otp = generateMeetupOTP()
    expect(otp).toHaveLength(MEETUP_OTP.length)
  })

  it('contains only digit characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateMeetupOTP()).toMatch(/^\d+$/)
    }
  })

  it('generates non-identical OTPs across calls (entropy check)', () => {
    const otps = new Set(Array.from({ length: 50 }, () => generateMeetupOTP()))
    // With 6 digits = 10^6 possibilities, 50 calls producing < 50 unique is astronomically unlikely
    expect(otps.size).toBeGreaterThan(10)
  })
})
