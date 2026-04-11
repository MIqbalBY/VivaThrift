import { sendEmail } from '../utils/send-email'
import { emailContactFormToTeam, emailContactFormAutoReply } from '../utils/email-templates'

// POST /api/contact
// Body: { name, email, subject, message, website? }
//
// Security:
//   - `website` is a honeypot field — bots fill it, humans leave it empty
//   - Input is validated and stripped of HTML tags before use
//   - Rate-limited by server/middleware/rate-limit.ts (contact tier: 3 req/5 min)
//   - Email is sent via Resend through server/utils/send-email.ts

const TEAM_EMAIL = 'admin@vivathrift.store'
const MAX_NAME = 100
const MAX_MESSAGE = 2000

function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name, email, subject, message, website } = body ?? {}

  // Honeypot — bots fill this hidden field, humans don't
  if (website) {
    // Silently accept to not tip off bots
    return { ok: true }
  }

  // ── Input validation ────────────────────────────────────────────────────────
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > MAX_NAME) {
    throw createError({ statusCode: 400, statusMessage: 'Nama tidak valid (min. 2 karakter).' })
  }
  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Alamat email tidak valid.' })
  }
  if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Topik wajib dipilih.' })
  }
  if (!message || typeof message !== 'string' || message.trim().length < 10 || message.length > MAX_MESSAGE) {
    throw createError({ statusCode: 400, statusMessage: `Pesan harus antara 10–${MAX_MESSAGE} karakter.` })
  }

  // ── Sanitize ────────────────────────────────────────────────────────────────
  const safe = {
    name: stripTags(name.trim()),
    email: email.trim().toLowerCase(),
    subject: stripTags(subject.trim()),
    message: stripTags(message.trim()),
  }

  // ── Send emails concurrently ─────────────────────────────────────────────────
  const teamEmail = emailContactFormToTeam(safe)
  const autoReply = emailContactFormAutoReply({ name: safe.name, subject: safe.subject })

  const [teamOk] = await Promise.all([
    sendEmail({ to: TEAM_EMAIL, ...teamEmail }),
    sendEmail({ to: safe.email, ...autoReply }),
  ])

  if (!teamOk) {
    console.error('[contact] Failed to deliver contact email to team.')
  }

  return { ok: true }
})
