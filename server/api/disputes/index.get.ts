import { supabaseAdmin } from '../../utils/supabase-admin'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// GET /api/disputes?role=buyer|seller
// Returns disputes for the authenticated user.

export default defineEventHandler(async (event) => {
  const userId = await resolveServerUid(event)

  const query = getQuery(event)
  const role = String(query.role ?? 'buyer')
  const field = role === 'seller' ? 'seller_id' : 'buyer_id'

  const { data, error } = await supabaseAdmin
    .from('disputes')
    .select(`
      id, reason, status, refund_amount, resolution_note, created_at, updated_at,
      evidence_urls,
      order:orders!order_id (
        id, total_amount, shipping_method,
        order_items ( quantity, product:products ( title, product_media ( media_url, thumbnail_url, is_primary, media_type ) ) )
      ),
      buyer:users!buyer_id  ( id, name, avatar_url ),
      seller:users!seller_id ( id, name, avatar_url )
    `)
    .eq(field, userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data ?? []
})
