export default defineNuxtPlugin(() => {
  const supabase = useSupabaseClient()

  // Skip if already on reset-password page
  if (window.location.pathname === '/auth/reset-password') return

  const RECOVERY_TIMEOUT = 15 * 60 * 1000 // 15 minutes

  supabase.auth.onAuthStateChange((event) => {
    // 1) Direct PASSWORD_RECOVERY event (backup — doesn't fire in current PKCE build, but future-proof)
    if (event === 'PASSWORD_RECOVERY') {
      localStorage.removeItem('__vt_pending_recovery')
      window.location.replace('/auth/reset-password')
      return
    }

    // 2) PKCE workaround: PASSWORD_RECOVERY never fires because @supabase/ssr
    //    hard-codes flowType:"pkce" and _getSessionFromURL returns redirectType:null.
    //    Detect recovery via localStorage flag set in forgot-password.vue.
    if (event === 'SIGNED_IN') {
      const pending = localStorage.getItem('__vt_pending_recovery')
      if (pending) {
        const timestamp = parseInt(pending, 10)
        if (Date.now() - timestamp < RECOVERY_TIMEOUT) {
          localStorage.removeItem('__vt_pending_recovery')
          window.location.replace('/auth/reset-password')
          return
        }
        // Stale flag, clean up
        localStorage.removeItem('__vt_pending_recovery')
      }
    }
  })
})
