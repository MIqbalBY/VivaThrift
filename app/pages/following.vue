<script setup>
definePageMeta({ middleware: 'auth' })

useSeoMeta({ title: 'Mengikuti — VivaThrift' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { isDark } = useDarkMode()
const { reveal } = useScrollReveal()

const loading = ref(true)
const followingUsers = ref([])

async function fetchFollowing() {
  loading.value = true
  if (!user.value) { loading.value = false; return }

  const { data: follows } = await supabase
    .from('follows')
    .select('following_id, users!follows_following_id_fkey ( id, name, username, nrp, faculty, department, avatar_url, gender )')
    .eq('follower_id', user.value.id)
    .order('created_at', { ascending: false })

  followingUsers.value = (follows ?? []).map(f => ({
    ...f.users,
    followId: f.following_id,
  }))
  loading.value = false
}

async function unfollow(userId) {
  await supabase.from('follows').delete()
    .eq('follower_id', user.value.id)
    .eq('following_id', userId)
  followingUsers.value = followingUsers.value.filter(u => u.id !== userId)
}

function userInitials(name) {
  return (name ?? '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

onMounted(() => fetchFollowing())
</script>

<template>
  <div class="w-full max-w-3xl mx-auto px-4 md:px-8 py-6">

    <!-- Back -->
    <button
      @click="$router.back()"
      class="mb-5 inline-flex items-center gap-2 text-sm transition"
      :class="isDark ? 'text-gray-400 hover:text-sky-400' : 'text-gray-500 hover:text-[#1e3a8a]'"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      Kembali
    </button>

    <h1 :ref="reveal" class="text-2xl font-bold mb-6" :class="isDark ? 'text-white' : 'text-[#1e3a8a]'">
      Mengikuti
      <span v-if="!loading" class="text-base font-normal" :class="isDark ? 'text-gray-400' : 'text-gray-500'">({{ followingUsers.length }})</span>
    </h1>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <div class="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" :class="isDark ? 'border-sky-400' : 'border-blue-800'"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!followingUsers.length" class="flex flex-col items-center text-center py-20 gap-3">
      <img src="/img/illustrations/empty-cart.svg" alt="Belum mengikuti" width="192" height="192" loading="lazy" class="w-48 h-auto opacity-80" />
      <p class="font-semibold text-lg" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Belum mengikuti siapapun</p>
      <p class="text-sm" :class="isDark ? 'text-gray-500' : 'text-gray-400'">Temukan penjual favoritmu dan mulai ikuti!</p>
    </div>

    <!-- User list -->
    <div v-else class="space-y-3" :ref="reveal">
      <div
        v-for="u in followingUsers"
        :key="u.id"
        class="flex items-center gap-4 p-4 rounded-xl transition"
        :style="isDark
          ? 'background: rgba(15,25,50,0.70); border: 1px solid rgba(255,255,255,0.08);'
          : 'background: rgba(255,255,255,0.65); border: 1px solid rgba(255,255,255,0.45); box-shadow: 0 2px 10px rgba(30,58,138,0.06);'"
      >
        <!-- Avatar -->
        <NuxtLink :to="`/profile/${u.username ?? u.id}`" class="shrink-0">
          <div
            class="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center"
            :style="isDark
              ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8);'
              : 'background: linear-gradient(135deg,#1e3a8a,#2563eb);'"
          >
            <img v-if="u.avatar_url" :src="u.avatar_url" width="48" height="48" class="w-full h-full object-cover" />
            <span v-else class="text-white text-sm font-bold select-none">{{ userInitials(u.name) }}</span>
          </div>
        </NuxtLink>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <NuxtLink :to="`/profile/${u.username ?? u.id}`" class="block">
            <p class="text-sm font-semibold truncate" :class="isDark ? 'text-white' : 'text-gray-800'">
              {{ u.name }}
              <span v-if="u.gender === 'Laki-laki'" title="Laki-laki">♂️</span>
              <span v-else-if="u.gender === 'Perempuan'" title="Perempuan">♀️</span>
            </p>
            <p v-if="u.username" class="text-xs" :class="isDark ? 'text-sky-400' : 'text-blue-700'">@{{ u.username }}</p>
          </NuxtLink>
          <p class="text-xs truncate" :class="isDark ? 'text-gray-500' : 'text-gray-400'">
            {{ u.nrp ?? '' }}
            <template v-if="u.faculty || u.department"> · {{ [u.faculty, u.department].filter(Boolean).join(' - ') }}</template>
          </p>
        </div>

        <!-- Unfollow -->
        <button
          @click="unfollow(u.id)"
          class="px-4 py-1.5 rounded-lg text-sm font-semibold transition shrink-0"
          :style="isDark
            ? 'background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8;'
            : 'background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b;'"
        >
          Berhenti Ikuti
        </button>
      </div>
    </div>
  </div>
</template>
