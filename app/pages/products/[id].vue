<script setup>
const route = useRoute()
const supabase = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark } = useDarkMode()
const { reveal } = useScrollReveal()

// route.params.id holds the slug (e.g. "keyboard-rexus-5b4b6d36")
const { data: product } = await useAsyncData(`product-${route.params.id}`, async () => {
  const param = route.params.id
  // Support legacy UUID links as fallback
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
  const { data } = await supabase
    .from('products')
    .select(`
      id, title, description, price, condition, is_negotiable, is_cod, status, stock, created_at, updated_at,
      product_media ( media_url, media_type, is_primary, thumbnail_url ),
      users ( id, name, nrp, faculty, department, avatar_url, gender ),
      categories ( name )
    `)
    .eq(isUuid ? 'id' : 'slug', param)
    .single()
  return data
})

useHead({ title: computed(() => product.value?.title ? `${product.value.title} — VivaThrift` : 'Produk — VivaThrift') })

const allMedia = computed(() => {
  const media = product.value?.product_media
  if (!media || media.length === 0) return []
  const primary = media.find(m => m.is_primary) ?? media[0]
  return [primary, ...media.filter(m => m !== primary)].map(m => ({
    url: m.media_url,
    isVideo: m.media_type?.startsWith('video/') ?? false,
    thumbnailUrl: m.thumbnail_url || null,
  }))
})

const activeIndex = ref(0)
const activeMedia = computed(() => allMedia.value[activeIndex.value] ?? null)

function prevMedia() {
  if (allMedia.value.length === 0) return
  activeIndex.value = (activeIndex.value - 1 + allMedia.value.length) % allMedia.value.length
}
function nextMedia() {
  if (allMedia.value.length === 0) return
  activeIndex.value = (activeIndex.value + 1) % allMedia.value.length
}

const lightboxOpen = ref(false)

const sellerInitials = computed(() => {
  const name = product.value?.users?.name ?? ''
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
})

function fakultasAkronim(f) {
  if (!f) return ''
  const m = /\(([^)]+)\)$/.exec(f)
  return m ? m[1] : f
}

// Seller rating
const sellerRating = ref(null)
const ratingCount = ref(0)
useAsyncData(`seller-rating-${route.params.id}`, async () => {
  const uid = product.value?.users?.id
  if (!uid) return
  const { data } = await supabase
    .from('reviews')
    .select('rating_seller')
    .eq('reviewee_id', uid)
  const arr = data?.map(r => r.rating_seller).filter(v => v != null) ?? []
  ratingCount.value = arr.length
  sellerRating.value = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
})

// Seller address + distance
const sellerAddress = ref(null)
const distanceKm = ref(null)
const distanceLoading = ref(false)

