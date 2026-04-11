/**
 * usePushNotifications — manages Web Push subscription lifecycle.
 *
 * Usage:
 *   const { isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications()
 */
export function usePushNotifications() {
  const isSupported = computed(() =>
    import.meta.client && 'serviceWorker' in navigator && 'PushManager' in window
  )

  const isSubscribed = ref(false)
  const loading = ref(false)

  async function checkSubscriptionStatus() {
    if (!isSupported.value) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    isSubscribed.value = !!sub
  }

  async function subscribe(): Promise<boolean> {
    if (!isSupported.value || loading.value) return false
    loading.value = true
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false

      // Fetch VAPID public key from server
      const { publicKey } = await $fetch<{ publicKey: string }>('/api/push/vapid-public-key')
      if (!publicKey) return false

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      })

      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: { subscription: subscription.toJSON() },
      })

      isSubscribed.value = true
      return true
    } catch (err) {
      console.error('[Push] Subscribe failed:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function unsubscribe(): Promise<boolean> {
    if (!isSupported.value || loading.value) return false
    loading.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (!subscription) return true

      await $fetch('/api/push/unsubscribe', {
        method: 'POST',
        body: { endpoint: subscription.endpoint },
      })
      await subscription.unsubscribe()
      isSubscribed.value = false
      return true
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  onMounted(checkSubscriptionStatus)

  return { isSupported, isSubscribed, loading, subscribe, unsubscribe }
}

/** Converts a base64url VAPID public key to ArrayBuffer for PushManager */
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const bytes = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index++) {
    bytes[index] = rawData.charCodeAt(index)
  }

  return bytes.buffer
}
