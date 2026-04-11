import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// POST /api/push/unsubscribe
// Removes a browser push subscription.
// Body: { endpoint: string }

function isValidPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length < 20 || endpoint.length > 2048) return false

  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const uid = await resolveServerUid(event)
  if (!uid) throw createError({ statusCode: 401, statusMessage: 'Unauthorized.' })

  const { endpoint } = await readBody(event)
  if (!isValidPushEndpoint(endpoint)) {
    throw createError({ statusCode: 400, statusMessage: 'Endpoint tidak valid.' })
  }

  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', uid)
    .eq('endpoint', endpoint)

  return { ok: true }
})
