<script setup>
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

defineProps({
  show: { type: Boolean, required: true },
  imageSrc: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'cancel'])

const cropperRef = ref(null)
const cropRotate = ref(0)

function handleConfirm() {
  emit('confirm', cropperRef.value)
}

defineExpose({ cropperRef })
</script>

<template>
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="show"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
             style="max-height: 90dvh;">

          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h3 class="font-bold text-sm text-gray-800 dark:text-slate-100">Atur Foto Profil</h3>
            <button @click="emit('cancel')"
                    class="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Cropper area -->
          <div class="relative bg-gray-900 overflow-hidden" style="height: 300px;">
            <Cropper
              ref="cropperRef"
              :src="imageSrc"
              :stencil-props="{ aspectRatio: 1, movable: true, resizable: true }"
              class="w-full"
              style="height: 300px;"
            />
          </div>

          <!-- Controls -->
          <div class="px-5 py-4 flex flex-col gap-3 border-t border-gray-100 dark:border-slate-700">
            <!-- Zoom -->
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
              </svg>
              <div class="flex gap-2 flex-1">
                <button @click="cropperRef?.zoom(0.8)"
                        class="flex-1 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-700 dark:text-slate-300 font-bold">
                  −
                </button>
                <button @click="cropperRef?.zoom(1.2)"
                        class="flex-1 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-700 dark:text-slate-300 font-bold">
                  +
                </button>
              </div>
              <span class="text-xs text-gray-400 w-14 text-right">Zoom</span>
            </div>

            <!-- Rotate -->
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              <div class="flex gap-2 flex-1">
                <button @click="() => { cropRotate -= 90; cropperRef?.rotate(-90) }"
                        class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                  ↺ Kiri 90°
                </button>
                <button @click="() => { cropRotate += 90; cropperRef?.rotate(90) }"
                        class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                  ↻ Kanan 90°
                </button>
              </div>
            </div>

            <!-- Flip -->
            <div class="flex gap-2">
              <button @click="cropperRef?.flip(true, false)"
                      class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                ↔ Cermin H
              </button>
              <button @click="cropperRef?.flip(false, true)"
                      class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                ↕ Cermin V
              </button>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2 mt-1">
              <button @click="emit('cancel')"
                      class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium hover:bg-gray-200 transition">
                Batal
              </button>
              <button @click="handleConfirm"
                      class="vt-btn-primary flex-1 py-2.5 text-sm rounded-xl text-white font-medium transition hover:opacity-90">
                Simpan Foto
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.vt-crop-fade-enter-active, .vt-crop-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.vt-crop-fade-enter-from, .vt-crop-fade-leave-to { opacity: 0; transform: scale(0.96); }
:deep(.vue-advanced-cropper) { height: 300px !important; }
.vt-btn-primary {
  background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);
}
.dark .vt-btn-primary {
  background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8);
}
</style>
