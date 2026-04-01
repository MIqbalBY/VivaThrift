import { defineEventHandler } from '#imports'
import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const supabase = await serverSupabaseClient(event)

  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at')
    .eq('status', 'available')

  return (products ?? []).map((p: { slug: string; updated_at: string }) => ({
    loc: `/products/${p.slug}`,
    lastmod: p.updated_at,
    changefreq: 'daily',
    priority: 0.8,
  }))
})
