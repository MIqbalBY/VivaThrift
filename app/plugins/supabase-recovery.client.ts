export default defineNuxtPlugin(() => {
  const supabase = useSupabaseClient()

  // 1) Immediately check URL hash for recovery type
  //    Supabase redirects with: .../#access_token=xxx&type=recovery
  //    This runs BEFORE the hash gets consumed
  const hash = window.location.hash.substring(1)
  if (hash) {
    const params = new URLSearchParams(hash)
    if (params.get('type') === 'recovery') {
      // Let Supabase client process the tokens first, then redirect
      const check = async () => {
        for (let i = 0; i < 10; i++) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            window.location.replace('/auth/reset-password')
            return
          }
          await new Promise(r => setTimeout(r, 300))
        }
        // Fallback: redirect anyway
        window.location.replace('/auth/reset-password')
      }
      check()
      return
    }
  }

  // 2) Backup: listen for PASSWORD_RECOVERY event (e.g. when arriving via /auth/confirm)
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      window.location.replace('/auth/reset-password')
    }
  })
})
