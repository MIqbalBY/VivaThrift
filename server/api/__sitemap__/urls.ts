import { defineEventHandler } from '#imports'
import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  try {
    const supabase = await serverSupabaseClient(event)

    const [{ data: products }, { data: users }] = await Promise.all([
      supabase
        .from('products')
        .select('slug, updated_at')
        .eq('status', 'active'),
      supabase
        .from('users')
        .select('username, created_at')
        .not('username', 'is', null),
    ])

    const productUrls = (products ?? []).map((p: { slug: string; updated_at: string }) => ({
      loc: `/products/${p.slug}`,
      lastmod: p.updated_at,
      changefreq: 'daily' as const,
      priority: 0.8,
    }))

    const profileUrls = (users ?? []).map((u: { username: string; created_at: string }) => ({
      loc: `/profile/${u.username}`,
      lastmod: u.created_at,
      changefreq: 'weekly' as const,
      priority: 0.5,
    }))

    return [...productUrls, ...profileUrls]
  } catch (e) {
    console.error('[sitemap] Failed to fetch dynamic URLs:', e)
    return []
  }
})
