<script setup lang="ts">
const user = useSupabaseUser()
const { isDark } = useDarkMode()
const { settings: userSettings } = useUserSettings()
const { userProfile, profilePending, userInitials } = useNavProfile()
const { searchQuery, handleSearch } = useNavSearch()
const { dbCategories, showCategory, categoryLabel, handleCategory } = useNavCategories()
const navUnreadCount = useState('navUnreadCount', () => 0)
const notifUnreadCount = useState('navNotifUnreadCount', () => 0)
const showNotifPanel = useState('navShowNotifPanel', () => false)

const show = defineModel<boolean>('show', { required: true })

const emit = defineEmits<{
  'handle-sell': []
  'handle-logout': []
}>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="show"
      class="md:hidden w-full px-4 pb-5 pt-3 flex flex-col gap-3"
      style="border-top: 1px solid rgba(30,58,138,0.08);"
    >
      <!-- Mobile Search -->
      <form @submit.prevent="() => { handleSearch(); show = false }" class="flex items-stretch border border-gray-300 rounded-lg overflow-hidden focus-within:border-blue-700 transition-colors">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari di VivaThrift"
          class="flex-1 px-4 py-2.5 text-sm text-gray-800 bg-transparent focus:outline-hidden placeholder-gray-400"
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
        <NuxtLink to="/about" @click="show = false" class="px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition font-medium">
          Tentang VivaThrift
        </NuxtLink>
        <button @click="() => { emit('handle-sell'); show = false }" class="text-left px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition font-medium">
          Mulai Berjualan
        </button>
        <button @click.stop="showCategory = !showCategory" class="text-left flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition font-medium">
          Kategori
          <svg class="w-3.5 h-3.5 transition-transform duration-200" :class="showCategory ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
          </svg>
        </button>
        <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="showCategory" class="ml-3 flex flex-col gap-0.5">
            <button @click="() => { handleCategory('Semua Kategori'); show = false }" class="text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
              🏷️ Semua Kategori
            </button>
            <button v-for="cat in (dbCategories ?? [])" :key="cat" @click="() => { handleCategory(cat); show = false }" class="text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
              {{ categoryLabel(cat) }}
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
            <NuxtLink to="/auth/signin" @click="show = false" class="vt-mobile-masuk flex-1 text-center py-2.5 rounded-full text-sm font-medium transition">
              Masuk
            </NuxtLink>
            <NuxtLink to="/auth/signup" @click="show = false" class="vt-mobile-daftar flex-1 text-center py-2.5 rounded-full text-sm font-medium text-white transition hover:opacity-90">
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
              <button @click="() => { emit('handle-logout'); show = false }" class="text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
                </svg>
                Keluar
              </button>
            </div>
            <div class="flex gap-2">
              <NuxtLink to="/profile/edit" @click="show = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                👤 Profil Saya
              </NuxtLink>
              <NuxtLink to="/profile/edit?tab=address" @click="show = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                📍 Alamat
              </NuxtLink>
              <NuxtLink to="/profile/edit?tab=security" @click="show = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                🔒 Keamanan
              </NuxtLink>
              <NuxtLink to="/profile/edit?tab=notifications" @click="show = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                ⚙️ Pengaturan
              </NuxtLink>
              <NuxtLink to="/orders" @click="show = false" class="flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                📋 Pesanan
              </NuxtLink>
              <NuxtLink to="/chat" @click="show = false" class="relative flex-1 text-center py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                💬 Chat
                <span v-if="navUnreadCount > 0"
                  class="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white"
                  style="background:#2563eb;">
                  {{ navUnreadCount > 99 ? '99+' : navUnreadCount }}
                </span>
              </NuxtLink>
              <button
                @click="showNotifPanel = !showNotifPanel; show = false"
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
</template>
