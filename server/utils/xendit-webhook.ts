export function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function buildPaidPaymentRows(params: {
  orders: Array<{ id: string; total_amount: number | null }>
  paidAmount?: number | null
  paymentMethod?: string | null
  xenditInvoiceId: string
}) {
  const totalDbAmount = params.orders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0)
  const actualPaid = params.paidAmount ?? totalDbAmount
  const paidAt = new Date().toISOString()

  return params.orders.map((order) => ({
    order_id: order.id,
    amount: totalDbAmount > 0
      ? Math.round(actualPaid * ((order.total_amount ?? 0) / totalDbAmount))
      : 0,
    status: 'paid',
    payment_method: params.paymentMethod ?? null,
    paid_at: paidAt,
    xendit_invoice_id: params.xenditInvoiceId,
  }))
}