// POST /api/shipping/rates
//
// Proxy ke Biteship API untuk mendapatkan estimasi ongkir.
//
// Mode 1 — Kode Pos (regular couriers: JNE, J&T, SiCepat, dll.):
//   Body: { origin_postal_code, destination_postal_code, items, couriers? }
//
// Mode 2 — Koordinat (instant/sameday: GoSend, GrabExpress):
//   Body: { origin_lat, origin_lng, destination_lat, destination_lng, items, couriers? }
//
// Items: Array<{ weight: number }>  — berat dalam gram
//
// Returns: { rates: Array<{ courier_code, courier_name, service, description, price, etd }> }

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const {
    // Mode kode pos
    origin_postal_code,
    destination_postal_code,
    // Mode koordinat
    origin_lat,
    origin_lng,
    destination_lat,
    destination_lng,
    // Shared
    items,
    couriers,
  } = body ?? {}

  const useCoordinates = !!(origin_lat && origin_lng && destination_lat && destination_lng)
  const usePostalCode  = !!(origin_postal_code && destination_postal_code)

  if (!useCoordinates && !usePostalCode) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Wajib isi kode pos (origin/destination) atau koordinat (lat/lng).',
    })
  }

  const biteshipKey = process.env.BITESHIP_KEY
  if (!biteshipKey) {
    throw createError({ statusCode: 500, statusMessage: 'BITESHIP_KEY belum dikonfigurasi.' })
  }

  // Hitung berat aktual per item: max(weight_asli, weight_volumetrik)
  // Berat volumetrik Biteship: (p × l × t) / 6000
  const requestItems = (items ?? [{ weight: 500 }]).map((item: any) => {
    const actualWeight     = Math.max(1, Math.round(item.weight ?? 500))
    const volumetricWeight = (item.length && item.width && item.height)
      ? Math.round((item.length * item.width * item.height) / 6000)
      : 0
    return { weight: Math.max(actualWeight, volumetricWeight) }
  })

  // Default: semua kurir yang tersedia di Biteship
  const courierList = couriers ?? '*'

  // Build Biteship request body sesuai mode
  const biteshipBody: Record<string, unknown> = {
    couriers: courierList,
    items:    requestItems,
  }

  if (useCoordinates) {
    biteshipBody.origin_latitude      = Number(origin_lat)
    biteshipBody.origin_longitude     = Number(origin_lng)
    biteshipBody.destination_latitude  = Number(destination_lat)
    biteshipBody.destination_longitude = Number(destination_lng)
  } else {
    biteshipBody.origin_postal_code      = String(origin_postal_code)
    biteshipBody.destination_postal_code = String(destination_postal_code)
  }

  try {
    const result = await $fetch<any>('https://api.biteship.com/v1/rates/couriers', {
      method: 'POST',
      headers: {
        Authorization:  biteshipKey,
        'Content-Type': 'application/json',
      },
      body: biteshipBody,
    })

    const rates = (result?.pricing ?? []).map((rate: any) => ({
      courier_code: rate.courier_code ?? '',
      courier_name: rate.courier_name ?? '',
      service:      rate.courier_service_code ?? rate.type ?? '',
      description:  rate.courier_service_name ?? rate.description ?? '',
      price:        rate.price ?? 0,
      etd:          rate.shipment_duration_range ?? rate.duration ?? '—',
    }))

    return { rates }
  } catch (e: any) {
    const detail = e?.data?.error ?? e?.data?.message ?? 'Gagal mengambil tarif pengiriman.'
    console.error('[shipping/rates] Biteship API error:', detail)
    throw createError({ statusCode: 502, statusMessage: detail })
  }
})
