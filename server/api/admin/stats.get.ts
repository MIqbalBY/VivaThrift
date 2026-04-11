import { assertAdmin } from '../../utils/assert-admin'
import { getRateLimitObservabilitySnapshot, readGlobalRateLimitObservabilitySnapshot } from '../../utils/rate-limit-observability'
import { supabaseAdmin } from '../../utils/supabase-admin'

// GET /api/admin/stats
// Returns dashboard overview numbers.

export default defineEventHandler(async (event) => {
  const adminId = await assertAdmin(event)
  const rateLimitBackend = process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
    ? 'upstash-rest'
    : 'memory'
  const globalRateLimitObservability = rateLimitBackend === 'upstash-rest'
    ? await readGlobalRateLimitObservabilitySnapshot().catch(() => null)
    : null
  const rateLimitObservability = globalRateLimitObservability ?? getRateLimitObservabilitySnapshot()
  const rateLimitObservabilityScope = globalRateLimitObservability ? 'global-upstash' : 'instance-memory'

  const [users, products, orders, reports, shippingIncidents, recentShippingIncidents] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', adminId)
      .eq('type', 'shipping_incident_admin')
      .eq('is_read', false),
    supabaseAdmin
      .from('notifications')
      .select('id, title, body, created_at, reference_id, is_read')
      .eq('user_id', adminId)
      .eq('type', 'shipping_incident_admin')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const [banned, moderated, ordersCompleted, revenue] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).not('banned_at', 'is', null),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('status', 'moderated'),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('orders').select('total_amount').eq('status', 'completed'),
  ])

  const totalRevenue = (revenue.data ?? []).reduce((sum: number, o: any) => sum + (o.total_amount ?? 0), 0)

  return {
    totalUsers:        users.count ?? 0,
    totalProducts:     products.count ?? 0,
    totalOrders:       orders.count ?? 0,
    pendingReports:    reports.count ?? 0,
    bannedUsers:       banned.count ?? 0,
    moderatedProducts: moderated.count ?? 0,
    completedOrders:   ordersCompleted.count ?? 0,
    unreadShippingIncidents: shippingIncidents.count ?? 0,
    recentShippingIncidents: recentShippingIncidents.data ?? [],
    rateLimitBackend,
    rateLimitObservability,
    rateLimitObservabilityScope,
    totalRevenue,
  }
})