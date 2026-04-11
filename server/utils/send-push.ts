import { supabaseAdmin } from './supabase-admin'
import { sendPushToMany } from './web-push'

/**
 * Sends a Web Push notification to all subscribed devices of a user.
 * Silently removes expired/invalid subscriptions (410 Gone).
 *
 * Usage:
 *   await sendPushToUser(userId, { title: 'Pesanan dikonfirmasi', body: '...', url: '/orders' })
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  const { data: rows } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, subscription, endpoint')
    .eq('user_id', userId)

  if (!rows || rows.length === 0) return

  const subs = rows.map(r => r.subscription as any)
  const { failed } = await sendPushToMany(subs, {
    ...payload,
    icon: '/img/logo-vivathrift.png',
  })

  // Prune any invalid/expired subscriptions if all failed (best-effort)
  if (failed === rows.length && rows.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
  }
}
