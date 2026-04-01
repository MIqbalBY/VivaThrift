<script setup>
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
const TABS = ['profile', 'address', 'security', 'notifications']
const activeTab = ref(TABS.includes(route.query.tab) ? route.query.tab : 'profile')
watch(() => route.query.tab, (val) => {
  activeTab.value = TABS.includes(val) ? val : 'profile'
})

// ─── Composables ────────────────────────────────────────────────────────────
const {
  name, username, faculty, department, avatarUrl, nrp, email, phone, gender, bio,
  profileSaving, profileMsg, profileMsgType, profileLoading,
  usernameError, usernameChecking, originalUsername,
  fetchProfile, saveProfile,
} = useProfileEdit()

const {
  avatarUploading, avatarInput,
  showCropModal, cropImageSrc, cropperRef, cropZoom, cropRotate,
  showDeleteAvatarConfirm,
  handleAvatarChange, confirmCrop, cancelCrop,
  deleteAvatar, confirmDeleteAvatar,
} = useAvatarUpload()

const {
  addrSaving, addrMsg, addrMsgType, addrLoading,
  addrActiveType,
  shippingForm, _shippingId, shippingEditMode,
  sellerForm, _sellerId, sellerEditMode,
  syncAddress,
  showDeleteAddrConfirm, addrDeleting, deleteAddrType,
  gpsLoading,
  fetchAddresses, saveAddress, toggleSyncAddress,
  deleteAddress, confirmDeleteAddress,
  useGPS, openMapLink,
} = useAddressEdit()

const {
  pwOld, pwNew, pwConfirm, pwSaving, pwMsg, pwMsgType,
  showPwOld, showPwNew, showPwConfirm,
  changePassword,
} = usePasswordChange()

const { myRating, myRatingCount, fetchMyRating } = useMyRating()

const { settings: userSettings, fetchSettings: fetchUserSettings, updateSetting } = useUserSettings()

// ─── Avatar flow msg callback ────────────────────────────────────────────────
function avatarMsgCallback(msg, type) {
  profileMsg.value = msg
  profileMsgType.value = type
  if (type === 'ok') setTimeout(() => { profileMsg.value = '' }, 3000)
}

function onAvatarInputChange(e) {
  const result = handleAvatarChange(e)
  if (result?.error) {
    profileMsg.value = result.error
    profileMsgType.value = 'err'
  }
}

function onConfirmCrop() {
  confirmCrop(avatarUrl, _userId.value, avatarMsgCallback)
}

function onConfirmDeleteAvatar() {
  confirmDeleteAvatar(avatarUrl, _userId.value, avatarMsgCallback)
}

// ─── Logout ──────────────────────────────────────────────────────────────────
const showLogoutConfirm = ref(false)

function requestLogout() {
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  showLogoutConfirm.value = false
  await supabase.auth.signOut()
  navigateTo('/')
}

// ─── Toggle setting ──────────────────────────────────────────────────────────
function toggleSetting(key) {
  const uid = user.value?.id ?? _userId.value
  if (!uid) return
  updateSetting(uid, key, !userSettings.value[key])
}

