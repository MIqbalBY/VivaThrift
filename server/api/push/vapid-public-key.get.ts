// GET /api/push/vapid-public-key
// Returns the VAPID public key needed by browser to create a push subscription.
// This key is safe to expose publicly.
export default defineEventHandler(() => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? '' }
})
