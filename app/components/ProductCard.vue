<script setup lang="ts">
const { isDark } = useDarkMode()

const props = withDefaults(defineProps<{
  product: any
  showSeller?: boolean
  isSold?: boolean
}>(), {
  showSeller: false,
  isSold: false,
})

const emit = defineEmits<{
  (e: 'seller-click', userId: string): void
}>()
</script>

<template>
  <NuxtLink
    :to="`/products/${product.slug ?? product.id}`"
    class="vt-product-card group rounded-xl border border-white/50 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer"
    :style="isDark
      ? 'background: rgba(15,23,42,0.80); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-color: rgba(255,255,255,0.08);'
      : 'background: rgba(255,255,255,0.70); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);'"
  >
    <!-- Image -->
    <div class="relative overflow-hidden rounded-t-xl">
      <img
        v-if="getPrimaryImage(product)"
        :src="getPrimaryImage(product)!"
        :alt="product.title"
        width="300"
        height="300"
        loading="lazy"
        class="aspect-square w-full object-cover rounded-t-xl transition-transform duration-500"
        :class="isSold ? 'opacity-60' : 'group-hover:scale-105'"
      />
      <div v-else class="bg-gray-100 aspect-square rounded-t-xl flex items-center justify-center">
        <svg class="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>

      <!-- Sold-out overlay -->
      <div v-if="isSold" class="absolute inset-0 flex items-center justify-center" style="background: rgba(0,0,0,0.45);">
        <span class="text-white text-xs font-bold px-2.5 py-1 rounded-full" style="background: rgba(239,68,68,0.85); letter-spacing:0.05em;">HABIS</span>
      </div>

      <!-- Floating badges top-left -->
      <div class="absolute top-2 left-2 flex flex-col items-start gap-1">
        <span v-if="product.condition" :class="['text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm', isDark ? 'bg-blue-900/80 text-blue-200 border border-blue-700' : 'bg-blue-50 text-blue-800 border border-blue-100']">{{ kondisiLabel(product.condition) }}</span>
        <span v-if="product.is_negotiable" :class="['text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm', isDark ? 'bg-green-900/80 text-green-200 border border-green-700' : 'bg-green-50 text-green-700 border border-green-100']">🤝 Nego</span>
        <span v-if="product.is_cod" :class="['text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm', isDark ? 'bg-green-900/80 text-green-200 border border-green-700' : 'bg-green-50 text-green-700 border border-green-100']">🚲 COD</span>
      </div>

      <!-- Category badge bottom-right -->
      <div v-if="product.categories?.name" class="absolute bottom-2 right-2">
        <span :class="['text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm border', isDark ? 'bg-blue-900/80 text-blue-200 border-blue-700' : 'bg-white/80 text-gray-700 border-gray-200']">
          {{ kategoriLabel(product.categories.name) }}
        </span>
      </div>
    </div>

    <!-- Body -->
    <div class="p-3 flex flex-col gap-2 flex-1">
      <!-- Title -->
      <p class="vt-product-title font-bold text-sm line-clamp-2 leading-snug text-gray-900">{{ product.title }}</p>

      <!-- Price -->
      <p v-if="!isSold" class="vt-product-price font-bold text-base" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">Rp {{ product.price?.toLocaleString('id-ID') }}</p>
      <p v-else class="text-xs font-semibold text-red-400">Stok habis</p>

      <!-- Divider -->
      <hr class="border-gray-100" />

      <!-- Seller section (index page) -->
      <template v-if="showSeller">
        <div
          class="flex items-center gap-2 rounded-lg transition hover:bg-black/5 cursor-pointer -mx-1 px-1 py-0.5"
          @click.prevent.stop="product.users?.id && emit('seller-click', product.users.id)"
        >
          <div class="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden" :style="isDark ? 'background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc)' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af)'">
            <img v-if="product.users?.avatar_url" :src="product.users.avatar_url" class="w-full h-full object-cover" />
            <span v-else class="text-white text-xs font-bold select-none">
              {{ (product.users?.name ?? '').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?' }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="vt-product-seller-name text-xs font-semibold text-gray-800 truncate">
              {{ product.users?.name ?? '-' }}
              <span v-if="product.users?.gender === 'Laki-laki'" title="Laki-laki">♂️</span>
              <span v-else-if="product.users?.gender === 'Perempuan'" title="Perempuan">♀️</span>
            </p>
            <p class="vt-product-seller-meta text-xs text-gray-500 truncate">
              {{ product.users?.nrp ?? '-' }}
              <template v-if="product.users?.faculty || product.users?.department">
                ({{ [fakultasAkronim(product.users?.faculty), product.users?.department].filter(Boolean).join(' - ') }})
              </template>
            </p>
            <!-- Rating -->
            <div class="flex items-center gap-1 mt-0.5">
              <svg class="w-3 h-3 text-yellow-400 fill-current shrink-0" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <template v-if="product._ratingCount > 0">
                <span class="text-xs text-gray-500">{{ product._sellerRating.toFixed(1) }} / 5.0</span>
                <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div class="h-1.5 rounded-full" :style="`background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); width:${Math.min(product._sellerRating / 5 * 100, 100)}%`"></div>
                </div>
              </template>
              <span v-else class="text-xs text-gray-500">Belum ada ulasan</span>
            </div>
          </div>
        </div>

        <hr class="border-gray-100" />
      </template>

      <!-- Date -->
      <p class="vt-product-date text-xs text-gray-500 text-right leading-snug">{{ productDate(product).label }}<br>{{ productDate(product).date }}</p>
    </div>
  </NuxtLink>
</template>
