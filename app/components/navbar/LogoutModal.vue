<script setup lang="ts">
const props = defineProps<{
  show: boolean
  isDark: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="show"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
           @click.self="emit('cancel')">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs flex flex-col overflow-hidden">
          <div class="flex flex-col items-center gap-3 px-6 pt-7 pb-2">
            <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, #fef2f2, #fee2e2);">
              <svg class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
              </svg>
            </div>
            <h3 class="font-bold text-base text-gray-800 dark:text-slate-100 text-center">Keluar dari VivaThrift?</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 text-center leading-relaxed">Sesi aktifmu akan diakhiri. Kamu harus login kembali untuk melanjutkan.</p>
          </div>
          <div class="flex gap-3 px-6 py-5">
            <button
              @click="emit('cancel')"
              class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition">
              Batal
            </button>
            <button
              @click="emit('confirm')"
              class="flex-1 py-2.5 text-sm rounded-xl text-white font-semibold transition hover:opacity-90"
              style="background: linear-gradient(to right, #dc2626, #b91c1c);">
              Keluar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
