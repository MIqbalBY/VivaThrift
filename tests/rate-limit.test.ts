import { describe, expect, it, vi } from 'vitest'
import {
  applyRateLimit,
  FallbackRateLimitStore,
  getRateLimitKey,
  getTier,
  MemoryRateLimitStore,
  UpstashRestRateLimitStore,
} from '../server/utils/rate-limit'

describe('getTier', () => {
  it('skips webhook and non-api routes', () => {
    expect(getTier('/api/webhooks/xendit')).toBeNull()
    expect(getTier('/products/123')).toBeNull()
  })

  it('maps auth, upload, contact, and general api routes to the expected tier', () => {
    expect(getTier('/api/auth/signin')).toEqual([8, 60_000])
    expect(getTier('/api/upload/image')).toEqual([10, 60_000])
    expect(getTier('/api/contact')).toEqual([3, 300_000])
    expect(getTier('/api/orders')).toEqual([60, 60_000])
  })
})

describe('getRateLimitKey', () => {
  it('groups requests by ip and the first three api segments', () => {
    expect(getRateLimitKey('127.0.0.1', '/api/auth/signin')).toBe('127.0.0.1:/api/auth/signin')
    expect(getRateLimitKey('127.0.0.1', '/api/orders/123/complete')).toBe('127.0.0.1:/api/orders/123')
  })
})

describe('MemoryRateLimitStore', () => {
  it('increments counts within the same window and resets after expiry', async () => {
    const store = new MemoryRateLimitStore()

    expect(await store.consume('key-1', 1000, 100)).toEqual({ count: 1, resetAt: 1100 })
    expect(await store.consume('key-1', 1000, 200)).toEqual({ count: 2, resetAt: 1100 })
    expect(await store.consume('key-1', 1000, 1201)).toEqual({ count: 1, resetAt: 2201 })
  })
})

describe('UpstashRestRateLimitStore', () => {
  it('parses a multi-exec response into count and reset time', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([
      { result: 4 },
      { result: 1 },
      { result: 45000 },
    ]), { status: 200 }))
    const store = new UpstashRestRateLimitStore('https://demo.upstash.io', 'token-1', fetchImpl as unknown as typeof fetch)

    await expect(store.consume('key-1', 60000, 1000)).resolves.toEqual({
      count: 4,
      resetAt: 46000,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('FallbackRateLimitStore', () => {
  it('falls back to the memory store when the primary store fails', async () => {
    const primary = {
      consume: vi.fn(async () => {
        throw new Error('upstash down')
      }),
    }
    const fallback = new MemoryRateLimitStore()
    const onError = vi.fn()
    const store = new FallbackRateLimitStore(primary, fallback, onError)

    await expect(store.consume('key-1', 1000, 0)).resolves.toEqual({ count: 1, resetAt: 1000 })
    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('applyRateLimit', () => {
  it('returns headers metadata and exceeded state for limited routes', async () => {
    const store = new MemoryRateLimitStore()

    await applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 0, store })
    await applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 1, store })
    await applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 2, store })

    await expect(applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 3, store })).resolves.toEqual({
      limit: 3,
      count: 4,
      remaining: 0,
      resetAt: 300000,
      retryAfter: 300,
      exceeded: true,
      firstExceeded: true,
    })
  })

  it('returns null for routes that are intentionally excluded from rate limiting', async () => {
    const store = new MemoryRateLimitStore()

    await expect(applyRateLimit({ path: '/api/webhooks/xendit', ip: '127.0.0.1', now: 0, store })).resolves.toBeNull()
  })

  it('marks only the first blocked request in a window as firstExceeded', async () => {
    const store = new MemoryRateLimitStore()

    await applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 0, store })
    await applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 1, store })
    await applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 2, store })

    const firstBlocked = await applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 3, store })
    const secondBlocked = await applyRateLimit({ path: '/api/contact', ip: '127.0.0.1', now: 4, store })

    expect(firstBlocked?.firstExceeded).toBe(true)
    expect(secondBlocked?.firstExceeded).toBe(false)
    expect(secondBlocked?.count).toBe(5)
  })
})