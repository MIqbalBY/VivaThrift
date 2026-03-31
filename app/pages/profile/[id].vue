<script setup>
useSeoMeta({ title: 'Profil — VivaThrift' })

const route = useRoute()
const supabase = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark } = useDarkMode()

const profileId = route.params.id
const currentUserId = ref(null)

// ── Fetch profile ────────────────────────────────────────────────────────────
const { data: profile, error: profileError } = await useAsyncData(`profile-${profileId}`, async () => {
  const { data } = await supabase
    .from('users')
    .select('id, name, nrp, faculty, department, avatar_url, gender')
    .eq('id', profileId)
    .single()
  return data
})

// ── Fetch seller rating ──────────────────────────────────────────────────────
const sellerRating = ref(null)
const ratingCount = ref(0)
useAsyncData(`profile-rating-${profileId}`, async () => {
  const { data } = await supabase
    .from('reviews')
    .select('rating_seller')
    .eq('reviewee_id', profileId)
  const arr = (data ?? []).map(r => r.rating_seller).filter(v => v != null)
  ratingCount.value = arr.length
  sellerRating.value = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
})

// ── Fetch follow counts ──────────────────────────────────────────────────────
const followersCount = ref(0)
const followingCount = ref(0)
useAsyncData(`profile-follows-${profileId}`, async () => {
  const [{ count: fc }, { count: fgc }] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profileId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profileId),
  ])
  followersCount.value = fc ?? 0
  followingCount.value = fgc ?? 0
})

// ── Fetch products (all statuses) ────────────────────────────────────────────
const { data: products } = await useAsyncData(`profile-products-${profileId}`, async () => {
  const { data } = await supabase
    .from('products')
    .select(`
      id, slug, title, price, condition, is_negotiable, is_cod, created_at, updated_at, status, stock,
      product_media ( media_url, media_type, thumbnail_url, is_primary ),
      categories ( name )
    `)
    .eq('seller_id', profileId)
    .in('status', ['active', 'sold'])
    .order('created_at', { ascending: false })
  return data ?? []
})

const productTab = ref('dijual')
const activeProducts = computed(() => (products.value ?? []).filter(p => p.status === 'active' && (p.stock === null || p.stock > 0)))
const soldProducts   = computed(() => (products.value ?? []).filter(p => p.status === 'sold'  || (p.stock !== null && p.stock === 0)))
const shownProducts  = computed(() => productTab.value === 'dijual' ? activeProducts.value : soldProducts.value)

// ── Follow state ─────────────────────────────────────────────────────────────
const isFollowing = ref(false)
const followLoading = ref(false)
const isSelf = computed(() => !!currentUserId.value && currentUserId.value === profileId)

// ── Helpers ──────────────────────────────────────────────────────────────────

const profileInitials = computed(() => {
  const name = profile.value?.name ?? ''
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
})

