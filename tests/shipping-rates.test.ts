import { describe, expect, it } from 'vitest'

import { classifyShippingRate, getAvailableShippingRateTabs, sortShippingRates } from '../app/utils/shipping-rates'

describe('shipping rate helpers', () => {
  it('classifies popular courier services into the expected tabs', () => {
    expect(classifyShippingRate({ courier_name: 'JNE', service: 'REG', description: 'Regular Service' })).toBe('regular')
    expect(classifyShippingRate({ courier_name: 'JNE', service: 'YES', description: 'Yakin Esok Sampai' })).toBe('next_day')
    expect(classifyShippingRate({ courier_name: 'GrabExpress', service: 'Instant', description: 'Instant Courier' })).toBe('instant')
    expect(classifyShippingRate({ courier_name: 'Sentral Cargo', service: 'Cargo', description: 'Ekonomi Darat' })).toBe('economy')
  })

  it('returns only tabs that have available rates', () => {
    const tabs = getAvailableShippingRateTabs([
      { courier_name: 'JNE', service: 'REG', description: 'Regular Service', price: 18000 },
      { courier_name: 'JNE', service: 'YES', description: 'Yakin Esok Sampai', price: 25000 },
    ])

    expect(tabs.map((tab) => tab.key)).toEqual(['all', 'next_day', 'regular'])
    expect(tabs.find((tab) => tab.key === 'regular')?.count).toBe(1)
    expect(tabs.find((tab) => tab.key === 'next_day')?.count).toBe(1)
  })

  it('sorts rates by the lowest available price first', () => {
    const sorted = sortShippingRates([
      { courier_name: 'J&T', service: 'EZ', description: 'Reguler', price: 30000 },
      { courier_name: 'JNE', service: 'REG', description: 'Reguler', price: 18000 },
      { courier_name: 'SiCepat', service: 'BEST', description: 'Next Day', price: 25000 },
    ])

    expect(sorted.map((rate) => rate.courier_name)).toEqual(['JNE', 'SiCepat', 'J&T'])
  })
})
