import { describe, expect, it } from 'vitest'

import {
  calculateShippingInsuranceFee,
  getShippingCollectionOptions,
  isShippingInsuranceEligible,
  normalizeShippingCollectionType,
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
})
