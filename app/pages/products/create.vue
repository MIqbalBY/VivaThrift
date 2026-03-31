<script setup>
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Jual Barang — VivaThrift' })

const { isDark } = useDarkMode()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const form = reactive({
  title: '',
  price: '',
  stock: 1,
  description: '',
  condition: '',
  category_id: '',
  is_negotiable: false,
  is_cod: false,
})

const { data: categories } = await useAsyncData('jual-categories', async () => {
  const { data } = await supabase.from('categories').select('id, name').order('name')
  const list = data ?? []
  return list.sort((a, b) => a.name === 'Lainnya' ? 1 : b.name === 'Lainnya' ? -1 : 0)
})

const CONDITIONS = [
  { value: 'Baru',        label: '🆕 Baru' },
  { value: 'Seperti Baru', label: '✨ Seperti Baru' },
  { value: 'Baik',        label: '👍 Baik' },
  { value: 'Cukup Baik',  label: '👌 Cukup Baik' },
  { value: 'Bekas',       label: '♻️ Bekas' },
]

const KATEGORI_META = {
  'Aksesori & Gadget':       '📱',
  'Buku & Alat Tulis':       '📚',
  'Dapur & Peralatan Makan': '🍳',
  'Elektronik':              '💻',
  'Fashion':                 '👗',
  'Hobi & Koleksi':          '🎨',
  'Kendaraan':               '🚗',
  'Kosmetik & Skincare':     '💄',
  'Olahraga':                '⚽',
  'Perabot Kos':             '🛋️',
  'Tiket & Voucher':         '🎫',
  'Lainnya':                 '📦',
}
function kategoriLabel(name) {
  const emoji = KATEGORI_META[name]
  return emoji ? `${emoji} ${name}` : name
}

// Media list: { file, preview, type: 'image'|'video', isCover }
const mediaList = ref([])

// ── Formatting toolbar ────

const descTextarea = ref(null)

function applyFormat(marker) {
  const el = descTextarea.value
  if (!el) return
  const start = el.selectionStart
  const end   = el.selectionEnd
  const selected = form.description.slice(start, end)
  const wrapped  = `${marker}${selected || 'teks'}${marker}`
  form.description = form.description.slice(0, start) + wrapped + form.description.slice(end)
  nextTick(() => {
    const cursor = start + marker.length + (selected || 'teks').length + marker.length
    el.setSelectionRange(cursor, cursor)
    el.focus()
  })
}
const isSubmitting = ref(false)
const errorMsg = ref('')

const PHOTO_MAX = 5
const VIDEO_MAX = 1
const PHOTO_SIZE_MAX = 4 * 1024 * 1024   // 4 MB
const VIDEO_SIZE_MAX = 20 * 1024 * 1024  // 20 MB

const photoCount = computed(() => mediaList.value.filter(m => m.type === 'image').length)
const videoCount = computed(() => mediaList.value.filter(m => m.type === 'video').length)

// ── Crop modal state ──────────────────────────────────────────────────────────
const showCropModal = ref(false)
const cropImageSrc = ref('')
const cropperRef = ref(null)
const cropRotate = ref(0)
const pendingCropQueue = ref([])   // files waiting to be cropped
const currentCropFile = ref(null)  // original file being cropped

function openNextCrop() {
  if (pendingCropQueue.value.length === 0) {
    showCropModal.value = false
    return
  }
  const file = pendingCropQueue.value.shift()
  currentCropFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    cropImageSrc.value = ev.target.result
    cropRotate.value = 0
    showCropModal.value = true
  }
  reader.readAsDataURL(file)
}

