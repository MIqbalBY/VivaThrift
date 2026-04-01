export function useProfileEdit() {
  const supabase = useSupabaseClient() as any
  const user = useSupabaseUser()

  const name       = ref('')
  const username   = ref('')
  const faculty    = ref('')
  const department = ref('')
  const avatarUrl  = ref('')
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
    const id = uid ?? user.value?.id
    if (!id) return
    profileLoading.value = true
    const { data, error } = await supabase
      .from('users')
      .select('name, username, faculty, department, avatar_url, nrp, email, gender, bio')
      .eq('id', id)
      .maybeSingle()
    profileLoading.value = false
    if (error) { console.error('[fetchProfile]', error.message); return }
    if (!data) return
    name.value            = data.name        ?? ''
    username.value        = data.username     ?? ''
    originalUsername.value = data.username     ?? ''
    faculty.value         = data.faculty      ?? ''
    department.value      = data.department   ?? ''
    avatarUrl.value       = data.avatar_url   ?? ''
    nrp.value             = data.nrp          ?? ''
    email.value           = data.email        ?? user.value?.email ?? ''
    phone.value           = data.phone        ?? ''
    gender.value          = data.gender       ?? ''
    bio.value             = data.bio          ?? ''

    // Sync ke shared Navbar state
    const sharedProfile = useState('userProfile')
    sharedProfile.value = { ...(sharedProfile.value ?? {}), name: data.name ?? '', avatar_url: data.avatar_url ?? null, username: data.username ?? null }
  }

  async function saveProfile(userId?: string | null) {
    const uid = user.value?.id ?? userId
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
    profileSaving.value = true
    profileMsg.value = ''
    const updates = {
      name: name.value.trim(),
      gender: gender.value || null,
      bio: bio.value.trim() || null,
      username: username.value.trim().toLowerCase() || null,
    }
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', uid)
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
