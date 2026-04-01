<script setup>
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const route = useRoute()
const { isDark, toggle } = useDarkMode()
const { fetchSettings: fetchUserSettings, resetSettings: resetUserSettings } = useUserSettings()

// ── Composables ───────────────────────────────────────────────────
const { userProfile, userAddress, profilePending, userInitials, fetchProfile, fetchNavAddress } = useNavProfile()
const { chatNotifications, showChatNotification, dismissChatNotification } = useNavChatPopup()
const {
  navUnreadCount, navUid,
  fetchNavUnread, setupNavChannel, startNavPoll,
  handleVisibilityChange, handleOnline,
  cleanup: cleanupChatBadge,
} = useNavChatBadge({ onNewMessage: showChatNotification })
const { notifications, notifUnreadCount, showNotifPanel, fetchNotifications, setupNotifChannel, cleanup: cleanupNotif } = useNavNotifications()
const { dbCategories, showCategory, categoryButtonRef, categoryLabel, handleCategory } = useNavCategories()

// ── Local UI state ────────────────────────────────────────────────
const showMobileMenu = ref(false)
const showLogoutConfirm = ref(false)

// ── Actions ───────────────────────────────────────────────────────
function goHome() {
  if (route.path === '/' && !Object.keys(route.query).length) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    navigateTo('/')
  }
}

function handleSell() {
  if (!user.value) return navigateTo('/auth/signin')
  navigateTo('/products/create')
}

function handleLogout() {
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  showLogoutConfirm.value = false
  await supabase.auth.signOut()
  navigateTo('/')
}

function onChatPopupNavigate(chatId, id) {
  navigateTo(`/chat/${chatId}`)
  dismissChatNotification(id)
}

// ── Outside-click: category dropdown ──────────────────────────────
function onDocClick(e) {
  if (!showMobileMenu.value && categoryButtonRef.value && !categoryButtonRef.value.contains(e.target)) {
    showCategory.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────
onMounted(async () => {
  document.addEventListener('click', onDocClick)

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) {
    navUid.value = session.user.id
    if (!userProfile.value) await fetchProfile(session.user.id)
    else profilePending.value = false
    if (!userAddress.value) fetchNavAddress(session.user.id)
    const uid = session.user.id
    const deferWork = () => {
      fetchNavUnread(uid)
      setupNavChannel(uid)
      startNavPoll(uid)
      fetchNotifications(uid)
      setupNotifChannel(uid)
      fetchUserSettings(uid)
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(deferWork, { timeout: 400 })
    } else {
      setTimeout(deferWork, 400)
    }
  } else {
    profilePending.value = false
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      userProfile.value = null
      userAddress.value = null
      profilePending.value = false
      navUnreadCount.value = 0
      notifications.value = []
      notifUnreadCount.value = 0
      resetUserSettings()
      cleanupChatBadge()
      cleanupNotif()
    } else if (event === 'SIGNED_IN' && session?.user?.id) {
      navUid.value = session.user.id
      if (!userProfile.value) fetchProfile(session.user.id)
      if (!userAddress.value) fetchNavAddress(session.user.id)
      fetchNavUnread(session.user.id)
      setupNavChannel(session.user.id)
      startNavPoll(session.user.id)
      fetchNotifications(session.user.id)
      setupNotifChannel(session.user.id)
      fetchUserSettings(session.user.id)
    }
  })

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('online', handleOnline)
})

