<script setup>
defineProps({
  show: { type: Boolean, required: true },
  title: { type: String, default: 'Konfirmasi' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Hapus' },
  iconColor: { type: String, default: 'text-red-500' },
  confirmBg: { type: String, default: 'background: linear-gradient(to right, #dc2626, #b91c1c);' },
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="show"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);"
           @click.self="emit('close')">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xs flex flex-col overflow-hidden">
          <div class="flex flex-col items-center gap-3 px-6 pt-7 pb-2">
            <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, #fef2f2, #fee2e2);">
              <slot name="icon">
                <svg :class="['w-7 h-7', iconColor]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                </svg>
              </slot>
            </div>
            <h3 class="font-bold text-base text-gray-800 dark:text-slate-100 text-center">{{ title }}</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 text-center leading-relaxed">{{ message }}</p>
          </div>
          <div class="flex gap-3 px-6 py-5">
            <button
              @click="emit('close')"
              class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 transition">
              Batal
            </button>
            <button
              @click="emit('confirm')"
              class="flex-1 py-2.5 text-sm rounded-xl text-white font-semibold transition hover:opacity-90"
              :style="confirmBg">
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.vt-crop-fade-enter-active, .vt-crop-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.vt-crop-fade-enter-from, .vt-crop-fade-leave-to { opacity: 0; transform: scale(0.96); }
</style>
