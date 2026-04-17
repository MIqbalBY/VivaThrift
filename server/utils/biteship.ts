// =============================================================================
// Biteship API utility — VivaThrift
// =============================================================================
// Two exported async functions:
//   createBiteshipOrder — POST /v1/orders  → returns { biteshipOrderId, waybillId }
//   getBiteshipTracking — GET  /v1/orders/:id → returns raw Biteship order object
// =============================================================================

export interface BiteshipItem {
  name: string
  quantity: number
  value: number       // IDR
  weight?: number     // grams, default 500
}

export interface BiteshipOrderResult {
  biteshipOrderId: string
  waybillId: string       // resi / airway bill; may be '' in test mode until pickup
  trackingId: string      // Biteship internal tracking id
}

function sanitizePhoneNumber(phone?: string) {
  return String(phone ?? '').trim().replace(/[^\d+]/g, '')
}

export function extractBiteshipLabelUrl(payload: any): string | null {
  const candidates = [
    payload?.label_url,
    payload?.label?.url,
    payload?.label?.download_url,
    payload?.courier?.label_url,
    payload?.courier?.label?.url,
    payload?.courier?.label?.download_url,
    payload?.order?.label_url,
    payload?.order?.label?.url,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

export async function createBiteshipOrder(params: {
  orderId?: string
  sellerName: string
  sellerPhone?: string
  sellerAddress: string
  sellerPostalCode: string | number
  buyerName: string
  buyerPhone?: string
  buyerAddress: string
  buyerPostalCode: string | number
  courierCompany: string   // e.g. "jne"
  courierType: string      // e.g. "reg"
  items: BiteshipItem[]
}): Promise<BiteshipOrderResult> {
  const biteshipKey = process.env.BITESHIP_KEY
  if (!biteshipKey) throw new Error('BITESHIP_KEY belum dikonfigurasi.')

  // Biteship requires postal codes as integers
  const originPostal = Number(params.sellerPostalCode) || 60111
  const destPostal   = Number(params.buyerPostalCode)

  if (!destPostal) {
    throw new Error('Kode pos tujuan tidak valid. Minta pembeli melengkapi alamat pengiriman terlebih dahulu.')
  }

  const sellerPhone = sanitizePhoneNumber(params.sellerPhone)
  const buyerPhone = sanitizePhoneNumber(params.buyerPhone)

  if (!sellerPhone || !buyerPhone) {
    throw new Error('Nomor HP penjual dan pembeli wajib tersedia sebelum membuat pengiriman Biteship.')
  }

  const biteshipItems = (params.items.length ? params.items : [{ name: 'Produk VivaThrift', quantity: 1, value: 1000 }]).map((item) => ({
    name:     item.name.substring(0, 100) || 'Produk',
    value:    Math.max(1, Math.round(item.value)),
    weight:   item.weight || 500,
    quantity: item.quantity || 1,
    length:   20,
    width:    15,
    height:   10,
  }))

  const reqBody: Record<string, unknown> = {
    origin_contact_name:       params.sellerName || 'Penjual VivaThrift',
    origin_contact_phone:      sellerPhone,
    origin_address:            params.sellerAddress || 'Jl. Keputih Tegal Timur, ITS Surabaya',
    origin_postal_code:        originPostal,
    destination_contact_name:  params.buyerName || 'Pembeli VivaThrift',
    destination_contact_phone: buyerPhone,
    destination_address:       params.buyerAddress || 'Alamat pembeli',
    destination_postal_code:   destPostal,
    courier_company:           params.courierCompany,
    courier_type:              params.courierType,
    delivery_type:             'now',
    items:                     biteshipItems,
  }

  if (params.orderId) reqBody.reference_id = params.orderId

  const res = await $fetch<any>('https://api.biteship.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization:  biteshipKey,
      'Content-Type': 'application/json',
    },
    body: reqBody,
  })

  return {
    biteshipOrderId: res?.id ?? '',
    waybillId:       res?.courier?.waybill_id ?? '',
    trackingId:      res?.courier?.tracking_id ?? '',
  }
}

export async function getBiteshipTracking(biteshipOrderId: string): Promise<any> {
  const biteshipKey = process.env.BITESHIP_KEY
  if (!biteshipKey) throw new Error('BITESHIP_KEY belum dikonfigurasi.')

  return await $fetch<any>(`https://api.biteship.com/v1/orders/${biteshipOrderId}`, {
    headers: {
      Authorization: biteshipKey,
    },
  })
}
