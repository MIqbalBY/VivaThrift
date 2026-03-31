export default defineNuxtPlugin(() => {
  const supabase = useSupabaseClient()

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      navigateTo('/auth/reset-password', { replace: true })
    }
  })
})