async function fetchSellerAddressAndDistance(buyerId) {
  const sellerId = product.value?.users?.id
  if (!sellerId) return

  const db = supabase

  // Fetch seller's seller-type address
  const { data: sAddr } = await db
    .from('addresses')
    .select('label, lat, lng')
    .eq('user_id', sellerId)
    .eq('address_type', 'seller')
    .maybeSingle()

  if (!sAddr || !sAddr.label) return
  sellerAddress.value = sAddr

  // Need buyer to calc distance
  if (!buyerId || buyerId === sellerId) return
  if (!sAddr.lat || !sAddr.lng) return

  // Fetch buyer's shipping address
  const { data: bAddr } = await db
    .from('addresses')
    .select('lat, lng')
    .eq('user_id', buyerId)
    .eq('address_type', 'shipping')
    .maybeSingle()

  if (!bAddr || !bAddr.lat || !bAddr.lng) return

  distanceLoading.value = true
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${sAddr.lng},${sAddr.lat};${bAddr.lng},${bAddr.lat}?overview=false`
    const res = await $fetch(url)
    if (res?.routes?.[0]?.distance != null) {
      distanceKm.value = (res.routes[0].distance / 1000).toFixed(2)
    }
  } catch {
    // OSRM unavailable — distance stays null
  } finally {
    distanceLoading.value = false
  }
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()]
  const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const jam = String(d.getHours()).padStart(2, '0')
  const mnt = String(d.getMinutes()).padStart(2, '0')
  return `${hari}, ${tgl} pukul ${jam}:${mnt}`
}
const productDateLabel = computed(() => {
  const c = product.value?.created_at, u = product.value?.updated_at
  if (u && c && new Date(u) - new Date(c) > 60000) return 'Diedit pada ' + formatDate(u)
  return 'Ditambahkan pada ' + formatDate(c)
})

// ── Quantity ──────────────────────────────────────────────────────
const qty = ref(1)
const stock = computed(() => product.value?.stock ?? null)
const isOutOfStock = computed(() => product.value?.status === 'sold' || (stock.value !== null && stock.value <= 0))

function decQty() { if (qty.value > 1) qty.value-- }
function incQty() {
  if (stock.value !== null && qty.value >= stock.value) return
  qty.value++
}

const subtotal = computed(() => {
  const price = product.value?.price ?? 0
  return (price * qty.value).toLocaleString('id-ID')
})

// ── Actions ───────────────────────────────────────────────────────
const wishlist = ref(false)
const cartMsg = ref('')

// ── Chat ─────────────────────────────────────────────────────────
const chatLoading = ref(false)
const chatError = ref('')

async function openChat() {
  const uid = currentUserId.value ?? currentUser.value?.id
  if (!uid) return navigateTo('/auth/signin')
  if (uid === product.value?.users?.id) return
  chatLoading.value = true
  chatError.value = ''
  try {
    // Find existing chat first (avoids relying on unique constraint for upsert)
    const { data: existing } = await supabase
      .from('chats')
      .select('id')
      .eq('product_id', product.value.id)
      .eq('buyer_id', uid)
      .maybeSingle()
    if (existing) {
      await navigateTo(`/chat/${existing.id}`)
      return
    }
    // Create new chat
    const { data: newChat, error } = await supabase
      .from('chats')
      .insert({
        product_id: product.value.id,
        buyer_id:   uid,
        seller_id:  product.value.users.id,
      })
      .select('id')
      .single()
    if (error) throw error
    await navigateTo(`/chat/${newChat.id}`)
  } catch (e) {
    console.error('openChat error:', e)
    chatError.value = 'Gagal membuka chat. Coba lagi.'
  } finally {
    chatLoading.value = false
  }
}

function addToCart() {
  cartMsg.value = 'cart'
  setTimeout(() => cartMsg.value = '', 2500)
}

function buyNow() {
  cartMsg.value = 'buy'
  setTimeout(() => cartMsg.value = '', 2500)
}

function toggleWishlist() {
  wishlist.value = !wishlist.value
}

function shareProduct() {
  if (navigator.share) {
    navigator.share({ title: product.value?.title, url: window.location.href })
  } else {
    navigator.clipboard.writeText(window.location.href)
    cartMsg.value = 'copied'
    setTimeout(() => cartMsg.value = '', 2500)
  }
}

// ── Description formatter ─────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/\u003C/g, '&lt;')
    .replace(/\u003E/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function applyInlineFormat(escaped) {
  // **bold** → <strong>, *italic* → <em> (bold must come first)
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
}

function formatDescription(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const parts = []
  let inList = false
  for (const line of lines) {
    if (line.trimStart().startsWith('- ')) {
      if (!inList) { parts.push('\u003Cul class="list-disc list-inside space-y-0.5 my-1 text-gray-600">'); inList = true }
      parts.push(`\u003Cli>${applyInlineFormat(escapeHtml(line.trimStart().slice(2)))}\u003C/li>`)
    } else {
      if (inList) { parts.push('\u003C/ul>'); inList = false }
      if (line.trim() === '') {
        parts.push('\u003Cdiv class="h-2">\u003C/div>')
      } else {
        parts.push(`\u003Cspan class="block">${applyInlineFormat(escapeHtml(line))}\u003C/span>`)
      }
    }
  }
  if (inList) parts.push('\u003C/ul>')
  return parts.join('')
}

const KONDISI_META = {
  'Baru':        '🆕',
  'Seperti Baru':'✨',
  'Baik':        '👍',
  'Cukup Baik':  '👌',
  'Bekas':       '♻️',
}

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

// ── Seller detection ──────────────────────────────────────────────
// useSupabaseUser() is null in v2 without auth middleware; use getSession() like Navbar
const currentUserId = ref(null)
const isSeller = computed(() => !!currentUserId.value && currentUserId.value === product.value?.users?.id)
// ── Profile Card ──────────────────────────────────────────────────────────────
const profileCardUserId = ref(null)
// ── Seller: edit ──────────────────────────────────────────────────
const editMode = ref(false)
const saving = ref(false)
const saveError = ref('')

const KONDISI_LIST = ['Baru', 'Seperti Baru', 'Baik', 'Cukup Baik', 'Bekas']

const editForm = reactive({
  title: '',
  price: 0,
  stock: null,
  is_negotiable: false,
  is_cod: false,
  description: '',
  condition: ''
})

function startEdit() {
  Object.assign(editForm, {
    title: product.value.title ?? '',
    price: product.value.price ?? 0,
    stock: product.value.stock,
    is_negotiable: product.value.is_negotiable ?? false,
    is_cod: product.value.is_cod ?? false,
    description: product.value.description ?? '',
    condition: product.value.condition ?? ''
  })
  saveError.value = ''
  editMode.value = true
}

function cancelEdit() {
  editMode.value = false
  saveError.value = ''
}

async function saveProductEdits() {
  if (!product.value?.id) return
  saving.value = true
  saveError.value = ''
  const stockVal = editForm.stock === null || editForm.stock === '' ? null : Number(editForm.stock)
  const updatePayload = {
      title: editForm.title.trim(),
      price: Number(editForm.price),
      stock: stockVal,
      is_negotiable: editForm.is_negotiable,
      is_cod: editForm.is_cod,
      description: editForm.description,
      condition: editForm.condition,
      updated_at: new Date().toISOString()
  }
  if (stockVal !== null) updatePayload.status = stockVal > 0 ? 'active' : 'sold'
  const { data, error } = await supabase
    .from('products')
    .update(updatePayload)
    .eq('id', product.value.id)
    .select('id, title, price, stock, status, is_negotiable, is_cod, description, condition, updated_at, created_at')
    .single()
  saving.value = false
  if (error) { saveError.value = 'Gagal menyimpan. Coba lagi.'; return }
  Object.assign(product.value, data)
  editMode.value = false
}

// ── Seller: inbox ─────────────────────────────────────────────────
const sellerChats = ref([])
const sellerChatsPending = ref(true)
const sellerChatsUnreadTotal = computed(() =>
  sellerChats.value.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
)

async function fetchSellerChats() {
  if (!product.value?.id) return
  const { data } = await supabase
    .from('chats')
    .select(`
      id, created_at,
      buyer:users!buyer_id ( id, name, avatar_url, gender ),
      messages ( content, created_at, sender_id )
    `)
    .eq('product_id', product.value.id)
    .order('created_at', { ascending: false })
  const mapped = (data ?? []).map(c => {
    const msgs = c.messages ?? []
    const sorted = [...msgs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const lastViewed = parseInt(localStorage.getItem(`chat_viewed_${currentUserId.value}_${c.id}`) ?? '0')
    return {
      ...c,
      lastMessage: sorted[0] ?? null,
      unreadCount: msgs.filter(m =>
        new Date(m.created_at).getTime() > lastViewed && m.sender_id !== currentUserId.value
      ).length
    }
  })
  // Only show chats where at least one message was sent, sorted by most recent activity
  sellerChats.value = mapped
    .filter(c => c.lastMessage !== null)
    .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at))
    .slice(0, 5)
  sellerChatsPending.value = false
}

function formatChatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return hhmm
  if (d.toDateString() === new Date(now - 86400000).toDateString()) return `Kemarin ${hhmm}`
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${hhmm}`
}

