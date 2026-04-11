import { applyRateLimit, getDefaultRateLimitStore } from '../utils/rate-limit'
import { reportRateLimitExceeded } from '../utils/rate-limit-observability'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Use X-Forwarded-For (Vercel sets this), fallback to remote address
  const forwarded = getHeader(event, 'x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim()
    || getHeader(event, 'x-real-ip')
    || 'unknown'
  const now = Date.now()

  const result = await applyRateLimit({
    path,
    ip,
    now,
    store: getDefaultRateLimitStore(),
  })

  if (!result) return

  // Set standard rate limit headers
  event.node.res.setHeader('X-RateLimit-Limit', result.limit)
  event.node.res.setHeader('X-RateLimit-Remaining', result.remaining)
  event.node.res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))

  if (result.exceeded) {
    event.node.res.setHeader('Retry-After', result.retryAfter ?? 0)

    if (result.firstExceeded) {
      reportRateLimitExceeded({
        path,
        ip,
        limit: result.limit,
        count: result.count,
        resetAt: result.resetAt,
      }, now)
    }

    throw createError({ statusCode: 429, statusMessage: 'Terlalu banyak permintaan. Coba lagi nanti.' })
  }
})
