import { assertAdmin } from '../../utils/assert-admin'
import { supabaseAdmin } from '../../utils/supabase-admin'

// GET /api/admin/stats
// Returns dashboard overview numbers.

export default defineEventHandler(async (event) => {
  await assertAdmin(event)

  const [users, products, orders, reports] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
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
    totalRevenue,
  }
})