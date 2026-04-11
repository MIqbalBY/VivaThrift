import * as Sentry from '@sentry/nuxt'

const throttledMessages = new Map<string, number>()
const GLOBAL_SNAPSHOT_KEY = 'rate-limit:observability:snapshot'

type RateLimitObservabilityState = {
  fallbackCount: number
  lastFallbackAt: string | null
  lastFallbackError: string | null
  exceededCount: number
  lastExceededAt: string | null
  lastExceededPath: string | null
  lastExceededIp: string | null
}

type UpstashCommandResult = {
  result?: unknown
  error?: string
}

const state: RateLimitObservabilityState = {
  fallbackCount: 0,
  lastFallbackAt: null,
  lastFallbackError: null,
  exceededCount: 0,
  lastExceededAt: null,
  lastExceededPath: null,
  lastExceededIp: null,
}

function shouldEmit(key: string, now: number, throttleMs: number) {
  const lastAt = throttledMessages.get(key)
  if (lastAt !== undefined && now - lastAt < throttleMs) {
    return false
  }

  throttledMessages.set(key, now)
  return true
}

function captureWarning(message: string, extras: Record<string, unknown>) {
  console.warn(message, extras)

  Sentry.withScope((scope) => {
    scope.setLevel('warning')

    for (const [key, value] of Object.entries(extras)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        scope.setTag(key, String(value))
      } else {
        scope.setExtra(key, value)
      }
    }

    Sentry.captureMessage(message)
  })
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (!url || !token) {
    return null
  }

  return {
    url: url.replace(/\/$/, ''),
    token,
  }
}

async function executeUpstashCommands(commands: unknown[][]) {
  const config = getUpstashConfig()
  if (!config) {
    return null
  }

  const response = await fetch(`${config.url}/multi-exec`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })

  if (!response.ok) {
    throw new Error(`Upstash request failed with ${response.status}`)
  }

  const payload = await response.json() as UpstashCommandResult[] | UpstashCommandResult
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected Upstash response shape')
  }

  for (const command of payload) {
    if (command?.error) {
      throw new Error(command.error)
    }
  }

  return payload
}

async function writeGlobalRateLimitObservabilityEvent(params: {
  countField: 'fallbackCount' | 'exceededCount'
  lastAtField: 'lastFallbackAt' | 'lastExceededAt'
  lastAtValue: string
  lastValueField?: 'lastFallbackError' | 'lastExceededPath' | 'lastExceededIp'
  lastValue?: string | null
  extraLastValueField?: 'lastExceededIp'
  extraLastValue?: string | null
}) {
  const commands: unknown[][] = [
    ['HINCRBY', GLOBAL_SNAPSHOT_KEY, params.countField, 1],
    ['HSET', GLOBAL_SNAPSHOT_KEY, params.lastAtField, params.lastAtValue],
  ]

  if (params.lastValueField) {
    commands.push(['HSET', GLOBAL_SNAPSHOT_KEY, params.lastValueField, params.lastValue ?? ''])
  }
  if (params.extraLastValueField) {
    commands.push(['HSET', GLOBAL_SNAPSHOT_KEY, params.extraLastValueField, params.extraLastValue ?? ''])
  }

  commands.push(['EXPIRE', GLOBAL_SNAPSHOT_KEY, 60 * 60 * 24 * 7])
  await executeUpstashCommands(commands)
}

function normalizeSnapshotValue(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return String(value)
}

export async function readGlobalRateLimitObservabilitySnapshot(): Promise<RateLimitObservabilityState | null> {
  const payload = await executeUpstashCommands([
    ['HMGET', GLOBAL_SNAPSHOT_KEY, 'fallbackCount', 'lastFallbackAt', 'lastFallbackError', 'exceededCount', 'lastExceededAt', 'lastExceededPath', 'lastExceededIp'],
  ])

  const values = payload?.[0]?.result
  if (!Array.isArray(values) || values.length !== 7) {
    return null
  }

  const [fallbackCount, lastFallbackAt, lastFallbackError, exceededCount, lastExceededAt, lastExceededPath, lastExceededIp] = values

  return {
    fallbackCount: Number(fallbackCount ?? 0),
    lastFallbackAt: normalizeSnapshotValue(lastFallbackAt),
    lastFallbackError: normalizeSnapshotValue(lastFallbackError),
    exceededCount: Number(exceededCount ?? 0),
    lastExceededAt: normalizeSnapshotValue(lastExceededAt),
    lastExceededPath: normalizeSnapshotValue(lastExceededPath),
    lastExceededIp: normalizeSnapshotValue(lastExceededIp),
  }
}

export function reportRateLimitFallback(error: unknown, now = Date.now()) {
  if (!shouldEmit('rate-limit-fallback', now, 60_000)) {
    return
  }

  state.fallbackCount += 1
  state.lastFallbackAt = new Date(now).toISOString()
  state.lastFallbackError = error instanceof Error ? error.message : String(error)

  void writeGlobalRateLimitObservabilityEvent({
    countField: 'fallbackCount',
    lastAtField: 'lastFallbackAt',
    lastAtValue: state.lastFallbackAt,
    lastValueField: 'lastFallbackError',
    lastValue: state.lastFallbackError,
  }).catch(() => {})

  captureWarning('[rate-limit] Falling back to in-memory store.', {
    errorMessage: state.lastFallbackError,
  })
}

export function reportRateLimitExceeded(params: {
  path: string
  ip: string
  limit: number
  count: number
  resetAt: number
}, now = Date.now()) {
  const minuteBucket = Math.floor(now / 60_000)
  const key = `rate-limit-exceeded:${params.ip}:${params.path}:${minuteBucket}`

  if (!shouldEmit(key, now, 60_000)) {
    return
  }

  state.exceededCount += 1
  state.lastExceededAt = new Date(now).toISOString()
  state.lastExceededPath = params.path
  state.lastExceededIp = params.ip

  void writeGlobalRateLimitObservabilityEvent({
    countField: 'exceededCount',
    lastAtField: 'lastExceededAt',
    lastAtValue: state.lastExceededAt,
    lastValueField: 'lastExceededPath',
    lastValue: state.lastExceededPath,
    extraLastValueField: 'lastExceededIp',
    extraLastValue: state.lastExceededIp,
  }).catch(() => {})

  captureWarning('[rate-limit] Request rejected with 429.', {
    path: params.path,
    ip: params.ip,
    limit: params.limit,
    count: params.count,
    resetAt: params.resetAt,
  })
}

export function getRateLimitObservabilitySnapshot() {
  return { ...state }
}