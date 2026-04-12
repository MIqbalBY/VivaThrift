<script setup lang="ts">
const props = defineProps<{
  chatNotifications: any[]
  isDark: boolean
}>()

const emit = defineEmits<{
  dismiss: [id: number]
  navigate: [chatId: string, id: number]
}>()

const isMounted = ref(false)

function getNotifInitial(name: string) {
  return (name ?? '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <Teleport v-if="isMounted" to="body">
    <div class="fixed bottom-5 right-5 z-[9997] flex flex-col-reverse gap-2.5 items-end" style="max-width:320px; width:calc(100vw - 40px); pointer-events:none;">
      <TransitionGroup name="vt-notif" tag="div" class="flex flex-col-reverse gap-2.5 w-full">
        <div
          v-for="notif in chatNotifications"
          :key="notif.id"
          class="vt-notif-card w-full rounded-2xl cursor-pointer select-none overflow-hidden"
          :style="isDark
            ? 'background:rgba(15,23,42,0.94);border:1px solid rgba(148,163,184,0.12);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,0.4);pointer-events:auto;'
            : 'background:rgba(255,255,255,0.97);border:1px solid rgba(30,58,138,0.1);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(30,58,138,0.18);pointer-events:auto;'"
          @click="emit('navigate', notif.chatId, notif.id)"
        >
          <!-- Timer bar -->
          <div class="w-full h-0.5 overflow-hidden" :class="isDark ? 'bg-slate-700' : 'bg-blue-50'">
            <div class="vt-notif-timer h-full" :class="isDark ? 'bg-sky-500' : 'bg-blue-600'"></div>
          </div>
          <!-- Body -->
          <div class="flex items-start gap-3 p-3 pr-3.5">
            <!-- Avatar -->
            <div
              class="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white text-xs font-bold"
              :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background:linear-gradient(to right,#162d6e,#1e40af)'"
            >
              <img v-if="notif.senderAvatar" :src="notif.senderAvatar" width="36" height="36" loading="lazy" class="w-full h-full object-cover" />
              <span v-else>{{ getNotifInitial(notif.senderName) }}</span>
            </div>
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-1">
                <div class="min-w-0">
                  <p class="text-xs font-semibold" :class="isDark ? 'text-slate-400' : 'text-blue-700'">Pesan baru</p>
                  <p class="text-sm font-semibold truncate" :class="isDark ? 'text-slate-100' : 'text-gray-800'">{{ notif.senderName }}</p>
                </div>
                <button
                  class="shrink-0 mt-0.5 rounded-full p-0.5 transition"
                  :class="isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'"
                  @click.stop="emit('dismiss', notif.id)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p class="text-xs mt-0.5 truncate" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                <template v-if="notif.type === 'image'">📷 Foto</template>
                <template v-else-if="notif.type === 'offer'">💰 Penawaran harga</template>
                <template v-else>{{ notif.message }}</template>
              </p>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
