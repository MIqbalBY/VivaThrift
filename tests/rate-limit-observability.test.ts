import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureMessage = vi.fn()
const setLevel = vi.fn()
const setTag = vi.fn()
const setExtra = vi.fn()
const withScope = vi.fn((callback: (scope: {
  setLevel: typeof setLevel
  setTag: typeof setTag
  setExtra: typeof setExtra
}) => void) => {
  callback({ setLevel, setTag, setExtra })
})

vi.mock('@sentry/nuxt', () => ({
  captureMessage,
  withScope,
}))

describe('rate-limit observability', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it('throttles repeated fallback reports within the same minute', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { reportRateLimitFallback } = await import('../server/utils/rate-limit-observability')

    reportRateLimitFallback(new Error('upstash down'), 1_000)
    reportRateLimitFallback(new Error('upstash still down'), 2_000)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('reports only the first exceeded event for the same path/ip bucket', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { reportRateLimitExceeded, getRateLimitObservabilitySnapshot } = await import('../server/utils/rate-limit-observability')

    reportRateLimitExceeded({ path: '/api/contact', ip: '127.0.0.1', limit: 3, count: 4, resetAt: 300_000 }, 60_000)
    reportRateLimitExceeded({ path: '/api/contact', ip: '127.0.0.1', limit: 3, count: 5, resetAt: 300_000 }, 60_500)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(getRateLimitObservabilitySnapshot()).toMatchObject({
      exceededCount: 1,
      lastExceededAt: '1970-01-01T00:01:00.000Z',
      lastExceededPath: '/api/contact',
      lastExceededIp: '127.0.0.1',
    })
    warn.mockRestore()
  })

  it('stores snapshot data for fallback reports', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { reportRateLimitFallback, getRateLimitObservabilitySnapshot } = await import('../server/utils/rate-limit-observability')

    reportRateLimitFallback(new Error('upstash down'), 120_000)

    expect(getRateLimitObservabilitySnapshot()).toMatchObject({
      fallbackCount: 1,
      lastFallbackAt: '1970-01-01T00:02:00.000Z',
      lastFallbackError: 'upstash down',
    })
    warn.mockRestore()
  })

  it('writes fallback events to the global Upstash snapshot when configured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { result: 1 },
        { result: 1 },
        { result: 1 },
        { result: 1 },
      ]),
    })

    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubGlobal('fetch', fetchMock)

    const { reportRateLimitFallback } = await import('../server/utils/rate-limit-observability')

    reportRateLimitFallback(new Error('upstash down'), 120_000)
    await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledWith('https://upstash.example/multi-exec', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer token',
      }),
    }))

    const request = fetchMock.mock.calls[0]?.[1]
    expect(typeof request?.body).toBe('string')
    expect(request?.body).toContain('fallbackCount')
    expect(request?.body).toContain('lastFallbackError')
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it('reads the global Upstash snapshot when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        result: ['2', '2025-01-01T00:00:00.000Z', 'upstash down', '5', '2025-01-01T00:05:00.000Z', '/api/contact', '127.0.0.1'],
      }]),
    })

    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubGlobal('fetch', fetchMock)

    const { readGlobalRateLimitObservabilitySnapshot } = await import('../server/utils/rate-limit-observability')

    await expect(readGlobalRateLimitObservabilitySnapshot()).resolves.toEqual({
      fallbackCount: 2,
      lastFallbackAt: '2025-01-01T00:00:00.000Z',
      lastFallbackError: 'upstash down',
      exceededCount: 5,
      lastExceededAt: '2025-01-01T00:05:00.000Z',
      lastExceededPath: '/api/contact',
      lastExceededIp: '127.0.0.1',
    })

    vi.unstubAllGlobals()
  })
})