import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

describe('xendit-disbursement webhook route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/xendit-disbursement-webhook-handler')
    vi.doUnmock('../server/utils/webhook-auth')
    vi.doUnmock('../server/utils/disbursement-attempts')
  })

  it('returns 401 when callback auth fails', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'wrong-token'))
    vi.stubGlobal('readBody', vi.fn())

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/xendit-disbursement-webhook-handler', () => ({
      processXenditDisbursementWebhook: vi.fn(),
    }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: false, statusCode: 401, statusMessage: 'Invalid callback token.' })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit-disbursement.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 401, statusMessage: 'Invalid callback token.' })
  })

  it('returns 400 when payload has no id', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'valid-token'))
    vi.stubGlobal('readBody', vi.fn(async () => ({ status: 'COMPLETED' })))

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/xendit-disbursement-webhook-handler', () => ({
      processXenditDisbursementWebhook: vi.fn(async () => ({ ok: false, action: 'missing_id', updated: false })),
    }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({})),
    }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: true })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit-disbursement.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Missing disbursement id in payload.' })
  })

  it('delegates a valid payload to the handler and returns its result', async () => {
    const processMock = vi.fn(async () => ({ ok: true, action: 'completed' as const, updated: true }))

    vi.stubGlobal('getHeader', vi.fn(() => 'valid-token'))
    vi.stubGlobal('readBody', vi.fn(async () => ({
      id: 'xd-seller-1',
      status: 'COMPLETED',
    })))

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: { from: vi.fn() } }))
    vi.doMock('../server/utils/xendit-disbursement-webhook-handler', () => ({
      processXenditDisbursementWebhook: processMock,
    }))
    vi.doMock('../server/utils/disbursement-attempts', () => ({
      createSupabaseAttemptStore: vi.fn(() => ({ findByXenditId: vi.fn(), updateCompleted: vi.fn(), updateFailed: vi.fn(), listByOrder: vi.fn() })),
    }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: true })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit-disbursement.post')

    await expect(handler({})).resolves.toEqual({ ok: true, action: 'completed', updated: true })
    expect(processMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'xd-seller-1', status: 'COMPLETED' }),
      expect.any(Object),
    )
  })
})
