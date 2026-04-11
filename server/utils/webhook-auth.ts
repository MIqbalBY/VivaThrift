import { timingSafeEqual } from 'node:crypto'

type AuthFailure = {
  ok: false
  statusCode: number
  statusMessage: string
  logMessage?: string
}

type AuthSuccess = {
  ok: true
}

type AuthResult = AuthSuccess | AuthFailure

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyXenditCallbackToken(params: {
  receivedToken?: string | null
  expectedToken?: string | null
}): AuthResult {
  if (!params.expectedToken) {
    return {
      ok: false,
      statusCode: 500,
      statusMessage: 'Webhook misconfigured.',
      logMessage: '[xendit-webhook] XENDIT_CALLBACK_TOKEN env var is not set!',
    }
  }

  if (params.receivedToken !== params.expectedToken) {
    return {
      ok: false,
      statusCode: 401,
      statusMessage: 'Invalid callback token.',
    }
  }

  return { ok: true }
}

export function verifyOptionalBiteshipWebhookAuth(params: {
  authorization?: string | null
  callbackToken?: string | null
  webhookToken?: string | null
  expectedToken?: string | null
  expectedUser?: string | null
  expectedPassword?: string | null
}): AuthResult {
  const expectedToken = params.expectedToken?.trim()
  const expectedUser = params.expectedUser?.trim()
  const expectedPassword = params.expectedPassword?.trim()
  const authorization = params.authorization?.trim()
  const callbackToken = params.callbackToken?.trim()
  const webhookToken = params.webhookToken?.trim()

  if (expectedUser || expectedPassword) {
    if (!expectedUser || !expectedPassword) {
      return {
        ok: false,
        statusCode: 500,
        statusMessage: 'Webhook misconfigured.',
        logMessage: '[biteship-webhook] Basic auth env is incomplete.',
      }
    }

    const expectedBasic = `Basic ${Buffer.from(`${expectedUser}:${expectedPassword}`).toString('base64')}`

    if (!authorization || !secureEquals(authorization, expectedBasic)) {
      return {
        ok: false,
        statusCode: 401,
        statusMessage: 'Invalid webhook authentication.',
      }
    }

    return { ok: true }
  }

  if (!expectedToken) {
    return { ok: true }
  }

  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''

  const candidates = [bearerToken, callbackToken ?? '', webhookToken ?? '']
  const isValid = candidates.some((candidate) => candidate && secureEquals(candidate, expectedToken))

  if (!isValid) {
    return {
      ok: false,
      statusCode: 401,
      statusMessage: 'Invalid webhook token.',
    }
  }

  return { ok: true }
}