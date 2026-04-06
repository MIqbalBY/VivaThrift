import { assertAdmin } from '../../../utils/assert-admin'
import { supabaseAdmin } from '../../../utils/supabase-admin'

// PATCH /api/admin/products/:id
// Body: { action: 'approve' }                      → moderated → active
//     | { action: 'reject', reason: string }        → active/moderated → moderated
//     | { action: 'ban', reason: string }           → moderated → banned

export default defineEventHandler(async (event) => {
  const adminId = await assertAdmin(event)

  const productId = getRouterParam(event, 'id')
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'product id required.' })

  const body   = await readBody(event)
  const action = body?.action as string

  // Load current product
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, status, seller_id, title')
    .eq('id', productId)
    .single()

  if (!product) throw createError({ statusCode: 404, statusMessage: 'Produk tidak ditemukan.' })

  if (action === 'approve') {
    if (product.status !== 'moderated') {
      throw createError({ statusCode: 422, statusMessage: 'Hanya produk termoderasi yang bisa di-approve.' })
    }
    const { error } = await supabaseAdmin
      .from('products')
      .update({
        status:            'active',
        moderation_reason: null,
        moderated_by:      null,
        moderated_at:      null,
      })
      .eq('id', productId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    // Notify seller
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id:      product.seller_id,
        type:         'product_approved',
        title:        'Produkmu telah disetujui!',
        body:         `"${product.title}" kembali aktif di marketplace.`,
        product_id:   productId,
      })
    } catch { /* best-effort */ }

    return { productId, action: 'approved' }
  }

  if (action === 'reject') {
    const reason = (body?.reason ?? '').trim()
    if (!reason) throw createError({ statusCode: 400, statusMessage: 'Alasan penolakan wajib diisi.' })

    if (!['active', 'moderated'].includes(product.status)) {
      throw createError({ statusCode: 422, statusMessage: `Produk berstatus "${product.status}" tidak bisa ditolak.` })
    }

    const { error } = await supabaseAdmin
      .from('products')
      .update({
        status:            'moderated',
        moderation_reason: reason,
        moderated_by:      adminId,
        moderated_at:      new Date().toISOString(),
      })
      .eq('id', productId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    // Notify seller
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id:      product.seller_id,
        type:         'product_rejected',
        title:        'Produkmu ditolak oleh moderator',
        body:         `"${product.title}" — Alasan: ${reason}`,
        product_id:   productId,
      })
    } catch { /* best-effort */ }

    return { productId, action: 'rejected', reason }
  }

  if (action === 'ban') {
    const reason = (body?.reason ?? '').trim()
    if (!reason) throw createError({ statusCode: 400, statusMessage: 'Alasan ban wajib diisi.' })

    if (product.status !== 'moderated') {
      throw createError({ statusCode: 422, statusMessage: 'Hanya produk termoderasi yang bisa di-ban.' })
    }

    const { error } = await supabaseAdmin
      .from('products')
      .update({
        status:            'banned',
        moderation_reason: reason,
        moderated_by:      adminId,
        moderated_at:      new Date().toISOString(),
      })
      .eq('id', productId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    // Notify seller
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id:      product.seller_id,
        type:         'product_banned',
        title:        'Produkmu di-ban secara permanen',
        body:         `"${product.title}" telah dihapus dari marketplace. Alasan: ${reason}`,
        product_id:   productId,
      })
    } catch { /* best-effort */ }

    return { productId, action: 'banned', reason }
  }

  throw createError({ statusCode: 400, statusMessage: 'Action tidak valid.' })
})