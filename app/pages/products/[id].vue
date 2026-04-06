<script setup>
const route = useRoute()
const supabase = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark } = useDarkMode()
const { reveal } = useScrollReveal()

// Resolve user ID reliably — mirrors the pattern in checkout.vue.
// getSession() is awaited at setup time so SSR + hydration both get the value.
// currentUser (reactive ref) catches any auth state change after hydration.
const { data: { session } } = await supabase.auth.getSession()

// route.params.id holds the slug (e.g. "keyboard-rexus-5b4b6d36")
const { data: product } = await useAsyncData(`product-${route.params.id}`, async () => {
  const param = route.params.id
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)
  const { data } = await supabase
    .from('products')
    .select(`
      id, title, description, price, condition, is_negotiable, is_cod, status, stock, created_at, updated_at,
      product_media ( media_url, media_type, is_primary, thumbnail_url ),
      users!products_seller_id_fkey ( id, name, nrp, faculty, department, avatar_url, gender ),
      categories ( name )
    `)
    .eq(isUuid ? 'id' : 'slug', param)
    .single()
  return data
}, {
  // Always fetch fresh from Supabase on client-side navigation.
  // SSR/hydration still uses the ISR payload for fast initial render.
  // IMPORTANT: must return `undefined` (not null) to trigger a refetch on SPA nav.
  // Returning null in Nuxt 4 means "use null as the cache value" — no refetch.
  getCachedData: (key, nuxtApp) => nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined,
})

const cleanTitle = computed(() => product.value?.title ? stripUrls(product.value.title) : '')

const primaryImage = computed(() => {
  const media = product.value?.product_media
  if (!media || media.length === 0) return ''
  const primary = media.find(m => m.is_primary) ?? media[0]
  return primary.media_url ?? ''
})

const productDesc = computed(() => {
  const p = product.value
  if (!p) return ''
  const price = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.price ?? 0)
  const cond = p.condition === 'Baru' ? 'Baru' : 'Bekas'
  return `${cond} — ${price}. ${(p.description ?? '').slice(0, 150)}`
})

useSeoMeta({
  title: computed(() => cleanTitle.value ? `${cleanTitle.value}` : 'Produk'),
  description: productDesc,
  ogTitle: computed(() => cleanTitle.value || 'Produk — VivaThrift'),
  ogDescription: productDesc,
  ogImage: primaryImage,
  ogType: 'product',
  twitterCard: 'summary_large_image',
  twitterTitle: computed(() => cleanTitle.value || 'Produk — VivaThrift'),
  twitterDescription: productDesc,
  twitterImage: primaryImage,
})

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
const lightboxOpen = ref(false)

const sellerInitials = computed(() => {
  const name = product.value?.users?.name ?? ''
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
})

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

// Similar products (same category, exclude self)
const similarProducts = ref([])
useAsyncData(`similar-${route.params.id}`, async () => {
  const p = product.value
  if (!p?.id) return
  const catName = p.categories?.name ?? null
  let q = supabase
    .from('products')
    .select(`id, slug, title, price, condition, is_negotiable, is_cod, seller_id, created_at,
      product_media ( media_url, media_type, thumbnail_url, is_primary ),
      users!products_seller_id_fkey ( id, name, avatar_url ),
      categories ( name )`)
    .eq('status', 'active')
    .neq('id', p.id)
    .order('created_at', { ascending: false })
    .limit(4)
  if (catName) q = q.eq('categories.name', catName)
  const { data } = await q
  similarProducts.value = data ?? []
})

// Product rating + reviews list
const productRating = ref(null)
const productRatingCount = ref(0)
const productReviews = ref([])
useAsyncData(`product-reviews-${route.params.id}`, async () => {
  const pid = product.value?.id
  if (!pid) return
  const { data } = await supabase
    .from('reviews')
    .select(`id, rating_product, rating_seller, comment, created_at,
      reviewer:users!reviews_reviewer_id_fkey(id, name, username, avatar_url)`)
    .eq('product_id', pid)
    .order('created_at', { ascending: false })
    .limit(20)
  productReviews.value = data ?? []
  const arr = (data ?? []).map(r => r.rating_product).filter(v => v != null)
  productRatingCount.value = arr.length
  productRating.value = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
})

// Seller address + distance
const sellerAddress = ref(null)
const distanceKm = ref(null)
const distanceLoading = ref(false)

async function fetchSellerAddressAndDistance(buyerId) {
  const sellerId = product.value?.users?.id
  if (!sellerId) return
  const db = supabase
  const { data: sAddr } = await db
    .from('addresses')
    .select('label, lat, lng')
    .eq('user_id', sellerId)
    .eq('address_type', 'seller')
    .maybeSingle()
  if (!sAddr || !sAddr.label) return
  sellerAddress.value = sAddr
  if (!buyerId || buyerId === sellerId) return
  if (!sAddr.lat || !sAddr.lng) return
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
    // OSRM unavailable
  } finally {
    distanceLoading.value = false
  }
}