async function toggleFollow() {
  if (!currentUserId.value) return navigateTo('/auth/signin')
  followLoading.value = true
  if (isFollowing.value) {
    await supabase.from('follows').delete()
      .eq('follower_id', currentUserId.value)
      .eq('following_id', profileId)
    isFollowing.value = false
    followersCount.value = Math.max(0, followersCount.value - 1)
  } else {
    await supabase.from('follows').insert({
      follower_id: currentUserId.value,
      following_id: profileId,
    })
    isFollowing.value = true
    followersCount.value += 1
  }
  followLoading.value = false
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  currentUserId.value = session?.user?.id ?? currentUser.value?.id ?? null

  if (currentUserId.value && currentUserId.value !== profileId) {
    const { data: f } = await supabase
      .from('follows').select('id')
      .eq('follower_id', currentUserId.value)
      .eq('following_id', profileId)
      .maybeSingle()
    isFollowing.value = !!f
  }
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto px-4 md:px-8 py-8">

    <!-- Back -->
    <button
      @click="$router.back()"
      class="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a8a] dark:hover:text-sky-400 transition"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      Kembali
    </button>

    <!-- Not found -->
    <div v-if="!profile" class="text-center py-24 text-gray-400">
      <span class="text-5xl block mb-3">🤷</span>
      Profil tidak ditemukan.
    </div>

    <template v-else>
      <!-- ── Profile Header Card ────────────────────────────────────────────── -->
      <div
        class="rounded-3xl p-6 mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6"
        :style="isDark
          ? 'background: linear-gradient(160deg,#0f172a,#1e293b); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 32px rgba(0,0,0,0.4);'
          : 'background: rgba(255,255,255,0.80); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 24px rgba(30,58,138,0.10);'"
      >
        <!-- Avatar -->
        <div
          class="w-24 h-24 rounded-full border-4 overflow-hidden flex items-center justify-center shrink-0"
          :style="isDark
            ? 'border-color: rgba(14,165,233,0.4); background: linear-gradient(135deg,#0ea5e9,#38bdf8);'
            : 'border-color: rgba(30,58,138,0.15); background: linear-gradient(135deg,#1e3a8a,#2563eb);'"
        >
          <img v-if="profile.avatar_url" :src="profile.avatar_url" class="w-full h-full object-cover" />
          <span v-else class="text-white text-2xl font-bold select-none">{{ profileInitials }}</span>
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0 flex flex-col gap-2 items-center sm:items-start text-center sm:text-left">
          <div>
            <h1 class="text-xl font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">
              {{ profile.name }}
              <span v-if="profile.gender === 'Laki-laki'" title="Laki-laki">♂️</span>
              <span v-else-if="profile.gender === 'Perempuan'" title="Perempuan">♀️</span>
            </h1>
            <p class="text-sm font-medium" :class="isDark ? 'text-sky-300' : 'text-blue-700'">
              {{ profile.nrp ?? '-' }}
            </p>
            <p v-if="profile.faculty || profile.department" class="text-sm" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
              {{ [fakultasAkronim(profile.faculty), profile.department].filter(Boolean).join(' · ') }}
            </p>
          </div>

          <!-- Rating -->
          <div class="flex items-center gap-1.5">
            <svg class="w-4 h-4 text-yellow-400 fill-current shrink-0" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <template v-if="ratingCount > 0">
              <span class="text-sm font-semibold" :class="isDark ? 'text-gray-200' : 'text-gray-700'">{{ sellerRating.toFixed(1) }}</span>
              <span class="text-xs" :class="isDark ? 'text-gray-500' : 'text-gray-400'">/&nbsp;5.0</span>
              <span class="text-xs" :class="isDark ? 'text-gray-500' : 'text-gray-400'">({{ ratingCount }} ulasan)</span>
            </template>
            <span v-else class="text-xs" :class="isDark ? 'text-gray-500' : 'text-gray-400'">Belum ada ulasan</span>
          </div>

          <!-- Stats: followers · following -->
          <div class="flex items-center gap-5">
            <div class="text-center sm:text-left">
              <span class="text-base font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ followersCount }}</span>
              <span class="text-xs ml-1" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Pengikut</span>
            </div>
            <div class="w-px h-5" :class="isDark ? 'bg-white/10' : 'bg-gray-200'"></div>
            <div class="text-center sm:text-left">
              <span class="text-base font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ followingCount }}</span>
              <span class="text-xs ml-1" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Diikuti</span>
            </div>
            <div class="w-px h-5" :class="isDark ? 'bg-white/10' : 'bg-gray-200'"></div>
            <div class="text-center sm:text-left">
              <span class="text-base font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ products?.length ?? 0 }}</span>
              <span class="text-xs ml-1" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Listing</span>
            </div>
          </div>
        </div>

        <!-- Follow button (right side on desktop) -->
        <div v-if="!isSelf" class="shrink-0">
          <button
            @click="toggleFollow"
            :disabled="followLoading"
            class="px-6 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 min-w-[110px] flex items-center justify-center gap-2"
            :style="isFollowing
              ? (isDark ? 'background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8;' : 'background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b;')
              : (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8); color: #fff; border: none;' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb); color: #fff; border: none;')"
          >
            <svg v-if="followLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <template v-else>
              <span v-if="isFollowing">✓ Mengikuti</span>
              <span v-else>+ Ikuti</span>
            </template>
          </button>
        </div>
        <div v-else class="shrink-0">
          <NuxtLink
            to="/profile/edit"
            class="px-6 py-2.5 rounded-xl text-sm font-bold transition"
            :style="isDark
              ? 'border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; background: rgba(255,255,255,0.05);'
              : 'border: 1px solid rgba(30,58,138,0.20); color: #1e3a8a; background: transparent;'"
          >
            Edit Profil
          </NuxtLink>
        </div>
      </div>

      <!-- ── Products Grid ─────────────────────────────────────────────────── -->
      <div>
        <!-- Instagram-style tabs -->
        <div class="flex border-b mb-5" :class="isDark ? 'border-white/10' : 'border-gray-200'">
          <button
            @click="productTab = 'dijual'"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px"
            :class="productTab === 'dijual'
              ? (isDark ? 'border-sky-400 text-sky-400' : 'border-blue-800 text-blue-800')
              : (isDark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            Dijual
            <span class="text-xs px-1.5 py-0.5 rounded-full" :class="isDark ? 'bg-white/10' : 'bg-gray-100'">{{ activeProducts.length }}</span>
          </button>
          <button
            @click="productTab = 'terjual'"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px"
            :class="productTab === 'terjual'
              ? (isDark ? 'border-sky-400 text-sky-400' : 'border-blue-800 text-blue-800')
              : (isDark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Terjual / Habis
            <span class="text-xs px-1.5 py-0.5 rounded-full" :class="isDark ? 'bg-white/10' : 'bg-gray-100'">{{ soldProducts.length }}</span>
          </button>
        </div>

        <div v-if="!shownProducts.length" class="text-center py-16" :class="isDark ? 'text-gray-500' : 'text-gray-400'">
          <span class="text-5xl block mb-3">{{ productTab === 'dijual' ? '📭' : '🏷️' }}</span>
          {{ productTab === 'dijual' ? 'Belum ada barang yang dijual.' : 'Belum ada barang yang terjual/habis.' }}
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <ProductCard
            v-for="p in shownProducts"
            :key="p.id"
            :product="p"
            :is-sold="productTab === 'terjual'"
          />
        </div>
      </div>
    </template>
  </div>
</template>
