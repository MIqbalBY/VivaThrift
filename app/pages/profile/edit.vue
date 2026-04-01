<script setup>
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

useSeoMeta({ title: 'Pengaturan — VivaThrift' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { isDark } = useDarkMode()
const _userId = ref(null)

// Redirect if not logged in
watchEffect(() => {
  if (user.value === null) navigateTo('/auth/signin')
})

// ─── Tabs ───────────────────────────────────────────────────────────────────
const route = useRoute()
const TABS = ['profil', 'alamat', 'keamanan', 'notifikasi']
const activeTab = ref(TABS.includes(route.query.tab) ? route.query.tab : 'profil')
watch(() => route.query.tab, (val) => {
  activeTab.value = TABS.includes(val) ? val : 'profil'
})

// ─── Faculty / Department data (same as signup) ─────────────────────────────
const FAKULTAS_DEPARTEMEN = {
  'Fakultas Desain Kreatif dan Bisnis Digital (FDKBD)': [
    'Desain Interior', 'Desain Komunikasi Visual', 'Desain Produk Industri',
    'Manajemen Bisnis', 'Studi Pembangunan',
  ],
  'Fakultas Kedokteran dan Kesehatan (FKK)': [
    'Kedokteran', 'Teknologi Kedokteran',
  ],
  'Fakultas Sains dan Analitika Data (FSAD)': [
    'Aktuaria', 'Biologi', 'Fisika', 'Kimia', 'Matematika', 'Statistika',
  ],
  'Fakultas Teknik Sipil, Perencanaan, dan Kebumian (FTSPK)': [
    'Arsitektur', 'Perencanaan Wilayah dan Kota', 'Teknik Geofisika',
    'Teknik Geomatika', 'Teknik Lingkungan', 'Teknik Sipil',
  ],
  'Fakultas Teknologi Elektro dan Informatika Cerdas (FTEIC)': [
    'Sistem Informasi', 'Teknik Biomedik', 'Teknik Elektro',
    'Teknik Informatika', 'Teknik Komputer', 'Teknik Telekomunikasi', 'Teknologi Informasi',
  ],
  'Fakultas Teknologi Industri dan Rekayasa Sistem (FTIRS)': [
    'Teknik dan Sistem Industri', 'Teknik Fisika', 'Teknik Kimia',
    'Teknik Material', 'Teknik Mesin', 'Teknik Pangan',
  ],
  'Fakultas Teknologi Kelautan (FTK)': [
    'Teknik Kelautan', 'Teknik Lepas Pantai', 'Teknik Perkapalan',
    'Teknik Sistem Perkapalan', 'Teknik Transportasi Laut',
  ],
  'Fakultas Vokasi (FV)': [
    'Statistika Bisnis', 'Teknik Elektro Otomasi', 'Teknik Infrastruktur Sipil',
    'Teknik Instrumentasi', 'Teknik Kimia Industri', 'Teknik Mesin Industri',
  ],
}

// ─── Profile state ───────────────────────────────────────────────────────────
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

const usernameError = ref('')
const usernameChecking = ref(false)
let usernameTimer = null
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

async function fetchProfile(uid = user.value?.id) {
  if (!uid) return
  profileLoading.value = true
  const { data, error } = await supabase
    .from('users')
    .select('name, username, faculty, department, avatar_url, nrp, email, gender, bio')
    .eq('id', uid)
    .maybeSingle()
  profileLoading.value = false
  if (error) { console.error('[fetchProfile]', error.message); return }
  if (!data) return
  name.value        = data.name        ?? ''
  username.value    = data.username     ?? ''
  originalUsername.value = data.username ?? ''
  faculty.value     = data.faculty     ?? ''
  department.value  = data.department  ?? ''
  avatarUrl.value   = data.avatar_url  ?? ''
  nrp.value         = data.nrp         ?? ''
  email.value       = data.email       ?? user.value?.email ?? ''
  phone.value       = data.phone       ?? ''
  gender.value     = data.gender     ?? ''
  bio.value        = data.bio        ?? ''

  // Sync ke shared Navbar state (avatar + nama + username)
  const sharedProfile = useState('userProfile')
  sharedProfile.value = { ...(sharedProfile.value ?? {}), name: data.name ?? '', avatar_url: data.avatar_url ?? null, username: data.username ?? null }
}


async function saveProfile() {
  const uid = user.value?.id ?? _userId.value
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
    // Sync username to shared Navbar state
    const sharedProfile = useState('userProfile')
    sharedProfile.value = { ...(sharedProfile.value ?? {}), username: updates.username }
    setTimeout(() => { profileMsg.value = '' }, 3000)
  }
}

// ─── Avatar upload + crop ────────────────────────────────────────────────────
const avatarUploading = ref(false)
const avatarInput     = ref(null)

// Crop modal state
const showCropModal   = ref(false)
const cropImageSrc    = ref('')
const cropperRef      = ref(null)
const cropZoom        = ref(1)     // 0.5 – 3
const cropRotate      = ref(0)     // multiples of 90

function handleAvatarChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  // Reset input so same file can be re-selected
  e.target.value = ''
  if (file.size > 10 * 1024 * 1024) {
    profileMsg.value = 'Ukuran foto maksimal 10 MB.'
    profileMsgType.value = 'err'
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    cropImageSrc.value = ev.target.result
    cropZoom.value = 1
    cropRotate.value = 0
    showCropModal.value = true
  }
  reader.readAsDataURL(file)
}

async function confirmCrop() {
  if (!cropperRef.value) return
  avatarUploading.value = true
  showCropModal.value = false

  // Get cropped canvas from vue-advanced-cropper
  const { canvas } = cropperRef.value.getResult()
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92))

  const uid  = user.value?.id ?? _userId.value
  const path = `${uid}/avatar.jpg`
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
  if (upErr) {
    profileMsg.value     = 'Upload gagal: ' + upErr.message
    profileMsgType.value = 'err'
    avatarUploading.value = false
    return
  }
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  const newUrl = urlData.publicUrl + '?t=' + Date.now()
  await supabase.from('users').update({ avatar_url: newUrl }).eq('id', uid)
  avatarUrl.value = newUrl
  // Sync to shared Navbar state
  const sharedProfile = useState('userProfile')
  sharedProfile.value = { ...(sharedProfile.value ?? {}), avatar_url: newUrl }
  profileMsg.value     = 'Foto profil diperbarui! ✅'
  profileMsgType.value = 'ok'
  setTimeout(() => { profileMsg.value = '' }, 3000)
  avatarUploading.value = false
}

function cancelCrop() {
  showCropModal.value = false
  cropImageSrc.value  = ''
}

const showDeleteAvatarConfirm = ref(false)
const showLogoutConfirm = ref(false)

function requestLogout() {
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  showLogoutConfirm.value = false
  await supabase.auth.signOut()
  navigateTo('/')
}

function deleteAvatar() {
  if (!avatarUrl.value) return
  showDeleteAvatarConfirm.value = true
}

