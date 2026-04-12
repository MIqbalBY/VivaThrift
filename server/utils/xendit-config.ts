export function getXenditSecretKey() {
  return process.env.XENDIT_KEY ?? process.env.XENDIT_SECRET_KEY ?? ''
}

export function getXenditCallbackToken() {
  return process.env.XENDIT_CALLBACK_TOKEN ?? process.env.XENDIT_WEBHOOK_TOKEN ?? ''
}