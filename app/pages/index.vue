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

const hasActiveFilter = computed(() =>
  activeCategory.value.length > 0 ||
  activeCondition.value.length  > 0 ||
  activeNegotiable.value !== null       ||
  activeCod.value  !== null       ||
  activeSort.value !== 'newest'
)

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

// -- Products query ------------------------------------------------
const SORT_MAP = {
  newest:     { col: 'created_at', asc: false },
  oldest:     { col: 'created_at', asc: true  },
  price_asc:  { col: 'price',      asc: true  },
  price_desc: { col: 'price',      asc: false },
}

const { data: products } = useAsyncData(
  () => `products-${activeCategory.value.join(',')}-${activeSearch.value ?? ''}-${activeCondition.value.join(',')}-${activeSort.value}-${activeNegotiable.value ?? ''}-${activeCod.value ?? ''}`,
  async () => {
    const hasCatFilter = activeCategory.value.length > 0
    const selectStr = `id, slug, title, price, condition, is_negotiable, is_cod, seller_id, created_at, updated_at,
      product_media ( media_url, media_type, thumbnail_url, is_primary ),
      users ( id, name, nrp, faculty, department, avatar_url, gender ),
      ${hasCatFilter ? 'categories!inner(name)' : 'categories(name)'}`

    const sort = SORT_MAP[activeSort.value] ?? SORT_MAP.newest

    let query = supabase
      .from('products')
      .select(selectStr)
      .eq('status', 'active')
      .order(sort.col, { ascending: sort.asc })

    if (hasCatFilter)                     query = query.in('categories.name', activeCategory.value)
    if (activeCondition.value.length)     query = query.in('condition', activeCondition.value)
    if (activeNegotiable.value === 'yes') query = query.eq('is_negotiable', true)
    if (activeNegotiable.value === 'no')  query = query.eq('is_negotiable', false)
    if (activeCod.value  === 'yes')       query = query.eq('is_cod', true)
    if (activeCod.value  === 'no')        query = query.eq('is_cod', false)
    if (activeSearch.value)           query = query.textSearch('search_vector', activeSearch.value, { type: 'websearch', config: 'indonesian' })

    const isFiltered = hasCatFilter || activeSearch.value || activeCondition.value.length || activeNegotiable.value || activeCod.value
    const { data, error } = await query.limit(isFiltered ? 50 : 12)
    if (error) { console.error('[products]', error.message, error.details); return [] }
    if (!data?.length) return []

    // Batch-fetch avg seller ratings from reviews table
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
  },
  { lazy: true, watch: [activeCategory, activeSearch, activeCondition, activeSort, activeNegotiable, activeCod] }
)

// -- Show more -----------------------------------------------------
const showAll = ref(false)

const gridCols = ref(4)
function updateGridCols() {
  const w = window.innerWidth
  if (w >= 1536) gridCols.value = 6
  else if (w >= 1280) gridCols.value = 5
  else if (w >= 1024) gridCols.value = 4
  else if (w >= 768)  gridCols.value = 3
  else if (w >= 640)  gridCols.value = 2
  else gridCols.value = 1
}
const { fetchWishlist } = useWishlist()
onMounted(() => {
  updateGridCols()
  window.addEventListener('resize', updateGridCols)
  if (user.value) fetchWishlist()
})
onUnmounted(() => window.removeEventListener('resize', updateGridCols))

const maxVisible = computed(() => gridCols.value * 4)

const visibleProducts = computed(() => {
  const list = products.value ?? []
  return showAll.value ? list : list.slice(0, maxVisible.value)
})

watch([activeCategory, activeSearch, activeCondition, activeSort, activeNegotiable, activeCod], () => {
  showAll.value = false
})
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

      </div>

      <!-- Product Grid -->
      <div :ref="reveal" class="vt-stagger-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
        <ProductCard
          v-for="product in visibleProducts"
          :key="product.id"
          :product="product"
          :show-seller="true"
          @seller-click="(uid) => profileCardUserId = uid"
        />

        <div v-if="!products || products.length === 0" class="col-span-full flex flex-col items-center justify-center py-20 gap-3">
          <img src="/img/illustrations/empty-cart.svg" alt="Belum ada produk" width="208" height="208" loading="lazy" class="w-52 h-auto opacity-80" />
          <p class="text-gray-500 dark:text-gray-400 font-semibold text-lg mt-2">Belum ada produk tersedia</p>
          <p class="text-gray-400 dark:text-gray-500 text-sm">Jadilah yang pertama menjual barang di sini!</p>
        </div>
      </div>

      <!-- Tampilkan lebih banyak -->
      <div v-if="(products?.length ?? 0) > maxVisible && !showAll" class="flex justify-center mt-6">
        <button
          @click="showAll = true"
          class="vt-btn-show-more px-8 py-2.5 rounded-full border-2 font-semibold text-sm transition hover:bg-blue-50"
          :style="isDark ? 'border-color: #38bdf8; color: #7dd3fc;' : 'border-color: #1e3a8a; color: #1e3a8a;'"
        >
          Tampilkan lebih banyak ({{ (products?.length ?? 0) - maxVisible }} produk lagi)
        </button>
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