async function confirmDeleteAvatar() {
  showDeleteAvatarConfirm.value = false
  const uid = user.value?.id ?? _userId.value
  if (!uid) return
  avatarUploading.value = true
  const path = `${uid}/avatar.jpg`
  await supabase.storage.from('avatars').remove([path])
  await supabase.from('users').update({ avatar_url: null }).eq('id', uid)
  avatarUrl.value = ''
  const sharedProfile = useState('userProfile')
  sharedProfile.value = { ...(sharedProfile.value ?? {}), avatar_url: null }
  profileMsg.value = 'Foto profil dihapus.'
  profileMsgType.value = 'ok'
  setTimeout(() => { profileMsg.value = '' }, 3000)
  avatarUploading.value = false
}

// ─── Address state (dual: shipping + seller) ────────────────────────────────
const addrSaving  = ref(false)
const addrMsg     = ref('')
const addrMsgType = ref('')
const addrLoading = ref(false)

// Which address card is being viewed/edited
const addrActiveType = ref('shipping') // 'shipping' | 'seller'

// Shipping address
const shippingForm = reactive({ label: '', full_address: '', city: '', notes: '', lat: null, lng: null })
const _shippingId  = ref(null)
const shippingEditMode = ref(false)

// Seller address
const sellerForm   = reactive({ label: '', full_address: '', city: '', notes: '', lat: null, lng: null })
const _sellerId    = ref(null)
const sellerEditMode = ref(false)

// "Samakan" toggle
const samakan = ref(false)

// Helpers to get active form/id based on type
function getAddrForm(type) { return type === 'seller' ? sellerForm : shippingForm }
function getAddrId(type) { return type === 'seller' ? _sellerId.value : _shippingId.value }
function getAddrEditMode(type) { return type === 'seller' ? sellerEditMode : shippingEditMode }

function loadAddrRow(row, type) {
  const form = getAddrForm(type)
  const idRef = type === 'seller' ? _sellerId : _shippingId
  const editRef = type === 'seller' ? sellerEditMode : shippingEditMode
  if (!row) { editRef.value = true; return }
  idRef.value = row.id
  form.label        = row.label        ?? ''
  form.full_address = row.full_address ?? ''
  form.city         = row.city         ?? ''
  form.notes        = row.notes        ?? ''
  form.lat          = row.lat          ?? null
  form.lng          = row.lng          ?? null
  editRef.value = false
}

async function fetchAddresses(uid = user.value?.id) {
  if (!uid) return
  addrLoading.value = true
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', uid)
  addrLoading.value = false
  const rows = data ?? []
  loadAddrRow(rows.find(r => r.address_type === 'shipping'), 'shipping')
  loadAddrRow(rows.find(r => r.address_type === 'seller'),  'seller')
  // Check if seller was "samakan"
  if (_sellerId.value && _shippingId.value) {
    const s = shippingForm, e = sellerForm
    samakan.value = s.label === e.label && s.full_address === e.full_address && s.city === e.city && s.lat === e.lat && s.lng === e.lng
  }
}

async function saveAddress(type = addrActiveType.value) {
  const form = getAddrForm(type)
  if (!form.full_address.trim()) {
    addrMsg.value = 'Alamat lengkap wajib diisi.'
    addrMsgType.value = 'err'
    return
  }
  const uid = user.value?.id ?? _userId.value
  if (!uid) {
    addrMsg.value = 'Sesi tidak ditemukan, coba muat ulang halaman.'
    addrMsgType.value = 'err'
    return
  }
  addrSaving.value = true
  addrMsg.value    = ''

  try {
    const payload = {
      user_id:      uid,
      address_type: type,
      label:        form.label.trim() || null,
      full_address: form.full_address.trim(),
      city:         form.city.trim() || null,
      notes:        form.notes.trim() || null,
      lat:          form.lat || null,
      lng:          form.lng || null,
    }

    const existingId = getAddrId(type)
    let error
    if (existingId) {
      ;({ error } = await supabase.from('addresses').update(payload).eq('id', existingId))
    } else {
      ;({ error } = await supabase.from('addresses').insert(payload))
    }

    if (error) {
      addrMsg.value = 'Gagal menyimpan: ' + error.message
      addrMsgType.value = 'err'
    } else {
      addrMsg.value = (type === 'seller' ? 'Alamat pengirim' : 'Alamat pengiriman') + ' berhasil disimpan! ✅'
      addrMsgType.value = 'ok'
      await fetchAddresses(uid)
      // Sync Navbar address indicator (always shows shipping address)
      if (type === 'shipping') {
        const sharedAddress = useState('userAddress')
        sharedAddress.value = { label: form.label, city: form.city, full_address: form.full_address }
      }
      setTimeout(() => { addrMsg.value = '' }, 3000)
    }
  } catch (e) {
    addrMsg.value = 'Terjadi kesalahan: ' + (e?.message ?? 'tidak diketahui')
    addrMsgType.value = 'err'
  } finally {
    addrSaving.value = false
  }
}

// ─── "Samakan" logic ────────────────────────────────────────────────────────
async function toggleSamakan() {
  samakan.value = !samakan.value
  if (samakan.value) {
    // Copy shipping → seller
    if (!shippingForm.full_address.trim()) {
      addrMsg.value = 'Isi alamat pengiriman terlebih dahulu.'
      addrMsgType.value = 'err'
      samakan.value = false
      return
    }
    Object.assign(sellerForm, {
      label: shippingForm.label,
      full_address: shippingForm.full_address,
      city: shippingForm.city,
      notes: shippingForm.notes,
      lat: shippingForm.lat,
      lng: shippingForm.lng,
    })
    sellerEditMode.value = false
    await saveAddress('seller')
  }
}

// ─── Delete address ─────────────────────────────────────────────────────────
const showDeleteAddrConfirm = ref(false)
const addrDeleting = ref(false)
const deleteAddrType = ref('shipping')

function deleteAddress(type) {
  const id = getAddrId(type)
  if (!id) return
  deleteAddrType.value = type
  showDeleteAddrConfirm.value = true
}

async function confirmDeleteAddress() {
  showDeleteAddrConfirm.value = false
  const type = deleteAddrType.value
  const id = getAddrId(type)
  if (!id) return
  addrDeleting.value = true
  const { error } = await supabase.from('addresses').delete().eq('id', id)
  addrDeleting.value = false
  if (error) {
    addrMsg.value = 'Gagal menghapus: ' + error.message
    addrMsgType.value = 'err'
    return
  }
  const form = getAddrForm(type)
  const idRef = type === 'seller' ? _sellerId : _shippingId
  const editRef = type === 'seller' ? sellerEditMode : shippingEditMode
  idRef.value = null
  form.label = ''; form.full_address = ''; form.city = ''; form.notes = ''; form.lat = null; form.lng = null
  editRef.value = true
  if (type === 'seller') samakan.value = false
  addrMsg.value = 'Alamat berhasil dihapus.'
  addrMsgType.value = 'ok'
  // Sync Navbar address indicator
  if (type === 'shipping') {
    const sharedAddress = useState('userAddress')
    sharedAddress.value = null
  }
  setTimeout(() => { addrMsg.value = '' }, 3000)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fakultasAkronim(f) {
  if (!f) return ''
  const m = /\(([^)]+)\)$/.exec(f)
  return m ? m[1] : f
}

// ─── My rating ───────────────────────────────────────────────────────────────
const myRating    = ref(null)
const myRatingCount = ref(0)

