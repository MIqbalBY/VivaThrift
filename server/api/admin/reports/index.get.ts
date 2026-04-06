import { assertAdmin } from '../../../utils/assert-admin'
import { supabaseAdmin } from '../../../utils/supabase-admin'

// GET /api/admin/reports?status=pending&page=1&limit=20

export default defineEventHandler(async (event) => {
  await assertAdmin(event)

  const query  = getQuery(event)
  const status = (query.status as string) || 'pending'
  const page   = Math.max(1, parseInt(query.page as string) || 1)
  const limit  = Math.min(50, parseInt(query.limit as string) || 20)
  const offset = (page - 1) * limit

  const { data, count, error } = await supabaseAdmin
    .from('reports')
    .select(`
      id, reason, status, created_at, admin_notes, resolved_at,
      reporter:users!reports_reporter_id_fkey ( id, name, username, avatar_url ),
      reported_user:users!reports_reported_user_id_fkey ( id, name, username, avatar_url, banned_at ),
      reported_product:products!reports_reported_product_id_fkey (
        id, title, slug, status, price,
        product_media ( media_url, is_primary, thumbnail_url )
      )
    `, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { reports: data ?? [], total: count ?? 0, page, limit }
})
