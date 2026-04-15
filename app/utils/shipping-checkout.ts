export type ShippingCollectionType = 'pickup' | 'drop_off'

export function normalizeShippingCollectionType(value: unknown): ShippingCollectionType {
  const normalized = String(value ?? 'pickup').trim().toLowerCase().replace(/[-\s]+/g, '_')
  return normalized === 'drop_off' ? 'drop_off' : 'pickup'
}

export function getShippingCollectionOptions() {
  return [
    {
      key: 'pickup' as ShippingCollectionType,
      label: 'Dijemput Kurir',
      description: 'Kurir menjemput paket ke penjual',
    },
    {
      key: 'drop_off' as ShippingCollectionType,
      label: 'Antar ke Gerai',
      description: 'Penjual drop-off ke agen / gerai',
    },
  ]
}

export function isShippingInsuranceEligible(categoryOrName?: string | null) {
  const text = String(categoryOrName ?? '').trim().toLowerCase()
  if (!text) return false

  return /(elektr|electro|gadget|hp|smartphone|laptop|tablet|kamera|camera|console|komputer|pc|monitor|headset|earphone|speaker|iphone|android)/i.test(text)
}

export function calculateShippingInsuranceFee(input: {
  declaredValue: number
  enabled: boolean
  eligible: boolean
}) {
  if (!input.enabled || !input.eligible) return 0
  const declaredValue = Math.max(0, Math.round(Number(input.declaredValue) || 0))
  return Math.round(declaredValue * 0.005)
}