function confirmCrop() {
  if (!cropperRef.value) return
  const { canvas } = cropperRef.value.getResult()
  canvas.toBlob((blob) => {
    const croppedFile = new File([blob], currentCropFile.value.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
    const isCover = mediaList.value.filter(m => m.isCover).length === 0
    mediaList.value.push({ file: croppedFile, preview: URL.createObjectURL(blob), type: 'image', isCover })
    openNextCrop()
  }, 'image/jpeg', 0.92)
}

function cancelCrop() {
  pendingCropQueue.value = []
  showCropModal.value = false
  cropImageSrc.value = ''
  currentCropFile.value = null
}

function skipCrop() {
  openNextCrop()
}

// ── Video thumbnail picker ────────────────────────────────────────────────────
const showThumbModal = ref(false)
const thumbVideoRef = ref(null)
const thumbVideoSrc = ref('')
const thumbPreview = ref('')
const thumbFile = ref(null)
const thumbMediaIndex = ref(-1)
const thumbDuration = ref(0)
const thumbSeekValue = ref(0)
const showThumbCrop = ref(false)
const thumbCropSrc = ref('')
const thumbCropperRef = ref(null)


function openThumbPicker(index) {
  const media = mediaList.value[index]
  thumbMediaIndex.value = index
  thumbVideoSrc.value = media.preview
  thumbPreview.value = media.thumbnail || ''
  thumbFile.value = media.thumbnailFile || null
  thumbSeekValue.value = 0
  thumbDuration.value = 0
  showThumbCrop.value = false
  showThumbModal.value = true
  nextTick(() => {
    if (thumbVideoRef.value) thumbVideoRef.value.currentTime = 0
  })
}

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
  // Open crop for uploaded thumbnail (1:1 ratio)
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
  if (thumbMediaIndex.value >= 0 && thumbFile.value) {
    mediaList.value[thumbMediaIndex.value].thumbnailFile = thumbFile.value
    mediaList.value[thumbMediaIndex.value].thumbnail = thumbPreview.value
  }
  showThumbModal.value = false
}

function cancelThumb() {
  showThumbModal.value = false
  thumbVideoSrc.value = ''
  thumbPreview.value = ''
  thumbFile.value = null
  showThumbCrop.value = false
}

function handleFileInput(event) {
  const files = Array.from(event.target.files)
  errorMsg.value = ''
  const imageQueue = []

  for (const file of files) {
    const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    const isVideo = ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)

    if (!isImage && !isVideo) {
      errorMsg.value = `File "${file.name}" tidak didukung. Gunakan JPG/PNG/WebP atau MP4/MOV/WebM.`
      continue
    }
    if (isImage && file.size > PHOTO_SIZE_MAX) {
      errorMsg.value = `Foto "${file.name}" melebihi batas 4 MB.`
      continue
    }
    if (isVideo && file.size > VIDEO_SIZE_MAX) {
      errorMsg.value = `Video "${file.name}" melebihi batas 20 MB.`
      continue
    }
    if (isImage && (photoCount.value + imageQueue.length) >= PHOTO_MAX) {
      errorMsg.value = `Maksimal ${PHOTO_MAX} foto.`
      continue
    }
    if (isVideo && videoCount.value >= VIDEO_MAX) {
      errorMsg.value = `Maksimal ${VIDEO_MAX} video.`
      continue
    }

    if (isImage) {
      imageQueue.push(file)
    } else {
      const isCover = mediaList.value.filter(m => m.isCover).length === 0
      mediaList.value.push({ file, preview: URL.createObjectURL(file), type: 'video', isCover: false })
    }
  }

  event.target.value = ''

  if (imageQueue.length > 0) {
    pendingCropQueue.value = imageQueue
    openNextCrop()
  }
}

function removeMedia(index) {
  const removed = mediaList.value[index]
  URL.revokeObjectURL(removed.preview)
  const wasCover = removed.isCover
  mediaList.value.splice(index, 1)
  if (wasCover) {
    const firstPhoto = mediaList.value.find(m => m.type === 'image')
    if (firstPhoto) firstPhoto.isCover = true
  }
}

function setCover(index) {
  mediaList.value.forEach((m, i) => { m.isCover = i === index })
}

// --- Viewer ---
const viewerOpen = ref(false)
const viewerIndex = ref(0)