onUnmounted(() => {
  cleanupChatBadge()
  cleanupNotif()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('online', handleOnline)
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <header class="vt-navbar w-full sticky top-0 z-50" :style="isDark
    ? 'background: rgba(15,23,42,0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.08);'
    : 'background: rgba(255,255,255,0.75); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.3);'">

    <!-- Top Strip -->
    <div class="vt-top-strip w-full hidden md:block" style="border-bottom: 1px solid rgba(30,58,138,0.08);">
      <div class="w-full px-10 py-1.5 flex justify-end items-center gap-5 text-xs text-gray-500">
        <div v-if="user" class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-blue-900 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
          </svg>
          <span>Dikirim ke</span>
          <NuxtLink
            to="/profile/edit?tab=address"
            class="flex items-center gap-0.5 font-semibold transition"
            :class="userAddress ? 'text-gray-700 hover:text-blue-900' : 'text-red-500 hover:text-red-700'"
          >
            {{ userAddress ? (userAddress.label || userAddress.city || userAddress.full_address || '?') : '?' }}
            <svg class="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
            </svg>
          </NuxtLink>
        </div>
        <span class="text-gray-200">|</span>
        <NuxtLink to="/about" class="hover:text-blue-900 transition">Tentang VivaThrift</NuxtLink>
        <span class="text-gray-200">|</span>
        <button @click="handleSell" class="hover:text-blue-900 transition">Mulai Berjualan</button>
      </div>
    </div>

    <!-- Main Navbar -->
    <div class="w-full" style="box-shadow: 0 4px 24px 0 rgba(30,58,138,0.10); border-bottom: 1px solid rgba(255,255,255,0.4);">
      <div class="w-full px-4 md:px-10 py-3 flex items-center gap-4">

        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2 select-none shrink-0" @click.prevent="goHome">
          <img src="/img/logo-vivathrift.png" alt="VivaThrift Logo" width="36" height="36" class="h-9 -translate-y-0.5" fetchpriority="high" />
          <span
            class="vt-logo-text font-himpun text-3xl leading-none"
            style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
          >VivaThrift</span>
        </NuxtLink>

        <!-- Kategori Dropdown -->
        <div ref="categoryButtonRef" class="relative shrink-0 hidden md:block">
          <button
            @click="showCategory = !showCategory"
            class="vt-kategori-btn flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-700 hover:border-blue-900 hover:text-blue-900 transition"
          >
            Kategori
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="showCategory ? 'rotate-180' : ''"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="showCategory"
              class="vt-glass-dropdown absolute left-0 top-full mt-1 w-52 rounded-xl py-1.5 z-50" :style="isDark
                ? 'background: rgba(15,23,42,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.4);'
                : 'background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 8px 32px rgba(30,58,138,0.15);'"
            >
              <button
                @click="handleCategory('Semua Kategori')"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition"
              >
                🏷️ Semua Kategori
              </button>
              <button
                v-for="cat in (dbCategories ?? [])"
                :key="cat"
                @click="handleCategory(cat)"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition"
              >
                {{ categoryLabel(cat) }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- Search Bar (desktop) -->
        <NavbarSearchBar />

        <!-- Chat -->
        <NuxtLink to="/chat" class="relative items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition shrink-0 hidden md:flex" aria-label="Chat">
          <svg class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.836L3 20l1.09-3.27C3.39 15.522 3 13.809 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <span v-if="navUnreadCount > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8); pointer-events:none;' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb); pointer-events:none;'">
            {{ navUnreadCount > 99 ? '99+' : navUnreadCount }}
          </span>
        </NuxtLink>

        <!-- Notifikasi Bell + Panel -->
        <NavbarNotifPanel />

        <!-- Wishlist -->
        <button class="relative items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition shrink-0 hidden md:flex" aria-label="Wishlist">
          <svg class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
          </svg>
        </button>

        <!-- Cart -->
        <button class="relative items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition shrink-0 hidden md:flex" aria-label="Keranjang">
          <svg class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>
          </svg>
        </button>

        <!-- Belum login -->
        <template v-if="!user">
          <NuxtLink
            to="/auth/signin"
            class="vt-btn-outline shrink-0 px-5 py-2 rounded-full bg-white text-sm font-medium hover:bg-blue-50 transition hidden md:flex" style="box-shadow: inset 0 0 0 2px #1e3a8a; color: #1e3a8a;"
          >
            Masuk
          </NuxtLink>
          <NuxtLink
            to="/auth/signup"
            class="vt-btn-primary shrink-0 px-5 py-2 rounded-full text-white text-sm font-medium transition hover:opacity-90 hover:shadow-md hidden md:flex" style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
          >
            Daftar
          </NuxtLink>
        </template>

        <!-- Sudah login -->
        <template v-else>
          <div class="relative group shrink-0 hidden md:block">
            <button
              class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold transition" :style="isDark ? 'background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc)' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af)'"
              aria-label="Profil"
            >
              <img v-if="userProfile?.avatar_url" :src="userProfile.avatar_url" alt="Avatar" width="36" height="36" class="w-full h-full object-cover" />
              <span v-else-if="profilePending" class="w-4 h-4 rounded-full border-2 border-white/50 border-t-white animate-spin"></span>
              <span v-else>{{ userInitials }}</span>
            </button>
            <div class="vt-glass-dropdown absolute right-0 top-full mt-2 w-48 rounded-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50" :style="isDark
              ? 'background: rgba(15,23,42,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.4);'
              : 'background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 8px 32px rgba(30,58,138,0.15);'">
              <div class="px-4 py-2 border-b border-gray-100">
                <p class="text-xs font-semibold text-gray-700 truncate">{{ userProfile?.name || user.email }}</p>
                <p v-if="userProfile?.username" class="text-xs truncate" :class="isDark ? 'text-sky-400' : 'text-blue-600'">@{{ userProfile.username }}</p>
                <p v-else-if="userProfile?.name" class="text-xs text-gray-400 truncate">{{ user.email }}</p>
              </div>
              <NuxtLink :to="userProfile?.username ? `/profile/@${userProfile.username}` : `/profile/${user.id}`" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                Lihat Profil
              </NuxtLink>
              <div class="border-t border-gray-100 my-1"></div>
              <NuxtLink to="/profile/edit" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                Profil Saya
              </NuxtLink>
              <NuxtLink to="/profile/edit?tab=address" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                Alamat
              </NuxtLink>
              <NuxtLink to="/profile/edit?tab=security" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
                Keamanan
              </NuxtLink>
              <NuxtLink to="/profile/edit?tab=notifications" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
                Notifikasi
              </NuxtLink>
              <div class="border-t border-gray-100 my-1"></div>
              <button
                @click="handleLogout"
                class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
                </svg>
                Keluar
              </button>
            </div>
          </div>
        </template>

        <!-- Mobile spacer -->
        <div class="flex-1 md:hidden"></div>

        <!-- Dark mode toggle -->
        <button
          @click="toggle"
          :aria-label="isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'"
          :title="isDark ? 'Mode terang' : 'Mode gelap'"
          class="w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-gray-100 shrink-0"
        >
          <svg v-if="isDark" class="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m8.66-9H20M4 12H3m15.07-6.07-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"/>
          </svg>
          <svg v-else class="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </button>

        <!-- Hamburger (mobile only) -->
        <button
          @click="showMobileMenu = !showMobileMenu"
          class="md:hidden w-9 h-9 rounded-full flex items-center justify-center transition hover:bg-gray-100 shrink-0"
          :aria-label="showMobileMenu ? 'Tutup menu' : 'Buka menu'"
        >
          <svg v-if="!showMobileMenu" class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
          </svg>
          <svg v-else class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

      </div>
    </div>

    <!-- Mobile Menu -->
    <NavbarMobileMenu v-model:show="showMobileMenu" @handle-sell="handleSell" @handle-logout="handleLogout" />

  </header>

  <!-- Floating Chat Notifications -->
  <NavbarChatPopup
    :chat-notifications="chatNotifications"
    :is-dark="isDark"
    @dismiss="dismissChatNotification"
    @navigate="onChatPopupNavigate"
  />

  <!-- Logout Confirm Modal -->
  <NavbarLogoutModal
    :show="showLogoutConfirm"
    :is-dark="isDark"
    @cancel="showLogoutConfirm = false"
    @confirm="confirmLogout"
  />

</template>

<style scoped>
.vt-search-submit-btn {
  background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);
}
.vt-mobile-search-btn {
  background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);
}
.vt-mobile-masuk {
  box-shadow: inset 0 0 0 2px #1e3a8a;
  color: #1e3a8a;
}
.vt-mobile-masuk:hover {
  background-color: rgba(239, 246, 255, 0.8);
}
.vt-mobile-daftar {
  background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);
}
</style>

<style>
.vt-crop-fade-enter-active, .vt-crop-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.vt-crop-fade-enter-from, .vt-crop-fade-leave-to { opacity: 0; transform: scale(0.96); }

.vt-notif-enter-active { transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.vt-notif-leave-active { transition: all 0.22s ease-in; position: absolute; }
.vt-notif-enter-from { opacity: 0; transform: translateX(110%); }
.vt-notif-leave-to { opacity: 0; transform: translateX(110%); }
.vt-notif-move { transition: transform 0.3s ease; }

@keyframes vt-timer-shrink {
  from { width: 100%; }
  to   { width: 0%; }
}
.vt-notif-timer {
  animation: vt-timer-shrink 5s linear forwards;
}
</style>

