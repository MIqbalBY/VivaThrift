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

function hasFilledAddress(address: any) {
  return !!String(address?.full_address ?? '').trim() && !!String(address?.postal_code ?? '').trim()
}

export function validateCheckoutReadiness(input: {
  shippingMethod: 'cod' | 'shipping'
  buyerAddress: any
  buyerPhone?: string | null
  selectedRate?: any
  meetupLocation?: string | null
}) {
  if (input.shippingMethod === 'shipping') {
    if (!hasFilledAddress(input.buyerAddress)) {
      return 'Tambahkan alamat pengiriman di profil terlebih dahulu.'
    }

    if (!String(input.buyerPhone ?? '').trim()) {
      return 'Nomor HP aktif wajib diisi di profil sebelum checkout pengiriman.'
    }

    if (!input.selectedRate) {
      return 'Pilih layanan pengiriman terlebih dahulu.'
    }

    return ''
  }

  if (!String(input.meetupLocation ?? '').trim()) {
    return 'Pilih lokasi meetup.'
  }

  return ''
}

export function getOrderShippingWarnings(input: {
  shippingMethod?: string | null
  status?: string | null
  sellerPhone?: string | null
  buyerPhone?: string | null
}) {
  if (input.shippingMethod !== 'shipping' || input.status !== 'confirmed') {
    return [] as string[]
  }

  const warnings: string[] = []

  if (!String(input.sellerPhone ?? '').trim()) {
    warnings.push('Nomor HP penjual belum diisi di profil.')
  }

  if (!String(input.buyerPhone ?? '').trim()) {
    warnings.push('Nomor HP pembeli belum lengkap sehingga resi Biteship belum bisa dibuat.')
  }

  return warnings
}

export function getShippingHandlingBadges(input: {
  shippingIsInsured?: boolean | null
  shippingInsuranceFee?: number | null
  shippingIsFragile?: boolean | null
}) {
  const badges: string[] = []

  if (input.shippingIsInsured) {
    badges.push('Asuransi Aktif')
  }

  if (input.shippingIsFragile) {
    badges.push('Fragile / Pecah Belah')
  }

  return badges
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
