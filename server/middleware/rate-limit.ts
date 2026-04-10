// ── In-memory rate limiter (per-instance) ───────────────────────────
// Provides basic abuse prevention. In serverless (Vercel Fluid Compute),
// each warm instance maintains its own Map — not a global rate limit,
// but effective against burst attacks within a single instance.
//
// For production-grade global rate limiting, replace with Upstash Redis.

interface RateBucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateBucket>()

// Cleanup stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key)
  }
}

// ── Tier config ─────────────────────────────────────────────────────
// [maxRequests, windowMs]
const TIERS: Record<string, [number, number]> = {
  auth:    [8, 60_000],        // 8 req/min  — login, register, reset-password
  upload:  [10, 60_000],       // 10 req/min — media upload
  default: [60, 60_000],       // 60 req/min — general API
}

function getTier(path: string): [number, number] | null {
  // Skip rate limiting for webhooks (Xendit sends retries)
  if (path.startsWith('/api/webhooks/')) return null

  if (path.startsWith('/api/auth/'))   return TIERS.auth ?? null
  if (path.includes('/upload'))        return TIERS.upload ?? null
  if (path.startsWith('/api/'))        return TIERS.default ?? null

  // Non-API routes (pages, assets) — don't rate limit
  return null
}

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const tier = getTier(path)
  if (!tier) return // skip non-API or exempt routes

  const [maxRequests, windowMs] = tier

  // Use X-Forwarded-For (Vercel sets this), fallback to remote address
  const forwarded = getHeader(event, 'x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim()
    || getHeader(event, 'x-real-ip')
    || 'unknown'

  const key = `${ip}:${path.split('/').slice(0, 4).join('/')}`
  const now = Date.now()

  cleanup()

  let bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count++

  // Set standard rate limit headers
  event.node.res.setHeader('X-RateLimit-Limit', maxRequests)
  event.node.res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - bucket.count))
  event.node.res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000))

  if (bucket.count > maxRequests) {
    event.node.res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000))
    throw createError({ statusCode: 429, statusMessage: 'Terlalu banyak permintaan. Coba lagi nanti.' })
  }
})
