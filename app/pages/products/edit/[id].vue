<script setup>
definePageMeta({ middleware: 'auth' })

const { isDark } = useDarkMode()
const route = useRoute()
const supabase = useSupabaseClient()
const currentUser = useSupabaseUser()

const param = route.params.id
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)

const { data: product } = await useAsyncData(`edit-product-${param}`, async () => {
  const { data } = await supabase
    .from('products')
    .select(`
      id, title, description, price, condition, is_negotiable, is_cod, status, stock, slug, seller_id, category_id,
      product_media ( media_url, media_type, is_primary, thumbnail_url ),
      categories ( name )
    `)
    .eq(isUuid ? 'id' : 'slug', param)
    .single()
  return data
})

useSeoMeta({ title: () => product.value?.title ? `Edit ${product.value.title} — VivaThrift` : 'Edit Produk — VivaThrift' })

if (!product.value) {
  await navigateTo('/')
}

const currentUserId = ref(null)
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  currentUserId.value = session?.user?.id ?? currentUser.value?.id ?? null
  if (!currentUserId.value || currentUserId.value !== product.value?.seller_id) {
    await navigateTo(`/products/${param}`)
  }
})

// ── Categories ──────────────────────────────────────────────────────────────
const { data: categories } = await useAsyncData('edit-categories', async () => {
  const { data } = await supabase.from('categories').select('id, name').order('name')
  const list = data ?? []
  return list.sort((a, b) => a.name === 'Lainnya' ? 1 : b.name === 'Lainnya' ? -1 : 0)
})

// ── Form ─────────────────────────────────────────────────────────────────────
const form = reactive({
  title:        product.value?.title ?? '',
  price:        product.value?.price ?? '',
  description:  product.value?.description ?? '',
  condition:    product.value?.condition ?? '',
  category_id:  product.value?.category_id ?? '',
  is_negotiable: product.value?.is_negotiable ?? false,
  is_cod:       product.value?.is_cod ?? false,
  stock:        product.value?.stock ?? 0,
})

const isSubmitting = ref(false)
const isDeleting = ref(false)
const showDeleteConfirm = ref(false)

// ── Media ─────────────────────────────────────────────────────────────────────
const { mediaList, errorMsg, photoCount, videoCount, handleFileInput, removeMedia, setCover } = useProductMedia({
  onImageFiles: (files) => startCropping(files),
})
const { showCropModal, cropImageSrc, pendingCount, startCropping, handleCropConfirm, handleCropSkip, handleCropCancel } = useImageCrop(mediaList)
const { viewerOpen, viewerIndex, openViewer, closeViewer, prevViewer, nextViewer } = useMediaViewer(mediaList)

// Pre-populate mediaList with existing product media
const loadedMedia = product.value?.product_media ?? []
const hasPrimary = loadedMedia.some(m => m.is_primary)
loadedMedia.forEach((m, i) => {
  const type = m.media_type?.startsWith('video') ? 'video' : 'image'
  mediaList.value.push({
    preview:   m.media_url,
    type,
    isCover:   m.is_primary || (!hasPrimary && i === 0),
    isExisting: true,
    dbUrl:     m.media_url,
    dbThumbnailUrl: m.thumbnail_url || null,
    thumbnail: m.thumbnail_url || '',
    mediaType: m.media_type ?? (type === 'image' ? 'image/jpeg' : 'video/mp4'),
  })
})

// ── Video thumbnail ───────────────────────────────────────────────────────────
const { showThumbModal, thumbVideoSrc, thumbInitialPreview, thumbInitialFile, openThumbPicker, handleThumbConfirm } = useVideoThumb(mediaList)

