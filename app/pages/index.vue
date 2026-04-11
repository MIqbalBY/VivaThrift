<script setup>
useSeoMeta({
  title: 'VivaThrift — Marketplace Preloved Mahasiswa ITS',
  description: 'Jual beli barang preloved khusus mahasiswa ITS Surabaya. Temukan fashion, elektronik, buku, dan kebutuhan kuliah dengan harga terjangkau.',
})

const { reveal } = useScrollReveal()

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const router = useRouter()
const { isDark } = useDarkMode()

// Profile card popup
const profileCardUserId = ref(null)

const showError = ref(false)
let errorTimer = null

// -- Filters from URL ----------------------------------------------
const activeCategory   = computed(() => {
  const v = route.query.category
  return v ? String(v).split(',').filter(Boolean) : []
})
const activeSearch     = computed(() => route.query.q      ? String(route.query.q)      : null)
const activeCondition  = computed(() => {
  const v = route.query.condition
  return v ? String(v).split(',').filter(Boolean) : []
})
const activeSort       = computed(() => route.query.sort   ? String(route.query.sort)   : 'newest')
const activeNegotiable = computed(() => route.query.negotiable ? String(route.query.negotiable) : null)
const activeCod        = computed(() => route.query.cod    ? String(route.query.cod)    : null)
const activeMinPrice   = computed(() => route.query.min_price ? Number(route.query.min_price) : null)
const activeMaxPrice   = computed(() => route.query.max_price ? Number(route.query.max_price) : null)

const hasActiveFilter = computed(() =>
  activeCategory.value.length > 0 ||
  activeCondition.value.length  > 0 ||
  activeNegotiable.value !== null       ||
  activeCod.value  !== null       ||
  activeMinPrice.value !== null ||
  activeMaxPrice.value !== null ||
  activeSort.value !== 'newest'
)

// Local price inputs (not synced to URL until user clicks apply)
const minPriceInput = ref('')
const maxPriceInput = ref('')
watch([activeMinPrice, activeMaxPrice], () => {
  minPriceInput.value = activeMinPrice.value != null ? String(activeMinPrice.value) : ''
  maxPriceInput.value = activeMaxPrice.value != null ? String(activeMaxPrice.value) : ''
}, { immediate: true })

function applyPriceFilter() {
  const min = minPriceInput.value ? Number(minPriceInput.value) : undefined
  const max = maxPriceInput.value ? Number(maxPriceInput.value) : undefined
  updateQuery({ min_price: min && min > 0 ? min : undefined, max_price: max && max > 0 ? max : undefined })
}

// -- Dynamic categories from DB (reuse navbar composable) ---------
const { dbCategories } = useNavCategories()
const CATEGORIES = computed(() => dbCategories.value ?? [])
const CATEGORIES_ROW1 = computed(() => CATEGORIES.value.slice(0, 6))
const CATEGORIES_ROW2 = computed(() => CATEGORIES.value.slice(6))

const SORT_OPTIONS = [
  { value: 'newest',     label: '🕐 Terbaru'         },
  { value: 'oldest',     label: '⏳ Terlama'          },
  { value: 'price_asc',  label: '💰 Harga Terendah'  },
  { value: 'price_desc', label: '💎 Harga Tertinggi' },
]

// -- Condition list (always show all 5) ---------------------------
const conditionOptions = computed(() =>
  Object.keys(CONDITION_META).sort((a, b) => CONDITION_META[a].order - CONDITION_META[b].order)
)

// -- URL query helpers ---------------------------------------------
function updateQuery(patch) {
  const q = { ...route.query }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '') delete q[k]
    else q[k] = v
  }
  router.push({ query: q })
}

function toggleCategory(cat) {
  const cur  = activeCategory.value
  const next = cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat]
  updateQuery({ category: next.length ? next.join(',') : undefined })
}

function toggleCondition(k) {
  const cur  = activeCondition.value
  const next = cur.includes(k) ? cur.filter(c => c !== k) : [...cur, k]
  updateQuery({ condition: next.length ? next.join(',') : undefined })
}

