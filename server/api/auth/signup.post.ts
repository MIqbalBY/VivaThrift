import { createSignupAccount } from '../../utils/signup-handler'
import { supabaseAdmin } from '../../utils/supabase-admin'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

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
      const { data, error } = await supabaseAdmin.auth.admin.createUser(payload)
      return {
        user: data.user ?? null,
        error: error
          ? { message: error.message }
          : null,
      }
    },
  })
})
