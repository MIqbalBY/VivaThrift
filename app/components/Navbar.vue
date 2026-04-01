<script setup>
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const route = useRoute()
const { isDark, toggle } = useDarkMode()
const { settings: userSettings, fetchSettings: fetchUserSettings, resetSettings: resetUserSettings } = useUserSettings()

// Shared profile state (synced with edit.vue via useState)
const userProfile = useState('userProfile', () => null)
const profilePending = ref(true)

// Shared address state
const userAddress = useState('userAddress', () => null)

async function fetchProfile(uid) {
  const { data } = await supabase.from('users').select('name, avatar_url, username').eq('id', uid).single()
  if (data) userProfile.value = data
  profilePending.value = false
}

async function fetchNavAddress(uid) {
  const { data } = await supabase.from('addresses').select('label, city, full_address').eq('user_id', uid).eq('address_type', 'shipping').maybeSingle()
  userAddress.value = data ?? null
}

// ── Total unread chat count (localStorage-based) ──────────────────
const navUnreadCount = useState('navUnreadCount', () => 0)
const navRefreshTrigger = useState('navRefreshTrigger', () => 0)
const navUid = ref(null)
let navChatChannel = null
let navRetryTimer = null
let navPollTimer = null

// ── Floating chat notifications ───────────────────────────────────
const chatNotifications = ref([])
let notifIdCounter = 0
// Per-chat dismiss timers, enables resetting the 5s window on update-in-place
const notifTimers = {}

