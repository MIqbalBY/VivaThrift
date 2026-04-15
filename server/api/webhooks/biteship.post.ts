import { supabaseAdmin } from '../../utils/supabase-admin'
import { processBiteshipWebhook } from '../../utils/biteship-webhook-handler'
import { verifyOptionalBiteshipWebhookAuth } from '../../utils/webhook-auth'
import { createWebhookRequestId, logWebhookEvent } from '../../utils/webhook-observability'

// POST /api/webhooks/biteship
//
// Receives Biteship order status updates.
// Register this URL in Biteship Dashboard → Settings → Webhook URL:
//   https://www.vivathrift.store/api/webhooks/biteship
//
// Security:
//   Biteship docs mention webhook authentication can be configured from the dashboard.
//   This handler supports either:
//   - Bearer/custom token via BITESHIP_WEBHOOK_TOKEN
//   - Basic Auth via BITESHIP_WEBHOOK_BASIC_USER + BITESHIP_WEBHOOK_BASIC_PASSWORD
//
// Biteship webhook payload (order_status type):
//   { event: "order.status", order_id, courier_tracking_id, status, ... }
//
// Statuses: confirmed, allocated, picking_up, picked, dropping_off, delivered, rejected, cancelled, on_hold, courier_not_found

async function filterDuplicateNotifications(rows: Array<Record<string, string>>) {
  if (!rows.length) {
    return rows
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const existenceChecks = await Promise.all(rows.map(async (row) => {
    const { data } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('type', row.type)
      .eq('reference_id', row.reference_id)
      .eq('title', row.title)
      .eq('body', row.body)
      .gte('created_at', cutoff)
      .limit(1)

    return (data?.length ?? 0) > 0
  }))

  return rows.filter((_, index) => !existenceChecks[index])
}

export default defineEventHandler(async (event) => {
  const requestId = createWebhookRequestId()

  const authResult = verifyOptionalBiteshipWebhookAuth({
    authorization: getHeader(event, 'authorization'),
    callbackToken: getHeader(event, 'x-callback-token'),
    webhookToken: getHeader(event, 'x-webhook-token'),
    expectedToken: process.env.BITESHIP_WEBHOOK_TOKEN,
    expectedUser: process.env.BITESHIP_WEBHOOK_BASIC_USER,
    expectedPassword: process.env.BITESHIP_WEBHOOK_BASIC_PASSWORD,
  })

  if (!authResult.ok) {
    await logWebhookEvent('warning', authResult.logMessage ?? '[biteship-webhook] Invalid webhook token.', {
      webhook: 'biteship-shipping',
      requestId,
      statusCode: authResult.statusCode,
      errorMessage: authResult.statusMessage,
    })

    throw createError({ statusCode: authResult.statusCode, statusMessage: authResult.statusMessage })
  }

  const body = await readBody(event)
  const eventType = typeof body?.event === 'string' ? body.event : ''

  // ── Validate payload ──────────────────────────────────────────────────────
  const biteshipOrderId = body?.order_id ?? body?.id
  const courierStatus   = body?.status ?? body?.courier_status

  try {
    const result = await processBiteshipWebhook({
      eventType,
      biteshipOrderId: biteshipOrderId ? String(biteshipOrderId) : null,
      courierStatus: courierStatus ? String(courierStatus) : null,
      courierWaybillId: body?.courier_waybill_id ?? body?.courier?.waybill_id ?? null,
      courierCompany: body?.courier_company ?? body?.courier?.company ?? null,
    }, {
      findOrderByBiteshipId: async (incomingBiteshipOrderId) => {
        const { data } = await supabaseAdmin
          .from('orders')
          .select('id, buyer_id, seller_id, status, tracking_number, courier_name, shipped_at, shipping_method')
          .eq('biteship_order_id', incomingBiteshipOrderId)
          .single()

        return data
      },
      updateOrder: async (orderId, updates) => {
        await supabaseAdmin.from('orders').update(updates).eq('id', orderId)
      },
      getAdminIds: async () => {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id')
          .in('role', ['admin', 'moderator'])

        return (data ?? []).map((admin) => String(admin.id))
      },
      filterDuplicateNotifications,
      insertNotifications: async (rows) => {
        await supabaseAdmin.from('notifications').insert(rows)
      },
    })

    const level = result.action === 'updated' || result.action === 'noop' ? 'info' : 'warning'
    const message = result.action === 'no_matching_order'
      ? '[biteship-webhook] No matching order found for incoming payload.'
      : result.action === 'ignored'
        ? '[biteship-webhook] Payload ignored.'
        : '[biteship-webhook] Processed webhook.'

    await logWebhookEvent(level, message, {
      webhook: 'biteship-shipping',
      requestId,
      action: typeof result.action === 'string' ? result.action : null,
      eventName: eventType || null,
      biteshipOrderId: biteshipOrderId ? String(biteshipOrderId) : null,
      status: courierStatus ? String(courierStatus) : null,
      updated: result.action === 'updated',
    })

    return result
  } catch (error) {
    await logWebhookEvent('error', '[biteship-webhook] Unhandled webhook error.', {
      webhook: 'biteship-shipping',
      requestId,
      eventName: eventType || null,
      biteshipOrderId: biteshipOrderId ? String(biteshipOrderId) : null,
      status: courierStatus ? String(courierStatus) : null,
      statusCode: 500,
      errorMessage: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
})
