import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// POST /api/push/subscribe
// Saves a browser push subscription for the authenticated user.
// Body: { subscription: PushSubscription }

interface PushSubscriptionInput {
  endpoint: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

function isValidPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length < 20 || endpoint.length > 2048) return false

  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function sanitizeSubscription(input: unknown): PushSubscriptionInput | null {
  if (!input || typeof input !== 'object') return null

  const subscription = input as PushSubscriptionInput
  if (!isValidPushEndpoint(subscription.endpoint)) return null

  const p256dh = subscription.keys?.p256dh
  const auth = subscription.keys?.auth

  if (typeof p256dh !== 'string' || p256dh.length < 16 || p256dh.length > 512) return null
  if (typeof auth !== 'string' || auth.length < 8 || auth.length > 256) return null

  return {
    endpoint: subscription.endpoint,
    expirationTime: typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null,
    keys: { p256dh, auth },
  }
}

export default defineEventHandler(async (event) => {
  const uid = await resolveServerUid(event)
  if (!uid) throw createError({ statusCode: 401, statusMessage: 'Unauthorized.' })

  const body = await readBody(event)
  const subscription = sanitizeSubscription(body?.subscription)

  if (!subscription) {
    throw createError({ statusCode: 400, statusMessage: 'Subscription tidak valid.' })
  }

  // Upsert: one row per (user_id, endpoint) — handles re-subscription
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id:      uid,
        endpoint:     subscription.endpoint,
        subscription: subscription,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

  if (error) throw createError({ statusCode: 500, statusMessage: 'Gagal menyimpan subscription.' })

  return { ok: true }
})
