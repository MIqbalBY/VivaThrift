import { assertAdmin } from '../../../utils/assert-admin'
import { supabaseAdmin } from '../../../utils/supabase-admin'

// GET /api/admin/products?status=active&page=1&limit=20&q=search

export default defineEventHandler(async (event) => {
  await assertAdmin(event)

  const query  = getQuery(event)
  const status = (query.status as string) || 'active'
  const search = (query.q as string ?? '').trim()
  const page   = Math.max(1, parseInt(query.page as string) || 1)
  const limit  = Math.min(50, parseInt(query.limit as string) || 20)
  const offset = (page - 1) * limit

  let q = supabaseAdmin
    .from('products')
    .select(`
      id, title, slug, price, condition, status, stock, created_at,
      moderation_reason, moderated_at,
      seller:users!seller_id ( id, name, username, avatar_url, nrp ),
      product_media ( media_url, media_type, is_primary, thumbnail_url ),
      categories ( name )
    `, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    q = q.ilike('title', `%${search}%`)
  }

  const { data, count, error } = await q

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { products: data ?? [], total: count ?? 0, page, limit }
})