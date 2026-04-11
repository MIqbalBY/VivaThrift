import webpush from 'web-push'

let initialized = false

function initWebPush() {
  if (initialized) return
  const publicKey  = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject    = process.env.VAPID_SUBJECT ?? 'mailto:admin@vivathrift.store'

  if (!publicKey || !privateKey) return
  webpush.setVapidDetails(subject, publicKey, privateKey)
  initialized = true
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; url?: string; icon?: string },
): Promise<void> {
  initWebPush()
  await webpush.sendNotification(subscription, JSON.stringify(payload))
}

export async function sendPushToMany(
  subscriptions: webpush.PushSubscription[],
  payload: { title: string; body: string; url?: string; icon?: string },
): Promise<{ sent: number; failed: number }> {
  initWebPush()
  let sent = 0
  let failed = 0
  await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload))
        .then(() => sent++)
        .catch(() => failed++)
    )
  )
  return { sent, failed }
}
