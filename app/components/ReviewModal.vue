<script setup lang="ts">
const { isDark } = useDarkMode()

const props = defineProps<{
  orderId: string
  productId: string
  sellerId: string
  productTitle: string
  sellerName: string
  productImage?: string | null
}>()

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const ratingProduct = ref(0)
const ratingSeller  = ref(0)
const hoverProduct  = ref(0)
const hoverSeller   = ref(0)
const comment       = ref('')
const loading       = ref(false)
const error         = ref('')
const success       = ref(false)

const STAR_LABELS = ['', 'Sangat Buruk', 'Buruk', 'Cukup', 'Baik', 'Sangat Baik']

function starClass(value: number, current: number, hover: number, isDarkMode: boolean) {
  const active = hover || current
  if (value <= active) {
    return 'text-yellow-400 fill-current'
  }
  return isDarkMode ? 'text-slate-600' : 'text-gray-300'
}

async function submit() {
  error.value = ''
  if (!ratingProduct.value || !ratingSeller.value) {
    error.value = 'Mohon beri rating bintang untuk produk dan penjual.'
    return
  }
  loading.value = true
  try {
    await $fetch('/api/reviews', {
      method: 'POST',
      body: {
        order_id:       props.orderId,
        product_id:     props.productId,
        seller_id:      props.sellerId,
        rating_product: ratingProduct.value,
        rating_seller:  ratingSeller.value,
        comment:        comment.value,
      },
    })
    success.value = true
    setTimeout(() => emit('submitted'), 1200)
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? 'Gagal mengirim ulasan.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-md rounded-2xl overflow-hidden"
        :style="isDark
          ? 'background:rgba(15,23,42,0.97);border:1px solid rgba(255,255,255,0.10);box-shadow:0 12px 40px rgba(0,0,0,0.60);'
          : 'background:rgba(255,255,255,0.98);border:1px solid rgba(30,58,138,0.10);box-shadow:0 12px 40px rgba(30,58,138,0.15);'"
      >
        <!-- Header -->
        <div class="px-6 pt-6 pb-4 flex items-start gap-4">
          <div v-if="productImage" class="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-100">
            <img :src="productImage" width="56" height="56" class="w-full h-full object-cover" :alt="productTitle" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-heading text-lg font-bold leading-snug mb-0.5"
              :style="isDark ? 'color:#f1f5f9;' : 'color:#1e3a8a;'">
              Gimana barangnya?
            </h3>
            <p class="text-xs truncate" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ productTitle }}</p>
          </div>
          <button
            @click="emit('close')"
            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition"
            :class="isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-gray-100 text-gray-400'"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Success State -->
        <div v-if="success" class="px-6 pb-8 text-center">
          <div class="text-5xl mb-3">🎉</div>
          <p class="font-semibold text-lg mb-1" :class="isDark ? 'text-white' : 'text-gray-800'">Terima kasih!</p>
          <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Ulasanmu sudah dikirim.</p>
        </div>

        <!-- Form -->
        <template v-else>
          <div class="px-6 pb-2 space-y-5">

            <!-- Rating Produk -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide mb-2"
                :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                Rating Produk
              </label>
              <div class="flex items-center gap-1">
                <button
                  v-for="star in 5"
                  :key="`p-${star}`"
                  @click="ratingProduct = star"
                  @mouseenter="hoverProduct = star"
                  @mouseleave="hoverProduct = 0"
                  class="p-0.5 transition-transform hover:scale-110"
                  type="button"
                >
                  <svg
                    class="w-8 h-8 transition-colors"
                    :class="starClass(star, ratingProduct, hoverProduct, isDark)"
                    viewBox="0 0 20 20"
                    :fill="star <= (hoverProduct || ratingProduct) ? 'currentColor' : 'none'"
                    :stroke="star <= (hoverProduct || ratingProduct) ? 'none' : 'currentColor'"
                    stroke-width="1"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                </button>
                <span v-if="hoverProduct || ratingProduct" class="ml-2 text-xs font-medium"
                  :class="isDark ? 'text-slate-300' : 'text-gray-600'">
                  {{ STAR_LABELS[hoverProduct || ratingProduct] }}
                </span>
              </div>
            </div>

            <!-- Rating Penjual -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide mb-2"
                :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                Rating Penjual <span class="normal-case font-normal">({{ sellerName }})</span>
              </label>
              <div class="flex items-center gap-1">
                <button
                  v-for="star in 5"
                  :key="`s-${star}`"
                  @click="ratingSeller = star"
                  @mouseenter="hoverSeller = star"
                  @mouseleave="hoverSeller = 0"
                  class="p-0.5 transition-transform hover:scale-110"
                  type="button"
                >
                  <svg
                    class="w-8 h-8 transition-colors"
                    :class="starClass(star, ratingSeller, hoverSeller, isDark)"
                    viewBox="0 0 20 20"
                    :fill="star <= (hoverSeller || ratingSeller) ? 'currentColor' : 'none'"
                    :stroke="star <= (hoverSeller || ratingSeller) ? 'none' : 'currentColor'"
                    stroke-width="1"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                </button>
                <span v-if="hoverSeller || ratingSeller" class="ml-2 text-xs font-medium"
                  :class="isDark ? 'text-slate-300' : 'text-gray-600'">
                  {{ STAR_LABELS[hoverSeller || ratingSeller] }}
                </span>
              </div>
            </div>

            <!-- Comment -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide mb-2"
                :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                Ulasan <span class="normal-case font-normal">(opsional)</span>
              </label>
              <textarea
                v-model="comment"
                rows="3"
                maxlength="500"
                placeholder="Ceritakan pengalamanmu…"
                class="w-full rounded-xl px-4 py-3 text-sm border resize-none transition focus:outline-none focus:ring-2"
                :class="isDark
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/30 focus:border-sky-400'
                  : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-200 focus:border-blue-400'"
              />
              <p class="text-right text-[10px] mt-1" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ comment.length }}/500</p>
            </div>

          </div>

          <!-- Error -->
          <p v-if="error" class="px-6 text-xs text-red-500 mb-2">{{ error }}</p>

          <!-- Actions -->
          <div class="px-6 pb-6 flex gap-2">
            <button
              @click="emit('close')"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium border transition"
              :class="isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
            >Nanti saja</button>
            <button
              @click="submit"
              :disabled="loading || !ratingProduct || !ratingSeller"
              class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style="background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);"
            >
              <span v-if="loading" class="flex items-center justify-center gap-1.5">
                <span class="w-4 h-4 rounded-full border-2 border-t-transparent border-white/50 animate-spin"></span>
                Mengirim…
              </span>
              <span v-else>Kirim Ulasan</span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>