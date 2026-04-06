import { serverSupabaseClient } from '#supabase/server'
import type { SitemapUrlInput } from '#sitemap/types'

export default defineEventHandler(async (event) => {
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

    const productUrls = (products ?? [])
      .filter((p): p is { slug: string; updated_at: string } => !!p.slug && !!p.updated_at)
      .map((p) => ({
        loc: `/products/${p.slug}`,
        lastmod: p.updated_at,
        changefreq: 'daily' as const,
        priority: 0.8,
      }))

    const profileUrls = (users ?? [])
      .filter((u): u is { username: string; created_at: string } => !!u.username && !!u.created_at)
      .map((u) => ({
        loc: `/profile/${u.username}`,
        lastmod: u.created_at,
        changefreq: 'weekly' as const,
        priority: 0.5,
      }))

    return [...productUrls, ...profileUrls] as SitemapUrlInput[]
  } catch (e) {
    console.error('[sitemap] Failed to fetch dynamic URLs:', e)
    return []
  }
})