function setSort(s) {
  updateQuery({ sort: s === 'newest' ? undefined : s })
}

function toggleNegotiable(n) {
  updateQuery({ negotiable: activeNegotiable.value === n ? undefined : n })
}

function toggleCod(c) {
  updateQuery({ cod: activeCod.value === c ? undefined : c })
}

function clearFilters() {
  navigateTo('/')
}

// -- Page helpers --------------------------------------------------
function handleSell() {
  if (!user.value) {
    showError.value = true
    clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { showError.value = false }, 3000)
    return
  }
  navigateTo('/products/create')
}

function scrollToCatalog() {
  document.getElementById('heading-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// -- Feed mode: "Semua" vs "Dari yang Diikuti" --------------------
const feedMode = ref('all') // 'all' | 'following'
const followingIds = ref([])

async function fetchFollowingIds() {
  if (!user.value) return
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.value.id)
  followingIds.value = (data ?? []).map(f => f.following_id)
}

// -- Recently viewed products --------------------------------------
const { recentProducts, fetchRecentProducts } = useRecentlyViewed()

// -- Cursor-based infinite scroll products query --------------------
const SORT_MAP = {
  newest:     { col: 'created_at', asc: false },
  oldest:     { col: 'created_at', asc: true  },
  price_asc:  { col: 'price',      asc: true  },
  price_desc: { col: 'price',      asc: false },
}

const PAGE_SIZE = 12
const products = ref([])
const productsLoading = ref(false)
const hasMore = ref(true)
const cursor = ref(null) // last item's sort value for cursor pagination

function buildQuery() {
  const hasCatFilter = activeCategory.value.length > 0
  const selectStr = `id, slug, title, price, condition, is_negotiable, is_cod, seller_id, created_at, updated_at,
    product_media ( media_url, media_type, thumbnail_url, is_primary ),
    users!products_seller_id_fkey ( id, name, nrp, faculty, department, avatar_url, gender ),
    ${hasCatFilter ? 'categories!inner(name)' : 'categories(name)'}`

  const sort = SORT_MAP[activeSort.value] ?? SORT_MAP.newest

  let query = supabase
    .from('products')
    .select(selectStr)
    .eq('status', 'active')
    .order(sort.col, { ascending: sort.asc })
    .order('id', { ascending: true }) // tiebreaker for stable cursor

  if (hasCatFilter)                     query = query.in('categories.name', activeCategory.value)
  if (activeCondition.value.length)     query = query.in('condition', activeCondition.value)
  if (activeNegotiable.value === 'yes') query = query.eq('is_negotiable', true)
  if (activeNegotiable.value === 'no')  query = query.eq('is_negotiable', false)
  if (activeCod.value  === 'yes')       query = query.eq('is_cod', true)
  if (activeCod.value  === 'no')        query = query.eq('is_cod', false)
  if (activeSearch.value)               query = query.textSearch('search_vector', activeSearch.value, { type: 'websearch', config: 'indonesian' })
  if (activeMinPrice.value != null)     query = query.gte('price', activeMinPrice.value)
  if (activeMaxPrice.value != null)     query = query.lte('price', activeMaxPrice.value)

  // Feed mode: filter to only sellers the user follows
  if (feedMode.value === 'following' && followingIds.value.length > 0) {
    query = query.in('seller_id', followingIds.value)
  }

  return { query, sort }
}

async function enrichWithRatings(data) {
  const sellerIds = [...new Set(data.map(p => p.users?.id).filter(Boolean))]
  const ratingsMap = {}
  if (sellerIds.length) {
    const { data: reviews } = await supabase
      .from('reviews')
      .select('reviewee_id, rating_seller')
      .in('reviewee_id', sellerIds)
    if (reviews) {
      for (const r of reviews) {
        if (!ratingsMap[r.reviewee_id]) ratingsMap[r.reviewee_id] = []
        ratingsMap[r.reviewee_id].push(r.rating_seller)
      }
    }
  }
  return data.map(p => {
    const uid = p.users?.id
    const arr = uid ? (ratingsMap[uid] ?? []) : []
    const avgRating = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    return { ...p, _sellerRating: avgRating, _ratingCount: arr.length }
  })
}

async function fetchProducts(reset = true) {
  if (productsLoading.value) return
  productsLoading.value = true

  if (reset) {
    products.value = []
    cursor.value = null
    hasMore.value = true
  }

  const { query, sort } = buildQuery()
  let q = query

  // Cursor: skip past items we already have
  if (cursor.value) {
    const op = sort.asc ? 'gt' : 'lt'
    q = q[op](sort.col, cursor.value)
  }

  const { data, error } = await q.limit(PAGE_SIZE)
  if (error) { console.error('[products]', error.message); productsLoading.value = false; return }

  if (!data?.length) {
    hasMore.value = false
    productsLoading.value = false
    return
  }

  const enriched = await enrichWithRatings(data)

  if (reset) {
    products.value = enriched
  } else {
    products.value = [...products.value, ...enriched]
  }

  // Update cursor to last item's sort column value
  const lastItem = data[data.length - 1]
  cursor.value = lastItem[sort.col]
  hasMore.value = data.length === PAGE_SIZE

  productsLoading.value = false
}

// Re-fetch from scratch when filters change
watch(
  [activeCategory, activeSearch, activeCondition, activeSort, activeNegotiable, activeCod, activeMinPrice, activeMaxPrice, feedMode],
  () => fetchProducts(true),
)

// -- Infinite scroll via IntersectionObserver -----------------------
const sentinelRef = ref(null)
let observer = null

function setupObserver() {
  if (observer) observer.disconnect()
  if (!sentinelRef.value) return
  observer = new IntersectionObserver(
    (entries) => { if (entries[0]?.isIntersecting && hasMore.value && !productsLoading.value) fetchProducts(false) },
    { rootMargin: '200px' }
  )
  observer.observe(sentinelRef.value)
}

const { fetchWishlist } = useWishlist()
onMounted(async () => {
  fetchProducts(true)
  window.addEventListener('resize', () => {}) // keep layout responsive
  if (user.value) {
    fetchWishlist()
    fetchFollowingIds()
  }
  fetchRecentProducts()
  nextTick(setupObserver)
})
onUnmounted(() => { if (observer) observer.disconnect() })

// Re-setup observer when sentinel element re-renders
watch(sentinelRef, () => nextTick(setupObserver))
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section class="vt-hero-bg relative w-full bg-blue-50 overflow-hidden min-h-[500px] flex items-center">
      <img
        src="/img/banner-1.png"
        alt="Banner VivaThrift"
        width="1920"
        height="600"
        fetchpriority="high"
        class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
      />

      <div class="vt-hero-overlay-left absolute inset-0 pointer-events-none bg-gradient-to-r from-white/95 via-white/50 to-transparent z-0"></div>
      <div class="vt-hero-dark-tint"></div>
      <div class="vt-hero-overlay-bottom absolute bottom-0 left-0 w-full h-24 pointer-events-none z-0"></div>

      <div class="relative w-full px-4 sm:px-6 md:px-10 flex flex-col md:flex-row items-center gap-8 z-10">
        <div class="flex-1 max-w-xl">
          <!-- ITS badge -->
          <a href="https://www.its.ac.id/" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 mb-4 w-fit">
            <img src="/img/logo-its.png" alt="ITS" width="28" height="28" class="h-7 opacity-75" />
            <span class="vt-its-badge-text text-xs font-semibold tracking-wider uppercase">Institut Teknologi Sepuluh Nopember</span>
          </a>
          <h1 class="vt-hero-heading font-heading text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 tracking-tight" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">
            Temukan <span class="vt-highlight">Barang Preloved</span> Berkualitas di Sekitar ITS!
          </h1>
          <p class="vt-hero-subtext text-lg mb-8 max-w-lg" :style="isDark ? 'color: rgba(148,163,184,0.9)' : 'color: rgba(30,58,138,0.75)'">
            Marketplace tepercaya khusus mahasiswa ITS. Jual beli buku mata kuliah, gadget, pakaian, hingga perlengkapan kos dengan mudah dan aman!
          </p>
          <div class="flex gap-3 relative">
            <button
              @click="scrollToCatalog"
              class="vt-btn-primary px-8 py-3 rounded-full text-white font-bold shadow-md transition hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5"
            style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
            >
              Mulai Jelajah
            </button>
            <button
              @click="handleSell"
              class="vt-btn-outline px-8 py-3 rounded-full border-2 font-bold bg-white/90 backdrop-blur-xs hover:bg-blue-50 transition hover:-translate-y-0.5"
            :style="isDark ? 'border-color: #38bdf8; color: #7dd3fc; background: rgba(15,23,42,0.60);' : 'border-color: #1e3a8a; color: #1e3a8a;'"
            >
              Jual Barang
            </button>

            <!-- Error notification -->
            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="opacity-0 translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-1"
            >
              <div
                v-if="showError"
                class="absolute top-full left-0 mt-2 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 shadow-md whitespace-nowrap z-50"
                style="background: linear-gradient(to right, #fef2f2, #fee2e2, #fecaca);"
              >
                Kamu harus login dulu untuk berjualan.
              </div>
            </Transition>
          </div>
        </div>
        <div class="flex-1 flex justify-center w-full"></div>
      </div>
    </section>

    <!-- Baru Saja Dilihat -->
    <section v-if="recentProducts.length" class="w-full px-4 sm:px-6 md:px-10 pt-10 pb-2">
      <h2 :ref="reveal" class="text-xl font-bold mb-4" :class="isDark ? 'text-white' : 'text-[#1e3a8a]'">
        🕐 Baru Saja Dilihat
      </h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        <ProductCard
          v-for="rp in recentProducts"
          :key="rp.id"
          :product="rp"
          :show-seller="true"
          @seller-click="(uid) => profileCardUserId = uid"
        />
      </div>
    </section>

    <!-- Katalog -->
    <section id="katalog" class="w-full px-4 sm:px-6 md:px-10 py-12">

      <!-- Heading -->
      <div id="heading-catalog" :ref="reveal" class="flex items-center gap-3 mb-5 flex-wrap" style="scroll-margin-top: 80px;">
        <h2 class="vt-katalog-heading text-2xl font-bold text-[#1e3a8a] dark:text-white">
          <template v-if="activeSearch">
            Hasil pencarian &ldquo;{{ activeSearch }}&rdquo;<template v-if="activeCategory.length"> &mdash; {{ activeCategory.join(', ') }}</template>
          </template>
          <template v-else-if="activeCategory.length">{{ activeCategory.join(', ') }}</template>
          <template v-else>Cari barang preloved impianmu!</template>
        </h2>
        <button
          v-if="hasActiveFilter || activeSearch"
          @click="clearFilters"
          class="vt-clear-filter-btn flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-full px-3 py-0.5 transition"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
          Hapus filter
        </button>
        <div class="ml-auto flex items-center gap-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Urutkan</label>
          <select
            :value="activeSort"
            @change="setSort($event.target.value)"
            class="vt-sort-select text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:border-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 cursor-pointer"
          >
            <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- Feed Mode Toggle -->
      <div v-if="user" class="flex items-center gap-1 mb-5 border-b" :class="isDark ? 'border-white/10' : 'border-gray-200'">
        <button
          @click="feedMode = 'all'"
          class="px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px"
          :class="feedMode === 'all'
            ? (isDark ? 'border-sky-400 text-sky-400' : 'border-blue-800 text-blue-800')
            : (isDark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600')"
        >
          Semua
        </button>
        <button
          @click="feedMode = 'following'"
          class="px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px flex items-center gap-1.5"
          :class="feedMode === 'following'
            ? (isDark ? 'border-sky-400 text-sky-400' : 'border-blue-800 text-blue-800')
            : (isDark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Dari yang Diikuti
        </button>
      </div>

      <!-- Empty following state -->
      <div v-if="feedMode === 'following' && !productsLoading && products.length === 0 && followingIds.length === 0" class="flex flex-col items-center py-16 gap-3 mb-8">
        <img src="/img/illustrations/empty-cart.svg" alt="Belum mengikuti" width="176" height="176" loading="lazy" class="w-44 h-auto opacity-80" />
        <p class="text-gray-500 dark:text-gray-400 font-semibold text-lg">Belum mengikuti siapapun</p>
        <p class="text-gray-400 dark:text-gray-500 text-sm">Ikuti penjual untuk melihat barang mereka di sini.</p>
      </div>

      <!-- Filter Panel -->
      <div :ref="reveal" data-delay="100" class="vt-filter-panel rounded-xl p-4 mb-8 space-y-3" :style="isDark ? 'background: rgba(15,23,42,0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 4px 16px rgba(0,0,0,0.3);' : 'background: rgba(255,255,255,0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 16px rgba(30,58,138,0.08);'">

        <!-- Kategori -->
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span :class="['vt-filter-label text-xs font-semibold uppercase tracking-wide w-20 shrink-0', isDark ? 'text-slate-400' : 'text-gray-500']">Kategori</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="cat in CATEGORIES_ROW1"
                :key="cat"
                @click="toggleCategory(cat)"
                :class="[
                  'px-3 py-1 rounded-full text-sm border transition',
                  activeCategory.includes(cat)
                    ? 'vt-btn-primary text-white border-transparent'
                    : isDark ? 'text-slate-300 border-slate-600 hover:border-blue-400 hover:text-blue-300' : 'vt-filter-tag text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700'
                ]"
                :style="activeCategory.includes(cat) ? 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);' : isDark ? 'background: rgba(30,58,138,0.35);' : 'background: rgba(255,255,255,0.70);'"
              >{{ categoryLabel(cat) }}</button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-20 shrink-0"></span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="cat in CATEGORIES_ROW2"
                :key="cat"
                @click="toggleCategory(cat)"
                :class="[
                  'px-3 py-1 rounded-full text-sm border transition',
                  activeCategory.includes(cat)
                    ? 'vt-btn-primary text-white border-transparent'
                    : isDark ? 'text-slate-300 border-slate-600 hover:border-blue-400 hover:text-blue-300' : 'vt-filter-tag text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700'
                ]"
                :style="activeCategory.includes(cat) ? 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);' : isDark ? 'background: rgba(30,58,138,0.35);' : 'background: rgba(255,255,255,0.70);'"
              >{{ categoryLabel(cat) }}</button>
            </div>
          </div>
        </div>

        <!-- Kondisi -->
        <div v-if="conditionOptions && conditionOptions.length" class="flex flex-wrap items-center gap-2">
          <span :class="['vt-filter-label text-xs font-semibold uppercase tracking-wide w-20 shrink-0', isDark ? 'text-slate-400' : 'text-gray-500']">Kondisi</span>
          <button
            v-for="k in conditionOptions"
            :key="k"
            @click="toggleCondition(k)"
            :class="[
              'px-3 py-1 rounded-full text-sm border transition',
              activeCondition.includes(k)
                ? 'vt-btn-primary text-white border-transparent'
                : isDark ? 'text-slate-300 border-slate-600 hover:border-blue-400 hover:text-blue-300' : 'vt-filter-tag text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700'
            ]"
            :style="activeCondition.includes(k) ? 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);' : isDark ? 'background: rgba(30,58,138,0.35);' : 'background: rgba(255,255,255,0.70);'"
          >{{ conditionLabel(k) }}</button>
        </div>

        <!-- Nego -->
        <div class="flex flex-wrap items-center gap-2">
          <span :class="['vt-filter-label text-xs font-semibold uppercase tracking-wide w-20 shrink-0', isDark ? 'text-slate-400' : 'text-gray-500']">Nego</span>
          <button
            @click="toggleNegotiable('yes')"
            :class="[
              'px-3 py-1 rounded-full text-sm border transition',
              activeNegotiable === 'yes'
                ? 'vt-btn-primary text-white border-transparent'
                : isDark ? 'text-slate-300 border-slate-600 hover:border-green-400 hover:text-green-300' : 'vt-filter-tag text-gray-600 border-gray-200 hover:border-green-500 hover:text-green-700'
            ]"
            :style="activeNegotiable === 'yes' ? 'background: linear-gradient(to right, #14532d, #16a34a, #4ade80);' : isDark ? 'background: rgba(20,83,45,0.40);' : 'background: rgba(255,255,255,0.70);'"
          >🤝 Bisa Nego</button>
          <button
            @click="toggleNegotiable('no')"
            :class="[
              'px-3 py-1 rounded-full text-sm border transition',
              activeNegotiable === 'no'
                ? 'text-white border-transparent'
                : isDark ? 'text-slate-300 border-slate-600 hover:border-red-400 hover:text-red-300' : 'vt-filter-tag text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-600'
            ]"
            :style="activeNegotiable === 'no' ? 'background: linear-gradient(to right, #7f1d1d, #dc2626, #f87171);' : isDark ? 'background: rgba(20,83,45,0.40);' : 'background: rgba(255,255,255,0.70);'"
          >🚫 Tidak Nego</button>
        </div>

        <!-- COD -->
        <div class="flex flex-wrap items-center gap-2">
          <span :class="['vt-filter-label text-xs font-semibold uppercase tracking-wide w-20 shrink-0', isDark ? 'text-slate-400' : 'text-gray-500']">COD</span>
          <button
            @click="toggleCod('yes')"
            :class="[
              'px-3 py-1 rounded-full text-sm border transition',
              activeCod === 'yes'
                ? 'vt-btn-primary text-white border-transparent'
                : isDark ? 'text-slate-300 border-slate-600 hover:border-green-400 hover:text-green-300' : 'vt-filter-tag text-gray-600 border-gray-200 hover:border-green-500 hover:text-green-700'
            ]"
            :style="activeCod === 'yes' ? 'background: linear-gradient(to right, #14532d, #16a34a, #4ade80);' : isDark ? 'background: rgba(20,83,45,0.40);' : 'background: rgba(255,255,255,0.70);'"
          >🚲 Tersedia COD</button>
          <button
            @click="toggleCod('no')"
            :class="[
              'px-3 py-1 rounded-full text-sm border transition',
              activeCod === 'no'
                ? 'text-white border-transparent'
                : isDark ? 'text-slate-300 border-slate-600 hover:border-red-400 hover:text-red-300' : 'vt-filter-tag text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-600'
            ]"
            :style="activeCod === 'no' ? 'background: linear-gradient(to right, #7f1d1d, #dc2626, #f87171);' : isDark ? 'background: rgba(20,83,45,0.40);' : 'background: rgba(255,255,255,0.70);'"
          >🚧 Non COD</button>
        </div>

        <!-- Harga -->
        <div class="flex flex-wrap items-center gap-2">
          <span :class="['vt-filter-label text-xs font-semibold uppercase tracking-wide w-20 shrink-0', isDark ? 'text-slate-400' : 'text-gray-500']">Harga</span>
          <div class="flex items-center gap-2">
            <input
              v-model="minPriceInput"
              type="number"
              min="0"
              placeholder="Min"
              class="w-28 px-3 py-1 rounded-full text-sm border transition focus:outline-none focus:ring-1"
              :class="isDark
                ? 'bg-slate-800/80 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/40 focus:border-sky-400'
                : 'bg-white/70 border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-400/40 focus:border-blue-400'"
              @keyup.enter="applyPriceFilter"
            />
            <span class="text-xs" :class="isDark ? 'text-slate-500' : 'text-gray-400'">—</span>
            <input
              v-model="maxPriceInput"
              type="number"
              min="0"
              placeholder="Max"
              class="w-28 px-3 py-1 rounded-full text-sm border transition focus:outline-none focus:ring-1"
              :class="isDark
                ? 'bg-slate-800/80 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/40 focus:border-sky-400'
                : 'bg-white/70 border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-400/40 focus:border-blue-400'"
              @keyup.enter="applyPriceFilter"
            />
            <button
              @click="applyPriceFilter"
              class="px-3 py-1 rounded-full text-xs font-bold text-white transition hover:opacity-90"
              :style="isDark
                ? 'background: linear-gradient(to right, #0ea5e9, #38bdf8, #7dd3fc);'
                : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);'"
            >Terapkan</button>
          </div>
        </div>

      </div>

      <!-- Product Grid Skeleton (initial load) -->
      <div v-if="productsLoading && products.length === 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
        <div
          v-for="i in 12"
          :key="i"
          class="vt-product-card rounded-xl border shadow-xs flex flex-col overflow-hidden animate-pulse"
          :class="isDark ? 'border-white/10 bg-slate-900/70' : 'border-white/50 bg-white/70'"
        >
          <div class="relative overflow-hidden rounded-t-xl">
            <div class="aspect-square w-full rounded-t-xl" :class="isDark ? 'bg-slate-800' : 'bg-slate-200'" />

            <div class="absolute top-2 left-2 flex flex-col items-start gap-1">
              <div class="h-5 w-16 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-white/80'" />
              <div class="h-5 w-14 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-white/80'" />
            </div>

            <div class="absolute bottom-2 right-2">
              <div class="h-5 w-[4.5rem] rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-white/80'" />
            </div>
          </div>

          <div class="p-3 flex flex-col gap-2 flex-1">
            <div class="space-y-2">
              <div class="h-4 w-11/12 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
              <div class="h-4 w-7/12 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
            </div>

            <div class="h-6 w-1/2 rounded-full" :class="isDark ? 'bg-slate-600' : 'bg-slate-300'" />

            <div class="h-px w-full" :class="isDark ? 'bg-white/10' : 'bg-gray-100'" />

            <div class="flex items-center gap-2 rounded-lg -mx-1 px-1 py-0.5">
              <div class="w-8 h-8 rounded-full shrink-0" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="h-3 w-24 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
                <div class="h-3 w-20 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
                <div class="h-3 w-28 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
              </div>
            </div>

            <div class="h-px w-full" :class="isDark ? 'bg-white/10' : 'bg-gray-100'" />

            <div class="flex justify-end">
              <div class="space-y-1.5 flex flex-col items-end">
                <div class="h-3 w-16 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
                <div class="h-3 w-12 rounded-full" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Product Grid -->
      <div v-else :ref="reveal" class="vt-stagger-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :product="product"
          :show-seller="true"
          @seller-click="(uid) => profileCardUserId = uid"
        />

        <div v-if="!productsLoading && products.length === 0" class="col-span-full flex flex-col items-center justify-center py-20 gap-3">
          <img src="/img/illustrations/empty-cart.svg" alt="Belum ada produk" width="208" height="208" loading="lazy" class="w-52 h-auto opacity-80" />
          <p class="text-gray-500 dark:text-gray-400 font-semibold text-lg mt-2">Belum ada produk tersedia</p>
          <p class="text-gray-400 dark:text-gray-500 text-sm">Jadilah yang pertama menjual barang di sini!</p>
        </div>
      </div>

      <!-- Infinite scroll sentinel + loading indicator -->
      <div ref="sentinelRef" class="flex justify-center py-8">
        <div v-if="productsLoading" class="flex items-center gap-2">
          <div class="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" :class="isDark ? 'border-sky-400' : 'border-blue-800'"></div>
          <span class="text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-400'">Memuat produk…</span>
        </div>
        <p v-else-if="!hasMore && products.length > 0" class="text-xs" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
          Semua produk sudah ditampilkan ({{ products.length }} item)
        </p>
      </div>

    </section>

    <!-- Profile Card Modal -->
    <ProfileCard
      v-if="profileCardUserId"
      :user-id="profileCardUserId"
      @close="profileCardUserId = null"
    />
  </div>
</template>
