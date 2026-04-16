type ReportTargetType = 'product' | 'user'

type CreateReportSubmissionInput = {
  reporterId: string
  targetType: ReportTargetType
  targetId: string
  reason: string
}

type CreateReportSubmissionDeps = {
  findDuplicate: (args: {
    reporterId: string
    targetType: ReportTargetType
    targetId: string
  }) => Promise<{ id: string } | null>
  insertReport: (payload: {
    reporter_id: string
    reason: string
    status: 'pending'
    reported_product_id: string | null
    reported_user_id: string | null
  }) => Promise<{ id: string } | null>
}

function throwReportError(statusCode: number, statusMessage: string): never {
  throw Object.assign(new Error(statusMessage), { statusCode, statusMessage })
}

export async function createReportSubmission(input: CreateReportSubmissionInput, deps: CreateReportSubmissionDeps) {
  const reporterId = String(input.reporterId ?? '').trim()
  const targetId = String(input.targetId ?? '').trim()
  const reason = String(input.reason ?? '').trim()
  const targetType = input.targetType

  if (!reporterId) {
    throwReportError(401, 'Kamu harus login dulu.')
  }

  if (targetType !== 'product' && targetType !== 'user') {
    throwReportError(400, 'Jenis laporan tidak valid.')
  }

  if (!targetId) {
    throwReportError(400, 'Target laporan tidak valid.')
  }

  if (!reason) {
    throwReportError(400, 'Pilih atau tulis alasan pelaporan.')
  }

  if (targetType === 'user' && reporterId === targetId) {
    throwReportError(400, 'Kamu tidak bisa melaporkan akunmu sendiri.')
  }

  const duplicate = await deps.findDuplicate({ reporterId, targetType, targetId })
  if (duplicate) {
    throwReportError(409, 'Kamu sudah pernah melaporkan ini sebelumnya.')
  }

  const payload = {
    reporter_id: reporterId,
    reason,
    status: 'pending' as const,
    reported_product_id: targetType === 'product' ? targetId : null,
    reported_user_id: targetType === 'user' ? targetId : null,
  }

  const report = await deps.insertReport(payload)
  if (!report?.id) {
    throwReportError(500, 'Gagal mengirim laporan.')
  }

  return { ok: true as const, reportId: report.id }
}
