import { buildPaidPaymentRows, normalizeRelation } from './xendit-webhook'

export type WebhookUser = {
  id: string
  name: string | null
  email: string | null
}

export type WebhookOrder = {
  id: string
  shipping_method: string | null
  shipping_cost: number | null
  meetup_location: string | null
  total_amount: number | null
  offer_id: string | null
  buyer: WebhookUser | WebhookUser[] | null
  seller: WebhookUser | WebhookUser[] | null
}

export type UpdatedOrder = {
  id: string
  total_amount: number | null
}

export type FailedOrder = {
  id: string
  offer_id: string | null
}

export type OrderItemStock = {
  product_id: string
  quantity: number
}

export type OrderPrimaryItem = {
  quantity: number | null
  productTitle: string | null
}

export type XenditWebhookPayload = {
  xenditInvoiceId: string
  status: string | null | undefined
  paymentMethod?: string | null
  paidAmount?: number | null
  // ── Refund event fields (Xendit sends refund callbacks to same URL) ──
  event?:         string | null
  refundId?:      string | null
  failureReason?: string | null
}

export type XenditWebhookDeps = {
  now?: () => string
  markOrdersPaymentFailed: (invoiceId: string, updatedAt: string) => Promise<FailedOrder[]>
  getOrderItems: (orderId: string) => Promise<OrderItemStock[]>
  getProductStock: (productId: string) => Promise<number | null>
  restoreProduct: (productId: string, stock: number) => Promise<void>
  restoreOffer: (offerId: string, updatedAt: string) => Promise<void>
  getPendingOrders: (invoiceId: string) => Promise<WebhookOrder[]>
  getProcessedOrders: (invoiceId: string) => Promise<WebhookOrder[]>
  getPaidPaymentOrderIds: (orderIds: string[]) => Promise<string[]>
  upsertPayments: (rows: ReturnType<typeof buildPaidPaymentRows>) => Promise<unknown>
  updateShippingOrdersPaid: (orderIds: string[], paymentMethod: string | null) => Promise<{ data: UpdatedOrder[]; error: unknown }>
  updateCodOrdersPaid: (orderIds: string[], paymentMethod: string | null) => Promise<{ data: UpdatedOrder[]; error: unknown }>
  getBuyerCartId: (buyerId: string) => Promise<string | null>
  getOrderProductIds: (orderId: string) => Promise<string[]>
  deleteCartItems: (cartId: string, productIds: string[]) => Promise<void>
  getOrderPrimaryItem: (orderId: string) => Promise<OrderPrimaryItem | null>
  renderBuyerEmail: (params: {
    buyerName: string
    orderId: string
    productTitle: string
    quantity: number
    totalAmount: number
    shippingMethod: 'cod' | 'shipping'
    meetupLocation?: string | null
  }) => { subject: string; html: string }
  renderSellerEmail: (params: {
    sellerName: string
    orderId: string
    productTitle: string
    quantity: number
    totalAmount: number
    buyerName: string
    shippingMethod: 'cod' | 'shipping'
  }) => { subject: string; html: string }
  sendEmail: (payload: { to: string; subject: string; html: string }) => Promise<unknown>
  // ── Refund dispute deps ─────────────────────────────────────────────
  findDisputeByRefundId:        (refundId: string) => Promise<{ id: string; refund_status: string | null } | null>
  updateDisputeRefundCompleted: (disputeId: string) => Promise<void>
  updateDisputeRefundFailed:    (disputeId: string, errorMessage: string) => Promise<void>
  onWarning?: (message: string, error: unknown) => void
}

