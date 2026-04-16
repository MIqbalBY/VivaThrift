import { createReportSubmission } from '../../utils/report-handler'
import { resolveServerUid } from '../../utils/resolve-server-uid'
import { supabaseAdmin } from '../../utils/supabase-admin'

export default defineEventHandler(async (event) => {
  const reporterId = await resolveServerUid(event)
  const body = await readBody(event)

  return createReportSubmission({
    reporterId,
    targetType: body?.targetType,
    targetId: body?.targetId,
    reason: body?.reason,
  }, {
    findDuplicate: async ({ reporterId, targetType, targetId }) => {
      let query = supabaseAdmin
        .from('reports')
        .select('id')
        .eq('reporter_id', reporterId)

      query = targetType === 'product'
        ? query.eq('reported_product_id', targetId).is('reported_user_id', null)
        : query.eq('reported_user_id', targetId).is('reported_product_id', null)

      const { data, error } = await query.maybeSingle()
      if (error) {
        throw createError({ statusCode: 500, statusMessage: error.message })
      }

      return data
    },
    insertReport: async (payload) => {
      const { data, error } = await supabaseAdmin
        .from('reports')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        if (error.code === '23505') {
          throw createError({ statusCode: 409, statusMessage: 'Kamu sudah pernah melaporkan ini sebelumnya.' })
        }
        if (error.code === '23503') {
          throw createError({ statusCode: 404, statusMessage: 'Target laporan tidak ditemukan.' })
        }
        throw createError({ statusCode: 500, statusMessage: error.message })
      }

      return data
    },
  })
})
