import { assertAdmin } from '../../utils/assert-admin'
import { supabaseAdmin } from '../../utils/supabase-admin'

// GET /api/admin/disputes?status=open&page=1&limit=20
// Admin-only: list all disputes with filtering.

export default defineEventHandler(async (event) => {
  await assertAdmin(event)

  const query = getQuery(event)
  const status = String(query.status ?? 'open')
  const page   = Math.max(1, Number(query.page ?? 1))
  const limit  = Math.min(50, Math.max(1, Number(query.limit ?? 20)))
  const offset = (page - 1) * limit

  let q = supabaseAdmin
    .from('disputes')
    .select(`
      id, reason, status, refund_amount, resolution_note, created_at, updated_at,
      evidence_urls,
      order:orders!order_id ( id, total_amount ),
      buyer:users!buyer_id  ( id, name, email, avatar_url ),
      seller:users!seller_id ( id, name, email, avatar_url )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') {
    q = q.eq('status', status)
  }

  const { data, count, error } = await q

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { disputes: data ?? [], total: count ?? 0 }
})
