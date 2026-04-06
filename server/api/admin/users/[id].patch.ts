import { assertAdmin } from '../../../utils/assert-admin'
import { supabaseAdmin } from '../../../utils/supabase-admin'

// PATCH /api/admin/users/:id
// Body: { action: 'ban', reason: string }
//     | { action: 'unban' }
//     | { action: 'set_role', role: 'user' | 'moderator' | 'admin' }

export default defineEventHandler(async (event) => {
  const adminId = await assertAdmin(event)

  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'user id required.' })

  if (userId === adminId) {
    throw createError({ statusCode: 400, statusMessage: 'Tidak bisa mengubah akun sendiri.' })
  }

  const body   = await readBody(event)
  const action = body?.action as string

  if (action === 'ban') {
    const reason = (body?.reason ?? '').trim()
    if (!reason) throw createError({ statusCode: 400, statusMessage: 'Alasan ban wajib diisi.' })

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        banned_at:     new Date().toISOString(),
        banned_reason: reason,
        banned_by:     adminId,
      })
      .eq('id', userId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    // Deactivate all active products from banned user
    await supabaseAdmin
      .from('products')
      .update({ status: 'inactive' })
      .eq('seller_id', userId)
      .eq('status', 'active')

    return { userId, action: 'banned' }
  }

  if (action === 'unban') {
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        banned_at:     null,
        banned_reason: null,
        banned_by:     null,
      })
      .eq('id', userId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { userId, action: 'unbanned' }
  }

  if (action === 'set_role') {
    const role = body?.role as string
    if (!['user', 'moderator', 'admin'].includes(role)) {
      throw createError({ statusCode: 400, statusMessage: 'Role harus user, moderator, atau admin.' })
    }
    const { error } = await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('id', userId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { userId, action: 'role_changed', role }
  }

  throw createError({ statusCode: 400, statusMessage: 'Action tidak valid.' })
})