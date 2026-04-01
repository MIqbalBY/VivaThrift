<script setup>
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const props = defineProps({
  show: Boolean,
  videoSrc: String,
  initialPreview: { type: String, default: '' },
  initialFile: { type: [File, Object], default: null },
})

const emit = defineEmits(['confirm', 'cancel'])

const thumbVideoRef = ref(null)
const thumbDuration = ref(0)
const thumbSeekValue = ref(0)
const thumbPreview = ref('')
const thumbFile = ref(null)
const showThumbCrop = ref(false)
const thumbCropSrc = ref('')
const thumbCropperRef = ref(null)
const thumbInput = ref(null)

watch(() => props.show, (val) => {
  if (val) {
    thumbPreview.value = props.initialPreview || ''
    thumbFile.value = props.initialFile || null
    thumbSeekValue.value = 0
    thumbDuration.value = 0
    showThumbCrop.value = false
    nextTick(() => {
      if (thumbVideoRef.value) thumbVideoRef.value.currentTime = 0
    })
  }
})

function captureVideoFrame() {
  const video = thumbVideoRef.value
  if (!video || !video.videoWidth) return
  video.pause()
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0)
  canvas.toBlob((blob) => {
    if (!blob) return
    thumbCropSrc.value = URL.createObjectURL(blob)
    showThumbCrop.value = true
  }, 'image/jpeg', 0.92)
}

function handleThumbUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  event.target.value = ''
  const reader = new FileReader()
  reader.onload = (ev) => {
    thumbCropSrc.value = ev.target.result
    showThumbCrop.value = true
  }
  reader.readAsDataURL(file)
}

function confirmThumbCrop() {
  if (!thumbCropperRef.value) return
  const { canvas } = thumbCropperRef.value.getResult()
  canvas.toBlob((blob) => {
    thumbFile.value = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
    thumbPreview.value = URL.createObjectURL(blob)
    showThumbCrop.value = false
  }, 'image/jpeg', 0.92)
}

function cancelThumbCrop() {
  showThumbCrop.value = false
  thumbCropSrc.value = ''
}

function editThumbPreview() {
  thumbCropSrc.value = thumbPreview.value
  showThumbCrop.value = true
}

function confirmThumb() {
  emit('confirm', { file: thumbFile.value, preview: thumbPreview.value })
}

function cancelThumb() {
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="show"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
             style="max-height: 90dvh;">
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h3 class="font-bold text-sm text-gray-800 dark:text-slate-100">Pilih Thumbnail Video</h3>
            <button @click="cancelThumb"
                    class="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Crop mode for thumbnail -->
          <template v-if="showThumbCrop">
            <div class="relative bg-gray-900 overflow-hidden" style="height: 300px;">
              <Cropper
                ref="thumbCropperRef"
                :src="thumbCropSrc"
                :stencil-props="{ aspectRatio: 1, movable: true, resizable: true }"
                class="w-full"
                style="height: 300px;"
              />
            </div>
            <div class="px-5 py-4 flex gap-2 border-t border-gray-100 dark:border-slate-700">
              <button type="button" @click="cancelThumbCrop"
                      class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium hover:bg-gray-200 transition">
                Kembali
              </button>
              <button type="button" @click="confirmThumbCrop"
                      class="flex-1 py-2.5 text-sm rounded-xl text-white font-medium transition hover:opacity-90 bg-gradient-to-r from-[#162d6e] via-[#1e3a8a] to-[#1e40af] dark:from-sky-500 dark:via-sky-400 dark:to-sky-300">
                Potong &amp; Simpan
              </button>
            </div>
          </template>

          <!-- Normal thumbnail picker -->
          <template v-else>
            <div class="relative bg-black">
              <video
                ref="thumbVideoRef"
                :src="videoSrc"
                class="w-full"
                style="max-height: 220px; object-fit: contain;"
                muted
                crossorigin="anonymous"
                preload="auto"
                @loadedmetadata="() => { thumbDuration = thumbVideoRef?.duration || 0; if (thumbVideoRef) thumbVideoRef.currentTime = 0 }"
              />
            </div>
            <div class="px-5 py-4 flex flex-col gap-3 border-t border-gray-100 dark:border-slate-700">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400 shrink-0">Geser:</span>
                <input type="range" min="0" :max="thumbDuration" step="0.1"
                       v-model.number="thumbSeekValue"
                       @input="thumbVideoRef && (thumbVideoRef.currentTime = thumbSeekValue)"
                       class="flex-1 accent-blue-700 dark:accent-sky-400" />
              </div>
              <div class="flex gap-2">
                <button type="button" @click="captureVideoFrame"
                        class="flex-1 py-2 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-700 dark:text-slate-300 font-medium">
                  📸 Ambil Frame
                </button>
                <button type="button" @click="thumbInput?.click()"
                        class="flex-1 py-2 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-700 dark:text-slate-300 font-medium">
                  🖼️ Upload Gambar
                </button>
              </div>
              <input ref="thumbInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="handleThumbUpload" />
              <div v-if="thumbPreview" class="flex flex-col items-center gap-2">
                <p class="text-xs text-gray-500 dark:text-slate-400">Preview Thumbnail:</p>
                <div class="relative group cursor-pointer" @click="editThumbPreview">
                  <img :src="thumbPreview" class="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-slate-600" alt="" />
                  <div class="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <span class="text-white text-[10px] font-medium">✏️ Edit</span>
                  </div>
                </div>
              </div>
              <div class="flex gap-2 mt-1">
                <button type="button" @click="cancelThumb"
                        class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium hover:bg-gray-200 transition">
                  Batal
                </button>
                <button type="button" @click="confirmThumb" :disabled="!thumbFile"
                        class="flex-1 py-2.5 text-sm rounded-xl text-white font-medium transition hover:opacity-90 disabled:opacity-40 bg-gradient-to-r from-[#162d6e] via-[#1e3a8a] to-[#1e40af] dark:from-sky-500 dark:via-sky-400 dark:to-sky-300">
                  Simpan Thumbnail
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.vt-crop-fade-enter-active, .vt-crop-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.vt-crop-fade-enter-from, .vt-crop-fade-leave-to { opacity: 0; transform: scale(0.96); }
</style>
