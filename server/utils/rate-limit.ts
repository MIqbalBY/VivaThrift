import { reportRateLimitFallback } from './rate-limit-observability'

export interface RateBucket {
  count: number
  resetAt: number
}

export interface RateLimitStore {
  consume: (key: string, windowMs: number, now: number) => Promise<RateBucket>
}

export interface RateLimitDecision {
  limit: number
  count: number
  remaining: number
  resetAt: number
  retryAfter: number | null
  exceeded: boolean
  firstExceeded: boolean
}

export type RateTier = readonly [number, number]

const CLEANUP_INTERVAL = 5 * 60 * 1000

export const RATE_LIMIT_TIERS = {
  auth: [8, 60_000],
  upload: [10, 60_000],
  contact: [3, 300_000],
  default: [60, 60_000],
} satisfies Record<string, RateTier>

export function getTier(path: string): RateTier | null {
  if (path.startsWith('/api/webhooks/')) return null
  if (path.startsWith('/api/auth/')) return RATE_LIMIT_TIERS.auth
  if (path.includes('/upload')) return RATE_LIMIT_TIERS.upload
  if (path === '/api/contact') return RATE_LIMIT_TIERS.contact
  if (path.startsWith('/api/')) return RATE_LIMIT_TIERS.default

  return null
}

export function getRateLimitKey(ip: string, path: string) {
  return `${ip}:${path.split('/').slice(0, 4).join('/')}`
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateBucket>()
  private lastCleanup = 0

  async consume(key: string, windowMs: number, now: number) {
    this.cleanup(now)

    let bucket = this.buckets.get(key)
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs }
      this.buckets.set(key, bucket)
    }

    bucket.count += 1
    return bucket
  }

  private cleanup(now: number) {
    if (now - this.lastCleanup < CLEANUP_INTERVAL) {
      return
    }

    this.lastCleanup = now

    for (const [key, bucket] of this.buckets) {
      if (now > bucket.resetAt) {
        this.buckets.delete(key)
      }
    }
  }
}

type UpstashResponse = { result?: unknown; error?: string }

export class UpstashRestRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async consume(key: string, windowMs: number, now: number) {
    const response = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/multi-exec`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['PEXPIRE', key, windowMs, 'NX'],
        ['PTTL', key],
      ]),
    })

    if (!response.ok) {
      throw new Error(`Upstash request failed with ${response.status}`)
    }

    const payload = await response.json() as UpstashResponse[] | UpstashResponse

    if (!Array.isArray(payload)) {
      throw new Error('Unexpected Upstash response shape')
    }

    const [incrResult, , ttlResult] = payload

    if (incrResult?.error) {
      throw new Error(incrResult.error)
    }
    if (ttlResult?.error) {
      throw new Error(ttlResult.error)
    }

    const count = Number(incrResult?.result ?? 0)
    const ttl = Number(ttlResult?.result ?? windowMs)
    const normalizedTtl = ttl > 0 ? ttl : windowMs

    return {
      count,
      resetAt: now + normalizedTtl,
    }
  }
}

export class FallbackRateLimitStore implements RateLimitStore {
  constructor(
    private readonly primary: RateLimitStore,
    private readonly fallback: RateLimitStore,
    private readonly onError?: (error: unknown) => void,
  ) {}

  async consume(key: string, windowMs: number, now: number) {
    try {
      return await this.primary.consume(key, windowMs, now)
    } catch (error) {
      this.onError?.(error)
      return this.fallback.consume(key, windowMs, now)
    }
  }
}

let defaultRateLimitStore: RateLimitStore | null = null

export function getDefaultRateLimitStore() {
  if (defaultRateLimitStore) {
    return defaultRateLimitStore
  }

  const fallbackStore = new MemoryRateLimitStore()
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (upstashUrl && upstashToken) {
    defaultRateLimitStore = new FallbackRateLimitStore(
      new UpstashRestRateLimitStore(upstashUrl, upstashToken),
      fallbackStore,
      (error) => reportRateLimitFallback(error),
    )
    return defaultRateLimitStore
  }

  defaultRateLimitStore = fallbackStore
  return defaultRateLimitStore
}

export async function applyRateLimit(params: {
  path: string
  ip: string
  now: number
  store: RateLimitStore
}) {
  const tier = getTier(params.path)
  if (!tier) {
    return null
  }

  const [limit, windowMs] = tier
  const bucket = await params.store.consume(getRateLimitKey(params.ip, params.path), windowMs, params.now)
  const exceeded = bucket.count > limit

  return {
    limit,
    count: bucket.count,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfter: exceeded ? Math.ceil((bucket.resetAt - params.now) / 1000) : null,
    exceeded,
    firstExceeded: bucket.count === limit + 1,
  } satisfies RateLimitDecision
}