// ── Save ──────────────────────────────────────────────────────────────────────
async function saveEdits() {
  errorMsg.value = ''
  if (!form.title.trim()) return (errorMsg.value = 'Judul barang wajib diisi.')
  if (!form.price || Number(form.price) <= 0) return (errorMsg.value = 'Harga harus lebih dari 0.')
  const stockNum = Number(form.stock)
  if (isNaN(stockNum) || stockNum < 0) return (errorMsg.value = 'Stok tidak boleh negatif.')
  if (!form.condition) return (errorMsg.value = 'Kondisi barang wajib dipilih.')
  if (!form.category_id) return (errorMsg.value = 'Kategori wajib dipilih.')
  if (!form.description.trim()) return (errorMsg.value = 'Deskripsi wajib diisi.')
  const hasPhoto = mediaList.value.some(m => m.type === 'image')
  if (!hasPhoto) return (errorMsg.value = 'Tambahkan minimal 1 foto produk.')

  isSubmitting.value = true
  try {
    const productId = product.value.id
    const newSlug   = generateSlug(stripUrls(form.title.trim()), productId)

    const stockVal = Number(form.stock) || 0
    const { error: updateError } = await supabase
      .from('products')
      .update({
        title:        stripUrls(form.title.trim()),
        price:        Number(form.price),
        description:  form.description.trim() || null,
        condition:    form.condition,
        category_id:  form.category_id ? Number(form.category_id) : null,
        is_negotiable: form.is_negotiable,
        is_cod:       form.is_cod,
        stock:        stockVal,
        status:       stockVal > 0 ? 'active' : 'sold',
        slug:         newSlug,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', productId)
    if (updateError) throw updateError

    const { error: deleteError } = await supabase
      .from('product_media')
      .delete()
      .eq('product_id', productId)
    if (deleteError) throw deleteError

    for (const media of mediaList.value) {
      if (media.isExisting) {
        let thumbnailUrl = media.dbThumbnailUrl || null
        if (media.thumbnailFile) {
          const thumbPath = `${productId}/${Date.now()}-thumb-${Math.random().toString(36).slice(2)}.jpg`
          const { error: thumbErr } = await supabase.storage.from('product-media').upload(thumbPath, media.thumbnailFile, { upsert: false })
          if (thumbErr) throw thumbErr
          const { data: thumbUrl } = supabase.storage.from('product-media').getPublicUrl(thumbPath)
          thumbnailUrl = thumbUrl.publicUrl
        }
        const { error: insError } = await supabase
          .from('product_media')
          .insert({
            product_id: productId,
            media_url:  media.dbUrl,
            media_type: media.mediaType,
            is_primary: media.isCover,
            thumbnail_url: thumbnailUrl,
          })
        if (insError) throw insError
      } else {
        const ext      = media.file.name.split('.').pop()
        const filePath = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('product-media')
          .upload(filePath, media.file, { upsert: false })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('product-media').getPublicUrl(filePath)

        let thumbnailUrl = null
        if (media.thumbnailFile) {
          const thumbPath = `${productId}/${Date.now()}-thumb-${Math.random().toString(36).slice(2)}.jpg`
          const { error: thumbErr } = await supabase.storage.from('product-media').upload(thumbPath, media.thumbnailFile, { upsert: false })
          if (thumbErr) throw thumbErr
          const { data: thumbUrl } = supabase.storage.from('product-media').getPublicUrl(thumbPath)
          thumbnailUrl = thumbUrl.publicUrl
        }

        const { error: insError } = await supabase
          .from('product_media')
          .insert({
            product_id: productId,
            media_url:  urlData.publicUrl,
            media_type: media.file.type,
            is_primary: media.isCover,
            thumbnail_url: thumbnailUrl,
          })
        if (insError) throw insError
      }
    }

    // Clear cached product data so detail page fetches fresh data
    clearNuxtData(`product-${param}`)
    clearNuxtData(`product-${newSlug}`)
    clearNuxtData(`edit-product-${param}`)
    await navigateTo(`/products/${newSlug}`)
  } catch (err) {
    errorMsg.value = err.message ?? 'Terjadi kesalahan, coba lagi.'
  } finally {
    isSubmitting.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteProduct() {
  isDeleting.value = true
  try {
    const productId = product.value.id
    const { error: chatError } = await supabase
      .from('chats')
      .delete()
      .eq('product_id', productId)
    if (chatError) throw chatError

    const { error } = await supabase
      .from('products')
      .update({ status: 'deleted', stock: 0, updated_at: new Date().toISOString() })
      .eq('id', productId)
    if (error) throw error
    await navigateTo('/')
  } catch (err) {
    errorMsg.value = err.message ?? 'Gagal menghapus produk.'
    showDeleteConfirm.value = false
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="w-full px-4 sm:px-10 py-12 max-w-2xl mx-auto">
    <div class="flex items-center gap-3 mb-8">
      <NuxtLink :to="`/products/${param}`" class="text-gray-400 hover:text-blue-700 transition">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </NuxtLink>
      <h1 class="vt-detail-title font-heading text-3xl font-bold" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">Edit Produk</h1>
    </div>

    <div class="vt-glass rounded-2xl p-6 sm:p-8" :style="isDark
      ? 'background: rgba(15,23,42,0.80); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 24px rgba(0,0,0,0.3);'
      : 'background: rgba(255,255,255,0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 24px rgba(30,58,138,0.10);'">

      <!-- Sold out banner -->
      <div v-if="product?.status === 'sold'" class="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm" :class="isDark ? 'border-red-500/40' : 'border-red-200'" :style="isDark ? 'background: rgba(220,38,38,0.15);' : 'background: linear-gradient(to right, #fef2f2, #fee2e2);'">
        <span class="text-lg">🚫</span>
        <span :class="isDark ? 'text-red-300' : 'text-red-700'">Produk ini sedang <strong>Habis</strong>. Tambah stok &gt; 0 untuk mengaktifkan kembali.</span>
      </div>

      <form @submit.prevent="saveEdits" class="space-y-6">

        <ProductFormFields :form="form" :categories="categories ?? []" :disabled="isSubmitting" />

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

        <!-- Buttons -->
        <div class="flex gap-3 pt-2">
          <NuxtLink
            :to="`/products/${param}`"
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
            {{ isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>

      </form>

      <!-- Delete section -->
      <div class="mt-6 pt-6 border-t" :class="isDark ? 'border-red-500/30' : 'border-red-100'">
        <div v-if="!showDeleteConfirm" class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold" :class="isDark ? 'text-red-400' : 'text-red-700'">Hapus Produk</p>
            <p class="text-xs mt-0.5" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Produk yang dihapus tidak akan muncul lagi di manapun.</p>
          </div>
          <button
            type="button"
            @click="showDeleteConfirm = true"
            class="px-4 py-2 rounded-full border-2 text-sm font-semibold transition"
            :class="isDark ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' : 'border-red-400 text-red-600 hover:bg-red-50'"
          >
            🗑️ Hapus
          </button>
        </div>
        <div v-else class="rounded-xl border p-4" :class="isDark ? 'border-red-500/40' : 'border-red-200'" :style="isDark ? 'background: rgba(220,38,38,0.15);' : 'background: linear-gradient(to right, #fef2f2, #fee2e2);'">
          <p class="text-sm font-semibold mb-1" :class="isDark ? 'text-red-300' : 'text-red-700'">Yakin ingin menghapus produk ini?</p>
          <p class="text-xs mb-3" :class="isDark ? 'text-red-400' : 'text-red-600'">Tindakan ini tidak bisa dibatalkan. Produk tidak akan muncul lagi di pencarian, profil, maupun chat.</p>
          <div class="flex gap-2">
            <button
              type="button"
              @click="showDeleteConfirm = false"
              class="px-4 py-2 rounded-full border text-sm transition"
              :class="isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-white'"
              :disabled="isDeleting"
            >
              Batal
            </button>
            <button
              type="button"
              @click="deleteProduct"
              :disabled="isDeleting"
              class="px-4 py-2 rounded-full text-white text-sm font-bold transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style="background: linear-gradient(to right, #dc2626, #ef4444);"
            >
              {{ isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen' }}
            </button>
          </div>
        </div>
      </div>
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