async function fetchMyRating(uid) {
  if (!uid) return
  const { data } = await supabase
    .from('reviews')
    .select('rating_seller')
    .eq('reviewee_id', uid)
  const arr = (data ?? []).map(r => r.rating_seller).filter(v => v != null)
  myRatingCount.value = arr.length
  myRating.value = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

// ─── GPS pin ─────────────────────────────────────────────────────────────────
const gpsLoading = ref(false)

function useGPS(type = addrActiveType.value) {
  if (!navigator.geolocation) {
    addrMsg.value = 'Browser tidak mendukung GPS.'
    addrMsgType.value = 'err'
    return
  }
  gpsLoading.value = true
  const form = getAddrForm(type)
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.lat = parseFloat(pos.coords.latitude.toFixed(7))
      form.lng = parseFloat(pos.coords.longitude.toFixed(7))
      gpsLoading.value = false
    },
    () => {
      addrMsg.value = 'Tidak bisa mendapatkan lokasi. Pastikan izin GPS diaktifkan.'
      addrMsgType.value = 'err'
      gpsLoading.value = false
    }
  )
}

function openMapLink(type = addrActiveType.value) {
  const form = getAddrForm(type)
  const lat = form.lat ?? -7.2813
  const lng = form.lng ?? 112.7971
  window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener')
}

// ─── Change password ─────────────────────────────────────────────────────────
const pwOld         = ref('')
const pwNew         = ref('')
const pwConfirm     = ref('')
const pwSaving      = ref(false)
const pwMsg         = ref('')
const pwMsgType     = ref('')
const showPwOld     = ref(false)
const showPwNew     = ref(false)
const showPwConfirm = ref(false)

async function changePassword() {
  pwMsg.value = ''
  if (!pwOld.value) { pwMsg.value = 'Password lama wajib diisi.'; pwMsgType.value = 'err'; return }
  if (!pwNew.value) { pwMsg.value = 'Password baru wajib diisi.'; pwMsgType.value = 'err'; return }
  if (pwNew.value.length < 6) { pwMsg.value = 'Password baru minimal 6 karakter.'; pwMsgType.value = 'err'; return }
  if (pwNew.value !== pwConfirm.value) { pwMsg.value = 'Konfirmasi password tidak cocok.'; pwMsgType.value = 'err'; return }
  if (pwOld.value === pwNew.value) { pwMsg.value = 'Password baru tidak boleh sama dengan password lama.'; pwMsgType.value = 'err'; return }

  pwSaving.value = true
  try {
    // Verify old password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.value?.email ?? email.value,
      password: pwOld.value,
    })
    if (signInErr) {
      pwMsg.value = 'Password lama salah.'
      pwMsgType.value = 'err'
      return
    }
    // Update to new password
    const { error: updateErr } = await supabase.auth.updateUser({ password: pwNew.value })
    if (updateErr) {
      const msg = updateErr.message?.toLowerCase() ?? ''
      if (msg.includes('same_password') || msg.includes('same password'))
        pwMsg.value = 'Password baru tidak boleh sama dengan password lama.'
      else if (msg.includes('weak'))
        pwMsg.value = 'Password terlalu lemah. Gunakan minimal 6 karakter.'
      else
        pwMsg.value = 'Gagal mengubah password. Coba lagi nanti.'
      pwMsgType.value = 'err'
      return
    }
    pwMsg.value = 'Password berhasil diubah! ✅'
    pwMsgType.value = 'ok'
    pwOld.value = ''
    pwNew.value = ''
    pwConfirm.value = ''
    setTimeout(() => { pwMsg.value = '' }, 3000)
  } catch (err) {
    pwMsg.value = 'Terjadi kesalahan. Coba lagi nanti.'
    pwMsgType.value = 'err'
  } finally {
    pwSaving.value = false
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────
// ─── User Settings (chat & notification) ─────────────────────────────────────
const { settings: userSettings, fetchSettings: fetchUserSettings, updateSetting } = useUserSettings()

function toggleSetting(key) {
  const uid = user.value?.id ?? _userId.value
  if (!uid) return
  updateSetting(uid, key, !userSettings.value[key])
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) {
    _userId.value = session.user.id
    fetchProfile(session.user.id)
    fetchAddresses(session.user.id)
    fetchMyRating(session.user.id)
    fetchUserSettings(session.user.id)
  }
})