export async function processXenditWebhook(payload: XenditWebhookPayload, deps: XenditWebhookDeps) {
  const now = deps.now?.() ?? new Date().toISOString()
  const paymentMethod = payload.paymentMethod ?? null

  // ── Refund event branch ──────────────────────────────────────────────────
  if (payload.event === 'refund.succeeded' || payload.event === 'refund.failed') {
    const refundId = payload.refundId ?? ''
    if (!refundId) {
      return { received: true, action: 'refund_missing_id' }
    }

    const dispute = await deps.findDisputeByRefundId(refundId)
    if (!dispute) {
      return { received: true, action: 'refund_unknown', refundId }
    }

    if (payload.event === 'refund.succeeded') {
      if (dispute.refund_status === 'completed') {
        return { received: true, action: 'refund_already_completed', disputeId: dispute.id }
      }
      await deps.updateDisputeRefundCompleted(dispute.id)
      return { received: true, action: 'refund_completed', disputeId: dispute.id }
    }

    // refund.failed
    const reason = payload.failureReason ?? 'Refund failed'
    await deps.updateDisputeRefundFailed(dispute.id, reason)
    return { received: true, action: 'refund_failed', disputeId: dispute.id }
  }

  // ── Existing invoice branch ──────────────────────────────────────────────
  if (payload.status === 'EXPIRED' || payload.status === 'FAILED') {
    const failedOrders = await deps.markOrdersPaymentFailed(payload.xenditInvoiceId, now)

    for (const order of failedOrders) {
      const items = await deps.getOrderItems(order.id)

      for (const item of items) {
        const stock = await deps.getProductStock(item.product_id)
        await deps.restoreProduct(item.product_id, (stock ?? 0) + item.quantity)
      }

      if (order.offer_id) {
        await deps.restoreOffer(order.offer_id, now)
      }
    }

    return { received: true, action: 'payment_failed', orderCount: failedOrders.length }
  }

  if (payload.status !== 'PAID') {
    return { received: true, action: 'ignored', status: payload.status }
  }

  const currentOrders = await deps.getPendingOrders(payload.xenditInvoiceId)

  if (!currentOrders.length) {
    const processedOrders = await deps.getProcessedOrders(payload.xenditInvoiceId)

    if (!processedOrders.length) {
      return { received: true, action: 'no_orders_found' }
    }

    const processedOrderIds = processedOrders.map((order) => order.id)
    const existingPaidOrderIds = new Set(await deps.getPaidPaymentOrderIds(processedOrderIds))
    const missingPaymentOrders = processedOrders.filter((order) => !existingPaidOrderIds.has(order.id))

    if (!missingPaymentOrders.length) {
      return { received: true, action: 'already_processed', orderCount: processedOrders.length, orderIds: processedOrderIds }
    }

    const reconcileRows = buildPaidPaymentRows({
      orders: missingPaymentOrders.map((order) => ({ id: order.id, total_amount: order.total_amount })),
      paidAmount: payload.paidAmount,
      paymentMethod,
      xenditInvoiceId: payload.xenditInvoiceId,
    })

    const reconcileError = await deps.upsertPayments(reconcileRows)

    if (reconcileError && deps.onWarning) {
      deps.onWarning('[xendit-webhook] Failed to reconcile payment records:', reconcileError)
    }

    return {
      received: true,
      action: 'payments_reconciled',
      orderCount: missingPaymentOrders.length,
      orderIds: missingPaymentOrders.map((order) => order.id),
    }
  }

  const codOrderIds = currentOrders.filter((order) => order.shipping_method === 'cod').map((order) => order.id)
  const shippingOrderIds = currentOrders.filter((order) => order.shipping_method !== 'cod').map((order) => order.id)

  const [shippingUpdate, codUpdate] = await Promise.all([
    shippingOrderIds.length
      ? deps.updateShippingOrdersPaid(shippingOrderIds, paymentMethod)
      : Promise.resolve({ data: [], error: null }),
    codOrderIds.length
      ? deps.updateCodOrdersPaid(codOrderIds, paymentMethod)
      : Promise.resolve({ data: [], error: null }),
  ])

  const updatedOrders = [...(shippingUpdate.data ?? []), ...(codUpdate.data ?? [])]
  const orderErr = shippingUpdate.error ?? codUpdate.error

  if (orderErr) {
    throw new Error('Failed to update orders.')
  }

  if (!updatedOrders.length) {
    return {
      received: true,
      action: 'already_processed',
      orderCount: currentOrders.length,
      orderIds: currentOrders.map((order) => order.id),
    }
  }

  const updatedOrderIds = new Set(updatedOrders.map((order) => order.id))
  const processedOrders = currentOrders.filter((order) => updatedOrderIds.has(order.id))
  const firstProcessedOrder = processedOrders[0]
  const firstBuyer = normalizeRelation(firstProcessedOrder?.buyer)

  if (firstBuyer?.id) {
    const buyerCartId = await deps.getBuyerCartId(firstBuyer.id)

    if (buyerCartId) {
      const allProductIds = (await Promise.all(updatedOrders.map((order) => deps.getOrderProductIds(order.id)))).flat()

      if (allProductIds.length) {
        await deps.deleteCartItems(buyerCartId, allProductIds)
      }
    }
  }

  const paymentRows = buildPaidPaymentRows({
    orders: updatedOrders,
    paidAmount: payload.paidAmount,
    paymentMethod,
    xenditInvoiceId: payload.xenditInvoiceId,
  })

  const paymentError = await deps.upsertPayments(paymentRows)

  if (paymentError && deps.onWarning) {
    deps.onWarning('[xendit-webhook] Failed to insert payment records:', paymentError)
  }

  for (const order of processedOrders) {
    const buyer = normalizeRelation(order.buyer)
    const seller = normalizeRelation(order.seller)

    if (!buyer?.email || !seller?.email) {
      continue
    }

    const primaryItem = await deps.getOrderPrimaryItem(order.id)
    const productTitle = primaryItem?.productTitle ?? 'Produk'
    const quantity = primaryItem?.quantity ?? 1

    try {
      const buyerEmail = deps.renderBuyerEmail({
        buyerName: buyer.name ?? 'Pembeli',
        orderId: order.id,
        productTitle,
        quantity,
        totalAmount: order.total_amount ?? 0,
        shippingMethod: (order.shipping_method as 'cod' | 'shipping') ?? 'shipping',
        meetupLocation: order.meetup_location,
      })
      const sellerEmail = deps.renderSellerEmail({
        sellerName: seller.name ?? 'Penjual',
        orderId: order.id,
        productTitle,
        quantity,
        totalAmount: order.total_amount ?? 0,
        buyerName: buyer.name ?? 'Pembeli',
        shippingMethod: (order.shipping_method as 'cod' | 'shipping') ?? 'shipping',
      })

      void Promise.resolve(deps.sendEmail({ to: buyer.email, subject: buyerEmail.subject, html: buyerEmail.html })).catch(() => {})
      void Promise.resolve(deps.sendEmail({ to: seller.email, subject: sellerEmail.subject, html: sellerEmail.html })).catch(() => {})
    } catch {
      // best-effort
    }
  }

  return {
    received: true,
    action: 'confirmed',
    orderCount: updatedOrders.length,
    orderIds: updatedOrders.map((order) => order.id),
  }
}