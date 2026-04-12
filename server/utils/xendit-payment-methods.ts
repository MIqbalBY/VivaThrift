const CHANNEL_TO_XENDIT_PAYMENT_METHODS: Record<string, string[]> = {
  qris: ['QRIS'],
  bca_va: ['BCA'],
  bni_va: ['BNI'],
  bri_va: ['BRI'],
  mandiri_va: ['MANDIRI'],
  gopay: ['GOPAY'],
  ovo: ['OVO'],
  dana: ['DANA'],
  shopeepay: ['SHOPEEPAY'],
}

export function isSupportedPaymentChannel(channel: string): boolean {
  const key = String(channel ?? '').trim().toLowerCase()
  return key in CHANNEL_TO_XENDIT_PAYMENT_METHODS
}

export function getXenditPaymentMethodsForChannel(channel: string): string[] {
  const key = String(channel ?? '').trim().toLowerCase()
  return CHANNEL_TO_XENDIT_PAYMENT_METHODS[key] ?? []
}
