<script setup lang="ts">
const user = useSupabaseUser()
const { isDark } = useDarkMode()
const { settings: userSettings } = useUserSettings()
const {
  notifications, notifUnreadCount, showNotifPanel,
  notifPanelRef, notifBellRef,
  markAllRead, markOneRead, notifTimeAgo, getNotifIcon, getNotifRoute, getNotifProductImage,
} = useNavNotifications()

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

function handleOutsideClick(e: MouseEvent) {
  if (
    notifPanelRef.value && !notifPanelRef.value.contains(e.target as Node) &&
    notifBellRef.value && !notifBellRef.value.contains(e.target as Node)
  ) {
    showNotifPanel.value = false
  }
}
</script>

<template>
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
            @click="markAllRead(user?.id)"
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
            :to="getNotifRoute(n)"
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
</template>