watch(user, (u) => {
  if (u?.id) {
    _userId.value = u.id
    fetchProfile(u.id)
    fetchAddresses(u.id)
    fetchMyRating(u.id)
    fetchUserSettings(u.id)
  }
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen vt-page-bg">

    <!-- Page Header -->
    <div class="vt-hero-enter vt-hero-enter-d1 vt-edit-header relative w-full pt-24 pb-10 px-4 md:px-10 overflow-hidden">
      <img src="/img/banner-3.png" alt="" width="1920" height="600" class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" style="object-position: center 20%;" aria-hidden="true" />
      <div class="absolute inset-0 pointer-events-none vt-edit-header-overlay"></div>
      <div class="relative max-w-3xl mx-auto flex items-center gap-4">
        <div class="flex flex-col gap-2 flex-1">
          <nav class="flex items-center gap-1.5 text-xs text-white/50">
            <NuxtLink to="/" class="hover:text-white/80 transition">Beranda</NuxtLink>
            <span>/</span>
            <span class="text-white/70">Pengaturan</span>
          </nav>
          <h1 class="font-heading text-3xl font-bold text-white leading-tight">⚙️ Pengaturan</h1>
          <p class="text-white/65 text-sm">Kelola informasi akun dan alamat pengirimanmu.</p>
        </div>
        <img src="/img/illustrations/personal-settings.svg" alt="" width="112" height="112" loading="lazy" class="hidden md:block w-28 h-auto opacity-70 shrink-0" aria-hidden="true" />
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="vt-hero-enter vt-hero-enter-d2 sticky top-[73px] z-30 vt-tab-bar border-b">
      <div class="max-w-3xl mx-auto px-4 md:px-0 flex gap-0">
        <button
          @click="activeTab = 'profil'"
          class="vt-tab-btn px-6 py-3.5 text-sm font-semibold transition border-b-2"
          :class="activeTab === 'profil' ? 'vt-tab-active' : 'vt-tab-inactive'"
        >
          👤 Profil Saya
        </button>
        <button
          @click="activeTab = 'alamat'"
          class="vt-tab-btn px-6 py-3.5 text-sm font-semibold transition border-b-2"
          :class="activeTab === 'alamat' ? 'vt-tab-active' : 'vt-tab-inactive'"
        >
          📍 Alamat
        </button>
        <button
          @click="activeTab = 'keamanan'"
          class="vt-tab-btn px-6 py-3.5 text-sm font-semibold transition border-b-2"
          :class="activeTab === 'keamanan' ? 'vt-tab-active' : 'vt-tab-inactive'"
        >
          🔒 Keamanan
        </button>
        <button
          @click="activeTab = 'notifikasi'"
          class="vt-tab-btn px-6 py-3.5 text-sm font-semibold transition border-b-2"
          :class="activeTab === 'notifikasi' ? 'vt-tab-active' : 'vt-tab-inactive'"
        >
          🔔 Notifikasi
        </button>
        <button
          @click="requestLogout"
          class="ml-auto px-4 py-3.5 text-sm font-semibold transition flex items-center gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
          </svg>
          Keluar
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-3xl mx-auto px-4 md:px-0 py-10 flex flex-col gap-6">

      <!-- ══ TAB: PROFIL SAYA ══════════════════════════════════════════════ -->
      <template v-if="activeTab === 'profil'">
        <div v-if="profileLoading" class="flex justify-center py-16">
          <svg class="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>

        <template v-else>
          <!-- Avatar Section -->
          <div class="vt-card p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6">
            <div class="relative group shrink-0">
              <div class="w-24 h-24 rounded-full overflow-hidden ring-4 ring-blue-100 dark:ring-blue-900/40">
                <img v-if="avatarUrl" :src="avatarUrl" alt="Foto profil" width="96" height="96" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-3xl font-bold text-white"
                     :style="isDark ? 'background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc)' : 'background: linear-gradient(135deg, #162d6e, #1e3a8a, #1e40af)'">
                  {{ name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?' }}
                </div>
              </div>
              <!-- Camera overlay -->
              <button
                @click="avatarInput?.click()"
                :disabled="avatarUploading"
                class="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                title="Ubah foto"
              >
                <svg v-if="!avatarUploading" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.577.360-.463.705a2.31 2.31 0 002.455 1.538l.06-.007M6.827 6.175C7.38 5.99 7.887 5.6 8.245 5.068A2.31 2.31 0 0110.44 4h3.12a2.31 2.31 0 012.195 1.068c.357.533.865.922 1.418 1.107m-10.346 0v.007m10.346-.007v.007m0 0A2.31 2.31 0 0118.814 7.23c.38.054.577.360.463.705a2.31 2.31 0 01-2.455 1.538l-.06-.007M12 13.5a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12z"/>
                </svg>
                <svg v-else class="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </button>
              <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="handleAvatarChange" />
            </div>
            <div class="flex flex-col items-start gap-1">
              <p class="font-bold text-base vt-text-primary truncate flex items-center gap-1.5">
                {{ name || '—' }}
                <span v-if="gender === 'Laki-laki'" title="Laki-laki">♂️</span>
                <span v-else-if="gender === 'Perempuan'" title="Perempuan">♀️</span>
              </p>
              <p class="text-xs text-gray-500 dark:text-slate-400 truncate">
                <span v-if="username" class="text-blue-600 dark:text-sky-400 font-medium">@{{ username }}</span>
                <template v-else>{{ nrp || '-' }}</template>
                <template v-if="faculty || department">
                  ({{ [fakultasAkronim(faculty), department].filter(Boolean).join(' - ') }})
                </template>
              </p>
              <div class="flex items-center gap-1 mt-0.5 w-full">
                <svg class="w-3 h-3 text-yellow-400 fill-current shrink-0" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <template v-if="myRatingCount > 0">
                  <span class="text-xs text-gray-500 dark:text-slate-400">{{ myRating.toFixed(1) }} / 5.0</span>
                  <div class="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 max-w-[80px]">
                    <div class="h-1.5 rounded-full" :style="`background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); width:${Math.min(myRating / 5 * 100, 100)}%`"></div>
                  </div>
                </template>
                <span v-else class="text-xs text-gray-400 dark:text-slate-500">Belum ada ulasan</span>
              </div>
              <div class="mt-2 flex items-center gap-3">
                <button
                  @click="avatarInput?.click()"
                  class="text-xs text-blue-600 dark:text-sky-400 font-medium hover:underline"
                >📷 Ubah Foto Profil</button>
                <button
                  v-if="avatarUrl"
                  @click="deleteAvatar"
                  :disabled="avatarUploading"
                  class="text-xs text-red-500 dark:text-red-400 font-medium hover:underline disabled:opacity-50"
                >🗑️ Hapus Foto</button>
              </div>
              <p class="text-xs vt-text-muted opacity-60 mt-0.5">Format JPG/PNG/WebP · Maks. 5 MB</p>
            </div>
          </div>

          <!-- Editable Info -->
          <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
            <h2 class="font-bold text-base vt-text-primary">Informasi Pribadi</h2>

            <!-- Nama -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Nama Lengkap</label>
              <input
                v-model="name"
                type="text"
                placeholder="Nama lengkapmu"
                class="vt-input"
                maxlength="100"
              />
            </div>

            <!-- Username -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Username</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm select-none">@</span>
                <input
                  v-model="username"
                  type="text"
                  placeholder="username_kamu"
                  class="vt-input"
                  style="padding-left: 1.75rem"
                  maxlength="30"
                />
              </div>
              <div v-if="usernameChecking" class="text-xs text-gray-400">Memeriksa...</div>
              <div v-else-if="usernameError" class="text-xs text-red-500 dark:text-red-400">{{ usernameError }}</div>
              <div v-else-if="username && !usernameError" class="text-xs text-gray-400 dark:text-slate-500">Huruf, angka, titik (.) dan underscore (_). 3–30 karakter.</div>
            </div>

            <!-- Bio -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Bio</label>
              <textarea
                v-model="bio"
                placeholder="Tulis biomu di sini... (opsional)"
                class="vt-input resize-none"
                maxlength="160"
                rows="3"
              />
              <span class="text-xs self-end" :class="isDark ? 'text-gray-500' : 'text-gray-400'">{{ bio.length }}/160</span>
            </div>

            <!-- Jenis Kelamin -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Jenis Kelamin</label>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="gender" value="Laki-laki" class="accent-blue-900 w-4 h-4" />
                  <span class="text-sm vt-text-primary">Laki-laki</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" v-model="gender" value="Perempuan" class="accent-blue-900 w-4 h-4" />
                  <span class="text-sm vt-text-primary">Perempuan</span>
                </label>

              </div>
            </div>

            <!-- Feedback -->
            <p v-if="profileMsg" class="text-sm font-medium px-4 py-2 rounded-lg" :class="profileMsgType === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'">
              {{ profileMsg }}
            </p>

            <button
              @click="saveProfile"
              :disabled="profileSaving"
              class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
            >
              <svg v-if="profileSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              {{ profileSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}
            </button>
          </div>

          <!-- Read-only Identity -->
          <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
            <div class="flex items-center gap-2">
              <h2 class="font-bold text-base vt-text-primary">Informasi Identitas</h2>
              <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                🔒 Tidak Dapat Diubah
              </span>
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold vt-label">Email Institusi</label>
                <div class="vt-input-readonly flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                  </svg>
                  <span class="text-sm font-mono truncate">{{ email }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold vt-label">NRP</label>
                <div class="vt-input-readonly flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"/>
                  </svg>
                  <span class="text-sm font-mono">{{ nrp }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold vt-label">Fakultas</label>
                <div class="vt-input-readonly flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"/>
                  </svg>
                  <span class="text-sm truncate">{{ faculty || '—' }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-semibold vt-label">Departemen</label>
                <div class="vt-input-readonly flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/>
                  </svg>
                  <span class="text-sm truncate">{{ department || '—' }}</span>
                </div>
              </div>
            </div>
            <p class="text-xs vt-text-muted opacity-60">Data identitas dikunci untuk menjaga keamanan ekosistem VivaThrift. Hubungi admin jika ada kesalahan data.</p>
          </div>
        </template>
      </template>

      <!-- ══ TAB: ALAMAT ════════════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'alamat'">

        <div v-if="addrLoading" class="flex justify-center py-16">
          <svg class="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>

        <template v-else>

          <!-- Feedback -->
          <p v-if="addrMsg" class="text-sm font-medium px-4 py-2 rounded-lg mb-2" :class="addrMsgType === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'">
            {{ addrMsg }}
          </p>

          <!-- ── Sub-tabs: Pengiriman | Pengirim ──────────────── -->
          <div class="flex gap-2 mb-4">
            <button
              @click="addrActiveType = 'shipping'"
              class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition border"
              :class="addrActiveType === 'shipping' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-sky-400 border-blue-200 dark:border-blue-700' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'"
            >
              📦 Pengiriman
              <svg v-if="_shippingId" class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            </button>
            <button
              @click="addrActiveType = 'seller'"
              class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition border"
              :class="addrActiveType === 'seller' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-sky-400 border-blue-200 dark:border-blue-700' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'"
            >
              🏠 Pengirim
              <svg v-if="_sellerId" class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            </button>
          </div>

          <!-- ════ SHIPPING ADDRESS ════════════════════════════ -->
          <template v-if="addrActiveType === 'shipping'">
            <!-- Card view -->
            <template v-if="_shippingId && !shippingEditMode">
              <div class="vt-card p-6 md:p-8 flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <h2 class="font-bold text-base vt-text-primary">📦 Alamat Pengiriman</h2>
                  <div class="flex items-center gap-3">
                    <button @click="shippingEditMode = true" class="text-xs font-medium text-blue-700 dark:text-sky-400 hover:underline">Edit</button>
                    <button @click="deleteAddress('shipping')" :disabled="addrDeleting" class="text-xs font-medium text-red-500 dark:text-red-400 hover:underline disabled:opacity-50">Hapus</button>
                  </div>
                </div>
                <button
                  @click="shippingEditMode = true"
                  class="w-full text-left border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 rounded-r-xl px-4 py-4 flex items-start justify-between gap-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition"
                >
                  <div class="flex flex-col gap-1 min-w-0 flex-1">
                    <span v-if="shippingForm.label" class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{{ shippingForm.label }}</span>
                    <p class="font-bold text-sm text-gray-800 dark:text-slate-100 leading-snug flex items-center gap-1.5">
                      {{ name || '—' }}
                      <span v-if="gender === 'Laki-laki'" title="Laki-laki">♂️</span>
                      <span v-else-if="gender === 'Perempuan'" title="Perempuan">♀️</span>
                    </p>
                    <p v-if="phone" class="text-sm text-gray-600 dark:text-slate-400">{{ phone }}</p>
                    <p class="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                      {{ shippingForm.full_address }}<template v-if="shippingForm.notes"> ({{ shippingForm.notes }})</template>
                    </p>
                    <div v-if="shippingForm.lat && shippingForm.lng" class="flex items-center gap-1 mt-1">
                      <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                      </svg>
                      <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">Sudah Pinpoint</span>
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                  </svg>
                </button>
              </div>
            </template>
            <!-- Form -->
            <template v-else>
              <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
                <div class="flex items-center justify-between">
                  <h2 class="font-bold text-base vt-text-primary">📦 {{ _shippingId ? 'Edit Alamat Pengiriman' : 'Tambah Alamat Pengiriman' }}</h2>
                  <button v-if="_shippingId" @click="shippingEditMode = false" class="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition">← Kembali</button>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold vt-label">Label Alamat</label>
                  <input v-model="shippingForm.label" type="text" placeholder="Contoh: Kosan Keputih, Rumah Sidoarjo" class="vt-input" maxlength="50" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold vt-label">Alamat Lengkap <span class="text-red-500">*</span></label>
                  <textarea v-model="shippingForm.full_address" rows="3" placeholder="Jl. Raya ITS No. ..., Keputih, Sukolilo, Surabaya" class="vt-input resize-none" maxlength="300"></textarea>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold vt-label">Kota / Kabupaten</label>
                  <input v-model="shippingForm.city" type="text" placeholder="Surabaya" class="vt-input" maxlength="80" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold vt-label">Catatan Pengiriman</label>
                  <input v-model="shippingForm.notes" type="text" placeholder="Contoh: Lantai 2, kamar paling kiri" class="vt-input" maxlength="150" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-xs font-semibold vt-label">📍 Pin Lokasi</label>
                  <div class="flex flex-wrap items-center gap-2">
                    <button type="button" @click="useGPS('shipping')" :disabled="gpsLoading"
                      class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-sm font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60">
                      <svg v-if="!gpsLoading" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                      </svg>
                      <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                      {{ gpsLoading ? 'Mengambil lokasi...' : 'Pakai GPS saat ini' }}
                    </button>
                    <button v-if="shippingForm.lat && shippingForm.lng" type="button" @click="openMapLink('shipping')"
                      class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                      🗺️ Lihat di Maps
                    </button>
                  </div>
                  <div class="flex gap-2">
                    <div class="flex flex-col gap-1 flex-1">
                      <label class="text-xs vt-text-muted">Latitude</label>
                      <input v-model.number="shippingForm.lat" type="number" step="0.0000001" placeholder="-7.2885618..." class="vt-input text-xs font-mono" />
                    </div>
                    <div class="flex flex-col gap-1 flex-1">
                      <label class="text-xs vt-text-muted">Longitude</label>
                      <input v-model.number="shippingForm.lng" type="number" step="0.0000001" placeholder="112.7917407..." class="vt-input text-xs font-mono" />
                    </div>
                  </div>
                  <p class="text-xs vt-text-muted opacity-60">Isi otomatis dengan GPS atau masukkan manual. Contoh: Asrama Mahasiswa ITS Blok H → -7.2885618, 112.7917407.</p>
                </div>
                <button
                  @click="saveAddress('shipping')"
                  :disabled="addrSaving"
                  class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
                >
                  <svg v-if="addrSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  {{ addrSaving ? 'Menyimpan...' : 'Simpan Alamat' }}
                </button>
              </div>
            </template>
          </template>

          <!-- ════ SELLER ADDRESS ══════════════════════════════ -->
          <template v-if="addrActiveType === 'seller'">

            <!-- Samakan toggle -->
            <div class="vt-card p-4 mb-4 flex items-center gap-3">
              <button
                @click="toggleSamakan"
                :disabled="addrSaving"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-50"
                :class="samakan ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'"
              >
                <span class="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform" :class="samakan ? 'translate-x-6' : 'translate-x-1'"></span>
              </button>
              <span class="text-sm vt-text-primary font-medium">Samakan dengan Alamat Pengiriman</span>
            </div>

            <!-- Card view -->
            <template v-if="_sellerId && !sellerEditMode">
              <div class="vt-card p-6 md:p-8 flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <h2 class="font-bold text-base vt-text-primary">🏠 Alamat Pengirim</h2>
                  <div class="flex items-center gap-3">
                    <button @click="sellerEditMode = true; samakan = false" class="text-xs font-medium text-blue-700 dark:text-sky-400 hover:underline">Edit</button>
                    <button @click="deleteAddress('seller')" :disabled="addrDeleting" class="text-xs font-medium text-red-500 dark:text-red-400 hover:underline disabled:opacity-50">Hapus</button>
                  </div>
                </div>
                <button
                  @click="sellerEditMode = true; samakan = false"
                  class="w-full text-left border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r-xl px-4 py-4 flex items-start justify-between gap-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                >
                  <div class="flex flex-col gap-1 min-w-0 flex-1">
                    <span v-if="sellerForm.label" class="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{{ sellerForm.label }}</span>
                    <p class="font-bold text-sm text-gray-800 dark:text-slate-100 leading-snug flex items-center gap-1.5">
                      {{ name || '—' }}
                      <span v-if="gender === 'Laki-laki'" title="Laki-laki">♂️</span>
                      <span v-else-if="gender === 'Perempuan'" title="Perempuan">♀️</span>
                    </p>
                    <p v-if="phone" class="text-sm text-gray-600 dark:text-slate-400">{{ phone }}</p>
                    <p class="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                      {{ sellerForm.full_address }}<template v-if="sellerForm.notes"> ({{ sellerForm.notes }})</template>
                    </p>
                    <div v-if="sellerForm.lat && sellerForm.lng" class="flex items-center gap-1 mt-1">
                      <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                      </svg>
                      <span class="text-xs font-medium text-blue-600 dark:text-blue-400">Sudah Pinpoint</span>
                    </div>
                    <div v-if="samakan" class="flex items-center gap-1 mt-1">
                      <span class="text-xs text-gray-400 dark:text-slate-500 italic">Sama dengan Alamat Pengiriman</span>
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                  </svg>
                </button>
              </div>
            </template>
            <!-- Form -->
            <template v-else-if="!samakan">
              <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
                <div class="flex items-center justify-between">
                  <h2 class="font-bold text-base vt-text-primary">🏠 {{ _sellerId ? 'Edit Alamat Pengirim' : 'Tambah Alamat Pengirim' }}</h2>
                  <button v-if="_sellerId" @click="sellerEditMode = false" class="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition">← Kembali</button>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold vt-label">Label Alamat</label>
                  <input v-model="sellerForm.label" type="text" placeholder="Contoh: Asrama ITS, Kost Gebang" class="vt-input" maxlength="50" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold vt-label">Alamat Lengkap <span class="text-red-500">*</span></label>
                  <textarea v-model="sellerForm.full_address" rows="3" placeholder="Jl. Raya ITS No. ..., Keputih, Sukolilo, Surabaya" class="vt-input resize-none" maxlength="300"></textarea>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold vt-label">Kota / Kabupaten</label>
                  <input v-model="sellerForm.city" type="text" placeholder="Surabaya" class="vt-input" maxlength="80" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold vt-label">Catatan</label>
                  <input v-model="sellerForm.notes" type="text" placeholder="Contoh: Blok H lantai 3" class="vt-input" maxlength="150" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-xs font-semibold vt-label">📍 Pin Lokasi</label>
                  <div class="flex flex-wrap items-center gap-2">
                    <button type="button" @click="useGPS('seller')" :disabled="gpsLoading"
                      class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-sm font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60">
                      <svg v-if="!gpsLoading" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                      </svg>
                      <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                      {{ gpsLoading ? 'Mengambil lokasi...' : 'Pakai GPS saat ini' }}
                    </button>
                    <button v-if="sellerForm.lat && sellerForm.lng" type="button" @click="openMapLink('seller')"
                      class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                      🗺️ Lihat di Maps
                    </button>
                  </div>
                  <div class="flex gap-2">
                    <div class="flex flex-col gap-1 flex-1">
                      <label class="text-xs vt-text-muted">Latitude</label>
                      <input v-model.number="sellerForm.lat" type="number" step="0.0000001" placeholder="-7.2885618..." class="vt-input text-xs font-mono" />
                    </div>
                    <div class="flex flex-col gap-1 flex-1">
                      <label class="text-xs vt-text-muted">Longitude</label>
                      <input v-model.number="sellerForm.lng" type="number" step="0.0000001" placeholder="112.7917407..." class="vt-input text-xs font-mono" />
                    </div>
                  </div>
                  <p class="text-xs vt-text-muted opacity-60">Isi otomatis dengan GPS atau masukkan manual. Contoh: Asrama Mahasiswa ITS Blok H → -7.2885618, 112.7917407.</p>
                </div>
                <button
                  @click="saveAddress('seller')"
                  :disabled="addrSaving"
                  class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
                >
                  <svg v-if="addrSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  {{ addrSaving ? 'Menyimpan...' : 'Simpan Alamat' }}
                </button>
              </div>
            </template>
          </template>
        </template>

      </template>

      <!-- ══ TAB: KEAMANAN ══════════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'keamanan'">
        <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
          <h2 class="font-bold text-base vt-text-primary">Ubah Password</h2>
          <p class="text-sm vt-text-muted -mt-2">Masukkan password lama dan password baru untuk mengubah password akunmu.</p>

          <!-- Password Lama -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Password Lama</label>
            <div class="relative">
              <input
                v-model="pwOld"
                :type="showPwOld ? 'text' : 'password'"
                placeholder="Masukkan password lama"
                class="vt-input pr-10"
                autocomplete="current-password"
              />
              <button type="button" @click="showPwOld = !showPwOld" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                <svg v-if="!showPwOld" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
              </button>
            </div>
          </div>

          <!-- Password Baru -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Password Baru</label>
            <div class="relative">
              <input
                v-model="pwNew"
                :type="showPwNew ? 'text' : 'password'"
                placeholder="Minimal 6 karakter"
                class="vt-input pr-10"
                autocomplete="new-password"
              />
              <button type="button" @click="showPwNew = !showPwNew" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                <svg v-if="!showPwNew" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
              </button>
            </div>
          </div>

          <!-- Konfirmasi Password -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Konfirmasi Password Baru</label>
            <div class="relative">
              <input
                v-model="pwConfirm"
                :type="showPwConfirm ? 'text' : 'password'"
                placeholder="Ketik ulang password baru"
                class="vt-input pr-10"
                autocomplete="new-password"
              />
              <button type="button" @click="showPwConfirm = !showPwConfirm" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                <svg v-if="!showPwConfirm" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
              </button>
            </div>
          </div>

          <!-- Feedback -->
          <p v-if="pwMsg" class="text-sm font-medium px-4 py-2 rounded-lg" :class="pwMsgType === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'">
            {{ pwMsg }}
          </p>

          <button
            @click="changePassword"
            :disabled="pwSaving"
            class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
          >
            <svg v-if="pwSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            {{ pwSaving ? 'Menyimpan...' : 'Ubah Password' }}
          </button>
        </div>

        <!-- Lupa Password Link -->
        <div class="vt-card p-6 md:p-8 flex flex-col gap-3">
          <h2 class="font-bold text-base vt-text-primary">Lupa Password?</h2>
          <p class="text-sm vt-text-muted">Jika kamu lupa password lama, kamu bisa reset melalui email.</p>
          <NuxtLink
            to="/auth/forgot-password"
            class="text-sm font-semibold text-blue-700 dark:text-sky-400 hover:underline self-start"
          >
            Kirim Link Reset Password →
          </NuxtLink>
        </div>
      </template>

      <!-- ══ TAB: NOTIFIKASI ═══════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'notifikasi'">
        <!-- Chat Settings -->
        <div class="vt-card p-6 md:p-8 flex flex-col gap-6">
          <div>
            <h2 class="font-bold text-base vt-text-primary flex items-center gap-2">💬 Pengaturan Chat</h2>
            <p class="text-sm vt-text-muted mt-1">Atur preferensi chat dan privasi pesanmu.</p>
          </div>

          <!-- Chat Popup -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium vt-text-primary">Popup Notifikasi Chat</p>
              <p class="text-xs vt-text-muted mt-0.5">Tampilkan popup saat ada pesan baru di pojok kanan bawah.</p>
            </div>
            <button
              @click="toggleSetting('chat_popup')"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none"
              :style="userSettings.chat_popup ? (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb)') : ''"
              :class="!userSettings.chat_popup ? 'bg-gray-300 dark:bg-slate-600' : ''"
              role="switch" :aria-checked="userSettings.chat_popup"
            >
              <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" :class="userSettings.chat_popup ? 'translate-x-5' : 'translate-x-0'" />
            </button>
          </div>

          <div class="border-t border-gray-100 dark:border-slate-700/50"></div>

          <!-- Read Receipts -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium vt-text-primary">Tanda Baca (Read Receipts)</p>
              <p class="text-xs vt-text-muted mt-0.5">Kirim dan tampilkan centang biru saat pesan sudah dibaca. Jika dinonaktifkan, kamu juga tidak bisa melihat tanda baca dari orang lain.</p>
            </div>
            <button
              @click="toggleSetting('read_receipts')"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none"
              :style="userSettings.read_receipts ? (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb)') : ''"
              :class="!userSettings.read_receipts ? 'bg-gray-300 dark:bg-slate-600' : ''"
              role="switch" :aria-checked="userSettings.read_receipts"
            >
              <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" :class="userSettings.read_receipts ? 'translate-x-5' : 'translate-x-0'" />
            </button>
          </div>

          <div class="border-t border-gray-100 dark:border-slate-700/50"></div>

          <!-- Online Status -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium vt-text-primary">Status Online</p>
              <p class="text-xs vt-text-muted mt-0.5">Tampilkan status online dan terakhir dilihat ke pengguna lain. Jika dinonaktifkan, kamu juga tidak bisa melihat status online orang lain.</p>
            </div>
            <button
              @click="toggleSetting('show_online')"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none"
              :style="userSettings.show_online ? (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb)') : ''"
              :class="!userSettings.show_online ? 'bg-gray-300 dark:bg-slate-600' : ''"
              role="switch" :aria-checked="userSettings.show_online"
            >
              <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" :class="userSettings.show_online ? 'translate-x-5' : 'translate-x-0'" />
            </button>
          </div>
        </div>

        <!-- Notification Settings -->
        <div class="vt-card p-6 md:p-8 flex flex-col gap-6">
          <div>
            <h2 class="font-bold text-base vt-text-primary flex items-center gap-2">🔔 Pengaturan Notifikasi</h2>
            <p class="text-sm vt-text-muted mt-1">Atur notifikasi yang ingin kamu terima.</p>
          </div>

          <!-- Product Notifications -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium vt-text-primary">Notifikasi Produk</p>
              <p class="text-xs vt-text-muted mt-0.5">Terima notifikasi tentang produk baru, restock, dan stok habis di panel lonceng.</p>
            </div>
            <button
              @click="toggleSetting('notif_product')"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none"
              :style="userSettings.notif_product ? (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb)') : ''"
              :class="!userSettings.notif_product ? 'bg-gray-300 dark:bg-slate-600' : ''"
              role="switch" :aria-checked="userSettings.notif_product"
            >
              <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out" :class="userSettings.notif_product ? 'translate-x-5' : 'translate-x-0'" />
            </button>
          </div>
        </div>
      </template>

    </div>
  </div>
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="showDeleteAddrConfirm"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
           @click.self="showDeleteAddrConfirm = false">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs flex flex-col overflow-hidden">
          <div class="flex flex-col items-center gap-3 px-6 pt-7 pb-2">
            <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, #fef2f2, #fee2e2);">
              <svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
              </svg>
            </div>
            <h3 class="font-bold text-base text-gray-800 dark:text-slate-100 text-center">Hapus Alamat?</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 text-center leading-relaxed">Alamat pengirimanmu akan dihapus permanen. Kamu bisa menambahkan alamat baru kapan saja.</p>
          </div>
          <div class="flex gap-3 px-6 py-5">
            <button
              @click="showDeleteAddrConfirm = false"
              class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition">
              Batal
            </button>
            <button
              @click="confirmDeleteAddress"
              class="flex-1 py-2.5 text-sm rounded-xl text-white font-semibold transition hover:opacity-90"
              style="background: linear-gradient(to right, #dc2626, #b91c1c);">
              Hapus
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ─── Delete Avatar Confirm Modal ─────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="showDeleteAvatarConfirm"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
           @click.self="showDeleteAvatarConfirm = false">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs flex flex-col overflow-hidden">

          <!-- Icon -->
          <div class="flex flex-col items-center gap-3 px-6 pt-7 pb-2">
            <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, #fef2f2, #fee2e2);">
              <svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
              </svg>
            </div>
            <h3 class="font-bold text-base text-gray-800 dark:text-slate-100 text-center">Hapus Foto Profil?</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 text-center leading-relaxed">Foto profilmu akan dihapus permanen dan tidak bisa dikembalikan.</p>
          </div>

          <!-- Buttons -->
          <div class="flex gap-3 px-6 py-5">
            <button
              @click="showDeleteAvatarConfirm = false"
              class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition">
              Batal
            </button>
            <button
              @click="confirmDeleteAvatar"
              class="flex-1 py-2.5 text-sm rounded-xl text-white font-semibold transition hover:opacity-90"
              style="background: linear-gradient(to right, #dc2626, #b91c1c);">
              Hapus
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ─── Crop Modal ─────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="showCropModal"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
             style="max-height: 90dvh;">

          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h3 class="font-bold text-sm text-gray-800 dark:text-slate-100">Atur Foto Profil</h3>
            <button @click="cancelCrop"
                    class="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Cropper area -->
          <div class="relative bg-gray-900 overflow-hidden" style="height: 300px;">
            <Cropper
              ref="cropperRef"
              :src="cropImageSrc"
              :stencil-props="{ aspectRatio: 1, movable: true, resizable: true }"
              class="w-full"
              style="height: 300px;"
            />
          </div>

          <!-- Controls -->
          <div class="px-5 py-4 flex flex-col gap-3 border-t border-gray-100 dark:border-slate-700">

            <!-- Zoom -->
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
              </svg>
              <div class="flex gap-2 flex-1">
                <button @click="cropperRef?.zoom(0.8)"
                        class="flex-1 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-700 dark:text-slate-300 font-bold">
                  −
                </button>
                <button @click="cropperRef?.zoom(1.2)"
                        class="flex-1 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-700 dark:text-slate-300 font-bold">
                  +
                </button>
              </div>
              <span class="text-xs text-gray-400 w-14 text-right">Zoom</span>
            </div>

            <!-- Rotate -->
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <div class="flex gap-2 flex-1">
                <button @click="() => { cropRotate -= 90; cropperRef?.rotate(-90) }"
                        class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                  ↺ Kiri 90°
                </button>
                <button @click="() => { cropRotate += 90; cropperRef?.rotate(90) }"
                        class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                  ↻ Kanan 90°
                </button>
              </div>
            </div>

            <!-- Flip -->
            <div class="flex gap-2">
              <button @click="cropperRef?.flip(true, false)"
                      class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                ↔ Cermin H
              </button>
              <button @click="cropperRef?.flip(false, true)"
                      class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                ↕ Cermin V
              </button>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2 mt-1">
              <button @click="cancelCrop"
                      class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium hover:bg-gray-200 transition">
                Batal
              </button>
              <button @click="confirmCrop"
                      class="vt-btn-primary flex-1 py-2.5 text-sm rounded-xl text-white font-medium transition hover:opacity-90">
                Simpan Foto
              </button>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ─── Logout Confirm Modal ──────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="showLogoutConfirm"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
           @click.self="showLogoutConfirm = false">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs flex flex-col overflow-hidden">
          <div class="flex flex-col items-center gap-3 px-6 pt-7 pb-2">
            <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, #fef2f2, #fee2e2);">
              <svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
              </svg>
            </div>
            <h3 class="font-bold text-base text-gray-800 dark:text-slate-100 text-center">Keluar dari VivaThrift?</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 text-center leading-relaxed">Sesi aktifmu akan diakhiri. Kamu harus login kembali untuk melanjutkan.</p>
          </div>
          <div class="flex gap-3 px-6 py-5">
            <button
              @click="showLogoutConfirm = false"
              class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition">
              Batal
            </button>
            <button
              @click="confirmLogout"
              class="flex-1 py-2.5 text-sm rounded-xl text-white font-semibold transition hover:opacity-90"
              style="background: linear-gradient(to right, #dc2626, #b91c1c);">
              Keluar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

</template>

<style scoped>
/* Crop modal transition */
.vt-crop-fade-enter-active, .vt-crop-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.vt-crop-fade-enter-from, .vt-crop-fade-leave-to { opacity: 0; transform: scale(0.96); }

/* Ensure vue-advanced-cropper fills its container */
:deep(.vue-advanced-cropper) { height: 300px !important; }

.vt-page-bg {
  background: #f8fafc;
}
.dark .vt-page-bg {
  background: #0f172a;
}
.vt-edit-header {
  background: transparent;
}
.vt-edit-header-overlay {
  background: linear-gradient(160deg, rgba(12,74,110,0.80) 0%, rgba(3,105,161,0.70) 50%, rgba(14,165,233,0.60) 100%);
}
.dark .vt-edit-header-overlay {
  background: linear-gradient(160deg, rgba(10,18,32,0.85) 0%, rgba(13,24,41,0.80) 100%);
}
.vt-tab-bar {
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(12px);
  border-color: rgba(0,0,0,0.07);
}
.dark .vt-tab-bar {
  background: rgba(15,23,42,0.92);
  border-color: rgba(255,255,255,0.07);
}
.vt-tab-active {
  color: #1e3a8a;
  border-color: #1e3a8a;
}
.dark .vt-tab-active {
  color: #38bdf8;
  border-color: #38bdf8;
}
.vt-tab-inactive {
  color: #6b7280;
  border-color: transparent;
}
.dark .vt-tab-inactive {
  color: #94a3b8;
}
.vt-tab-inactive:hover {
  color: #374151;
}
.dark .vt-tab-inactive:hover {
  color: #cbd5e1;
}
.vt-card {
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.07);
  border-radius: 1rem;
}
.dark .vt-card {
  background: #0d1829;
  border-color: rgba(255,255,255,0.07);
}
.vt-card-primary {
  border-color: rgba(30,58,138,0.30);
  box-shadow: 0 0 0 1px rgba(30,58,138,0.10);
}
.dark .vt-card-primary {
  border-color: rgba(56,189,248,0.30);
}
.vt-text-primary {
  color: #0f172a;
}
.dark .vt-text-primary {
  color: #f1f5f9;
}
.vt-text-muted {
  color: #6b7280;
}
.dark .vt-text-muted {
  color: #94a3b8;
}
.vt-label {
  color: #374151;
}
.dark .vt-label {
  color: #cbd5e1;
}
.vt-input {
  width: 100%;
  padding: 0.6rem 0.875rem;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 0.6rem;
  font-size: 0.875rem;
  background: #fff;
  color: #0f172a;
  transition: border-color 0.15s;
  outline: none;
}
.vt-input:focus {
  border-color: #1e3a8a;
  box-shadow: 0 0 0 3px rgba(30,58,138,0.10);
}
.vt-input:disabled {
  background: #f1f5f9;
  color: #9ca3af;
  cursor: not-allowed;
}
.dark .vt-input {
  background: #0f172a;
  border-color: rgba(255,255,255,0.12);
  color: #f1f5f9;
}
.dark .vt-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 3px rgba(56,189,248,0.12);
}
.dark .vt-input:disabled {
  background: #1e293b;
  color: #475569;
}
.vt-input-readonly {
  width: 100%;
  padding: 0.6rem 0.875rem;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 0.6rem;
  font-size: 0.875rem;
  background: #f8fafc;
  color: #6b7280;
}
.dark .vt-input-readonly {
  background: #1e293b;
  border-color: rgba(255,255,255,0.06);
  color: #64748b;
}
.vt-btn-primary {
  background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);
}
.dark .vt-btn-primary {
  background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8);
}
.vt-btn-cancel {
  border-color: rgba(0,0,0,0.15);
  color: #374151;
}
.vt-btn-cancel:hover {
  background: #f3f4f6;
}
.dark .vt-btn-cancel {
  border-color: rgba(255,255,255,0.12);
  color: #94a3b8;
}
.dark .vt-btn-cancel:hover {
  background: rgba(255,255,255,0.05);
}
.vt-btn-set-primary {
  border-color: rgba(30,58,138,0.30);
  color: #1e3a8a;
}
.vt-btn-set-primary:hover {
  background: rgba(30,58,138,0.05);
}
.dark .vt-btn-set-primary {
  border-color: rgba(56,189,248,0.30);
  color: #38bdf8;
}
.dark .vt-btn-set-primary:hover {
  background: rgba(56,189,248,0.06);
}
.vt-add-addr-btn {
  border-color: rgba(30,58,138,0.25);
  color: #1e40af;
}
.vt-add-addr-btn:hover {
  background: rgba(30,58,138,0.04);
  border-color: rgba(30,58,138,0.45);
}
.dark .vt-add-addr-btn {
  border-color: rgba(56,189,248,0.25);
  color: #38bdf8;
}
.dark .vt-add-addr-btn:hover {
  background: rgba(56,189,248,0.05);
}
</style>
