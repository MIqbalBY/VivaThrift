<script setup>
const route = useRoute()
const supabase = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark } = useDarkMode()
const { reveal } = useScrollReveal()

const profileId = computed(() => route.params.id)
const currentUserId = ref(null)

// Determine if param is a username (not a UUID)
const isUUID = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

// ── Fetch profile ────────────────────────────────────────────────────────────────────
const { data: profile } = await useAsyncData(`profile-${route.params.id}`, async () => {
  const paramVal = profileId.value
  let query = supabase
    .from('users')
    .select('id, name, username, nrp, faculty, department, avatar_url, gender, bio, created_at')
  if (isUUID(paramVal)) {
    query = query.eq('id', paramVal)
  } else {
    // Strip leading @ if present
    const uname = paramVal.startsWith('@') ? paramVal.slice(1) : paramVal
    query = query.eq('username', uname.toLowerCase())
  }
  const { data } = await query.single()
  return data
}, { watch: [profileId] })

useHead({ title: computed(() => profile.value?.name ? `${profile.value.name} — VivaThrift` : 'Profil — VivaThrift') })

// ── Resolved profile user ID (always UUID after fetch) ──────────────────────
const resolvedId = computed(() => profile.value?.id ?? profileId.value)

// ── Fetch seller rating ──────────────────────────────────────────────────────
const sellerRating = ref(null)
const ratingCount = ref(0)
useAsyncData(`profile-rating-${route.params.id}`, async () => {
  if (!resolvedId.value) return
  const { data } = await supabase
    .from('reviews')
    .select('rating_seller')
    .eq('reviewee_id', resolvedId.value)
  const arr = (data ?? []).map(r => r.rating_seller).filter(v => v != null)
  ratingCount.value = arr.length
  sellerRating.value = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
})

// ── Fetch follow counts ──────────────────────────────────────────────────────
const followersCount = ref(0)
const followingCount = ref(0)
useAsyncData(`profile-follows-${route.params.id}`, async () => {
  if (!resolvedId.value) return
  const [{ count: fc }, { count: fgc }] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', resolvedId.value),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', resolvedId.value),
  ])
  followersCount.value = fc ?? 0
  followingCount.value = fgc ?? 0
})

