/**
 * Lightweight transactional email sender via Resend REST API.
 * Zero dependencies — uses $fetch (built into Nitro).
 *
 * Setup: set RESEND_API_KEY in your .env
 * Free tier: 100 emails/day — more than enough for a campus marketplace.
 */

interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[send-email] RESEND_API_KEY not configured, skipping email.')
    return false
  }

  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        from: 'VivaThrift <noreply@vivathrift.store>',
        to: [to],
        subject,
        html,
      },
    })
    return true
  } catch (e: any) {
    console.error('[send-email] Failed:', e?.data ?? e?.message)
    return false
  }
}
