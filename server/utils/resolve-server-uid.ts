import { serverSupabaseUser } from '#supabase/server'
import { supabaseAdmin } from './supabase-admin'
import type { H3Event } from 'h3'

/**
 * Reliably resolve the authenticated user ID from a server event.
 *
 * On Vercel serverless, `serverSupabaseUser(event)` can occasionally return
 * a truthy user object with `id` = undefined (JWT parsing edge case).
 * This helper adds a cookie-based fallback using supabaseAdmin.auth.getUser().
 *
 * Throws 401 if no valid user can be resolved.
 */
export async function resolveServerUid(event: H3Event): Promise<string> {
  // Method 1: standard @nuxtjs/supabase helper
  const user = await serverSupabaseUser(event)
  if (user?.id) return user.id

  // Method 2: extract access_token from Supabase auth cookies
  const cookies = parseCookies(event)
  for (const [key, value] of Object.entries(cookies)) {
    if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
    try {
      // Cookie may store JSON (chunked) or plain token string
      let token: string | undefined
      const parsed = JSON.parse(value)
      token = typeof parsed === 'string' ? parsed : parsed?.access_token
      if (token) {
        const { data } = await supabaseAdmin.auth.getUser(token)
        if (data.user?.id) return data.user.id
      }
    } catch {
      // value might be a raw JWT string (not JSON)
      if (typeof value === 'string' && value.includes('.')) {
        const { data } = await supabaseAdmin.auth.getUser(value)
        if (data?.user?.id) return data.user.id
      }
    }
  }

  throw createError({ statusCode: 401, statusMessage: 'Sesi tidak ditemukan.' })
}

export interface ServerUser {
  id: string
  email?: string
  fullName?: string
}

/**
 * Like resolveServerUid but also returns email + fullName when available.
 * Used by checkout APIs that need user metadata for Xendit customer info.
 */
export async function resolveServerUser(event: H3Event): Promise<ServerUser> {
  // Method 1: standard helper
  const user = await serverSupabaseUser(event)
  if (user?.id) {
    return {
      id: user.id,
      email: user.email ?? undefined,
      fullName: user.user_metadata?.full_name ?? undefined,
    }
  }

  // Method 2: cookie-based fallback
  const cookies = parseCookies(event)
  for (const [key, value] of Object.entries(cookies)) {
    if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
    try {
      let token: string | undefined
      const parsed = JSON.parse(value)
      token = typeof parsed === 'string' ? parsed : parsed?.access_token
      if (token) {
        const { data } = await supabaseAdmin.auth.getUser(token)
        if (data.user?.id) {
          return {
            id: data.user.id,
            email: data.user.email ?? undefined,
            fullName: data.user.user_metadata?.full_name ?? undefined,
          }
        }
      }
    } catch {
      if (typeof value === 'string' && value.includes('.')) {
        const { data } = await supabaseAdmin.auth.getUser(value)
        if (data?.user?.id) {
          return {
            id: data.user.id,
            email: data.user.email ?? undefined,
            fullName: data.user.user_metadata?.full_name ?? undefined,
          }
        }
      }
    }
  }

  throw createError({ statusCode: 401, statusMessage: 'Sesi tidak ditemukan.' })
}
