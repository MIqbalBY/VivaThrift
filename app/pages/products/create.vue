<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Jual Barang — VivaThrift' })

const { isDark } = useDarkMode()
const supabase = useSupabaseClient()

const form = reactive({
  title: '',
  price: '',
  stock: 1,
  description: '',
  condition: '',
  category_id: '',
  is_negotiable: false,
  is_cod: false,
  weight: 500,
  length: null as number | null,
  width:  null as number | null,
  height: null as number | null,
})

const { data: categories } = await useAsyncData('jual-categories', async () => {
  const { data } = await supabase.from('categories').select('id, name').order('name')
  const list = data ?? []
  return list.sort((a, b) => a.name === 'Lainnya' ? 1 : b.name === 'Lainnya' ? -1 : 0)
})

const isSubmitting = ref(false)

// ── Media ─────────────────────────────────────────────────────────────────────
const { mediaList, errorMsg, photoCount, videoCount, handleFileInput, removeMedia, setCover } = useProductMedia({
  onImageFiles: (files) => startCropping(files),
})
const { showCropModal, cropImageSrc, pendingCount, startCropping, handleCropConfirm, handleCropSkip, handleCropCancel } = useImageCrop(mediaList)
const { viewerOpen, viewerIndex, openViewer, closeViewer, prevViewer, nextViewer } = useMediaViewer(mediaList)

// ── Video thumbnail ───────────────────────────────────────────────────────────
const { showThumbModal, thumbVideoSrc, thumbInitialPreview, thumbInitialFile, openThumbPicker, handleThumbConfirm } = useVideoThumb(mediaList)

// ── Submit ────────────────────────────────────────────────────────────────────
async function submitProduct() {
  errorMsg.value = ''
  if (!form.title.trim()) return (errorMsg.value = 'Judul barang wajib diisi.')
  if (!form.price || Number(form.price) <= 0) return (errorMsg.value = 'Harga harus lebih dari 0.')
  if (!form.stock || Number(form.stock) < 1) return (errorMsg.value = 'Stok harus minimal 1.')
  if (!form.condition) return (errorMsg.value = 'Kondisi barang wajib dipilih.')
  if (!form.category_id) return (errorMsg.value = 'Kategori wajib dipilih.')
  if (!form.description.trim()) return (errorMsg.value = 'Deskripsi wajib diisi.')
  const hasPhoto = mediaList.value.some(m => m.type === 'image')
  if (!hasPhoto) return (errorMsg.value = 'Tambahkan minimal 1 foto produk.')

  isSubmitting.value = true
  try {
    const { data: { user: sessionUser } } = await supabase.auth.getUser()
    if (!sessionUser?.id) {
      errorMsg.value = 'Sesi login tidak ditemukan. Silakan login ulang.'
      isSubmitting.value = false
      return
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        title:         stripUrls(form.title.trim()),
        price:         Number(form.price),
        description:   form.description.trim() || null,
        condition:     form.condition,
        category_id:   form.category_id ? Number(form.category_id) : null,
        stock:         Number(form.stock) || 1,
        is_negotiable: form.is_negotiable,
        is_cod:        form.is_cod,
        status:        'active',
        seller_id:     sessionUser.id,
        weight:        Math.max(1, Number(form.weight) || 500),
        length:        form.length || null,
        width:         form.width  || null,
        height:        form.height || null,
      })
      .select('id')
      .single()

    if (productError) throw productError

    const slug = generateSlug(stripUrls(form.title.trim()), product.id)
    await supabase.from('products').update({ slug }).eq('id', product.id)

    const { uploadToR2 } = useR2Upload()

    for (const media of mediaList.value) {
      const { publicUrl: mediaUrl } = await uploadToR2(media.file, 'product-media')

      let thumbnailUrl = null
      if (media.thumbnailFile) {
        const { publicUrl: thumbUrl } = await uploadToR2(media.thumbnailFile, 'product-media')
        thumbnailUrl = thumbUrl
      }

      const { error: mediaError } = await supabase
        .from('product_media')
        .insert({
          product_id: product.id,
          media_url: mediaUrl,
          media_type: media.file.type,
          is_primary: media.isCover,
          thumbnail_url: thumbnailUrl,
        })
      if (mediaError) throw mediaError
    }

    const finalSlug = generateSlug(stripUrls(form.title.trim()), product.id)
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
      <h1 class="vt-detail-title font-heading text-3xl font-bold" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">Jual Barang</h1>
      <img src="/img/illustrations/shopping-app.svg" alt="" width="112" height="112" loading="lazy" class="hidden md:block w-28 h-auto opacity-70 ml-auto" aria-hidden="true" />
    </div>

    <div class="vt-hero-enter vt-hero-enter-d2 vt-glass rounded-2xl p-8" :style="isDark
      ? 'background: rgba(15,23,42,0.80); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 24px rgba(0,0,0,0.3);'
      : 'background: rgba(255,255,255,0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 24px rgba(30,58,138,0.10);'">
    <form @submit.prevent="submitProduct" class="space-y-6">

      <ProductFormFields :form="form" :categories="categories ?? []" :disabled="isSubmitting" :description-rows="10">
        <template #stock-help>
          <p class="text-xs text-gray-400 mt-1">Jumlah unit yang tersedia (default: 1)</p>
        </template>
      </ProductFormFields>

      <!-- Upload Media -->
      <ProductMediaGrid
        :media-list="mediaList"
        :photo-count="photoCount"
        :video-count="videoCount"
        :photo-max="PHOTO_MAX"
        :video-max="VIDEO_MAX"
        :disabled="isSubmitting"
        @open-viewer="openViewer"
        @set-cover="setCover"
        @remove="removeMedia"
        @open-thumb-picker="openThumbPicker"
        @file-input="handleFileInput"
      />

      <!-- Error -->
      <p v-if="errorMsg" class="text-sm border rounded-lg px-4 py-2" :class="isDark ? 'text-red-300 border-red-500/40' : 'text-red-700 border-red-200'" :style="isDark ? 'background: rgba(220,38,38,0.15);' : 'background: linear-gradient(to right, #fef2f2, #fee2e2, #fecaca);'">
        {{ errorMsg }}
      </p>

      <!-- Submit -->
      <div class="flex gap-3 pt-2">
        <NuxtLink
          to="/"
          class="vt-btn-outline px-6 py-2.5 rounded-full border-2 font-semibold hover:bg-blue-50 transition text-sm"
          :style="isDark ? 'border-color: #38bdf8; color: #7dd3fc;' : 'border-color: #1e3a8a; color: #1e3a8a;'"
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

  <!-- Modals -->
  <ProductMediaViewer
    :show="viewerOpen"
    :media-list="mediaList"
    :current-index="viewerIndex"
    @close="closeViewer"
    @prev="prevViewer"
    @next="nextViewer"
  />

  <ProductCropModal
    :show="showCropModal"
    :image-src="cropImageSrc"
    :pending-count="pendingCount"
    @confirm="handleCropConfirm"
    @skip="handleCropSkip"
    @cancel="handleCropCancel"
  />

  <ProductThumbModal
    :show="showThumbModal"
    :video-src="thumbVideoSrc"
    :initial-preview="thumbInitialPreview"
    :initial-file="thumbInitialFile"
    @confirm="handleThumbConfirm"
    @cancel="showThumbModal = false"
  />
</template>

