import { assertAdmin } from '../../../utils/assert-admin'
import { supabaseAdmin } from '../../../utils/supabase-admin'

// PATCH /api/admin/reports/:id
// Body:
//   { action: 'dismiss', notes?: string }                → status = dismissed
//   { action: 'resolve', notes?: string }                → status = resolved (no take-down)
//   { action: 'resolve_takedown_product', notes?: string } → status = resolved + moderate product
//   { action: 'resolve_ban_user', notes?: string }       → status = resolved + ban user

export default defineEventHandler(async (event) => {
  const adminId = await assertAdmin(event)

  const reportId = getRouterParam(event, 'id')
  if (!reportId) throw createError({ statusCode: 400, statusMessage: 'report id required.' })

  const body   = await readBody(event)
  const action = body?.action as string
  const notes  = (body?.notes ?? '').trim()

  const validActions = ['dismiss', 'resolve', 'resolve_takedown_product', 'resolve_ban_user']
  if (!validActions.includes(action)) {
    throw createError({ statusCode: 400, statusMessage: `Action harus salah satu: ${validActions.join(', ')}` })
  }

  // Load report
  const { data: report } = await supabaseAdmin
    .from('reports')
    .select('id, status, reported_product_id, reported_user_id')
    .eq('id', reportId)
    .single()

  if (!report) throw createError({ statusCode: 404, statusMessage: 'Laporan tidak ditemukan.' })
  if (report.status !== 'pending' && report.status !== 'reviewed') {
    throw createError({ statusCode: 422, statusMessage: `Laporan sudah berstatus "${report.status}".` })
  }

  const now = new Date().toISOString()
  const newStatus = action === 'dismiss' ? 'dismissed' : 'resolved'

  // Update report
  const { error: updateErr } = await supabaseAdmin
    .from('reports')
    .update({
      status:      newStatus,
      admin_notes: notes || null,
      resolved_by: adminId,
      resolved_at: now,
    })
    .eq('id', reportId)

  if (updateErr) throw createError({ statusCode: 500, statusMessage: updateErr.message })

  // Take-down product
  if (action === 'resolve_takedown_product' && report.reported_product_id) {
    await supabaseAdmin
      .from('products')
      .update({
        status:            'moderated',
        moderation_reason: `Laporan valid: ${notes || 'Melanggar ketentuan'}`,
        moderated_by:      adminId,
        moderated_at:      now,
      })
      .eq('id', report.reported_product_id)

    // Notify seller
    const { data: prod } = await supabaseAdmin
      .from('products')
      .select('seller_id, title')
      .eq('id', report.reported_product_id)
      .single()

    if (prod) {
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id:    prod.seller_id,
          type:       'product_rejected',
          title:      'Produkmu di-take-down oleh moderator',
          body:       `"${prod.title}" — Alasan: ${notes || 'Melanggar ketentuan'}`,
          product_id: report.reported_product_id,
        })
      } catch { /* best-effort */ }
    }
  }

  // Ban user
  if (action === 'resolve_ban_user' && report.reported_user_id) {
    await supabaseAdmin
      .from('users')
      .update({
        banned_at:     now,
        banned_reason: `Laporan valid: ${notes || 'Melanggar ketentuan'}`,
        banned_by:     adminId,
      })
      .eq('id', report.reported_user_id)

    // Deactivate all their products
    await supabaseAdmin
      .from('products')
      .update({ status: 'inactive' })
      .eq('seller_id', report.reported_user_id)
      .eq('status', 'active')
  }

  return { reportId, action, status: newStatus }
})
