// POST /api/shipping/rates
//
// Proxy ke Biteship API untuk mendapatkan estimasi ongkir.
// Body: { origin_postal_code: string, destination_postal_code: string, items: Array<{ weight: number }>, couriers?: string }
//
// Returns: { rates: Array<{ courier_code, courier_name, service, description, price, etd }> }

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const {
    origin_postal_code,
    destination_postal_code,
    items,
    couriers,
  } = body ?? {}

  if (!origin_postal_code || !destination_postal_code) {
    throw createError({ statusCode: 400, statusMessage: 'Kode pos asal dan tujuan harus diisi.' })
  }

  const biteshipKey = process.env.BITESHIP_API_KEY
  if (!biteshipKey) {
    throw createError({ statusCode: 500, statusMessage: 'BITESHIP_API_KEY belum dikonfigurasi.' })
  }

  // Default weight: 500g per item if not specified
  const requestItems = (items ?? [{ weight: 500 }]).map((item: any) => ({
    weight: item.weight ?? 500,
  }))

  // Default: all available couriers (Biteship wildcard)
  const courierList = couriers ?? '*'

  try {
    const result = await $fetch<any>('https://api.biteship.com/v1/rates/couriers', {
      method: 'POST',
      headers: {
        Authorization: biteshipKey,
        'Content-Type': 'application/json',
      },
      body: {
        origin_postal_code:      String(origin_postal_code),
        destination_postal_code: String(destination_postal_code),
        couriers:                courierList,
        items:                   requestItems,
      },
    })

    // Map Biteship response to clean format
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
    const detail = e?.data?.message ?? e?.message ?? 'Gagal mengambil tarif pengiriman.'
    console.error('[shipping/rates] Biteship API error:', detail)
    throw createError({ statusCode: 502, statusMessage: detail })
  }
})
