export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/auth/signin')

  // Primary: check role from JWT app_metadata (no DB round-trip, works on SSR)
  const metaRole = (user.value.app_metadata as any)?.role
  if (['admin', 'moderator'].includes(metaRole)) return

  // Fallback: query DB (for sessions before app_metadata was set)
  const supabase = useSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.value.id)
    .single()

  if (error || !data || !['admin', 'moderator'].includes(data.role)) {
    return navigateTo('/')
  }
})