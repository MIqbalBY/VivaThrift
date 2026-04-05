import { serverSupabaseUser } from '#supabase/server'
import { supabaseAdmin } from './supabase-admin'
import type { H3Event } from 'h3'
import type { User } from '@supabase/supabase-js'

/**
 * Extract Supabase access_token from request cookies.
 *
 * Handles both single-cookie and chunked-cookie formats:
 *   - `sb-<ref>-auth-token`          (single cookie, JSON or raw JWT)
 *   - `sb-<ref>-auth-token.0`, `.1`  (chunked, concatenate then parse)
 */
function extractTokenFromCookies(event: H3Event): string | undefined {
  const cookies = parseCookies(event)

  // Collect all sb-*-auth-token* cookies grouped by base name
  const groups = new Map<string, { base?: string; chunks: Map<number, string> }>()

  for (const [key, value] of Object.entries(cookies)) {
    if (!key.startsWith('sb-') || !key.includes('-auth-token')) continue

    // Check if it's a chunk (ends with .0, .1, etc.)
    const chunkMatch = key.match(/^(.+-auth-token)\.(\d+)$/)
    if (chunkMatch) {
      const baseName = chunkMatch[1]!
      const idx = parseInt(chunkMatch[2]!, 10)
      if (!groups.has(baseName)) groups.set(baseName, { chunks: new Map() })
      groups.get(baseName)!.chunks.set(idx, value)
    } else if (key.endsWith('-auth-token')) {
      if (!groups.has(key)) groups.set(key, { chunks: new Map() })
      groups.get(key)!.base = value
    }
  }

  for (const [, group] of groups) {
    let raw: string | undefined

    if (group.chunks.size > 0) {
      // Reassemble chunked cookie in order
      const sorted = [...group.chunks.entries()].sort((a, b) => a[0] - b[0])
      raw = sorted.map(([, v]) => v).join('')
    } else if (group.base) {
      raw = group.base
    }

    if (!raw) continue

    try {
      const parsed = JSON.parse(raw)
      const token = typeof parsed === 'string' ? parsed : parsed?.access_token
      if (token) return token
    } catch {
      // raw might be a plain JWT string
      if (raw.includes('.')) return raw
    }
  }

  return undefined
}

/**
 * Resolve authenticated Supabase user from server event with fallback.
 *
 * On Vercel serverless, `serverSupabaseUser(event)` can occasionally return
 * a truthy user object with `id` = undefined, or the chunked auth cookies
 * may not be reassembled properly. This helper adds a cookie-based fallback
 * using supabaseAdmin.auth.getUser().
 */
async function resolveUser(event: H3Event): Promise<User> {
  // Method 1: standard @nuxtjs/supabase helper
  try {
    const user = await serverSupabaseUser(event)
    if (user?.id) return user as unknown as User
  } catch {
    // serverSupabaseUser can throw; fall through to cookie method
  }

  // Method 2: extract access_token from Supabase auth cookies
  const token = extractTokenFromCookies(event)
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token)
    if (data.user?.id) return data.user
  }

  throw createError({ statusCode: 401, statusMessage: 'Sesi tidak ditemukan.' })
}

/**
 * Resolve just the user ID. Throws 401 if not authenticated.
 */
export async function resolveServerUid(event: H3Event): Promise<string> {
  const user = await resolveUser(event)
  return user.id
}

export interface ServerUser {
  id: string
  email?: string
  fullName?: string
}

/**
 * Resolve user ID + metadata (email, fullName). Used by checkout APIs
 * that need user metadata for Xendit customer info.
 */
export async function resolveServerUser(event: H3Event): Promise<ServerUser> {
  const user = await resolveUser(event)
  return {
    id: user.id,
    email: user.email ?? undefined,
    fullName: user.user_metadata?.full_name ?? undefined,
  }
}
