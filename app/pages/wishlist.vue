<script setup>
definePageMeta({ middleware: 'auth' })

useSeoMeta({ title: 'Wishlist Saya — VivaThrift' })

const { isDark } = useDarkMode()
const { fetchWishlistProducts, toggleWishlist, fetchWishlist, wishlistedIds } = useWishlist()
const user = useSupabaseUser()
const { reveal } = useScrollReveal()

const loading = ref(true)
const items = ref([])

async function load() {
  loading.value = true
  const data = await fetchWishlistProducts()
  items.value = data
    .map(w => w.products)
    .filter(Boolean)
    .filter(p => p.status !== 'deleted')
  loading.value = false
}

async function removeFromWishlist(productId) {
  await toggleWishlist(productId)
  items.value = items.value.filter(p => p.id !== productId)
}

onMounted(async () => {
  await fetchWishlist()
  await load()
})
</script>

<template>
  <div class="w-full max-w-7xl mx-auto px-4 md:px-8 py-8">

    <!-- Header -->
    <div class="vt-hero-enter vt-hero-enter-d1 flex items-center gap-3 mb-8">
      <NuxtLink to="/" class="vt-back-btn inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a8a] transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        Kembali
      </NuxtLink>
      <div class="flex-1" />
      <h1 class="font-heading text-2xl font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">
        Wishlist Saya
      </h1>
      <span v-if="!loading" class="text-sm font-medium px-2.5 py-0.5 rounded-full" :class="isDark ? 'bg-sky-900/60 text-sky-300' : 'bg-blue-50 text-blue-700'">
        {{ items.length }} item
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="i in 8" :key="i" class="rounded-xl aspect-[3/4] animate-pulse" :class="isDark ? 'bg-slate-800' : 'bg-gray-100'" />
    </div>

    <!-- Empty state -->
    <div v-else-if="items.length === 0" class="vt-hero-enter vt-hero-enter-d2 flex flex-col items-center text-center py-24 gap-4">
      <svg class="w-20 h-20 opacity-20" :class="isDark ? 'text-sky-400' : 'text-blue-300'" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
      </svg>
      <p class="font-semibold text-lg" :class="isDark ? 'text-slate-300' : 'text-gray-500'">Wishlist kamu masih kosong</p>
      <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">Tap ikon ❤️ di produk mana saja untuk menyimpannya di sini.</p>
      <NuxtLink to="/" class="mt-2 px-6 py-2.5 rounded-full text-white font-semibold text-sm transition hover:shadow-lg hover:-translate-y-0.5" :class="isDark ? 'bg-sky-600 hover:bg-sky-500' : 'bg-blue-900 hover:bg-blue-800'">
        Jelajahi Produk
      </NuxtLink>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="product in items"
        :key="product.id"
        class="vt-hero-enter relative group rounded-xl border shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col overflow-hidden"
        :style="isDark
          ? 'background:rgba(15,23,42,0.80);backdrop-filter:blur(10px);border-color:rgba(255,255,255,0.08);'
          : 'background:rgba(255,255,255,0.70);backdrop-filter:blur(10px);'"
      >
        <!-- Image -->
        <NuxtLink :to="`/products/${product.slug ?? product.id}`" class="relative overflow-hidden">
          <img
            v-if="product.product_media?.find(m => m.is_primary) ?? product.product_media?.[0]"
            :src="mediaUrl((product.product_media?.find(m => m.is_primary) ?? product.product_media?.[0])?.media_url)"
            :alt="product.title"
            width="300" height="300"
            loading="lazy"
            class="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div v-else class="aspect-square bg-gray-100 flex items-center justify-center">
            <svg class="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            </svg>
          </div>

          <!-- Sold overlay -->
          <div v-if="product.status === 'sold' || product.stock === 0" class="absolute inset-0 flex items-center justify-center" style="background:rgba(0,0,0,0.45);">
            <span class="text-white text-xs font-bold px-2.5 py-1 rounded-full" style="background:rgba(239,68,68,0.85);">HABIS</span>
          </div>
        </NuxtLink>

        <!-- Remove button -->
        <button
          @click="removeFromWishlist(product.id)"
          class="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition shadow-sm text-red-500"
          :class="isDark ? 'bg-slate-800/90' : 'bg-white/90'"
          title="Hapus dari wishlist"
        >
          <svg class="w-4 h-4" fill="currentColor" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
          </svg>
        </button>

        <!-- Body -->
        <NuxtLink :to="`/products/${product.slug ?? product.id}`" class="p-3 flex flex-col gap-1.5 flex-1">
          <p class="font-bold text-sm line-clamp-2 leading-snug" :class="isDark ? 'text-slate-100' : 'text-gray-900'">{{ product.title }}</p>
          <p class="font-bold text-base" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Rp {{ product.price?.toLocaleString('id-ID') }}</p>

          <div class="flex flex-wrap gap-1 mt-auto pt-1">
            <span v-if="product.is_negotiable" class="text-xs px-1.5 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-green-900/60 text-green-300' : 'bg-green-50 text-green-700'">Nego</span>
            <span v-if="product.is_cod" class="text-xs px-1.5 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-green-900/60 text-green-300' : 'bg-green-50 text-green-700'">COD</span>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
