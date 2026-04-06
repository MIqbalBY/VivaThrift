import { assertAdmin } from '../../../utils/assert-admin'
import { supabaseAdmin } from '../../../utils/supabase-admin'

// GET /api/admin/users?q=search&page=1&limit=20

export default defineEventHandler(async (event) => {
  await assertAdmin(event)

  const query = getQuery(event)
  const search = (query.q as string ?? '').trim()
  const page   = Math.max(1, parseInt(query.page as string) || 1)
  const limit  = Math.min(50, parseInt(query.limit as string) || 20)
  const offset = (page - 1) * limit

  let q = supabaseAdmin
    .from('users')
    .select('id, name, username, email, nrp, faculty, department, avatar_url, role, banned_at, banned_reason, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,nrp.ilike.%${search}%,username.ilike.%${search}%`)
  }

  const { data, count, error } = await q

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { users: data ?? [], total: count ?? 0, page, limit }
})