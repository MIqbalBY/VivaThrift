import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CreatedError = Error & { statusCode?: number; statusMessage?: string }

function createNitroError(input: { statusCode: number; statusMessage: string }) {
  return Object.assign(new Error(input.statusMessage), input) as CreatedError
}

describe('checkout routes config guard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', vi.fn(createNitroError))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.doUnmock('../server/utils/resolve-server-uid')
    vi.doUnmock('../server/utils/supabase-admin')
    vi.doUnmock('../server/utils/xendit-config')
    vi.doUnmock('#supabase/server')
  })

  it('offer checkout: returns 500 when XENDIT key is missing before touching DB', async () => {
    const serverSupabaseClient = vi.fn(async () => ({}))

    vi.stubGlobal('readBody', vi.fn(async () => ({
      offerId: 'offer-1',
      paymentChannel: 'qris',
      shippingMethod: 'shipping',
      shippingCost: 10000,
    })))

    vi.doMock('../server/utils/resolve-server-uid', () => ({
      resolveServerUser: vi.fn(async () => ({ id: 'buyer-1', email: 'buyer@test.com' })),
    }))
    vi.doMock('../server/utils/xendit-config', () => ({
      getXenditSecretKey: vi.fn(() => ''),
    }))
    vi.doMock('../server/utils/supabase-admin', () => ({
      supabaseAdmin: { from: vi.fn() },
    }))
    vi.doMock('#supabase/server', () => ({
      serverSupabaseClient,
    }))

    const { default: handler } = await import('../server/api/checkout/index.post')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'XENDIT_KEY belum dikonfigurasi.',
    })
    expect(serverSupabaseClient).not.toHaveBeenCalled()
  })

  it('cart checkout: returns 500 when XENDIT key is missing before touching DB', async () => {
    const serverSupabaseClient = vi.fn(async () => ({}))

    vi.stubGlobal('readBody', vi.fn(async () => ({
      paymentChannel: 'qris',
      shippingMethod: 'shipping',
      shippingCost: 10000,
    })))

    vi.doMock('../server/utils/resolve-server-uid', () => ({
      resolveServerUser: vi.fn(async () => ({ id: 'buyer-1', email: 'buyer@test.com' })),
    }))
    vi.doMock('../server/utils/xendit-config', () => ({
      getXenditSecretKey: vi.fn(() => ''),
    }))
    vi.doMock('../server/utils/supabase-admin', () => ({
      supabaseAdmin: { from: vi.fn() },
    }))
    vi.doMock('#supabase/server', () => ({
      serverSupabaseClient,
    }))

    const { default: handler } = await import('../server/api/checkout/cart.post')

    await expect(handler({})).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'XENDIT_KEY belum dikonfigurasi.',
    })
    expect(serverSupabaseClient).not.toHaveBeenCalled()
  })
})
