export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/auth/signin')

  const supabase = useSupabaseClient()
  const { data } = await (supabase
    .from('users')
    .select('role')
    .eq('id', (user.value as any).id)
    .single() as any)

  if (!data || !['admin', 'moderator'].includes(data.role)) {
    return navigateTo('/')
  }
})