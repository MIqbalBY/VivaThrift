import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// GET /api/seller/analytics
// Returns seller-specific dashboard metrics.
// Caller must be authenticated — data is scoped to their own seller_id.

export default defineEventHandler(async (event) => {
  const sellerId = await resolveServerUid(event)

  // ── Parallel batch queries ────────────────────────────────────────────────
  const [
    totalOrdersRes,
    completedRes,
    activeProductsRes,
    avgRatingRes,
    recentOrdersRes,
    topProductsRes,
    monthlyRes,
  ] = await Promise.all([
    // Total orders as seller
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId),

    // Completed orders + revenue
    supabaseAdmin
      .from('orders')
      .select('total_amount, platform_fee, shipping_cost')
      .eq('seller_id', sellerId)
      .eq('status', 'completed'),

    // Active products
    supabaseAdmin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .eq('status', 'active'),

    // Average rating from reviews where reviewee = seller
    supabaseAdmin
      .from('reviews')
      .select('rating_seller')
      .eq('reviewee_id', sellerId),

    // Recent 5 orders (for activity feed)
    supabaseAdmin
      .from('orders')
      .select(`
        id, status, total_amount, created_at,
        buyer:users!buyer_id ( name, avatar_url ),
        order_items ( quantity, product:products ( title ) )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(5),

    // Top 5 products by order count
    supabaseAdmin
      .from('order_items')
      .select('product_id, quantity, product:products!inner ( title, seller_id )')
      .eq('product.seller_id', sellerId),

    // Monthly revenue (last 6 months)
    supabaseAdmin
      .from('orders')
      .select('total_amount, platform_fee, shipping_cost, completed_at')
      .eq('seller_id', sellerId)
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 180 * 86400000).toISOString()),
  ])

  // ── Compute metrics ────────────────────────────────────────────────────────
  const completedOrders = completedRes.data ?? []
  const totalRevenue = completedOrders.reduce((sum, o) =>
    sum + (o.total_amount ?? 0) - (o.shipping_cost ?? 0) - (o.platform_fee ?? 0), 0)

  const ratings = (avgRatingRes.data ?? []).map((r: any) => r.rating_seller).filter(Boolean)
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length) * 10) / 10
    : null

  // Top products aggregation
  const productMap = new Map<string, { title: string; sold: number }>()
  for (const item of (topProductsRes.data ?? []) as any[]) {
    const pid = item.product_id
    const existing = productMap.get(pid)
    if (existing) {
      existing.sold += item.quantity ?? 1
    } else {
      productMap.set(pid, { title: item.product?.title ?? '—', sold: item.quantity ?? 1 })
    }
  }
  const topProducts = [...productMap.entries()]
    .sort((a, b) => b[1].sold - a[1].sold)
    .slice(0, 5)
    .map(([id, data]) => ({ id, ...data }))

  // Monthly revenue aggregation
  const monthlyMap = new Map<string, number>()
  for (const o of (monthlyRes.data ?? []) as any[]) {
    if (!o.completed_at) continue
    const month = o.completed_at.slice(0, 7) // "2026-04"
    const net = (o.total_amount ?? 0) - (o.shipping_cost ?? 0) - (o.platform_fee ?? 0)
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + net)
  }
  const monthlyRevenue = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, revenue]) => ({ month, revenue }))

  // Recent orders cleanup
  const recentOrders = (recentOrdersRes.data ?? []).map((o: any) => ({
    id: o.id,
    status: o.status,
    total_amount: o.total_amount,
    created_at: o.created_at,
    buyer_name: o.buyer?.name ?? '—',
    buyer_avatar: o.buyer?.avatar_url ?? null,
    product_title: o.order_items?.[0]?.product?.title ?? '—',
    item_count: o.order_items?.length ?? 0,
  }))

  return {
    totalOrders:    totalOrdersRes.count ?? 0,
    completedOrders: completedOrders.length,
    totalRevenue,
    activeProducts: activeProductsRes.count ?? 0,
    avgRating,
    totalReviews:   ratings.length,
    topProducts,
    monthlyRevenue,
    recentOrders,
  }
})
