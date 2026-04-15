export interface ShippingRate {
  courier_code?: string | null
  courier_name?: string | null
  service?: string | null
  description?: string | null
  price?: number | null
  etd?: string | null
  collection_type?: string | null
  collection_label?: string | null
  supports_insurance?: boolean | null
}

export type ShippingRateCategory = 'all' | 'instant' | 'next_day' | 'regular' | 'economy'

const CATEGORY_META: Record<Exclude<ShippingRateCategory, 'all'>, { label: string; order: number }> = {
  instant: { label: 'Instant', order: 1 },
  next_day: { label: 'Next Day', order: 2 },
  regular: { label: 'Regular', order: 3 },
  economy: { label: 'Hemat', order: 4 },
}

function toSearchText(rate: ShippingRate) {
  return [rate.courier_name, rate.service, rate.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function classifyShippingRate(rate: ShippingRate): Exclude<ShippingRateCategory, 'all'> {
  const haystack = toSearchText(rate)

  if (/(same day|sameday|instant|grab|gosend|express instant)/i.test(haystack)) return 'instant'
  if (/(next day|nextday|one day|oneday|yes|ons|besok sampai)/i.test(haystack)) return 'next_day'
  if (/(economy|eco|hemat|cargo|trucking|darat|non[-\s]?elektronik)/i.test(haystack)) return 'economy'

  return 'regular'
}

export function getShippingRateTabLabel(category: ShippingRateCategory) {
  if (category === 'all') return 'Semua'
  return CATEGORY_META[category].label
}

export function getAvailableShippingRateTabs(rates: ShippingRate[]) {
  const counts: Record<Exclude<ShippingRateCategory, 'all'>, number> = {
    instant: 0,
    next_day: 0,
    regular: 0,
    economy: 0,
  }

  for (const rate of rates) {
    counts[classifyShippingRate(rate)] += 1
  }

  const tabs = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => CATEGORY_META[left[0] as Exclude<ShippingRateCategory, 'all'>].order - CATEGORY_META[right[0] as Exclude<ShippingRateCategory, 'all'>].order)
    .map(([key, count]) => ({
      key: key as ShippingRateCategory,
      label: getShippingRateTabLabel(key as ShippingRateCategory),
      count,
    }))

  return [{ key: 'all' as ShippingRateCategory, label: 'Semua', count: rates.length }, ...tabs]
}

export function sortShippingRates(rates: ShippingRate[]) {
  return [...rates].sort((left, right) => {
    const priceDelta = Number(left.price ?? 0) - Number(right.price ?? 0)
    if (priceDelta !== 0) return priceDelta

    const leftCategory = classifyShippingRate(left)
    const rightCategory = classifyShippingRate(right)
    return CATEGORY_META[leftCategory].order - CATEGORY_META[rightCategory].order
  })
}