function getNotifInitial(name) {
  return (name ?? '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function dismissChatNotification(id) {
  const idx = chatNotifications.value.findIndex(n => n.id === id)
  if (idx >= 0) {
    const { chatId } = chatNotifications.value[idx]
    if (notifTimers[chatId]) { clearTimeout(notifTimers[chatId]); delete notifTimers[chatId] }
    chatNotifications.value.splice(idx, 1)
  }
}

function showChatNotification(chatId, senderId, content) {
  // Respect user's chat popup preference
  if (!userSettings.value.chat_popup) return
  // If a card for this chat is already visible, update it in place and reset the timer.
  const existing = chatNotifications.value.find(n => n.chatId === chatId)
  if (existing) {
    existing.message = content
    existing.senderName = '...'
    existing.senderAvatar = null
    if (notifTimers[chatId]) clearTimeout(notifTimers[chatId])
    notifTimers[chatId] = setTimeout(() => { dismissChatNotification(existing.id); delete notifTimers[chatId] }, 5000)
    supabase.from('users').select('name, avatar_url').eq('id', senderId).single().then(({ data: s }) => {
      const n = chatNotifications.value.find(n => n.chatId === chatId)
      if (n) { n.senderName = s?.name ?? 'Pengguna'; n.senderAvatar = s?.avatar_url ?? null }
    })
    return
  }
  // Push immediately so the card appears without waiting for a DB round-trip.
  const id = ++notifIdCounter
  chatNotifications.value.push({ id, chatId, senderName: '...', senderAvatar: null, message: content, type: 'text' })
  notifTimers[chatId] = setTimeout(() => { dismissChatNotification(id); delete notifTimers[chatId] }, 5000)
  // Fetch sender info non-blocking and update the card reactively.
  supabase.from('users').select('name, avatar_url').eq('id', senderId).single().then(({ data: s }) => {
    const n = chatNotifications.value.find(n => n.id === id)
    if (n) { n.senderName = s?.name ?? 'Pengguna'; n.senderAvatar = s?.avatar_url ?? null }
  })
}

watch(navRefreshTrigger, () => {
  if (navUid.value) fetchNavUnread(navUid.value)
})

async function fetchNavUnread(uid) {
  const { data, error } = await supabase
    .from('chats')
    .select('id, messages(id, sender_id, is_read)')
    .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
  if (error) { console.error('[NavUnread] Supabase error:', error); return }
  let total = 0
  for (const chat of data ?? []) {
    // User is currently viewing this chat — treat as fully read
    if (route.path === `/chat/${chat.id}`) continue
    const msgs = chat.messages ?? []
    // Count messages from others that are still unread in DB
    const dbUnread = msgs.filter(m => m.sender_id !== uid && m.is_read === false).length
    if (dbUnread > 0) {
      total += dbUnread
    } else {
      // Fallback: localStorage for messages that may not have propagated yet
      const sorted = [...msgs].sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
      if (sorted.length > 0 && sorted[0].sender_id === uid) continue
      const lastViewed = parseInt(localStorage.getItem(`chat_viewed_${uid}_${chat.id}`) ?? '0')
      if (lastViewed > 0) continue // already marked via localStorage
    }
  }
  navUnreadCount.value = total
}

function setupNavChannel(uid) {
  if (navRetryTimer) { clearTimeout(navRetryTimer); navRetryTimer = null }
  // Remove old channel first to avoid stale duplicate subscriptions
  if (navChatChannel) {
    supabase.removeChannel(navChatChannel)
    navChatChannel = null
  }
  navChatChannel = supabase
    .channel(`nav-chat-unread-${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const msg = payload.new
        // Show floating notification immediately from the payload — no extra round-trip.
        // Only notify if the sender is someone else and the user isn't already in that chat.
        if (msg.sender_id !== uid && route.path !== `/chat/${msg.chat_id}`) {
          showChatNotification(msg.chat_id, msg.sender_id, msg.content)
        }
        fetchNavUnread(uid)
      }
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
      (payload) => {
        // When messages are marked as read, refresh the badge count
        if (payload.new?.is_read === true) fetchNavUnread(uid)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        fetchNavUnread(uid)
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        navRetryTimer = setTimeout(() => setupNavChannel(uid), 3000)
      }
    })
}

function startNavPoll(uid) {
  if (navPollTimer) clearInterval(navPollTimer)
  // Poll every 15 s as fallback when realtime silently fails
  navPollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') fetchNavUnread(uid)
  }, 15000)
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && navUid.value) {
    setupNavChannel(navUid.value)
    fetchNavUnread(navUid.value)
  }
}

function handleOnline() {
  if (navUid.value) {
    setupNavChannel(navUid.value)
    fetchNavUnread(navUid.value)
  }
}

onMounted(async () => {
  // Load profile from session on mount
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) {
    navUid.value = session.user.id
    if (!userProfile.value) await fetchProfile(session.user.id)
    else profilePending.value = false
    if (!userAddress.value) fetchNavAddress(session.user.id)
    // Defer non-critical realtime subscriptions to avoid blocking first paint
    const uid = session.user.id
    setTimeout(() => {
      fetchNavUnread(uid)
      setupNavChannel(uid)
      startNavPoll(uid)
      fetchNotifications(uid)
      setupNotifChannel(uid)
      fetchUserSettings(uid)
    }, 100)
  } else {
    profilePending.value = false
  }

  // Only react to definitive auth events — not transient null during navigation
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      userProfile.value = null
      userAddress.value = null
      profilePending.value = false
      navUnreadCount.value = 0
      notifications.value = []
      notifUnreadCount.value = 0
      resetUserSettings()
      if (navPollTimer) { clearInterval(navPollTimer); navPollTimer = null }
      if (navChatChannel) {
        supabase.removeChannel(navChatChannel)
        navChatChannel = null
      }
      if (notifChannel) { supabase.removeChannel(notifChannel); notifChannel = null }
    } else if (event === 'SIGNED_IN' && session?.user?.id) {
      navUid.value = session.user.id
      if (!userProfile.value) fetchProfile(session.user.id)
      if (!userAddress.value) fetchNavAddress(session.user.id)
      fetchNavUnread(session.user.id)
      if (!navChatChannel) setupNavChannel(session.user.id)
      if (!navPollTimer) startNavPoll(session.user.id)
      fetchNotifications(session.user.id)
      setupNotifChannel(session.user.id)
      fetchUserSettings(session.user.id)
    }
  })

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('online', handleOnline)
})

onUnmounted(() => {
  if (navRetryTimer) clearTimeout(navRetryTimer)
  if (navPollTimer) clearInterval(navPollTimer)
  if (navChatChannel) supabase.removeChannel(navChatChannel)
  if (notifChannel) supabase.removeChannel(notifChannel)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('online', handleOnline)
})

const userInitials = computed(() => {
  const name = userProfile.value?.name ?? ''
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return initials || '?'
})

// ── Notifications ─────────────────────────────────────────────────
const notifications = ref([])
const notifUnreadCount = ref(0)
const showNotifPanel = ref(false)
const notifPanelRef = ref(null)
const notifBellRef = ref(null)
let notifChannel = null

async function fetchNotifications(uid) {
  const { data } = await supabase
    .from('notifications')
    .select(`
      id, type, title, body, is_read, created_at,
      product_id,
      products ( slug, product_media ( media_url, media_type, thumbnail_url, is_primary ) ),
      actor:users!notifications_actor_id_fkey ( name, avatar_url )
    `)
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(30)
  notifications.value = data ?? []
  notifUnreadCount.value = (data ?? []).filter(n => !n.is_read).length
}

function setupNotifChannel(uid) {
  if (notifChannel) { supabase.removeChannel(notifChannel); notifChannel = null }
  notifChannel = supabase
    .channel(`notif-${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
      () => fetchNotifications(uid)
    )
    .subscribe()
}

async function markAllRead() {
  if (!navUid.value || notifUnreadCount.value === 0) return
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', navUid.value).eq('is_read', false)
  notifications.value = notifications.value.map(n => ({ ...n, is_read: true }))
  notifUnreadCount.value = 0
}

async function markOneRead(n) {
  if (n.is_read) return
  n.is_read = true
  notifUnreadCount.value = Math.max(0, notifUnreadCount.value - 1)
  await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
}

function notifTimeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} jam lalu`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function getNotifIcon(type) {
  if (type === 'new_product') return '🛍️'
  if (type === 'restock') return '📦'
  if (type === 'out_of_stock') return '😔'
  return 'ℹ️'
}

function getNotifProductImage(notif) {
  const media = notif.products?.product_media
  if (!media?.length) return null
  const primary = media.find(m => m.is_primary) ?? media[0]
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
  return primary.media_url
}

const searchQuery = ref('')
const showMobileMenu = ref(false)
const showKategori = ref(false)
const showLogoutConfirm = ref(false)
const kategoriBtnRef = ref(null)
const showSearchDropdown = ref(false)
const searchFormRef = ref(null)

const RECENT_KEY = 'vt_recent_searches'
const MAX_RECENT = 5
const recentSearches = ref([])

const suggestions = ref([])
const isSearching = ref(false)
let debounceTimer = null

const filteredRecent = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return recentSearches.value
  return recentSearches.value.filter(s => s.toLowerCase().includes(q))
})

const showDropdown = computed(() => showSearchDropdown.value && (suggestions.value.length > 0 || filteredRecent.value.length > 0 || isSearching.value))

watch(searchQuery, (val) => {
  clearTimeout(debounceTimer)
  const q = val.trim()
  if (!q) {
    suggestions.value = []
    isSearching.value = false
    return
  }
  isSearching.value = true
  debounceTimer = setTimeout(async () => {
    const { data } = await supabase
      .from('products')
      .select('id, slug, title, price, product_media ( media_url, media_type, thumbnail_url, is_primary )')
      .eq('status', 'active')
      .ilike('title', `%${q}%`)
      .limit(6)
    suggestions.value = data ?? []
    isSearching.value = false
  }, 250)
})

function saveRecent(q) {
  const list = recentSearches.value.filter(s => s !== q)
  list.unshift(q)
  recentSearches.value = list.slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value))
}

function removeRecent(q, e) {
  e.stopPropagation()
  recentSearches.value = recentSearches.value.filter(s => s !== q)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value))
}

function clearRecent() {
  recentSearches.value = []
  localStorage.removeItem(RECENT_KEY)
}

function selectRecent(q) {
  searchQuery.value = q
  saveRecent(q)
  showSearchDropdown.value = false
  suggestions.value = []
  navigateTo(`/?q=${encodeURIComponent(q)}`)
}

function selectSuggestion(product) {
  saveRecent(product.title)
  showSearchDropdown.value = false
  suggestions.value = []
  navigateTo(`/products/${product.slug ?? product.id}`)
}

function getSuggestionImage(product) {
  const media = product.product_media
  if (!media || media.length === 0) return null
  const primary = media.find(m => m.is_primary) ?? media[0]
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
  return primary.media_url
}

const { data: dbCategories } = await useAsyncData('navbar-categories', async () => {
  const { data } = await supabase.from('categories').select('name').order('name')
  const names = data?.map(c => c.name) ?? []
  const sorted = names.filter(n => n !== 'Lainnya')
  if (names.includes('Lainnya')) sorted.push('Lainnya')
  return sorted
}, { lazy: true })

const KATEGORI_META = {
  'Aksesori & Gadget':       '📱',
  'Buku & Alat Tulis':       '📚',
  'Dapur & Peralatan Makan': '🍳',
  'Elektronik':              '💻',
  'Fashion':                 '👗',
  'Hobi & Koleksi':          '🎨',
  'Kendaraan':               '🚗',
  'Kosmetik & Skincare':     '💄',
  'Olahraga':                '⚽',
  'Perabot Kos':             '🛋️',
  'Tiket & Voucher':         '🎫',
  'Lainnya':                 '📦',
}
function kategoriLabel(cat) {
  const emoji = KATEGORI_META[cat]
  return emoji ? `${emoji} ${cat}` : cat
}

function handleSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  saveRecent(q)
  showSearchDropdown.value = false
  suggestions.value = []
  navigateTo(`/?q=${encodeURIComponent(q)}`)
}

function handleKategori(cat) {
  showKategori.value = false
  if (cat === 'Semua Kategori') navigateTo('/')
  else navigateTo(`/?kategori=${encodeURIComponent(cat)}`)
}

function goHome() {
  if (route.path === '/' && !Object.keys(route.query).length) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    navigateTo('/')
  }
}

function handleJual() {
  if (!user.value) return navigateTo('/auth/signin')
  navigateTo('/products/create')
}

async function handleLogout() {
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  showLogoutConfirm.value = false
  await supabase.auth.signOut()
  navigateTo('/')
}

function onDocClick(e) {
  if (!showMobileMenu.value && kategoriBtnRef.value && !kategoriBtnRef.value.contains(e.target)) {
    showKategori.value = false
  }
  if (searchFormRef.value && !searchFormRef.value.contains(e.target)) {
    showSearchDropdown.value = false
  }
  if (notifPanelRef.value && !notifPanelRef.value.contains(e.target) && notifBellRef.value && !notifBellRef.value.contains(e.target)) {
    showNotifPanel.value = false
  }
}

onMounted(() => {
  recentSearches.value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <header class="vt-navbar w-full sticky top-0 z-50" :style="isDark
    ? 'background: rgba(15,23,42,0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.08);'
    : 'background: rgba(255,255,255,0.75); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(255,255,255,0.3);'">

    <!-- Top Strip -->
    <div class="vt-top-strip w-full hidden md:block" style="border-bottom: 1px solid rgba(30,58,138,0.08);">
      <div class="w-full px-10 py-1.5 flex justify-end items-center gap-5 text-xs text-gray-500">

        <!-- Alamat (pojok kanan atas) -->
        <div v-if="user" class="flex items-center gap-1">
          <svg class="w-3.5 h-3.5 text-blue-900 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
          </svg>
          <span>Dikirim ke</span>
          <NuxtLink
            to="/profile/edit?tab=alamat"
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
        <button @click="handleJual" class="hover:text-blue-900 transition">Mulai Berjualan</button>

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
        <div ref="kategoriBtnRef" class="relative shrink-0 hidden md:block">
          <button
            @click="showKategori = !showKategori"
            class="vt-kategori-btn flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-700 hover:border-blue-900 hover:text-blue-900 transition"
          >
            Kategori
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="showKategori ? 'rotate-180' : ''"
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
              v-if="showKategori"
              class="vt-glass-dropdown absolute left-0 top-full mt-1 w-52 rounded-xl py-1.5 z-50" :style="isDark
                ? 'background: rgba(15,23,42,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.4);'
                : 'background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 8px 32px rgba(30,58,138,0.15);'"
            >
              <button
                @click="handleKategori('Semua Kategori')"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition"
              >
                🏷️ Semua Kategori
              </button>
              <button
                v-for="cat in (dbCategories ?? [])"
                :key="cat"
                @click="handleKategori(cat)"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition"
              >
                {{ kategoriLabel(cat) }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- Search Bar -->
        <div ref="searchFormRef" class="flex-1 relative hidden md:block">
          <form @submit.prevent="handleSearch" class="vt-search-form flex items-stretch border border-gray-300 rounded-lg overflow-hidden focus-within:border-blue-700 transition-colors" :class="showDropdown ? 'rounded-b-none border-b-0' : ''">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari di VivaThrift"
              class="vt-search-input flex-1 px-4 py-2.5 text-sm text-gray-800 bg-transparent focus:outline-none placeholder-gray-400"
              @focus="showSearchDropdown = true"
              @keydown.escape="showSearchDropdown = false"
              autocomplete="off"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''; showSearchDropdown = true"
              class="px-2 text-gray-400 hover:text-gray-600 transition"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <button type="submit" class="vt-search-submit-btn px-4 py-2.5 text-white transition hover:opacity-90 flex items-center justify-center shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
              </svg>
            </button>
          </form>

          <!-- Search Dropdown -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="showDropdown"
              class="vt-glass-dropdown absolute left-0 right-0 top-full rounded-b-lg z-50 py-1 max-h-[420px] overflow-y-auto" :style="isDark
                ? 'background: rgba(15,23,42,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-top: none; box-shadow: 0 8px 32px rgba(0,0,0,0.4);'
                : 'background: rgba(255,255,255,0.90); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(30,58,138,0.12); border-top: none; box-shadow: 0 8px 32px rgba(30,58,138,0.12);'"
            >

              <!-- Live Suggestions -->
              <template v-if="searchQuery.trim()">
                <!-- Loading -->
                <div v-if="isSearching" class="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                  <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Mencari...
                </div>

                <!-- Results -->
                <template v-else-if="suggestions.length">
                  <div class="px-4 py-1.5">
                    <span class="text-xs text-gray-400 font-medium">Produk</span>
                  </div>
                  <button
                    v-for="product in suggestions"
                    :key="product.id"
                    @click="selectSuggestion(product)"
                    class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <div class="w-9 h-9 rounded shrink-0 overflow-hidden bg-gray-100">
                      <img v-if="getSuggestionImage(product)" :src="getSuggestionImage(product)" width="40" height="40" loading="lazy" class="w-full h-full object-cover" />
                      <div v-else class="w-full h-full bg-gray-200"></div>
                    </div>
                    <div class="flex-1 min-w-0 text-left">
                      <p class="truncate font-medium">{{ product.title }}</p>
                      <p class="text-xs text-blue-900 font-semibold">Rp {{ product.price?.toLocaleString('id-ID') }}</p>
                    </div>
                    <svg class="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                    </svg>
                  </button>
                  <!-- Lihat semua hasil -->
                  <button
                    @click="handleSearch"
                    class="w-full text-left px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 transition border-t border-gray-100 mt-1 font-medium"
                  >
                    Lihat semua hasil untuk &ldquo;{{ searchQuery.trim() }}&rdquo;
                  </button>
                </template>

                <!-- Tidak ada hasil -->
                <div v-else class="px-4 py-3 text-sm text-gray-400">
                  Tidak ada produk untuk &ldquo;{{ searchQuery.trim() }}&rdquo;
                </div>
              </template>

              <!-- Recent Searches (hanya ditampilkan saat input kosong) -->
              <template v-if="!searchQuery.trim() && filteredRecent.length">
                <div class="flex items-center justify-between px-4 py-1.5">
                  <span class="text-xs text-gray-400 font-medium">Pencarian Terakhir</span>
                  <button @click="clearRecent" class="text-xs text-blue-600 hover:underline">Hapus Semua</button>
                </div>
                <button
                  v-for="item in filteredRecent"
                  :key="item"
                  @click="selectRecent(item)"
                  class="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition group"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="truncate">{{ item }}</span>
                  </div>
                  <button
                    @click="(e) => removeRecent(item, e)"
                    class="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition shrink-0"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </button>
              </template>

            </div>
          </Transition>
        </div>

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

        <!-- Notifikasi Bell -->
        <div v-if="user" class="relative shrink-0 hidden md:flex items-center">
          <button
            ref="notifBellRef"
            @click="showNotifPanel = !showNotifPanel"
            class="relative items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition flex"
            aria-label="Notifikasi"
          >
            <svg class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
            </svg>
            <span v-if="notifUnreadCount > 0 && userSettings.notif_product"
              class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
              :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8); pointer-events:none;' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb); pointer-events:none;'">
              {{ notifUnreadCount > 99 ? '99+' : notifUnreadCount }}
            </span>
          </button>

          <!-- Notifikasi Panel -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="showNotifPanel"
              ref="notifPanelRef"
              class="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] rounded-xl z-50 flex flex-col overflow-hidden"
              :style="isDark
                ? 'background: rgba(15,23,42,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 8px 32px rgba(0,0,0,0.4);'
                : 'background: rgba(255,255,255,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(30,58,138,0.10); box-shadow: 0 8px 32px rgba(30,58,138,0.18);'"
            >
              <!-- Header -->
              <div class="flex items-center justify-between px-4 py-3 border-b" :class="isDark ? 'border-slate-700' : 'border-gray-100'">
                <h3 class="text-sm font-bold" :class="isDark ? 'text-slate-100' : 'text-gray-800'">Notifikasi</h3>
                <button
                  v-if="notifUnreadCount > 0"
                  @click="markAllRead"
                  class="text-xs font-medium transition"
                  :class="isDark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-800'"
                >
                  Tandai semua dibaca
                </button>
              </div>

              <!-- List -->
              <div v-if="notifications.length" class="flex-1 overflow-y-auto overscroll-contain">
                <NuxtLink
                  v-for="n in notifications"
                  :key="n.id"
                  :to="n.products?.slug ? `/products/${n.products.slug}` : (n.product_id ? `/products/${n.product_id}` : '#')"
                  @click="markOneRead(n); showNotifPanel = false"
                  class="flex items-start gap-3 px-4 py-3 transition border-b"
                  :class="[
                    isDark ? 'border-slate-700/50 hover:bg-slate-700/50' : 'border-gray-50 hover:bg-blue-50/50',
                    !n.is_read ? (isDark ? 'bg-slate-700/30' : 'bg-blue-50/30') : ''
                  ]"
                >
                  <!-- Product image or icon -->
                  <div class="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" :class="isDark ? 'bg-slate-700' : 'bg-gray-100'">
                    <img v-if="getNotifProductImage(n)" :src="getNotifProductImage(n)" width="40" height="40" loading="lazy" class="w-full h-full object-cover" />
                    <span v-else class="text-lg">{{ getNotifIcon(n.type) }}</span>
                  </div>
                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm leading-snug" :class="!n.is_read
                      ? (isDark ? 'font-semibold text-slate-100' : 'font-semibold text-gray-800')
                      : (isDark ? 'text-slate-300' : 'text-gray-600')">
                      {{ n.title }}
                    </p>
                    <p v-if="n.body" class="text-xs truncate mt-0.5" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ n.body }}</p>
                    <p class="text-xs mt-1" :class="!n.is_read ? (isDark ? 'text-sky-400 font-medium' : 'text-blue-500 font-medium') : (isDark ? 'text-slate-500' : 'text-gray-400')">{{ notifTimeAgo(n.created_at) }}</p>
                  </div>
                  <!-- Unread dot -->
                  <div v-if="!n.is_read" class="w-2 h-2 rounded-full shrink-0 mt-2" :class="isDark ? 'bg-sky-400' : 'bg-blue-500'"></div>
                </NuxtLink>
              </div>

              <!-- Empty -->
              <div v-else class="py-12 text-center">
                <span class="text-4xl block mb-2">🔔</span>
                <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">Belum ada notifikasi</p>
              </div>
            </div>
          </Transition>
        </div>

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
              <NuxtLink to="/profile/edit?tab=alamat" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                Alamat
              </NuxtLink>
              <NuxtLink to="/profile/edit?tab=keamanan" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
                Keamanan
              </NuxtLink>
              <NuxtLink to="/profile/edit?tab=notifikasi" class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition">
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
          <!-- Sun (shown in dark mode) -->
          <svg v-if="isDark" class="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m8.66-9H20M4 12H3m15.07-6.07-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"/>
          </svg>
          <!-- Moon (shown in light mode) -->
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
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="showMobileMenu"
        class="md:hidden w-full px-4 pb-5 pt-3 flex flex-col gap-3"
        style="border-top: 1px solid rgba(30,58,138,0.08);"
      >
        <!-- Mobile Search -->
        <form @submit.prevent="() => { handleSearch(); showMobileMenu = false }" class="flex items-stretch border border-gray-300 rounded-lg overflow-hidden focus-within:border-blue-700 transition-colors">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari di VivaThrift"
            class="flex-1 px-4 py-2.5 text-sm text-gray-800 bg-transparent focus:outline-none placeholder-gray-400"
            autocomplete="off"
          />
          <button type="submit" class="vt-mobile-search-btn px-4 py-2.5 text-white transition hover:opacity-90">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
            </svg>
          </button>
        </form>

        <!-- Mobile Nav Links -->
        <div class="flex flex-col gap-0.5">
          <NuxtLink to="/about" @click="showMobileMenu = false" class="px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition font-medium">
            Tentang VivaThrift
          </NuxtLink>
          <button @click="() => { handleJual(); showMobileMenu = false }" class="text-left px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition font-medium">
            Mulai Berjualan
          </button>
          <button @click.stop="showKategori = !showKategori" class="text-left flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition font-medium">
            Kategori
            <svg class="w-3.5 h-3.5 transition-transform duration-200" :class="showKategori ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
            <div v-if="showKategori" class="ml-3 flex flex-col gap-0.5">
              <button @click="() => { handleKategori('Semua Kategori'); showMobileMenu = false }" class="text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
                🏷️ Semua Kategori
              </button>
              <button v-for="cat in (dbCategories ?? [])" :key="cat" @click="() => { handleKategori(cat); showMobileMenu = false }" class="text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
                {{ kategoriLabel(cat) }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- Mobile Wishlist + Cart -->
        <div class="flex items-center gap-2">
          <button class="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition font-medium" aria-label="Wishlist">
            <svg class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
            </svg>
            Wishlist
          </button>
          <button class="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition font-medium" aria-label="Keranjang">
            <svg class="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>
            </svg>
            Keranjang
          </button>
        </div>

        <!-- Mobile Auth -->
        <div class="pt-2 border-t border-gray-100">
          <template v-if="!user">
            <div class="flex gap-2">
              <NuxtLink to="/auth/signin" @click="showMobileMenu = false" class="vt-mobile-masuk flex-1 text-center py-2.5 rounded-full text-sm font-medium transition">
                Masuk
              </NuxtLink>
              <NuxtLink to="/auth/signup" @click="showMobileMenu = false" class="vt-mobile-daftar flex-1 text-center py-2.5 rounded-full text-sm font-medium text-white transition hover:opacity-90">
                Daftar
              </NuxtLink>
            </div>
          </template>
          <template v-else>
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between px-1">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0" :style="isDark ? 'background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc)' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af)'">
                    <img v-if="userProfile?.avatar_url" :src="userProfile.avatar_url" alt="Avatar" width="48" height="48" class="w-full h-full object-cover" />
                    <span v-else-if="profilePending" class="w-3.5 h-3.5 rounded-full border-2 border-white/50 border-t-white animate-spin"></span>
                    <span v-else>{{ userInitials }}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-300 truncate max-w-[180px]">{{ userProfile?.name || user.email }}</span>
                    <span v-if="userProfile?.username" class="text-xs truncate max-w-[180px]" :class="isDark ? 'text-sky-400' : 'text-blue-600'">@{{ userProfile.username }}</span>
                    <span v-else-if="userProfile?.name" class="text-xs text-gray-400 truncate max-w-[180px]">{{ user.email }}</span>
                  </div>
                </div>
                <button @click="() => { handleLogout(); showMobileMenu = false }" class="text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
                  </svg>
                  Keluar
                </button>
              </div>
              <div class="flex gap-2">
                <NuxtLink to="/profile/edit" @click="showMobileMenu = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                  👤 Profil Saya
                </NuxtLink>
                <NuxtLink to="/profile/edit?tab=alamat" @click="showMobileMenu = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                  📍 Alamat
                </NuxtLink>
                <NuxtLink to="/profile/edit?tab=keamanan" @click="showMobileMenu = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                  🔒 Keamanan
                </NuxtLink>
                <NuxtLink to="/profile/edit?tab=notifikasi" @click="showMobileMenu = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                  ⚙️ Pengaturan
                </NuxtLink>
                <NuxtLink to="/chat" @click="showMobileMenu = false" class="relative flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                  💬 Chat
                  <span v-if="navUnreadCount > 0"
                    class="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white"
                    style="background:#2563eb;">
                    {{ navUnreadCount > 99 ? '99+' : navUnreadCount }}
                  </span>
                </NuxtLink>
                <button
                  @click="showNotifPanel = !showNotifPanel; showMobileMenu = false"
                  class="relative flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                >
                  🔔 Notifikasi
                  <span v-if="notifUnreadCount > 0 && userSettings.notif_product"
                    class="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white"
                    style="background:#ef4444;">
                    {{ notifUnreadCount > 99 ? '99+' : notifUnreadCount }}
                  </span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>

  </header>

  <!-- ─── Floating Chat Notifications ─────────────────────────────────── -->
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-[9997] flex flex-col-reverse gap-2.5 items-end" style="max-width:320px; width:calc(100vw - 40px); pointer-events:none;">
      <TransitionGroup name="vt-notif" tag="div" class="flex flex-col-reverse gap-2.5 w-full">
        <div
          v-for="notif in chatNotifications"
          :key="notif.id"
          class="vt-notif-card w-full rounded-2xl cursor-pointer select-none overflow-hidden"
          :style="isDark
            ? 'background:rgba(15,23,42,0.94);border:1px solid rgba(148,163,184,0.12);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,0.4);pointer-events:auto;'
            : 'background:rgba(255,255,255,0.97);border:1px solid rgba(30,58,138,0.1);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(30,58,138,0.18);pointer-events:auto;'"
          @click="navigateTo(`/chat/${notif.chatId}`); dismissChatNotification(notif.id)"
        >
          <!-- Timer bar -->
          <div class="w-full h-0.5 overflow-hidden" :class="isDark ? 'bg-slate-700' : 'bg-blue-50'">
            <div class="vt-notif-timer h-full" :class="isDark ? 'bg-sky-500' : 'bg-blue-600'"></div>
          </div>
          <!-- Body -->
          <div class="flex items-start gap-3 p-3 pr-3.5">
            <!-- Avatar -->
            <div
              class="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white text-xs font-bold"
              :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background:linear-gradient(to right,#162d6e,#1e40af)'"
            >
              <img v-if="notif.senderAvatar" :src="notif.senderAvatar" width="36" height="36" loading="lazy" class="w-full h-full object-cover" />
              <span v-else>{{ getNotifInitial(notif.senderName) }}</span>
            </div>
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-1">
                <div class="min-w-0">
                  <p class="text-xs font-semibold" :class="isDark ? 'text-slate-400' : 'text-blue-700'">Pesan baru</p>
                  <p class="text-sm font-semibold truncate" :class="isDark ? 'text-slate-100' : 'text-gray-800'">{{ notif.senderName }}</p>
                </div>
                <button
                  class="shrink-0 mt-0.5 rounded-full p-0.5 transition"
                  :class="isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'"
                  @click.stop="dismissChatNotification(notif.id)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p class="text-xs mt-0.5 truncate" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                <template v-if="notif.type === 'image'">📷 Foto</template>
                <template v-else-if="notif.type === 'offer'">💰 Penawaran harga</template>
                <template v-else>{{ notif.message }}</template>
              </p>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
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

