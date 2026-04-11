import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

describe('webhook routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/send-email')
    vi.doUnmock('../server/utils/email-templates')
    vi.doUnmock('../server/utils/xendit-webhook-handler')
    vi.doUnmock('../server/utils/biteship-webhook-handler')
    vi.doUnmock('../server/utils/webhook-auth')
  })

  it('xendit route returns 401 when callback auth fails', async () => {
    const getHeader = vi.fn(() => 'wrong-token')
    const readBody = vi.fn()

    vi.stubGlobal('getHeader', getHeader)
    vi.stubGlobal('readBody', readBody)

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn() }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderConfirmedBuyer: vi.fn(),
      emailNewOrderSeller: vi.fn(),
    }))
    vi.doMock('../server/utils/xendit-webhook-handler', () => ({ processXenditWebhook: vi.fn() }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: false, statusCode: 401, statusMessage: 'Invalid callback token.' })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 401, statusMessage: 'Invalid callback token.' })
    expect(readBody).not.toHaveBeenCalled()
  })

  it('xendit route returns 400 when invoice id is missing from the payload', async () => {
    vi.stubGlobal('getHeader', vi.fn(() => 'expected-token'))
    vi.stubGlobal('readBody', vi.fn(async () => ({ status: 'PAID' })))

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn() }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderConfirmedBuyer: vi.fn(),
      emailNewOrderSeller: vi.fn(),
    }))
    vi.doMock('../server/utils/xendit-webhook-handler', () => ({ processXenditWebhook: vi.fn() }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: true })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Missing invoice id in payload.' })
  })

  it('xendit route delegates a valid payload to the webhook service', async () => {
    const processXenditWebhook = vi.fn(async () => ({ received: true, action: 'confirmed' }))

    vi.stubGlobal('getHeader', vi.fn(() => 'expected-token'))
    vi.stubGlobal('readBody', vi.fn(async () => ({
      id: 'inv-1',
      status: 'PAID',
      payment_method: 'EWALLET',
      paid_amount: 120000,
    })))

    vi.doMock('../server/utils/supabase-admin', () => ({
      supabaseAdmin: {
        from: vi.fn(),
      },
    }))
    vi.doMock('../server/utils/send-email', () => ({ sendEmail: vi.fn() }))
    vi.doMock('../server/utils/email-templates', () => ({
      emailOrderConfirmedBuyer: vi.fn(),
      emailNewOrderSeller: vi.fn(),
    }))
    vi.doMock('../server/utils/xendit-webhook-handler', () => ({ processXenditWebhook }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyXenditCallbackToken: vi.fn(() => ({ ok: true })),
    }))

    const { default: handler } = await import('../server/api/webhooks/xendit.post')

    await expect(handler({})).resolves.toEqual({ received: true, action: 'confirmed' })
    expect(processXenditWebhook).toHaveBeenCalledWith({
      xenditInvoiceId: 'inv-1',
      status: 'PAID',
      paymentMethod: 'EWALLET',
      paidAmount: 120000,
    }, expect.any(Object))
  })

  it('biteship route returns 401 when webhook auth fails', async () => {
    const readBody = vi.fn()

    vi.stubGlobal('getHeader', vi.fn(() => null))
    vi.stubGlobal('readBody', readBody)

    vi.doMock('../server/utils/supabase-admin', () => ({ supabaseAdmin: {} }))
    vi.doMock('../server/utils/biteship-webhook-handler', () => ({ processBiteshipWebhook: vi.fn() }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyOptionalBiteshipWebhookAuth: vi.fn(() => ({ ok: false, statusCode: 401, statusMessage: 'Invalid webhook token.' })),
    }))

    const { default: handler } = await import('../server/api/webhooks/biteship.post')

    await expect(handler({})).rejects.toMatchObject({ statusCode: 401, statusMessage: 'Invalid webhook token.' })
    expect(readBody).not.toHaveBeenCalled()
  })

  it('biteship route delegates a valid payload to the webhook service', async () => {
    const processBiteshipWebhook = vi.fn(async () => ({ received: true, action: 'updated' }))
    const getHeader = vi.fn((_: unknown, name: string) => {
      if (name === 'authorization') {
        return 'Bearer expected'
      }

      return null
    })

    vi.stubGlobal('getHeader', getHeader)
    vi.stubGlobal('readBody', vi.fn(async () => ({
      event: 'order.status',
      order_id: 'biteship-1',
      status: 'picked',
      courier_waybill_id: 'WB-123',
      courier_company: 'jne',
    })))

    vi.doMock('../server/utils/supabase-admin', () => ({
      supabaseAdmin: {
        from: vi.fn(),
      },
    }))
    vi.doMock('../server/utils/biteship-webhook-handler', () => ({ processBiteshipWebhook }))
    vi.doMock('../server/utils/webhook-auth', () => ({
      verifyOptionalBiteshipWebhookAuth: vi.fn(() => ({ ok: true })),
    }))

    const { default: handler } = await import('../server/api/webhooks/biteship.post')

    await expect(handler({})).resolves.toEqual({ received: true, action: 'updated' })
    expect(processBiteshipWebhook).toHaveBeenCalledWith({
      eventType: 'order.status',
      biteshipOrderId: 'biteship-1',
      courierStatus: 'picked',
      courierWaybillId: 'WB-123',
      courierCompany: 'jne',
    }, expect.any(Object))
  })
})