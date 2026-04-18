import { validatePhoneNumber } from '~/utils/signup-validation'

export function useProfileEdit() {
  const supabase = useSupabaseClient() as any
  const user = useSupabaseUser()

  async function resolveUid(): Promise<string | null> {
    if (user.value?.id) return user.value.id
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.id ?? null
  }

  const _shared = useState<any>('userProfile')
  const name       = ref('')
  const username   = ref('')
  const faculty    = ref('')
  const department = ref('')
  const avatarUrl  = ref(_shared.value?.avatar_url ?? '')
  const nrp        = ref('')
  const email      = ref('')
  const phone      = ref('')
  const gender     = ref('')
  const bio        = ref('')

  const profileSaving  = ref(false)
  const profileMsg     = ref('')
  const profileMsgType = ref('') // 'ok' | 'err'
  const profileLoading = ref(false)

  const usernameError    = ref('')
  const usernameChecking = ref(false)
  let usernameTimer: ReturnType<typeof setTimeout> | null = null
  const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/
  const originalUsername = ref('')

  watch(username, (val) => {
    usernameError.value = ''
    if (usernameTimer) clearTimeout(usernameTimer)
    if (!val) return
    if (!usernameRegex.test(val)) {
      usernameError.value = 'Hanya huruf, angka, titik (.) dan underscore (_). 3–30 karakter.'
      return
    }
    if (val.toLowerCase() === originalUsername.value.toLowerCase()) return
    usernameChecking.value = true
    usernameTimer = setTimeout(async () => {
      const { data } = await supabase.from('users').select('id').eq('username', val.toLowerCase()).maybeSingle()
      usernameChecking.value = false
      if (data) usernameError.value = 'Username sudah digunakan.'
    }, 500)
  })

  async function fetchProfile(uid?: string) {
    const id = uid ?? user.value?.id ?? await resolveUid()
    if (!id) return

    const authUser = user.value?.id === id
      ? user.value
      : (await supabase.auth.getUser()).data.user
    const metadata = (authUser?.user_metadata ?? {}) as Record<string, string | null | undefined>

    profileLoading.value = true
    const { data, error } = await supabase
      .from('users')
      .select('name, username, faculty, department, avatar_url, nrp, email, phone, gender, bio')
      .eq('id', id)
      .maybeSingle()
    profileLoading.value = false
    if (error) { console.error('[fetchProfile]', error.message); return }

    const merged = {
      name: data?.name ?? metadata.name ?? '',
      username: data?.username ?? metadata.username ?? '',
      faculty: data?.faculty ?? metadata.faculty ?? '',
      department: data?.department ?? metadata.department ?? '',
      avatar_url: data?.avatar_url ?? '',
      nrp: data?.nrp ?? metadata.nrp ?? '',
      email: data?.email ?? authUser?.email ?? '',
      phone: data?.phone ?? metadata.phone ?? '',
      gender: data?.gender ?? metadata.gender ?? '',
      bio: data?.bio ?? '',
    }

    name.value = merged.name
    username.value = merged.username
    originalUsername.value = merged.username
    faculty.value = merged.faculty
    department.value = merged.department
    avatarUrl.value = merged.avatar_url
    nrp.value = merged.nrp
    email.value = merged.email
    phone.value = merged.phone
    gender.value = merged.gender
    bio.value = merged.bio

    if (!data && (merged.name || merged.username || merged.email)) {
      const { error: syncError } = await supabase
        .from('users')
        .upsert({
          id,
          name: merged.name || null,
          username: merged.username || null,
          faculty: merged.faculty || null,
          department: merged.department || null,
          avatar_url: merged.avatar_url || null,
          nrp: merged.nrp || null,
          email: merged.email || null,
          phone: merged.phone || null,
          gender: merged.gender || null,
          bio: merged.bio || null,
        }, { onConflict: 'id' })

      if (syncError) console.error('[fetchProfile:sync]', syncError.message)
    }

    // Sync ke shared Navbar state
    const sharedProfile = useState('userProfile')
    sharedProfile.value = { ...(sharedProfile.value ?? {}), name: merged.name ?? '', avatar_url: merged.avatar_url ?? null, username: merged.username ?? null }
  }

  async function saveProfile(userId?: string | null) {
    const uid = user.value?.id ?? userId ?? await resolveUid()
    if (!uid) return
    if (username.value && !usernameRegex.test(username.value)) {
      profileMsg.value = 'Username tidak valid.'
      profileMsgType.value = 'err'
      return
    }
    if (usernameError.value) {
      profileMsg.value = usernameError.value
      profileMsgType.value = 'err'
      return
    }
    const phoneError = validatePhoneNumber(phone.value)
    if (phoneError) {
      profileMsg.value = phoneError
      profileMsgType.value = 'err'
      return
    }
    profileSaving.value = true
    profileMsg.value = ''
    const updates = {
      id: uid,
      name: name.value.trim(),
      gender: gender.value || null,
      bio: bio.value.trim() || null,
      phone: phone.value.trim(),
      username: username.value.trim().toLowerCase() || null,
      faculty: faculty.value.trim() || null,
      department: department.value.trim() || null,
      nrp: nrp.value.trim() || null,
      email: email.value.trim() || user.value?.email || null,
      avatar_url: avatarUrl.value || null,
    }
    const { error } = await supabase
      .from('users')
      .upsert(updates, { onConflict: 'id' })
    profileSaving.value = false
    if (error) {
      profileMsg.value = error.message.includes('idx_users_username_lower')
        ? 'Username sudah digunakan.'
        : 'Gagal menyimpan: ' + error.message
      profileMsgType.value = 'err'
    } else {
      originalUsername.value = username.value.trim().toLowerCase()
      profileMsg.value = 'Profil berhasil disimpan! ✅'
      profileMsgType.value = 'ok'
      const sharedProfile = useState('userProfile')
      sharedProfile.value = { ...(sharedProfile.value ?? {}), username: updates.username }
      setTimeout(() => { profileMsg.value = '' }, 3000)
    }
  }

  return {
    name, username, faculty, department, avatarUrl, nrp, email, phone, gender, bio,
    profileSaving, profileMsg, profileMsgType, profileLoading,
    usernameError, usernameChecking, originalUsername,
    fetchProfile, saveProfile,
  }
}
