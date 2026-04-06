import type { H3Event } from 'h3'
import { resolveServerUid } from './resolve-server-uid'
import { supabaseAdmin } from './supabase-admin'

/**
 * Assert that the current request is made by an admin or moderator.
 * Throws 403 if not. Returns the admin's user ID.
 */
export async function assertAdmin(event: H3Event): Promise<string> {
  const userId = await resolveServerUid(event)

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (!user || !['admin', 'moderator'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Akses ditolak. Hanya admin yang bisa mengakses ini.' })
  }

  return userId
}