// ─── Init ────────────────────────────────────────────────────────────────────
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
          @click="activeTab = 'profile'"
          class="vt-tab-btn px-6 py-3.5 text-sm font-semibold transition border-b-2"
          :class="activeTab === 'profile' ? 'vt-tab-active' : 'vt-tab-inactive'"
        >
          👤 Profil Saya
        </button>
        <button
          @click="activeTab = 'address'"
          class="vt-tab-btn px-6 py-3.5 text-sm font-semibold transition border-b-2"
          :class="activeTab === 'address' ? 'vt-tab-active' : 'vt-tab-inactive'"
        >
          📍 Alamat
        </button>
        <button
          @click="activeTab = 'security'"
          class="vt-tab-btn px-6 py-3.5 text-sm font-semibold transition border-b-2"
          :class="activeTab === 'security' ? 'vt-tab-active' : 'vt-tab-inactive'"
        >
          🔒 Keamanan
        </button>
        <button
          @click="activeTab = 'notifications'"
          class="vt-tab-btn px-6 py-3.5 text-sm font-semibold transition border-b-2"
          :class="activeTab === 'notifications' ? 'vt-tab-active' : 'vt-tab-inactive'"
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

      <!-- ══ TAB: PROFIL ═══════════════════════════════════════════════════ -->
      <template v-if="activeTab === 'profile'">
        <TabProfile
          :name="name" :username="username" :faculty="faculty" :department="department"
          :avatarUrl="avatarUrl" :nrp="nrp" :email="email" :phone="phone"
          :gender="gender" :bio="bio"
          :profileLoading="profileLoading" :profileSaving="profileSaving"
          :profileMsg="profileMsg" :profileMsgType="profileMsgType"
          :usernameError="usernameError" :usernameChecking="usernameChecking"
          :avatarUploading="avatarUploading"
          :myRating="myRating" :myRatingCount="myRatingCount" :isDark="isDark"
          @update:name="name = $event"
          @update:username="username = $event"
          @update:gender="gender = $event"
          @update:bio="bio = $event"
          @save-profile="saveProfile"
          @open-avatar-input="avatarInput?.click()"
          @delete-avatar="deleteAvatar(avatarUrl)"
        />
      </template>

      <!-- ══ TAB: ALAMAT ═══════════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'address'">
        <TabAddress
          :addrLoading="addrLoading" :addrSaving="addrSaving"
          :addrMsg="addrMsg" :addrMsgType="addrMsgType"
          :addrDeleting="addrDeleting" :gpsLoading="gpsLoading"
          :addrActiveType="addrActiveType"
          :shippingForm="shippingForm" :_shippingId="_shippingId"
          :shippingEditMode="shippingEditMode"
          :sellerForm="sellerForm" :_sellerId="_sellerId"
          :sellerEditMode="sellerEditMode"
          :syncAddress="syncAddress"
          :name="name" :phone="phone" :gender="gender"
          @update:addrActiveType="addrActiveType = $event"
          @update:shippingEditMode="shippingEditMode = $event"
          @update:sellerEditMode="sellerEditMode = $event"
          @save-address="saveAddress"
          @delete-address="deleteAddress"
          @toggle-sync-address="toggleSyncAddress"
          @use-gps="useGPS"
          @open-map-link="openMapLink"
        />
      </template>

      <!-- ══ TAB: KEAMANAN ═════════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'security'">
        <TabSecurity
          :pwOld="pwOld" :pwNew="pwNew" :pwConfirm="pwConfirm"
          :pwSaving="pwSaving" :pwMsg="pwMsg" :pwMsgType="pwMsgType"
          :showPwOld="showPwOld" :showPwNew="showPwNew" :showPwConfirm="showPwConfirm"
          @update:pwOld="pwOld = $event"
          @update:pwNew="pwNew = $event"
          @update:pwConfirm="pwConfirm = $event"
          @update:showPwOld="showPwOld = $event"
          @update:showPwNew="showPwNew = $event"
          @update:showPwConfirm="showPwConfirm = $event"
          @change-password="changePassword"
        />
      </template>

      <!-- ══ TAB: NOTIFIKASI ═══════════════════════════════════════════════ -->
      <template v-else-if="activeTab === 'notifications'">
        <TabNotifications
          :userSettings="userSettings"
          :isDark="isDark"
          @toggle-setting="toggleSetting"
        />
      </template>

    </div>

    <!-- Hidden avatar file input -->
    <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onAvatarInputChange" />

  </div>

  <!-- ─── Delete Address Confirm Modal ───────────────────────────────────── -->
  <ProfileConfirmModal
    :show="showDeleteAddrConfirm"
    title="Hapus Alamat?"
    message="Alamat ini akan dihapus secara permanen."
    confirm-label="Hapus"
    @close="showDeleteAddrConfirm = false"
    @confirm="confirmDeleteAddress"
  />

  <!-- ─── Delete Avatar Confirm Modal ────────────────────────────────────── -->
  <ProfileConfirmModal
    :show="showDeleteAvatarConfirm"
    title="Hapus Foto Profil?"
    message="Foto profilmu akan dihapus. Kamu bisa upload foto baru kapan saja."
    confirm-label="Hapus"
    @close="showDeleteAvatarConfirm = false"
    @confirm="onConfirmDeleteAvatar"
  />

  <!-- ─── Avatar Crop Modal ──────────────────────────────────────────────── -->
  <ProfileAvatarCropModal
    :show="showCropModal"
    :image-src="cropImageSrc"
    @confirm="onConfirmCrop"
    @cancel="cancelCrop"
  />

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
/* Modal transition */
.vt-crop-fade-enter-active, .vt-crop-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.vt-crop-fade-enter-from, .vt-crop-fade-leave-to { opacity: 0; transform: scale(0.96); }

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
</style>
