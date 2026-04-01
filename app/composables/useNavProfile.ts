export function useNavProfile() {
  const supabase = useSupabaseClient() as any

  const userProfile = useState<any>('userProfile', () => null)
  const userAddress = useState<any>('userAddress', () => null)
  const profilePending = useState('navProfilePending', () => true)

  const userInitials = computed(() => {
    const name = userProfile.value?.name ?? ''
    const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    return initials || '?'
  })

  async function fetchProfile(uid: string) {
    const { data } = await supabase.from('users').select('name, avatar_url, username').eq('id', uid).single()
    if (data) userProfile.value = data
    profilePending.value = false
  }

  async function fetchNavAddress(uid: string) {
    const { data } = await supabase.from('addresses').select('label, city, full_address').eq('user_id', uid).eq('address_type', 'shipping').maybeSingle()
    userAddress.value = data ?? null
  }

  return {
    userProfile,
    userAddress,
    profilePending,
    userInitials,
    fetchProfile,
    fetchNavAddress,
  }
}