const productDateLabel = computed(() => {
  if (!product.value) return ''
  const pd = productDate(product.value)
  return `${pd.label} ${pd.date}`
})

const stock = computed(() => product.value?.stock ?? null)
const isOutOfStock = computed(() => product.value?.status === 'sold' || (stock.value !== null && stock.value <= 0))

// ── Cart ─────────────────────────────────────────────────────────
const { addToCart: doAddToCart, cartOpen } = useCart()

// ── Wishlist ─────────────────────────────────────────────────────
const { isWishlisted, toggleWishlist: doToggleWishlist, fetchWishlist } = useWishlist()
const wishlistLoading = ref(false)

async function toggleWishlist() {
  if (!currentUser.value) return navigateTo('/auth/signin')
  if (!product.value?.id) return
  wishlistLoading.value = true
  await doToggleWishlist(product.value.id)
  wishlistLoading.value = false
}

// ── Actions ──────────────────────────────────────────────────────
const cartMsg = ref('')
const chatLoading = ref(false)
const chatError = ref('')

async function openChat() {
  const uid = currentUserId.value ?? currentUser.value?.id
  if (!uid) return navigateTo('/auth/signin')
  if (uid === product.value?.users?.id) return
  chatLoading.value = true
  chatError.value = ''
  try {
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

async function addToCart(qty = 1) {
  if (!currentUserId.value) return navigateTo('/auth/signin')
  const result = await doAddToCart(product.value.id, qty)
  if (!result.success && result.message === 'login') return navigateTo('/auth/signin')
  cartMsg.value = result.success ? 'cart' : 'error'
  if (!result.success) cartMsg.value = result.message
  setTimeout(() => cartMsg.value = '', 3000)
  if (result.success) cartOpen.value = true
}
async function buyNow(qty = 1) {
  if (!currentUserId.value) return navigateTo('/auth/signin')
  const result = await doAddToCart(product.value.id, qty)
  if (result.success) {
    await navigateTo('/cart')
  } else {
    cartMsg.value = result.message
    setTimeout(() => cartMsg.value = '', 3000)
  }
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

// ── Seller detection ─────────────────────────────────────────────
// Computed (not ref) so it reacts immediately when currentUser settles
// after hydration — no async gap, no flash of wrong buyer/seller UI.
const currentUserId = computed(() => session?.user?.id ?? currentUser.value?.id ?? null)
const isSeller = computed(() => !!currentUserId.value && currentUserId.value === product.value?.users?.id)
const profileCardUserId = ref(null)

// ── Report modal ────────────────────────────────────────────────
const showReportModal = ref(false)

// ── Recently viewed tracking ────────────────────────────────────
const { trackView } = useRecentlyViewed()

onMounted(() => {
  // Fetch immediately if session was already available at setup time
  fetchSellerAddressAndDistance(currentUserId.value)
  if (currentUserId.value) fetchWishlist()
  // Track product view
  if (product.value?.id) trackView(product.value.id)
})

// If auth state settles after mount (e.g. ISR-cached page + returning user),
// re-trigger distance calculation and wishlist fetch.
watch(currentUserId, (id, prevId) => {
  if (id && !prevId) {
    fetchSellerAddressAndDistance(id)
    fetchWishlist()
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
        <ProductDetailGallery
          :media="allMedia"
          v-model:active-index="activeIndex"
          :product-title="cleanTitle"
          :is-out-of-stock="isOutOfStock"
          @open-lightbox="lightboxOpen = true"
        />

        <!-- ── Aksi: Buyer ── -->
        <p v-if="chatError" class="text-xs text-red-500 px-1">{{ chatError }}</p>
        <div v-if="!isSeller" class="vt-action-bar flex items-center rounded-xl overflow-hidden text-sm" :style="isDark
          ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 2px 12px rgba(0,0,0,0.3);'
          : 'background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.45); box-shadow: 0 2px 12px rgba(30,58,138,0.08);'">
          <button @click="openChat" :disabled="chatLoading" class="flex-1 flex flex-col items-center gap-1 py-3 transition disabled:opacity-40" :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-white/40'">
            <svg v-if="!chatLoading" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.836L3 20l1.09-3.27C3.39 15.522 3 13.809 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <span>Chat</span>
          </button>
          <div class="vt-action-bar-divider w-px self-stretch" :style="isDark ? 'background: rgba(255,255,255,0.10)' : 'background: rgba(30,58,138,0.12)'"></div>
          <button @click="toggleWishlist" :disabled="wishlistLoading" class="flex-1 flex flex-col items-center gap-1 py-3 transition disabled:opacity-60" :class="[isWishlisted(product?.id) ? 'text-red-500' : isDark ? 'text-gray-300' : 'text-gray-600', isDark ? 'hover:bg-white/10' : 'hover:bg-white/40']">
            <svg class="w-5 h-5" :fill="isWishlisted(product?.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
            <span>{{ isWishlisted(product?.id) ? 'Disimpan' : 'Wishlist' }}</span>
          </button>
          <div class="vt-action-bar-divider w-px self-stretch" :style="isDark ? 'background: rgba(255,255,255,0.10)' : 'background: rgba(30,58,138,0.12)'"></div>
          <button @click="shareProduct" class="flex-1 flex flex-col items-center gap-1 py-3 transition" :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-white/40'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            <span>Share</span>
          </button>
          <div class="vt-action-bar-divider w-px self-stretch" :style="isDark ? 'background: rgba(255,255,255,0.10)' : 'background: rgba(30,58,138,0.12)'"></div>
          <button @click="showReportModal = true" class="flex-1 flex flex-col items-center gap-1 py-3 transition" :class="isDark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-400 hover:bg-red-50'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"/></svg>
            <span>Laporkan</span>
          </button>
        </div>
        <!-- ── Aksi: Seller ── -->
        <div v-else class="vt-action-bar flex items-center rounded-xl overflow-hidden text-sm" :style="isDark
          ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 2px 12px rgba(0,0,0,0.3);'
          : 'background: rgba(255,255,255,0.65); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.45); box-shadow: 0 2px 12px rgba(30,58,138,0.08);'">
          <NuxtLink :to="`/products/edit/${route.params.id}`" class="flex-1 flex flex-col items-center gap-1 py-3 transition" :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-white/40'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
            <span>Edit</span>
          </NuxtLink>
          <div class="vt-action-bar-divider w-px self-stretch" :style="isDark ? 'background: rgba(255,255,255,0.10)' : 'background: rgba(30,58,138,0.12)'"></div>
          <button @click="shareProduct" class="flex-1 flex flex-col items-center gap-1 py-3 transition" :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-white/40'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            <span>Share</span>
          </button>
        </div>
      </div>

      <!-- ── Kolom Kanan: Detail ── -->
      <div class="flex flex-col gap-4 min-w-0">

        <!-- Badges -->
        <div class="flex flex-wrap gap-2">
          <NuxtLink v-if="product.condition" :to="{ path: '/', query: { condition: product.condition } }" class="vt-badge-kondisi inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full border border-blue-100 cursor-pointer hover:bg-blue-100 hover:border-blue-200 transition">
            {{ CONDITION_META[product.condition]?.emoji ?? '' }} {{ product.condition }}
          </NuxtLink>
          <NuxtLink v-if="product.is_negotiable" :to="{ path: '/', query: { negotiable: 'yes' } }" class="vt-badge-nego inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full border border-green-100 cursor-pointer hover:bg-green-100 hover:border-green-200 transition">
            🤝 Nego
          </NuxtLink>
          <NuxtLink v-if="product.is_cod" :to="{ path: '/', query: { cod: 'yes' } }" class="vt-badge-cod inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full border border-green-100 cursor-pointer hover:bg-green-100 hover:border-green-200 transition">
            🚲 COD
          </NuxtLink>
        </div>

        <!-- Judul -->
        <h1 class="vt-detail-title font-heading text-2xl md:text-3xl font-bold leading-tight" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">{{ cleanTitle }}</h1>

        <!-- Date -->
        <p class="text-xs text-gray-400 text-right">{{ productDateLabel }}</p>

        <!-- Harga -->
        <p class="vt-detail-price text-2xl font-bold" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">
          Rp {{ product.price?.toLocaleString('id-ID') }}
        </p>

        <!-- Kategori + Stok -->
        <div class="flex items-center justify-between gap-2">
          <NuxtLink v-if="product.categories" :to="{ path: '/', query: { category: product.categories.name } }" class="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full border border-gray-200 cursor-pointer hover:bg-gray-200 transition">
            {{ CATEGORY_META[product.categories.name] ?? '📦' }} {{ product.categories.name }}
          </NuxtLink>
          <span v-else></span>
          <span v-if="isSeller" class="text-xs font-semibold">
            <span v-if="isOutOfStock" class="text-red-500">Stok habis</span>
            <span v-else class="text-blue-800">Stok: {{ stock }} unit</span>
          </span>
          <span v-else-if="isOutOfStock" class="text-xs font-semibold text-red-500">Stok habis</span>
        </div>

        <!-- Penjual -->
        <div v-if="product.users" class="vt-glass flex items-center gap-3 p-3 rounded-xl transition cursor-pointer hover:shadow-md"
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
              <template v-if="currentUser">
                <span v-if="product.users.gender === 'Laki-laki'" title="Laki-laki">♂️</span>
                <span v-else-if="product.users.gender === 'Perempuan'" title="Perempuan">♀️</span>
              </template>
            </p>
            <p v-if="currentUser" class="text-xs text-gray-500 truncate">
              {{ product.users.nrp ?? '-' }}
              <template v-if="product.users.faculty || product.users.department">
                ({{ [facultyAcronym(product.users.faculty), product.users.department].filter(Boolean).join(' - ') }})
              </template>
            </p>
            <div class="flex items-center gap-1 mt-0.5">
              <svg class="w-3 h-3 text-yellow-400 fill-current shrink-0" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <template v-if="ratingCount > 0">
                <span class="text-xs text-gray-500">{{ sellerRating.toFixed(1) }} / 5.0</span>
              </template>
              <span v-else class="text-xs text-gray-400">Belum ada ulasan</span>
            </div>
          </div>
        </div>

        <!-- Profile Card Modal -->
        <ProfileCard v-if="profileCardUserId" :user-id="profileCardUserId" @close="profileCardUserId = null" />

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

        <!-- Ulasan Pembeli -->
        <div v-if="productReviews.length" class="border-t border-gray-100 pt-4">
          <div class="flex items-center gap-2 mb-3">
            <p class="text-sm font-semibold text-gray-700">Ulasan Pembeli</p>
            <div v-if="productRating != null" class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <span class="text-xs font-semibold" :class="isDark ? 'text-gray-200' : 'text-gray-700'">{{ productRating.toFixed(1) }}</span>
              <span class="text-xs" :class="isDark ? 'text-gray-500' : 'text-gray-400'">({{ productRatingCount }})</span>
            </div>
          </div>
          <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
            <div
              v-for="review in productReviews"
              :key="review.id"
              class="rounded-xl p-3"
              :style="isDark
                ? 'background:rgba(30,41,59,0.50);border:1px solid rgba(255,255,255,0.06);'
                : 'background:rgba(248,250,252,0.80);border:1px solid rgba(226,232,240,0.60);'"
            >
              <div class="flex items-center gap-2 mb-1.5">
                <div class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8);' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb);'">
                  <img v-if="review.reviewer?.avatar_url" :src="review.reviewer.avatar_url" class="w-full h-full object-cover" />
                  <span v-else>{{ (review.reviewer?.name ?? '?')[0] }}</span>
                </div>
                <span class="text-xs font-semibold truncate" :class="isDark ? 'text-slate-200' : 'text-gray-700'">{{ review.reviewer?.name ?? 'Anonim' }}</span>
                <span class="text-[10px] ml-auto shrink-0" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
                  {{ new Date(review.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                </span>
              </div>
              <div class="flex items-center gap-0.5 mb-1">
                <svg v-for="s in 5" :key="s" class="w-3 h-3" :class="s <= (review.rating_product ?? 0) ? 'text-yellow-400 fill-current' : isDark ? 'text-slate-600' : 'text-gray-300'" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              </div>
              <p v-if="review.comment" class="text-xs leading-relaxed" :class="isDark ? 'text-slate-300' : 'text-gray-600'">{{ review.comment }}</p>
            </div>
          </div>
        </div>

        <!-- Panel Beli (buyer) -->
        <ProductDetailBuyPanel
          v-if="!isSeller"
          :price="product.price ?? 0"
          :stock="stock"
          :is-out-of-stock="isOutOfStock"
          :is-dark="isDark"
          :cart-msg="cartMsg"
          @add-to-cart="addToCart"
          @buy-now="buyNow"
        />

        <!-- Pesan Masuk (seller only) -->
        <ProductDetailSellerInbox
          v-if="isSeller"
          :product-id="product.id"
          :current-user-id="currentUserId"
          :is-dark="isDark"
        />
      </div>
    </div>

    <!-- Produk Serupa -->
    <div v-if="similarProducts.length" class="mt-8">
      <h3 class="text-lg font-bold mb-4" :class="isDark ? 'text-white' : 'text-gray-800'">Produk Serupa</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ProductCard
          v-for="sp in similarProducts"
          :key="sp.id"
          :product="sp"
          :show-seller="true"
          @seller-click="(uid) => profileCardUserId = uid"
        />
      </div>
    </div>
  </div>

  <!-- Lightbox -->
  <ProductDetailLightbox
    :show="lightboxOpen"
    :media="allMedia"
    v-model:active-index="activeIndex"
    :product-title="cleanTitle"
    @close="lightboxOpen = false"
  />

  <!-- Report Modal -->
  <ReportModal
    v-if="showReportModal && product"
    target-type="product"
    :target-id="product.id"
    :target-label="product.title"
    @close="showReportModal = false"
    @submitted="showReportModal = false"
  />
</template>
