import { describe, expect, it } from 'vitest'

import {
  calculateShippingInsuranceFee,
  getOrderShippingWarnings,
  getShippingCollectionOptions,
  getShippingHandlingBadges,
  isShippingInsuranceEligible,
  normalizeShippingCollectionType,
  validateCheckoutReadiness,
} from '../app/utils/shipping-checkout'

describe('shipping checkout options', () => {
  it('only enables shipping insurance for electronics-like categories', () => {
    expect(isShippingInsuranceEligible('Elektronik')).toBe(true)
    expect(isShippingInsuranceEligible('Gadget & Aksesoris')).toBe(true)
    expect(isShippingInsuranceEligible('Fashion')).toBe(false)
  })

  it('calculates insurance as 0.5 percent of declared value when enabled', () => {
    expect(calculateShippingInsuranceFee({ declaredValue: 5_999_000, enabled: true, eligible: true })).toBe(29_995)
    expect(calculateShippingInsuranceFee({ declaredValue: 5_999_000, enabled: false, eligible: true })).toBe(0)
  })

  it('normalizes and exposes supported collection types', () => {
    expect(normalizeShippingCollectionType('drop-off')).toBe('drop_off')
    expect(normalizeShippingCollectionType('pickup')).toBe('pickup')
    expect(getShippingCollectionOptions().map((option) => option.key)).toEqual(['pickup', 'drop_off'])
  })

  it('blocks shipping checkout when address or phone is incomplete', () => {
    expect(validateCheckoutReadiness({
      shippingMethod: 'shipping',
      buyerAddress: null,
      buyerPhone: '081234567890',
      selectedRate: { price: 10000 },
      meetupLocation: '',
    })).toContain('alamat pengiriman')

    expect(validateCheckoutReadiness({
      shippingMethod: 'shipping',
      buyerAddress: { full_address: 'ITS Sukolilo', postal_code: '60111' },
      buyerPhone: '',
      selectedRate: { price: 10000 },
      meetupLocation: '',
    })).toContain('Nomor HP')
  })

  it('builds seller warnings before creating a Biteship shipment', () => {
    expect(getOrderShippingWarnings({
      shippingMethod: 'shipping',
      sellerPhone: '',
      buyerPhone: '081234567890',
      status: 'confirmed',
    })).toEqual(expect.arrayContaining([
      expect.stringContaining('Nomor HP penjual'),
    ]))
  })

  it('shows handling badges for insured and fragile shipments', () => {
    expect(getShippingHandlingBadges({
      shippingIsInsured: true,
      shippingInsuranceFee: 12000,
      shippingIsFragile: true,
    })).toEqual(expect.arrayContaining([
      'Asuransi Aktif',
      'Fragile / Pecah Belah',
    ]))
  })
})
