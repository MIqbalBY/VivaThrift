import { describe, expect, it } from 'vitest'
import { verifyOptionalBiteshipWebhookAuth, verifyXenditCallbackToken } from '../server/utils/webhook-auth'

describe('verifyXenditCallbackToken', () => {
  it('fails when the callback token env is missing', () => {
    expect(verifyXenditCallbackToken({
      receivedToken: 'token-1',
      expectedToken: null,
    })).toEqual({
      ok: false,
      statusCode: 500,
      statusMessage: 'Webhook misconfigured.',
      logMessage: '[xendit-webhook] XENDIT_CALLBACK_TOKEN env var is not set!',
    })
  })

  it('fails when the callback token does not match', () => {
    expect(verifyXenditCallbackToken({
      receivedToken: 'wrong',
      expectedToken: 'expected',
    })).toEqual({
      ok: false,
      statusCode: 401,
      statusMessage: 'Invalid callback token.',
    })
  })

  it('passes when the callback token matches', () => {
    expect(verifyXenditCallbackToken({
      receivedToken: 'expected',
      expectedToken: 'expected',
    })).toEqual({ ok: true })
  })
})

describe('verifyOptionalBiteshipWebhookAuth', () => {
  it('passes when no webhook auth is configured', () => {
    expect(verifyOptionalBiteshipWebhookAuth({
      authorization: null,
      callbackToken: null,
      webhookToken: null,
      expectedToken: null,
      expectedUser: null,
      expectedPassword: null,
    })).toEqual({ ok: true })
  })

  it('fails when basic auth env is incomplete', () => {
    expect(verifyOptionalBiteshipWebhookAuth({
      authorization: null,
      expectedUser: 'admin',
      expectedPassword: null,
    })).toEqual({
      ok: false,
      statusCode: 500,
      statusMessage: 'Webhook misconfigured.',
      logMessage: '[biteship-webhook] Basic auth env is incomplete.',
    })
  })

  it('passes when the basic auth header matches', () => {
    const auth = `Basic ${Buffer.from('admin:secret').toString('base64')}`

    expect(verifyOptionalBiteshipWebhookAuth({
      authorization: auth,
      expectedUser: 'admin',
      expectedPassword: 'secret',
    })).toEqual({ ok: true })
  })

  it('fails when the bearer/callback/webhook token does not match', () => {
    expect(verifyOptionalBiteshipWebhookAuth({
      authorization: 'Bearer wrong',
      callbackToken: 'wrong',
      webhookToken: 'wrong',
      expectedToken: 'expected',
    })).toEqual({
      ok: false,
      statusCode: 401,
      statusMessage: 'Invalid webhook token.',
    })
  })

  it('passes when any supported token header matches', () => {
    expect(verifyOptionalBiteshipWebhookAuth({
      authorization: 'Bearer expected',
      callbackToken: null,
      webhookToken: null,
      expectedToken: 'expected',
    })).toEqual({ ok: true })

    expect(verifyOptionalBiteshipWebhookAuth({
      authorization: null,
      callbackToken: 'expected',
      webhookToken: null,
      expectedToken: 'expected',
    })).toEqual({ ok: true })

    expect(verifyOptionalBiteshipWebhookAuth({
      authorization: null,
      callbackToken: null,
      webhookToken: 'expected',
      expectedToken: 'expected',
    })).toEqual({ ok: true })
  })
})