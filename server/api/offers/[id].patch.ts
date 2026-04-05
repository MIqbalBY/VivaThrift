import { serverSupabaseClient } from '#supabase/server'
import { resolveServerUid } from '../../utils/resolve-server-uid'

// PATCH /api/offers/:id
// Body: { status: 'accepted' | 'rejected' }
// When accepting: also rejects all other pending offers for the same product (cascade-reject).
// Both operations run server-side so they are atomic from the client's perspective.
export default defineEventHandler(async (event) => {
  await resolveServerUid(event) // validates auth; ID not needed below (RLS handles ownership)

  const offerId = getRouterParam(event, 'id')
  if (!offerId) throw createError({ statusCode: 400, statusMessage: 'offer id tidak ditemukan.' })

  const body = await readBody(event)
  const newStatus: string = body?.status
  if (newStatus !== 'accepted' && newStatus !== 'rejected') {
    throw createError({ statusCode: 400, statusMessage: 'status harus "accepted" atau "rejected".' })
  }

  const supabase = await serverSupabaseClient(event)

  // Load the offer — RLS allows seller to update via the seller_update_offer_status policy
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .select('id, status, product_id, chat_id, buyer_id')
    .eq('id', offerId)
    .single()

  if (offerErr || !offer) {
    throw createError({ statusCode: 404, statusMessage: 'Penawaran tidak ditemukan.' })
  }

  if (offer.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: `Penawaran sudah berstatus ${offer.status}.` })
  }

  // ── 1. Update this offer ──────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('offers')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', offerId)

  if (updateErr) throw createError({ statusCode: 500, statusMessage: updateErr.message })

  // ── 2. If accepted → cascade-reject all other pending offers for same product ──
  if (newStatus === 'accepted') {
    await supabase
      .from('offers')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('product_id', offer.product_id as string)
      .eq('status', 'pending')
      .neq('id', offerId)
  }

  return { offerId, status: newStatus }
})