function openViewer(index) {
  viewerIndex.value = index
  viewerOpen.value = true
}
function closeViewer() { viewerOpen.value = false }
function prevViewer() {
  viewerIndex.value = (viewerIndex.value - 1 + mediaList.value.length) % mediaList.value.length
}
function nextViewer() {
  viewerIndex.value = (viewerIndex.value + 1) % mediaList.value.length
}

function handleKeydown(e) {
  if (!viewerOpen.value) return
  if (e.key === 'Escape') closeViewer()
  if (e.key === 'ArrowLeft') prevViewer()
  if (e.key === 'ArrowRight') nextViewer()
}
onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// --- Slug ---
function generateSlug(title, id) {
  const base = title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return `${base}-${id.slice(0, 8)}`
}

// --- Submit ---
async function submitProduct() {
  errorMsg.value = ''
  if (!form.title.trim()) return (errorMsg.value = 'Judul barang wajib diisi.')
  if (!form.price || Number(form.price) <= 0) return (errorMsg.value = 'Harga harus lebih dari 0.')
  if (!form.condition) return (errorMsg.value = 'Kondisi barang wajib dipilih.')
  if (!form.category_id) return (errorMsg.value = 'Kategori wajib dipilih.')
  if (!form.description.trim()) return (errorMsg.value = 'Deskripsi wajib diisi.')
  const hasPhoto = mediaList.value.some(m => m.type === 'image')
  if (!hasPhoto) return (errorMsg.value = 'Tambahkan minimal 1 foto produk.')

  isSubmitting.value = true
  try {
    // Get authenticated user from session (more reliable than useSupabaseUser ref)
    const { data: { user: sessionUser } } = await supabase.auth.getUser()
    if (!sessionUser?.id) {
      errorMsg.value = 'Sesi login tidak ditemukan. Silakan login ulang.'
      isSubmitting.value = false
      return
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        title: form.title.trim(),
        price: Number(form.price),
        description: form.description.trim() || null,
        condition: form.condition,
        category_id: form.category_id ? Number(form.category_id) : null,
        stock: Number(form.stock) || 1,
        is_negotiable: form.is_negotiable,
        is_cod: form.is_cod,
        status: 'active',
        seller_id: sessionUser.id,
      })
      .select('id')
      .single()

    if (productError) throw productError

    const slug = generateSlug(form.title.trim(), product.id)
    await supabase.from('products').update({ slug }).eq('id', product.id)

    for (const media of mediaList.value) {
      const ext = media.file.name.split('.').pop()
      const filePath = `${product.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('product-media')
        .upload(filePath, media.file, { upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('product-media').getPublicUrl(filePath)

      let thumbnailUrl = null
      if (media.thumbnailFile) {
        const thumbPath = `${product.id}/${Date.now()}-thumb-${Math.random().toString(36).slice(2)}.jpg`
        const { error: thumbErr } = await supabase.storage.from('product-media').upload(thumbPath, media.thumbnailFile, { upsert: false })
        if (thumbErr) throw thumbErr
        const { data: thumbUrl } = supabase.storage.from('product-media').getPublicUrl(thumbPath)
        thumbnailUrl = thumbUrl.publicUrl
      }

      const { error: mediaError } = await supabase
        .from('product_media')
        .insert({
          product_id: product.id,
          media_url: urlData.publicUrl,
          media_type: media.file.type,
          is_primary: media.isCover,
          thumbnail_url: thumbnailUrl,
        })
      if (mediaError) throw mediaError
    }

    const finalSlug = generateSlug(form.title.trim(), product.id)
    await navigateTo(`/products/${finalSlug}`)
  } catch (err) {
    errorMsg.value = err.message ?? 'Terjadi kesalahan, coba lagi.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="w-full px-4 sm:px-10 py-12 max-w-2xl mx-auto">
    <div class="vt-hero-enter vt-hero-enter-d1 flex items-center gap-3 mb-8">
      <NuxtLink to="/" class="vt-back-btn text-gray-400 hover:text-blue-700 transition">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </NuxtLink>
      <h1 class="vt-detail-title font-heading text-3xl font-bold" style="color: #1e3a8a;">Jual Barang</h1>
      <img src="/img/illustrations/shopping-app.svg" alt="" class="hidden md:block w-28 h-auto opacity-70 ml-auto" aria-hidden="true" />
    </div>

    <div class="vt-hero-enter vt-hero-enter-d2 vt-glass rounded-2xl p-8" style="background: rgba(255,255,255,0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 24px rgba(30,58,138,0.10);">
    <form @submit.prevent="submitProduct" class="space-y-6">

      <!-- Judul Barang -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Judul Barang <span class="text-red-500">*</span></label>
        <input
          v-model="form.title"
          type="text"
          placeholder="Contoh: Buku Kalkulus 1 edisi 2024"
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          :disabled="isSubmitting"
        />
      </div>

      <!-- Harga -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Harga (Rp) <span class="text-red-500">*</span></label>
        <input
          v-model="form.price"
          type="number"
          min="0"
          placeholder="Contoh: 75000"
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          :disabled="isSubmitting"
        />
        <div class="flex flex-col gap-1.5 mt-2">
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" v-model="form.is_negotiable" class="accent-blue-900" />
            🤝 Harga bisa nego
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" v-model="form.is_cod" class="accent-blue-900" />
            🚲 Tersedia COD
          </label>
        </div>
      </div>

      <!-- Stok -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">📦 Stok</label>
        <input
          v-model="form.stock"
          type="number"
          min="1"
          placeholder="1"
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          :disabled="isSubmitting"
        />
        <p class="text-xs text-gray-400 mt-1">Jumlah unit yang tersedia (default: 1)</p>
      </div>

      <!-- Kondisi -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">🔍 Kondisi <span class="text-red-500">*</span></label>
        <select
          v-model="form.condition"
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          style="background: rgba(255,255,255,0.70); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);"
          :disabled="isSubmitting"
        >
          <option value="" disabled>Pilih kondisi barang</option>
          <option v-for="c in CONDITIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </div>

      <!-- Kategori -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">🏷️ Kategori <span class="text-red-500">*</span></label>
        <select
          v-model="form.category_id"
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          style="background: rgba(255,255,255,0.70); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);"
          :disabled="isSubmitting"
        >
          <option value="">Pilih kategori</option>
          <option v-for="cat in (categories ?? [])" :key="cat.id" :value="cat.id">{{ kategoriLabel(cat.name) }}</option>
        </select>
      </div>

      <!-- Deskripsi -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">Deskripsi <span class="text-red-500">*</span></label>
        <div class="flex items-center gap-1 mb-1">
          <button type="button" @click="applyFormat('**')" title="Bold" class="px-2 py-1 rounded border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"><b>B</b></button>
          <button type="button" @click="applyFormat('*')" title="Italic" class="px-2 py-1 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 transition"><i>I</i></button>
          <span class="text-[10px] text-gray-400 ml-1">**bold** &nbsp;*italic* &nbsp;·&nbsp; awali baris dengan <code class="bg-gray-100 px-1 rounded">-</code> untuk bullet</span>
        </div>
        <textarea
          ref="descTextarea"
          v-model="form.description"
          rows="10"
          placeholder="Jelaskan kondisi, kelengkapan, alasan jual, dsb."
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent resize-none"
          :disabled="isSubmitting"
        ></textarea>
      </div>

      <!-- Upload Media -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">
          Foto &amp; Video <span class="text-red-500">*</span>
          <span class="text-gray-400 font-normal ml-1">
            ({{ photoCount }}/{{ PHOTO_MAX }} foto • {{ videoCount }}/{{ VIDEO_MAX }} video)
          </span>
        </label>

        <!-- Thumbnail grid -->
        <div v-if="mediaList.length > 0" class="grid grid-cols-3 gap-2 mb-2">
          <div
            v-for="(media, index) in mediaList"
            :key="index"
            class="relative group"
          >
            <!-- 1:1 thumbnail -->
            <div
              class="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer border-2 transition"
              :class="media.isCover ? 'border-blue-700 dark:border-sky-400' : 'border-transparent hover:border-gray-300'"
              @click="openViewer(index)"
            >
              <img
                v-if="media.type === 'image'"
                :src="media.preview"
                class="w-full h-full object-cover"
                alt=""
              />
              <img
                v-else-if="media.thumbnail"
                :src="media.thumbnail"
                class="w-full h-full object-cover"
                alt=""
              />
              <video
                v-else
                :src="media.preview"
                class="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <!-- Play icon overlay for video -->
              <div v-if="media.type === 'video'" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="bg-black/50 rounded-full p-2">
                  <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
              <!-- Cover badge -->
              <div v-if="media.isCover" class="absolute top-1 left-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none bg-gradient-to-r from-[#162d6e] via-blue-800 to-blue-700 dark:from-sky-500 dark:via-sky-400 dark:to-cyan-400">COVER</div>
            </div>

            <!-- Hover actions -->
            <div class="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                v-if="!media.isCover && (media.type === 'image' || media.thumbnail)"
                type="button"
                title="Jadikan cover"
                @click.stop="setCover(index)"
                class="bg-white rounded-full p-1 shadow hover:bg-yellow-50"
              >
                <svg class="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </button>
              <button
                v-if="media.type === 'video'"
                type="button"
                title="Pilih thumbnail"
                @click.stop="openThumbPicker(index)"
                class="bg-white dark:bg-gray-700 rounded-full p-1 shadow hover:bg-blue-50 dark:hover:bg-gray-600"
              >
                <svg class="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
              </button>
              <button
                type="button"
                title="Hapus"
                @click.stop="removeMedia(index)"
                class="bg-white rounded-full p-1 shadow hover:bg-red-50"
              >
                <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          <!-- Add more slot -->
          <div
            v-if="photoCount < PHOTO_MAX || videoCount < VIDEO_MAX"
            class="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-700 hover:text-blue-700 transition text-gray-400"
            @click="$refs.mediaInput.click()"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            <span class="text-[10px] mt-1 font-medium">Tambah</span>
          </div>
        </div>

        <!-- Empty drop zone -->
        <div
          v-if="mediaList.length === 0"
          class="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#1e3a8a] transition"
          @click="$refs.mediaInput.click()"
        >
          <p class="text-3xl mb-2">📷</p>
          <p class="text-sm text-gray-500 font-medium">Klik untuk upload foto atau video</p>
          <p class="text-xs text-gray-400 mt-1">Maks {{ PHOTO_MAX }} foto (JPG/PNG/WebP ≤ 4 MB) &nbsp;•&nbsp; Maks {{ VIDEO_MAX }} video (MP4/MOV ≤ 20 MB)</p>
        </div>

        <input
          ref="mediaInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          multiple
          class="hidden"
          @change="handleFileInput"
          :disabled="isSubmitting"
        />
        <p v-if="mediaList.length > 0" class="text-xs text-gray-400 mt-1.5">Klik thumbnail untuk pratinjau • Hover untuk aksi • ★ untuk jadikan cover</p>
      </div>

      <!-- Error -->
      <p v-if="errorMsg" class="text-sm border rounded-lg px-4 py-2" :class="isDark ? 'text-red-300 border-red-500/40' : 'text-red-700 border-red-200'" :style="isDark ? 'background: rgba(220,38,38,0.15);' : 'background: linear-gradient(to right, #fef2f2, #fee2e2, #fecaca);'">
        {{ errorMsg }}
      </p>

      <!-- Submit -->
      <div class="flex gap-3 pt-2">
        <NuxtLink
          to="/"
          class="vt-btn-outline px-6 py-2.5 rounded-full border-2 font-semibold hover:bg-blue-50 transition text-sm"
          style="border-color: #1e3a8a; color: #1e3a8a;"
        >
          Batal
        </NuxtLink>
        <button
          type="submit"
          :disabled="isSubmitting"
          class="vt-btn-primary flex-1 py-2.5 rounded-full text-white font-bold transition hover:opacity-90 hover:shadow-md text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
        >
          {{ isSubmitting ? 'Menyimpan...' : 'Posting Barang' }}
        </button>
      </div>

    </form>
    </div>
  </div>

  <!-- MEDIA VIEWER MODAL -->
  <Teleport to="body">
    <div
      v-if="viewerOpen"
      class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      @click.self="closeViewer"
    >
      <!-- Close -->
      <button type="button" @click="closeViewer" class="absolute top-4 right-4 text-white hover:text-gray-300 z-10">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>

      <!-- Prev -->
      <button
        v-if="mediaList.length > 1"
        type="button"
        @click="prevViewer"
        class="absolute left-4 text-white hover:text-gray-300 z-10"
      >
        <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>

      <!-- Viewer -->
      <div class="max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden flex items-center justify-center">
        <img
          v-if="mediaList[viewerIndex]?.type === 'image'"
          :src="mediaList[viewerIndex]?.preview"
          class="block max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
          alt=""
        />
        <VideoPlayer
          v-else
          :src="mediaList[viewerIndex]?.preview"
          autoplay
          video-class="block max-w-[90vw] max-h-[90vh]"
        />
      </div>

      <!-- Next -->
      <button
        v-if="mediaList.length > 1"
        type="button"
        @click="nextViewer"
        class="absolute right-4 text-white hover:text-gray-300 z-10"
      >
        <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>

      <!-- Dots + counter -->
      <div class="absolute bottom-5 left-0 right-0 flex flex-col items-center gap-1.5">
        <div class="flex gap-1.5">
          <span
            v-for="(m, i) in mediaList"
            :key="i"
            class="w-2 h-2 rounded-full transition"
            :class="i === viewerIndex ? 'bg-white' : 'bg-white/35'"
          />
        </div>
        <span class="text-white/60 text-xs">{{ viewerIndex + 1 }} / {{ mediaList.length }}</span>
        <span v-if="mediaList[viewerIndex]?.isCover" class="text-yellow-400 text-xs font-bold">⭐ Cover</span>
      </div>
    </div>
  </Teleport>

  <!-- ─── Crop Modal ─────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="showCropModal"
           class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
             style="max-height: 90dvh;">

          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h3 class="font-bold text-sm text-gray-800 dark:text-slate-100">Atur Foto Produk</h3>
            <button @click="cancelCrop"
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
              :src="cropImageSrc"
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
                <button type="button" @click="cropperRef?.zoom(0.8)"
                        class="flex-1 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-700 dark:text-slate-300 font-bold">
                  −
                </button>
                <button type="button" @click="cropperRef?.zoom(1.2)"
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
                <button type="button" @click="() => { cropRotate -= 90; cropperRef?.rotate(-90) }"
                        class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                  ↺ Kiri 90°
                </button>
                <button type="button" @click="() => { cropRotate += 90; cropperRef?.rotate(90) }"
                        class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                  ↻ Kanan 90°
                </button>
              </div>
            </div>

            <!-- Flip -->
            <div class="flex gap-2">
              <button type="button" @click="cropperRef?.flip(true, false)"
                      class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                ↔ Cermin H
              </button>
              <button type="button" @click="cropperRef?.flip(false, true)"
                      class="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition text-gray-600 dark:text-slate-300 font-medium">
                ↕ Cermin V
              </button>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2 mt-1">
              <button type="button" @click="skipCrop"
                      class="flex-1 py-2.5 text-sm rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium hover:bg-gray-200 transition">
                Lewati
              </button>
              <button type="button" @click="confirmCrop"
                      class="flex-1 py-2.5 text-sm rounded-xl text-white font-medium transition hover:opacity-90"
                      style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);">
                Potong &amp; Simpan
              </button>
            </div>

            <p v-if="pendingCropQueue.length > 0" class="text-xs text-gray-400 text-center">
              {{ pendingCropQueue.length }} foto lagi menunggu
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ─── Video Thumbnail Picker Modal ─────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="vt-crop-fade">
      <div v-if="showThumbModal"
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
                :src="thumbVideoSrc"
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
                <button type="button" @click="$refs.thumbInput.click()"
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
:deep(.vue-advanced-cropper) { height: 300px !important; }
</style>
