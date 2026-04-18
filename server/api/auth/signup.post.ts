import { createSignupAccount, createAuthUserWithCustomVerificationEmail } from '../../utils/signup-handler'
import { supabaseAdmin } from '../../utils/supabase-admin'
import { sendEmail } from '../../utils/send-email'
import { emailSignupVerification } from '../../utils/email-templates'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const requestOrigin = getRequestURL(event).origin.replace(/\/+$/, '')
  const preferredOrigin = String(process.env.SITE_URL ?? '').trim().replace(/\/+$/, '')
  const emailRedirectTo = `${preferredOrigin || requestOrigin}/auth/confirm?type=signup`

  return createSignupAccount(body, {
    findUserByUsername: async (username: string) => {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle()

      return data
    },
    createAuthUser: async (payload) => {
      return createAuthUserWithCustomVerificationEmail(payload, {
        generateSignupLink: async (linkPayload) => {
          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'signup',
            email: linkPayload.email,
            password: linkPayload.password,
            options: {
              redirectTo: linkPayload.emailRedirectTo,
              data: linkPayload.user_metadata,
            },
          })

          return {
            user: data.user ?? null,
            actionLink: data.properties?.action_link ?? null,
            error: error ? { message: error.message } : null,
          }
        },
        sendVerificationEmail: async ({ to, name, confirmationUrl }) => {
          const mail = emailSignupVerification({ name, confirmationUrl })
          return sendEmail({ to, ...mail })
        },
      })
    },
    syncUserProfile: async (profile) => {
      const { error } = await supabaseAdmin
        .from('users')
        .upsert(profile, { onConflict: 'id' })

      if (error) {
        throw new Error(`Gagal sinkronisasi profil pengguna: ${error.message}`)
      }
    },
  }, {
    emailRedirectTo,
  })
})
