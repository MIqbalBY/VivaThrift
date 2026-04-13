import { supabaseAdmin } from '../../utils/supabase-admin'
import { sendEmail } from '../../utils/send-email'
import { emailOrderConfirmedBuyer, emailNewOrderSeller } from '../../utils/email-templates'
import { processXenditWebhook } from '../../utils/xendit-webhook-handler'
import { verifyXenditCallbackToken } from '../../utils/webhook-auth'
import { getXenditCallbackToken } from '../../utils/xendit-config'
import { createWebhookRequestId, logWebhookEvent } from '../../utils/webhook-observability'

// POST /api/webhooks/xendit
//
// Menerima notifikasi otomatis dari Xendit saat status Invoice berubah.
//
// Security:
//   Xendit menyertakan X-CALLBACK-TOKEN di setiap request.
//   Set di: dashboard.xendit.co → Settings → Developers → Callback Token
//
// Mendukung dua flow:
//   - Offer-based checkout  : external_id = single order UUID
//   - Cart-based checkout   : external_id = "orderId1_orderId2_..."
//
// On PAID: update SEMUA orders dengan xendit_invoice_id tsb → 'confirmed'
//          lalu insert payment record per order.

export default defineEventHandler(async (event) => {
  const requestId = createWebhookRequestId()

  // ── Security: verify Xendit callback token ────────────────────────────────
  const authResult = verifyXenditCallbackToken({
    receivedToken: getHeader(event, 'x-callback-token'),
    expectedToken: getXenditCallbackToken(),
  })

  if (!authResult.ok) {
    logWebhookEvent('warning', authResult.logMessage ?? '[xendit-webhook] Invalid callback token.', {
      webhook: 'xendit-invoice',
      requestId,
      statusCode: authResult.statusCode,
      errorMessage: authResult.statusMessage,
    })

    throw createError({ statusCode: authResult.statusCode, statusMessage: authResult.statusMessage })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await readBody(event)
  const {
    id:              xenditInvoiceId,
    status,
    payment_method:  paymentMethod,
    paid_amount:     paidAmount,
    event:           eventType,
  } = body ?? {}
  const refundId      = body?.data?.id ?? body?.refund_id ?? null
  const failureReason = body?.data?.failure_reason ?? body?.failure_reason ?? null

  const isRefundEvent = eventType === 'refund.succeeded' || eventType === 'refund.failed'
  if (!xenditInvoiceId && !isRefundEvent) {
    logWebhookEvent('warning', '[xendit-webhook] Missing invoice id in payload.', {
      webhook: 'xendit-invoice',
      requestId,
      eventName: eventType ?? null,
      status: status ?? null,
      statusCode: 400,
    })

    throw createError({ statusCode: 400, statusMessage: 'Missing invoice id in payload.' })
  }

  try {
    const result = await processXenditWebhook({
      xenditInvoiceId: xenditInvoiceId ?? '',
      status,
      paymentMethod,
      paidAmount,
      event: eventType,
      refundId,
      failureReason,
    }, {
      markOrdersPaymentFailed: async (invoiceId, updatedAt) => {
        const { data } = await supabaseAdmin
          .from('orders')
          .update({ status: 'payment_failed', updated_at: updatedAt })
          .eq('xendit_invoice_id', invoiceId)
          .in('status', ['pending_payment'])
          .select('id, offer_id')

        return data ?? []
      },
      getOrderItems: async (orderId) => {
        const { data } = await supabaseAdmin
          .from('order_items')
          .select('product_id, quantity')
          .eq('order_id', orderId)

        return data ?? []
      },
      getProductStock: async (productId) => {
        const { data } = await supabaseAdmin
          .from('products')
          .select('stock')
          .eq('id', productId)
          .single()

        return data?.stock ?? null
      },
      restoreProduct: async (productId, stock) => {
        await supabaseAdmin
          .from('products')
          .update({ status: 'active', stock })
          .eq('id', productId)
      },
      restoreOffer: async (offerId, updatedAt) => {
        await supabaseAdmin
          .from('offers')
          .update({ status: 'accepted', updated_at: updatedAt })
          .eq('id', offerId)
      },
      getPendingOrders: async (invoiceId) => {
        const { data } = await supabaseAdmin
          .from('orders')
          .select(`id, shipping_method, shipping_cost, meetup_location, total_amount, offer_id,
            buyer:users!buyer_id  ( id, name, email ),
            seller:users!seller_id ( id, name, email )`)
          .eq('xendit_invoice_id', invoiceId)
          .in('status', ['pending_payment'])

        return data ?? []
      },
      getProcessedOrders: async (invoiceId) => {
        const { data } = await supabaseAdmin
          .from('orders')
          .select(`id, shipping_method, shipping_cost, meetup_location, total_amount, offer_id,
            buyer:users!buyer_id  ( id, name, email ),
            seller:users!seller_id ( id, name, email )`)
          .eq('xendit_invoice_id', invoiceId)
          .in('status', ['confirmed', 'awaiting_meetup', 'shipped', 'completed'])

        return data ?? []
      },
      getPaidPaymentOrderIds: async (orderIds) => {
        const { data } = await supabaseAdmin
          .from('payments')
          .select('order_id')
          .in('order_id', orderIds)
          .eq('status', 'paid')

        return (data ?? []).map((payment) => payment.order_id)
      },
      upsertPayments: async (rows) => {
        const { error } = await supabaseAdmin
          .from('payments')
          .upsert(rows, { onConflict: 'order_id' })

        return error
      },
      updateShippingOrdersPaid: async (orderIds, incomingPaymentMethod) => {
        const response = await supabaseAdmin
          .from('orders')
          .update({ status: 'confirmed', payment_method: incomingPaymentMethod })
          .in('id', orderIds)
          .eq('status', 'pending_payment')
          .select('id, total_amount')

        return { data: response.data ?? [], error: response.error }
      },
      updateCodOrdersPaid: async (orderIds, incomingPaymentMethod) => {
        const response = await supabaseAdmin
          .from('orders')
          .update({ status: 'awaiting_meetup', payment_method: incomingPaymentMethod })
          .in('id', orderIds)
          .eq('status', 'pending_payment')
          .select('id, total_amount')

        return { data: response.data ?? [], error: response.error }
      },
      getBuyerCartId: async (buyerId) => {
        const { data } = await supabaseAdmin
          .from('carts')
          .select('id')
          .eq('user_id', buyerId)
          .maybeSingle()

        return data?.id ?? null
      },
      getOrderProductIds: async (orderId) => {
        const { data } = await supabaseAdmin
          .from('order_items')
          .select('product_id')
          .eq('order_id', orderId)

        return (data ?? []).map((item) => item.product_id)
      },
      deleteCartItems: async (cartId, productIds) => {
        await supabaseAdmin
          .from('cart_items')
          .delete()
          .eq('cart_id', cartId)
          .in('product_id', productIds)
      },
      getOrderPrimaryItem: async (orderId) => {
        const { data } = await supabaseAdmin
          .from('order_items')
          .select('quantity, product:products ( title )')
          .eq('order_id', orderId)
          .limit(1)

        const item = data?.[0] as { quantity?: number | null; product?: { title?: string | null } | null } | undefined

        return item
          ? {
            quantity: item.quantity ?? 1,
            productTitle: item.product?.title ?? 'Produk',
          }
          : null
      },
      renderBuyerEmail: emailOrderConfirmedBuyer,
      renderSellerEmail: emailNewOrderSeller,
      sendEmail,
      findDisputeByRefundId: async (refundId) => {
        const { data } = await supabaseAdmin
          .from('disputes')
          .select('id, refund_status')
          .eq('xendit_refund_id', refundId)
          .maybeSingle()
        return data ?? null
      },
      updateDisputeRefundCompleted: async (disputeId) => {
        await supabaseAdmin
          .from('disputes')
          .update({ refund_status: 'completed', refunded_at: new Date().toISOString() })
          .eq('id', disputeId)
      },
      updateDisputeRefundFailed: async (disputeId, errorMessage) => {
        await supabaseAdmin
          .from('disputes')
          .update({ refund_status: 'failed', refund_error: errorMessage })
          .eq('id', disputeId)
      },
      onWarning: (message, error) => {
        logWebhookEvent('warning', message, {
          webhook: 'xendit-invoice',
          requestId,
          eventName: eventType ?? null,
          invoiceId: xenditInvoiceId ?? null,
          status: status ?? null,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      },
    })

    logWebhookEvent('info', '[xendit-webhook] Processed webhook.', {
      webhook: 'xendit-invoice',
      requestId,
      action: typeof result.action === 'string' ? result.action : null,
      eventName: eventType ?? null,
      invoiceId: xenditInvoiceId ?? refundId,
      status: status ?? null,
      orderCount: 'orderCount' in result && typeof result.orderCount === 'number' ? result.orderCount : undefined,
    })

    return result
  } catch (error) {
    if (error instanceof Error && error.message === 'Failed to update orders.') {
      logWebhookEvent('error', '[xendit-webhook] Failed to update orders.', {
        webhook: 'xendit-invoice',
        requestId,
        eventName: eventType ?? null,
        invoiceId: xenditInvoiceId ?? refundId,
        status: status ?? null,
        statusCode: 500,
        errorMessage: error.message,
      })
      throw createError({ statusCode: 500, statusMessage: 'Failed to update orders.' })
    }

    logWebhookEvent('error', '[xendit-webhook] Unhandled webhook error.', {
      webhook: 'xendit-invoice',
      requestId,
      eventName: eventType ?? null,
      invoiceId: xenditInvoiceId ?? refundId,
      status: status ?? null,
      statusCode: 500,
      errorMessage: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
})
