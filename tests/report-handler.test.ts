import { describe, expect, it, vi } from 'vitest'

import { createReportSubmission } from '../server/utils/report-handler'

describe('createReportSubmission', () => {
  it('creates a pending user report for the authenticated reporter', async () => {
    const deps = {
      findDuplicate: vi.fn(async () => null),
      insertReport: vi.fn(async () => ({ id: 'report-1' })),
    }

    const result = await createReportSubmission({
      reporterId: 'user-1',
      targetType: 'user',
      targetId: 'user-2',
      reason: 'Spam / promosi berlebihan',
    }, deps)

    expect(result).toEqual({ ok: true, reportId: 'report-1' })
    expect(deps.insertReport).toHaveBeenCalledWith({
      reporter_id: 'user-1',
      reason: 'Spam / promosi berlebihan',
      status: 'pending',
      reported_product_id: null,
      reported_user_id: 'user-2',
    })
  })

  it('rejects duplicate reports from the same reporter for the same target', async () => {
    const deps = {
      findDuplicate: vi.fn(async () => ({ id: 'existing-report' })),
      insertReport: vi.fn(),
    }

    await expect(createReportSubmission({
      reporterId: 'user-1',
      targetType: 'product',
      targetId: 'product-9',
      reason: 'Barang palsu / KW',
    }, deps)).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: 'Kamu sudah pernah melaporkan ini sebelumnya.',
    })
  })

  it('rejects self-reporting for user targets', async () => {
    const deps = {
      findDuplicate: vi.fn(async () => null),
      insertReport: vi.fn(),
    }

    await expect(createReportSubmission({
      reporterId: 'user-1',
      targetType: 'user',
      targetId: 'user-1',
      reason: 'Spam / promosi berlebihan',
    }, deps)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Kamu tidak bisa melaporkan akunmu sendiri.',
    })
  })
})