let sellerChatsChannel = null

function setupSellerChatsRealtime() {
  if (sellerChatsChannel) return
  sellerChatsChannel = supabase
    .channel(`produk-seller-chats-${product.value?.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const msg = payload.new
      const chatIdx = sellerChats.value.findIndex(c => c.id === msg.chat_id)
      if (chatIdx === -1) return
      const chat = sellerChats.value[chatIdx]
      const alreadyExists = (chat.messages ?? []).some(m => m.id === msg.id)
      if (!alreadyExists) {
        chat.messages = [...(chat.messages ?? []), msg]
        chat.lastMessage = msg
        // bump unread if message is from buyer
        if (msg.sender_id !== currentUserId.value) {
          chat.unreadCount = (chat.unreadCount ?? 0) + 1
        }
        // re-sort: most recent first
        sellerChats.value = [chat, ...sellerChats.value.filter((_, i) => i !== chatIdx)]
      }
    })
    .subscribe()
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  currentUserId.value = session?.user?.id ?? currentUser.value?.id ?? null
  if (isSeller.value && sellerChatsPending.value) {
    await fetchSellerChats()
    setupSellerChatsRealtime()
  }
  fetchSellerAddressAndDistance(currentUserId.value)
})

onUnmounted(() => {
  if (sellerChatsChannel) {
    supabase.removeChannel(sellerChatsChannel)
    sellerChatsChannel = null
  }
})
</script>

<template>
  <div class="w-full max-w-7xl mx-auto px-4 md:px-8 py-8">

    <!-- Tombol Back -->
    <NuxtLink to="/" class="vt-hero-enter vt-hero-enter-d1 vt-back-btn mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a8a] transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Kembali
    </NuxtLink>

    <!-- Not found -->
    <div v-if="!product || product.status === 'deleted'" class="flex flex-col items-center text-center text-gray-400 py-24">
      <img src="/img/illustrations/page-not-found.svg" alt="Produk tidak ditemukan" width="208" height="208" loading="lazy" class="w-52 h-auto opacity-80 mb-4" />
      <p class="font-semibold text-lg dark:text-gray-400">Produk tidak ditemukan.</p>
    </div>

    <div v-else class="vt-hero-enter vt-hero-enter-d2 grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-8 items-start">

      <!-- ── Kolom Kiri: Foto ── -->
      <div class="md:sticky md:top-6 flex flex-col gap-3 min-w-0">
        <!-- Gambar Utama -->
        <div class="relative overflow-hidden rounded-2xl shadow bg-gray-50 group">
          <template v-if="activeMedia">
            <VideoPlayer
              v-if="activeMedia.isVideo"
              :src="activeMedia.url"
              video-class="w-full aspect-square object-contain"
              preload="metadata"
            />
            <img
              v-else
              :src="activeMedia.url"
              :alt="product.title"
              width="600"
              height="600"
              class="w-full aspect-square object-cover cursor-zoom-in"
              @click="lightboxOpen = true"
            />
          </template>
          <div v-else class="aspect-square flex items-center justify-center text-gray-300 text-6xl">📷</div>

          <!-- Sold Out overlay -->
          <div v-if="isOutOfStock" class="absolute inset-0 bg-black/50 flex items-center justify-center z-20 pointer-events-none rounded-2xl">
            <span class="text-white text-3xl font-bold tracking-widest uppercase rotate-[-15deg] border-4 border-white px-6 py-2 rounded-lg">Sold Out!</span>
          </div>

          <!-- Panah Prev/Next -->
          <template v-if="allMedia.length > 1">
            <button @click.stop="prevMedia" class="vt-img-nav-btn absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white transition opacity-0 group-hover:opacity-100 z-10">
              <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button @click.stop="nextMedia" class="vt-img-nav-btn absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white transition opacity-0 group-hover:opacity-100 z-10">
              <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </template>

          <!-- Tombol Expand -->
          <button v-if="!activeMedia?.isVideo" @click.stop="lightboxOpen = true" class="vt-img-nav-btn absolute bottom-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white transition opacity-0 group-hover:opacity-100 z-10">
            <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
          </button>

          <!-- Counter -->
          <span v-if="allMedia.length > 1" class="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
            {{ activeIndex + 1 }} / {{ allMedia.length }}
          </span>
        </div>
        <!-- Thumbnail Strip -->
        <div v-if="allMedia.length > 1" class="flex gap-2 flex-wrap">
          <button
            v-for="(m, i) in allMedia"
            :key="i"
            @click="activeIndex = i"
            class="w-16 h-16 rounded-xl overflow-hidden border-2 transition relative"
            :class="activeIndex === i ? 'vt-thumb-active border-[#1e3a8a] shadow' : 'border-transparent opacity-60 hover:opacity-100'"
          >
            <img v-if="m.isVideo && m.thumbnailUrl" :src="m.thumbnailUrl" width="64" height="64" loading="lazy" class="w-full h-full object-cover" />
            <video v-else-if="m.isVideo" :src="m.url" class="w-full h-full object-cover" preload="metadata" muted />
            <img v-else :src="m.url" width="64" height="64" loading="lazy" class="w-full h-full object-cover" />
            <div v-if="m.isVideo" class="absolute inset-0 flex items-center justify-center bg-black/20">
              <svg class="w-5 h-5 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </button>
        </div>
        <!-- Media count -->
        <p v-if="allMedia.length > 1" class="text-xs text-gray-400 px-1">{{ allMedia.length }} media</p>

        <!-- ── Aksi: Buyer: Chat / Wishlist / Share | Seller: Share only ── -->
        <p v-if="chatError" class="text-xs text-red-500 px-1">{{ chatError }}</p>
        <div v-if="!isSeller" class="vt-action-bar flex items-center rounded-xl overflow-hidden text-sm" :style="isDark
          ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 2px 12px rgba(0,0,0,0.3);'
          : 'background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.45); box-shadow: 0 2px 12px rgba(30,58,138,0.08);'">
          <button
            @click="openChat"
            :disabled="chatLoading"
            class="flex-1 flex flex-col items-center gap-1 py-3 transition disabled:opacity-40" :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-white/40'"
          >
            <svg v-if="!chatLoading" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.836L3 20l1.09-3.27C3.39 15.522 3 13.809 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <span>Chat</span>
          </button>
          <div class="vt-action-bar-divider w-px self-stretch" :style="isDark ? 'background: rgba(255,255,255,0.10)' : 'background: rgba(30,58,138,0.12)'"></div>
          <button
            @click="toggleWishlist"
            class="flex-1 flex flex-col items-center gap-1 py-3 transition" :class="[wishlist ? 'text-red-500' : isDark ? 'text-gray-300' : 'text-gray-600', isDark ? 'hover:bg-white/10' : 'hover:bg-white/40']"
          >
            <svg class="w-5 h-5" :fill="wishlist ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
            <span>{{ wishlist ? 'Disimpan' : 'Wishlist' }}</span>
          </button>
          <div class="vt-action-bar-divider w-px self-stretch" :style="isDark ? 'background: rgba(255,255,255,0.10)' : 'background: rgba(30,58,138,0.12)'"></div>
          <button
            @click="shareProduct"
            class="flex-1 flex flex-col items-center gap-1 py-3 transition" :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-white/40'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            <span>Share</span>
          </button>
        </div>
        <div v-else class="vt-action-bar flex items-center rounded-xl overflow-hidden text-sm" :style="isDark
          ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 2px 12px rgba(0,0,0,0.3);'
          : 'background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.45); box-shadow: 0 2px 12px rgba(30,58,138,0.08);'">
          <NuxtLink
            :to="`/products/edit/${route.params.id}`"
            class="flex-1 flex flex-col items-center gap-1 py-3 transition" :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-white/40'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
            <span>Edit</span>
          </NuxtLink>
          <div class="vt-action-bar-divider w-px self-stretch" :style="isDark ? 'background: rgba(255,255,255,0.10)' : 'background: rgba(30,58,138,0.12)'"></div>
          <button
            @click="shareProduct"
            class="flex-1 flex flex-col items-center gap-1 py-3 transition" :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-white/40'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            <span>Share</span>
          </button>
        </div>
      </div>

      <!-- ── Kolom Kanan: Detail ── -->
      <div class="flex flex-col gap-4 min-w-0">

        <!-- Badges -->
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-if="product.condition"
            :to="{ path: '/', query: { kondisi: product.condition } }"
            class="vt-badge-kondisi inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full border border-blue-100 cursor-pointer hover:bg-blue-100 hover:border-blue-200 transition"
          >
            {{ KONDISI_META[product.condition] ?? '' }} {{ product.condition }}
          </NuxtLink>
          <NuxtLink
            v-if="product.is_negotiable"
            :to="{ path: '/', query: { nego: 'ya' } }"
            class="vt-badge-nego inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full border border-green-100 cursor-pointer hover:bg-green-100 hover:border-green-200 transition"
          >
            🤝 Nego
          </NuxtLink>
          <NuxtLink
            v-if="product.is_cod"
            :to="{ path: '/', query: { cod: 'ya' } }"
            class="vt-badge-cod inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full border border-green-100 cursor-pointer hover:bg-green-100 hover:border-green-200 transition"
          >
            🚲 COD
          </NuxtLink>
        </div>

        <!-- Judul -->
        <h1 class="vt-detail-title font-heading text-2xl md:text-3xl font-bold leading-tight" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">{{ product.title }}</h1>

        <!-- Date -->
        <p class="text-xs text-gray-400 text-right">{{ productDateLabel }}</p>

        <!-- Harga -->
        <p class="vt-detail-price text-2xl font-bold" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">
          Rp {{ product.price?.toLocaleString('id-ID') }}
        </p>

        <!-- Kategori + Stok -->
        <div class="flex items-center justify-between gap-2">
          <NuxtLink
            v-if="product.categories"
            :to="{ path: '/', query: { kategori: product.categories.name } }"
            class="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full border border-gray-200 cursor-pointer hover:bg-gray-200 transition"
          >
            {{ KATEGORI_META[product.categories.name] ?? '📦' }} {{ product.categories.name }}
          </NuxtLink>
          <span v-else></span>
          <span v-if="isSeller" class="text-xs font-semibold">
            <span v-if="isOutOfStock" class="text-red-500">Stok habis</span>
            <span v-else class="text-blue-800">Stok: {{ stock }} unit</span>
          </span>
          <span v-else-if="isOutOfStock" class="text-xs font-semibold text-red-500">Stok habis</span>
        </div>

        <!-- Penjual -->
        <div
          v-if="product.users"
          class="vt-glass flex items-center gap-3 p-3 rounded-xl transition cursor-pointer hover:shadow-md"
          :style="isDark
            ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 2px 12px rgba(0,0,0,0.3);'
            : 'background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.45); box-shadow: 0 2px 12px rgba(30,58,138,0.08);'"
          @click="profileCardUserId = product.users.id"
        >
          <div class="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden" :style="isDark ? 'background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc)' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af)'">
            <img v-if="product.users.avatar_url" :src="product.users.avatar_url" width="48" height="48" loading="lazy" class="w-full h-full object-cover" />
            <span v-else class="text-white text-xs font-bold select-none">{{ sellerInitials }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-gray-800 truncate">
              {{ product.users.name }}
              <span v-if="product.users.gender === 'Laki-laki'" title="Laki-laki">♂️</span>
              <span v-else-if="product.users.gender === 'Perempuan'" title="Perempuan">♀️</span>
            </p>
            <p class="text-xs text-gray-500 truncate">
              {{ product.users.nrp ?? '-' }}
              <template v-if="product.users.faculty || product.users.department">
                ({{ [fakultasAkronim(product.users.faculty), product.users.department].filter(Boolean).join(' - ') }})
              </template>
            </p>
            <div class="flex items-center gap-1 mt-0.5">
              <svg class="w-3 h-3 text-yellow-400 fill-current shrink-0" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <template v-if="ratingCount > 0">
                <span class="text-xs text-gray-500">{{ sellerRating.toFixed(1) }} / 5.0</span>
                <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div class="h-1.5 rounded-full" :style="`background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); width:${Math.min(sellerRating / 5 * 100, 100)}%`"></div>
                </div>
              </template>
              <span v-else class="text-xs text-gray-400">Belum ada ulasan</span>
            </div>
          </div>
        </div>

        <!-- Profile Card Modal -->
        <ProfileCard
          v-if="profileCardUserId"
          :user-id="profileCardUserId"
          @close="profileCardUserId = null"
        />

        <!-- Alamat Pengirim + Jarak -->
        <div v-if="sellerAddress" class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" :style="isDark
          ? 'background: rgba(15,25,50,0.70); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08);'
          : 'background: rgba(255,255,255,0.55); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.4);'">
          <svg class="w-4 h-4 shrink-0" :class="isDark ? 'text-sky-400' : 'text-blue-600'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span :class="isDark ? 'text-gray-300' : 'text-gray-700'" class="truncate">
            {{ sellerAddress.label }}
            <template v-if="distanceLoading"> — <span class="text-gray-400">menghitung…</span></template>
            <template v-else-if="distanceKm"> — {{ distanceKm }} km</template>
          </span>
        </div>

        <!-- Deskripsi -->
        <div class="border-t border-gray-100 pt-4">
          <p class="text-sm font-semibold text-gray-700 mb-2">Deskripsi</p>
          <div class="text-gray-600 text-sm leading-relaxed">
            <div v-if="product.description" v-html="formatDescription(product.description)"></div>
            <span v-else class="text-gray-400">Tidak ada deskripsi.</span>
          </div>
        </div>

        <!-- ── Panel Beli (buyer) ── -->
        <div v-if="!isSeller" class="vt-glass rounded-2xl p-4 flex flex-col gap-4" :style="isDark
          ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
          : 'background: rgba(255,255,255,0.70); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 20px rgba(30,58,138,0.10);'">
          <!-- Stok & Qty -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <button
                @click="decQty"
                :disabled="qty <= 1"
                class="vt-qty-btn w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition"
              >−</button>
              <span class="w-6 text-center font-semibold text-gray-800">{{ qty }}</span>
              <button
                @click="incQty"
                :disabled="isOutOfStock || qty >= stock"
                class="vt-qty-btn w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition"
              >+</button>
            </div>
            <span class="text-sm text-gray-500">
              <template v-if="isOutOfStock"><span class="text-red-500 font-medium">Stok habis</span></template>
              <template v-else>Stok: <span class="font-medium text-gray-700">{{ stock }}</span></template>
            </span>
          </div>

          <!-- Subtotal -->
          <div class="flex items-center justify-between border-t border-gray-100 pt-3">
            <span class="text-sm text-gray-500">Subtotal</span>
            <span class="text-lg font-bold text-gray-900">Rp {{ subtotal }}</span>
          </div>

          <!-- Tombol aksi -->
          <div class="flex gap-3">
            <button
              @click="addToCart"
              :disabled="isOutOfStock"
              class="vt-btn-primary flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition hover:opacity-90 hover:shadow-lg text-sm inline-flex items-center justify-center gap-1.5"
              style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
              Keranjang
            </button>
            <button
              @click="buyNow"
              :disabled="isOutOfStock"
              class="vt-buy-outline-btn flex-1 py-3 rounded-xl border-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
              :style="isDark ? 'border-color: #38bdf8; color: #7dd3fc;' : 'border-color: #1e3a8a; color: #1e3a8a;'"
              :class="isDark ? 'hover:bg-sky-900/30' : 'hover:bg-blue-50'"
            >
              ⚡ Beli Langsung
            </button>
          </div>

          <!-- Toast -->
          <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 -translate-y-1" leave-active-class="transition duration-150" leave-to-class="opacity-0">
            <p v-if="cartMsg" class="text-center text-sm font-medium"
              :class="cartMsg === 'copied' ? 'text-gray-500' : 'text-green-600'">
              <template v-if="cartMsg === 'cart'">✅ Ditambahkan ke keranjang!</template>
              <template v-else-if="cartMsg === 'buy'">✅ Mengarahkan ke checkout...</template>
              <template v-else-if="cartMsg === 'copied'">🔗 Link disalin!</template>
            </p>
          </Transition>
        </div>

        <!-- ── Pesan Masuk (seller only) ── -->
        <div v-if="isSeller" class="vt-glass rounded-2xl p-4 flex flex-col gap-3"
          :style="isDark
            ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
            : 'background: rgba(255,255,255,0.70); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 20px rgba(30,58,138,0.10);'"
        >
          <p class="text-sm font-semibold flex items-center gap-1.5" :class="isDark ? 'text-gray-200' : 'text-gray-700'">
            📬 Pesan Masuk
            <span v-if="sellerChatsUnreadTotal > 0"
              class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
              :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb)'">
              {{ sellerChatsUnreadTotal > 99 ? '99+' : sellerChatsUnreadTotal }}
            </span>
          </p>
          <div v-if="sellerChatsPending" class="flex justify-center py-4">
            <svg class="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
          </div>
          <div v-else-if="sellerChats.length === 0" class="flex flex-col items-center gap-2 py-6 text-gray-400">
            <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.836L3 20l1.09-3.27C3.39 15.522 3 13.809 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <p class="text-sm font-medium">Belum ada pesan masuk</p>
            <p class="text-xs text-center">Pembeli yang tertarik akan menghubungimu di sini</p>
          </div>
          <div v-else class="flex flex-col gap-2">
            <NuxtLink
              v-for="c in sellerChats"
              :key="c.id"
              :to="`/chat/${c.id}`"
              class="flex items-center gap-3 p-3 rounded-xl transition cursor-pointer overflow-hidden"
              :style="isDark
                ? 'background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);'
                : 'background: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.5);'"
            >
              <div class="w-9 h-9 rounded-full shrink-0 flex items-center justify-center overflow-hidden" :style="isDark ? 'background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc)' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af)'">
                <img v-if="c.buyer?.avatar_url" :src="c.buyer.avatar_url" width="36" height="36" loading="lazy" class="w-full h-full object-cover" />
                <span v-else class="text-white text-xs font-bold">{{ (c.buyer?.name ?? '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase() }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate" :class="isDark ? 'text-white' : 'text-gray-800'">{{ c.buyer?.name ?? 'Pembeli' }} <span v-if="c.buyer?.gender === 'Laki-laki'" title="Laki-laki" class="text-blue-500">♂️</span><span v-else-if="c.buyer?.gender === 'Perempuan'" title="Perempuan" class="text-pink-500">♀️</span></p>
                <p class="text-xs truncate" :class="isDark ? 'text-gray-400' : 'text-gray-500'">{{ c.lastMessage.content }}</p>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0 ml-2">
                <span class="text-xs whitespace-nowrap" :class="isDark ? 'text-gray-500' : 'text-gray-400'">{{ formatChatTime(c.lastMessage.created_at) }}</span>
                <span v-if="c.unreadCount > 0"
                  class="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb)'">
                  {{ c.unreadCount }}
                </span>
                <svg v-else class="w-4 h-4" :class="isDark ? 'text-gray-500' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </div>
            </NuxtLink>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Edit Produk Modal (seller) -->
  <Teleport to="body">
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0" leave-active-class="transition duration-150" leave-to-class="opacity-0">
      <div
        v-if="editMode"
        class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto py-8 px-4"
        style="background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);"
        @click.self="cancelEdit"
      >
        <div class="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 mt-8 mb-8" :style="isDark
          ? 'background: rgba(15,23,42,0.97); box-shadow: 0 8px 40px rgba(0,0,0,0.4);'
          : 'background: rgba(255,255,255,0.97); box-shadow: 0 8px 40px rgba(30,58,138,0.18);'">
          <div class="flex items-center justify-between">
            <h2 class="font-heading text-xl font-bold" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">✏️ Edit Produk</h2>
            <button @click="cancelEdit" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Judul -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Judul Produk</label>
            <input v-model="editForm.title" type="text" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" placeholder="Judul produk" />
          </div>

          <!-- Harga -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Harga (Rp)</label>
            <input v-model="editForm.price" type="number" min="0" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" placeholder="0" />
          </div>

          <!-- Stok -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Stok</label>
            <input v-model="editForm.stock" type="number" min="0" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" placeholder="Jumlah unit tersedia" />
          </div>

          <!-- Kondisi -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Kondisi</label>
            <select v-model="editForm.condition" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
              <option v-for="k in KONDISI_LIST" :key="k" :value="k">{{ k }}</option>
            </select>
          </div>

          <!-- Opsi -->
          <div class="flex gap-6">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input v-model="editForm.is_negotiable" type="checkbox" class="w-4 h-4 rounded accent-blue-800" />
              <span class="text-sm text-gray-700">🤝 Bisa Nego</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input v-model="editForm.is_cod" type="checkbox" class="w-4 h-4 rounded accent-blue-800" />
              <span class="text-sm text-gray-700">🚲 COD</span>
            </label>
          </div>

          <!-- Deskripsi -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Deskripsi</label>
            <textarea v-model="editForm.description" rows="10" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none" placeholder="Tulis deskripsi produk..."></textarea>
          </div>

          <!-- Error -->
          <p v-if="saveError" class="text-sm text-red-500 text-center">{{ saveError }}</p>

          <!-- Tombol -->
          <div class="flex gap-3 pt-1">
            <button
              @click="cancelEdit"
              class="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >Batal</button>
            <button
              @click="saveProductEdits"
              :disabled="saving"
              class="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition hover:opacity-90"
              style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
            >{{ saving ? 'Menyimpan...' : '💾 Simpan Perubahan' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Lightbox -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="lightboxOpen"
        class="fixed inset-0 z-[9998] bg-black flex items-center justify-center p-4"
        @click.self="lightboxOpen = false"
      >
        <!-- Tutup -->
        <button @click="lightboxOpen = false" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <!-- Counter -->
        <span v-if="allMedia.length > 1" class="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-3 py-1 rounded-full">
          {{ activeIndex + 1 }} / {{ allMedia.length }}
        </span>

        <!-- Prev -->
        <button v-if="allMedia.length > 1" @click="prevMedia" class="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>

        <!-- Media -->
        <template v-if="activeMedia">
          <VideoPlayer
            v-if="activeMedia.isVideo"
            :src="activeMedia.url"
            autoplay
            video-class="max-w-[85vw] max-h-[75vh] object-contain select-none"
            class="rounded-lg"
          />
          <img
            v-else
            :src="activeMedia.url"
            :alt="product?.title"
            loading="lazy"
            class="max-w-[85vw] max-h-[75vh] object-contain rounded-lg select-none"
          />
        </template>

        <!-- Next -->
        <button v-if="allMedia.length > 1" @click="nextMedia" class="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
