<script setup>
const props = defineProps({
  userId: { type: String, required: true }
})
const emit = defineEmits(['close'])

const supabase = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark } = useDarkMode()

const loading = ref(true)
const userProfile = ref(null)
const sellerRating = ref(null)
const ratingCount = ref(0)
const followersCount = ref(0)
const followingCount = ref(0)
const isFollowing = ref(false)
const followLoading = ref(false)
const currentUserId = ref(null)

function fakultasAkronim(f) {
  if (!f) return ''
  const m = /\(([^)]+)\)$/.exec(f)
  return m ? m[1] : f
}

const userInitials = computed(() => {
  const name = userProfile.value?.name ?? ''
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
})

const isSelf = computed(() =>
  !!currentUserId.value && currentUserId.value === props.userId
)

async function loadProfile() {
  loading.value = true
  const { data: { session } } = await supabase.auth.getSession()
  currentUserId.value = session?.user?.id ?? currentUser.value?.id ?? null

  const [{ data: u }, { data: reviews }, { count: fc }, { count: fgc }] = await Promise.all([
    supabase.from('users')
      .select('id, name, nrp, faculty, department, avatar_url, gender, username')
      .eq('id', props.userId)
      .single(),
    supabase.from('reviews')
      .select('rating_seller')
      .eq('reviewee_id', props.userId),
    supabase.from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', props.userId),
    supabase.from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', props.userId),
  ])

  userProfile.value = u
  const arr = (reviews ?? []).map(r => r.rating_seller).filter(v => v != null)
  ratingCount.value = arr.length
  sellerRating.value = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  followersCount.value = fc ?? 0
  followingCount.value = fgc ?? 0

  if (currentUserId.value && currentUserId.value !== props.userId) {
    const { data: f } = await supabase
      .from('follows').select('id')
      .eq('follower_id', currentUserId.value)
      .eq('following_id', props.userId)
      .maybeSingle()
    isFollowing.value = !!f
  }
  loading.value = false
}

async function toggleFollow() {
  if (!currentUserId.value) return navigateTo('/auth/signin')
  followLoading.value = true
  if (isFollowing.value) {
    await supabase.from('follows').delete()
      .eq('follower_id', currentUserId.value)
      .eq('following_id', props.userId)
    isFollowing.value = false
    followersCount.value = Math.max(0, followersCount.value - 1)
  } else {
    await supabase.from('follows').insert({
      follower_id: currentUserId.value,
      following_id: props.userId,
    })
    isFollowing.value = true
    followersCount.value += 1
  }
  followLoading.value = false
}

function onKeyDown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  loadProfile()
  document.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);"
      @click.self="emit('close')"
    >
      <!-- Card -->
      <div
        class="relative w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden"
        :style="isDark
          ? 'background: linear-gradient(160deg,#0f172a,#1e293b); border: 1px solid rgba(255,255,255,0.08);'
          : 'background: rgba(255,255,255,0.96); border: 1px solid rgba(30,58,138,0.10);'"
      >
        <!-- Close button -->
        <button
          @click="emit('close')"
          class="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition"
          :class="isDark ? 'text-gray-400 hover:bg-white/10 hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <!-- Loading state -->
        <div v-if="loading" class="flex items-center justify-center py-16">
          <svg class="w-8 h-8 animate-spin" :class="isDark ? 'text-sky-400' : 'text-blue-600'" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>

        <!-- Content -->
        <div v-else-if="userProfile" class="flex flex-col items-center px-6 pt-8 pb-6 gap-4">

          <!-- Avatar -->
          <div
            class="w-24 h-24 rounded-full shadow-lg border-4 overflow-hidden flex items-center justify-center shrink-0"
            :style="isDark
              ? 'border-color: rgba(14,165,233,0.4); background: linear-gradient(135deg, #0ea5e9, #38bdf8);'
              : 'border-color: rgba(30,58,138,0.15); background: linear-gradient(135deg, #1e3a8a, #2563eb);'"
          >
            <img v-if="userProfile.avatar_url" :src="userProfile.avatar_url" width="96" height="96" loading="lazy" class="w-full h-full object-cover" />
            <span v-else class="text-white text-2xl font-bold select-none">{{ userInitials }}</span>
          </div>

          <!-- Name + gender -->
          <div class="text-center">
            <p class="font-bold text-lg leading-tight" :class="isDark ? 'text-white' : 'text-gray-900'">
              {{ userProfile.name }}
              <span v-if="userProfile.gender === 'Laki-laki'" title="Laki-laki" class="text-base">♂️</span>
              <span v-else-if="userProfile.gender === 'Perempuan'" title="Perempuan" class="text-base">♀️</span>
            </p>
            <p v-if="userProfile.username" class="text-xs mt-0.5" :class="isDark ? 'text-sky-400' : 'text-blue-600'">
              @{{ userProfile.username }}
            </p>
            <p class="text-xs mt-0.5" :class="isDark ? 'text-sky-300' : 'text-blue-700'">
              {{ userProfile.nrp ?? '-' }}
            </p>
            <p v-if="userProfile.faculty || userProfile.department" class="text-xs mt-0.5" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
              {{ [fakultasAkronim(userProfile.faculty), userProfile.department].filter(Boolean).join(' · ') }}
            </p>
          </div>

          <!-- Rating -->
          <div class="flex items-center gap-1.5 w-full justify-center">
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
          <div class="flex items-center gap-6 text-center">
            <div>
              <p class="text-base font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ followersCount }}</p>
              <p class="text-xs" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Pengikut</p>
            </div>
            <div class="w-px h-8" :class="isDark ? 'bg-white/10' : 'bg-gray-200'"></div>
            <div>
              <p class="text-base font-bold" :class="isDark ? 'text-white' : 'text-gray-900'">{{ followingCount }}</p>
              <p class="text-xs" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Diikuti</p>
            </div>
          </div>

          <!-- Buttons -->
          <div class="flex flex-col gap-2 w-full">
            <!-- Follow / Unfollow (only if viewing someone else) -->
            <button
              v-if="!isSelf"
              @click="toggleFollow"
              :disabled="followLoading"
              class="w-full py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
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

            <!-- Lihat Profile -->
            <NuxtLink
              :to="userProfile.username ? `/profile/@${userProfile.username}` : `/profile/${userProfile.id}`"
              @click="emit('close')"
              class="w-full py-2.5 rounded-xl text-sm font-bold text-center transition"
              :style="isDark
                ? 'border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; background: rgba(255,255,255,0.05);'
                : 'border: 1px solid rgba(30,58,138,0.20); color: #1e3a8a; background: transparent;'"
            >
              Lihat Profil
            </NuxtLink>
          </div>

        </div>

        <!-- Not found -->
        <div v-else class="flex flex-col items-center justify-center py-12 gap-2 px-6">
          <span class="text-4xl">🤷</span>
          <p class="text-sm text-gray-400">Profil tidak ditemukan.</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