// ── Fetch products (all statuses) ────────────────────────────────────────────
const { data: products } = await useAsyncData(`profile-products-${route.params.id}`, async () => {
  const { data } = await supabase
    .from('products')
    .select(`
      id, slug, title, price, condition, is_negotiable, is_cod, created_at, updated_at, status, stock,
      product_media ( media_url, media_type, thumbnail_url, is_primary ),
      categories ( name )
    `)
    .eq('seller_id', resolvedId.value)
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
const isSelf = computed(() => !!currentUserId.value && currentUserId.value === resolvedId.value)

// ── Helpers ──────────────────────────────────────────────────────────────────

const profileInitials = computed(() => {
  const name = profile.value?.name ?? ''
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
})

const joinedDate = computed(() => {
  if (!profile.value?.created_at) return null
  return new Date(profile.value.created_at).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})

async function toggleFollow() {
  if (!currentUserId.value) return navigateTo('/auth/signin')
  followLoading.value = true
  if (isFollowing.value) {
    await supabase.from('follows').delete()
      .eq('follower_id', currentUserId.value)
      .eq('following_id', resolvedId.value)
    isFollowing.value = false
    followersCount.value = Math.max(0, followersCount.value - 1)
  } else {
    await supabase.from('follows').insert({
      follower_id: currentUserId.value,
      following_id: resolvedId.value,
    })
    isFollowing.value = true
    followersCount.value += 1
  }
  followLoading.value = false
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  currentUserId.value = session?.user?.id ?? currentUser.value?.id ?? null

  if (currentUserId.value && currentUserId.value !== resolvedId.value) {
    const { data: f } = await supabase
      .from('follows').select('id')
      .eq('follower_id', currentUserId.value)
      .eq('following_id', resolvedId.value)
      .maybeSingle()
    isFollowing.value = !!f
  }
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto px-4 md:px-8 py-6">

    <!-- Back -->
    <button
      @click="$router.back()"
      class="mb-5 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a8a] dark:hover:text-sky-400 transition"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      Kembali
    </button>

    <!-- Not found -->
    <div v-if="!profile" class="flex flex-col items-center text-center py-24 text-gray-400">
      <img src="/img/illustrations/not-found.svg" alt="Profil tidak ditemukan" class="w-48 h-auto opacity-80 mb-4" />
      Profil tidak ditemukan.
    </div>

    <template v-else>

      <!-- ══ INSTAGRAM-STYLE PROFILE HEADER ══════════════════════════════════ -->
      <div class="vt-hero-enter vt-hero-enter-d1 flex items-start gap-6 sm:gap-10 mb-6">
        <!-- Avatar (left) -->
        <div class="shrink-0">
          <div
            class="w-20 h-20 sm:w-[120px] sm:h-[120px] rounded-full border-[3px] overflow-hidden flex items-center justify-center"
            :style="isDark
              ? 'border-color: rgba(14,165,233,0.5); background: linear-gradient(135deg,#0ea5e9,#38bdf8);'
              : 'border-color: rgba(30,58,138,0.18); background: linear-gradient(135deg,#1e3a8a,#2563eb);'"
          >
            <img v-if="profile.avatar_url" :src="profile.avatar_url" class="w-full h-full object-cover" />
            <span v-else class="text-white text-xl sm:text-3xl font-bold select-none">{{ profileInitials }}</span>
          </div>
        </div>

        <!-- Right side: name + stats + buttons -->
        <div class="flex-1 min-w-0 pt-1">
          <!-- Name row -->
          <div class="flex flex-wrap items-center gap-3 mb-1">
            <h1 class="text-lg sm:text-xl font-bold truncate" :class="isDark ? 'text-white' : 'text-gray-900'">
              {{ profile.name }}
              <span v-if="profile.gender === 'Laki-laki'" title="Laki-laki" class="text-base">♂️</span>
              <span v-else-if="profile.gender === 'Perempuan'" title="Perempuan" class="text-base">♀️</span>
            </h1>
          </div>
          <!-- Username -->
          <p v-if="profile.username" class="text-sm mb-3" :class="isDark ? 'text-sky-400' : 'text-blue-700'">@{{ profile.username }}</p>
          <div v-else class="mb-3"></div>

          <!-- Action buttons (desktop inline) -->
            <div class="hidden sm:flex items-center gap-2">
              <template v-if="!isSelf">
                <button
                  @click="toggleFollow"
                  :disabled="followLoading"
                  class="px-5 py-1.5 rounded-lg text-sm font-bold transition disabled:opacity-50"
                  :style="isFollowing
                    ? (isDark ? 'background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8;' : 'background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b;')
                    : (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8); color: #fff; border: none;' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb); color: #fff; border: none;')"
                >
                  <svg v-if="followLoading" class="w-4 h-4 animate-spin inline mr-1" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  <template v-else>{{ isFollowing ? '✓ Mengikuti' : '+ Ikuti' }}</template>
                </button>
              </template>
              <NuxtLink
                v-else
                to="/profile/edit"
                class="px-5 py-1.5 rounded-lg text-sm font-bold transition"
                :style="isDark
                  ? 'border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; background: rgba(255,255,255,0.05);'
                  : 'border: 1px solid rgba(30,58,138,0.20); color: #1e3a8a; background: #f8fafc;'"
              >
                Edit Profil
              </NuxtLink>
            </div>

          <!-- Stats row (desktop) -->
          <div class="hidden sm:flex items-center gap-6 mb-3">
            <div>
              <span class="font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ products?.length ?? 0 }}</span>
              <span class="ml-1" :class="isDark ? 'text-gray-400' : 'text-gray-500'">postingan</span>
            </div>
            <div>
              <span class="font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ followersCount }}</span>
              <span class="ml-1" :class="isDark ? 'text-gray-400' : 'text-gray-500'">pengikut</span>
            </div>
            <div>
              <span class="font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ followingCount }}</span>
              <span class="ml-1" :class="isDark ? 'text-gray-400' : 'text-gray-500'">mengikuti</span>
            </div>
          </div>

          <!-- NRP + Faculty (desktop) -->
          <div class="hidden sm:block">
            <p class="text-sm font-semibold" :class="isDark ? 'text-sky-300' : 'text-blue-700'">
              {{ profile.nrp ?? '-' }}
            </p>
            <p v-if="profile.faculty || profile.department" class="text-sm" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
              {{ [fakultasAkronim(profile.faculty), profile.department].filter(Boolean).join(' · ') }}
            </p>
          </div>
        </div>
      </div>

      <!-- ── Bio & Info section (below avatar row) ─────────────────────────── -->
      <div class="mb-5 px-1">
        <!-- NRP + Faculty (mobile only) -->
        <div class="sm:hidden mb-2">
          <p class="text-sm font-semibold" :class="isDark ? 'text-sky-300' : 'text-blue-700'">
            {{ profile.nrp ?? '-' }}
          </p>
          <p v-if="profile.faculty || profile.department" class="text-sm" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
            {{ [fakultasAkronim(profile.faculty), profile.department].filter(Boolean).join(' · ') }}
          </p>
        </div>

        <!-- Bio -->
        <p v-if="profile.bio" class="text-sm whitespace-pre-line leading-relaxed mb-2" :class="isDark ? 'text-gray-300' : 'text-gray-700'">
          {{ profile.bio }}
        </p>

        <!-- Rating & joined date -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div class="flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-yellow-400 fill-current shrink-0" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <template v-if="ratingCount > 0">
              <span class="text-xs font-semibold" :class="isDark ? 'text-gray-200' : 'text-gray-700'">{{ sellerRating.toFixed(1) }}/5.0</span>
              <span class="text-xs" :class="isDark ? 'text-gray-500' : 'text-gray-400'">({{ ratingCount }} ulasan)</span>
            </template>
            <span v-else class="text-xs" :class="isDark ? 'text-gray-500' : 'text-gray-400'">Belum ada ulasan</span>
          </div>
          <span v-if="joinedDate" class="text-xs" :class="isDark ? 'text-gray-500' : 'text-gray-400'">
            📅 Bergabung {{ joinedDate }}
          </span>
        </div>
      </div>

      <!-- ── Mobile stats bar ──────────────────────────────────────────────── -->
      <div
        class="sm:hidden flex items-center border-y py-3 mb-4"
        :class="isDark ? 'border-white/10' : 'border-gray-200'"
      >
        <div class="flex-1 text-center">
          <div class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ products?.length ?? 0 }}</div>
          <div class="text-xs" :class="isDark ? 'text-gray-400' : 'text-gray-500'">postingan</div>
        </div>
        <div class="w-px h-8" :class="isDark ? 'bg-white/10' : 'bg-gray-200'"></div>
        <div class="flex-1 text-center">
          <div class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ followersCount }}</div>
          <div class="text-xs" :class="isDark ? 'text-gray-400' : 'text-gray-500'">pengikut</div>
        </div>
        <div class="w-px h-8" :class="isDark ? 'bg-white/10' : 'bg-gray-200'"></div>
        <div class="flex-1 text-center">
          <div class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ followingCount }}</div>
          <div class="text-xs" :class="isDark ? 'text-gray-400' : 'text-gray-500'">mengikuti</div>
        </div>
      </div>

      <!-- ── Mobile action buttons ─────────────────────────────────────────── -->
      <div class="sm:hidden flex gap-2 mb-5">
        <template v-if="!isSelf">
          <button
            @click="toggleFollow"
            :disabled="followLoading"
            class="flex-1 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
            :style="isFollowing
              ? (isDark ? 'background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8;' : 'background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b;')
              : (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8); color: #fff; border: none;' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb); color: #fff; border: none;')"
          >
            <svg v-if="followLoading" class="w-4 h-4 animate-spin inline mr-1" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <template v-else>{{ isFollowing ? '✓ Mengikuti' : '+ Ikuti' }}</template>
          </button>
        </template>
        <NuxtLink
          v-else
          to="/profile/edit"
          class="flex-1 text-center py-2 rounded-lg text-sm font-bold transition"
          :style="isDark
            ? 'border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; background: rgba(255,255,255,0.05);'
            : 'border: 1px solid rgba(30,58,138,0.20); color: #1e3a8a; background: #f8fafc;'"
        >
          Edit Profil
        </NuxtLink>
      </div>

      <!-- ══ PRODUCT GRID ════════════════════════════════════════════════════ -->

      <!-- Tab bar -->
      <div class="flex border-b mb-4" :class="isDark ? 'border-white/10' : 'border-gray-200'">
        <button
          @click="productTab = 'dijual'"
          class="flex-1 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-semibold transition border-b-2 -mb-px"
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
          class="flex-1 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-semibold transition border-b-2 -mb-px"
          :class="productTab === 'terjual'
            ? (isDark ? 'border-sky-400 text-sky-400' : 'border-blue-800 text-blue-800')
            : (isDark ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Terjual
          <span class="text-xs px-1.5 py-0.5 rounded-full" :class="isDark ? 'bg-white/10' : 'bg-gray-100'">{{ soldProducts.length }}</span>
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="!shownProducts.length" class="flex flex-col items-center text-center py-16" :class="isDark ? 'text-gray-500' : 'text-gray-400'">
        <img src="/img/illustrations/empty.svg" alt="Belum ada barang" class="w-44 h-auto opacity-75 mb-3" />
        {{ productTab === 'dijual' ? 'Belum ada barang yang dijual.' : 'Belum ada barang yang terjual/habis.' }}
      </div>

      <!-- Product grid (3 columns like Instagram) -->
      <div v-else class="grid grid-cols-3 gap-1 sm:gap-3 vt-stagger-grid" :ref="reveal">
        <ProductCard
          v-for="p in shownProducts"
          :key="p.id"
          :product="p"
          :is-sold="productTab === 'terjual'"
        />
      </div>

    </template>
  </div>
</template>
