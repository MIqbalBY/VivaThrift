import { describe, expect, it } from 'vitest'

import { renderShippingLabelHtml } from '../server/utils/shipping-label'

describe('renderShippingLabelHtml', () => {
  it('renders a prominent fragile warning when the shipment is marked fragile', () => {
    const html = renderShippingLabelHtml({
      orderId: 'order-1',
      courierName: 'JNE',
      trackingNumber: 'RESI-123',
      biteshipOrderId: 'bs-123',
      sellerName: 'Tiara',
      sellerPhone: '081234567890',
      sellerAddress: 'ITS Sukolilo',
      buyerName: 'Iqbal',
      buyerPhone: '081299988877',
      buyerAddress: 'Keputih',
      itemsHtml: '1x Kacamata',
      shippingIsFragile: true,
      shippingIsInsured: true,
      shippingInsuranceFee: 10000,
      officialLabelUrl: null,
    })

    expect(html).toContain('FRAGILE / PECAH BELAH')
    expect(html).toContain('Asuransi pengiriman aktif')
    expect(html).toContain('/img/label-fragile.png')
    expect(html).toContain('Sticker fragile')
  })
})
