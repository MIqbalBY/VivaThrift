<script setup lang="ts">
const { isDark } = useDarkMode()
const { cartItems, cartOpen, cartTotal, cartCount, removeFromCart, updateQuantity } = useCart()

function close() { cartOpen.value = false }
function getImage(item: any) {
  const media = item.product?.product_media
  return (media?.find((m: any) => m.is_primary) ?? media?.[0])?.media_url ?? null
}
</script>

<template>
  <!-- Overlay -->
  <Teleport to="body">
    <Transition name="vt-overlay">
      <div v-if="cartOpen" class="fixed inset-0 z-50 flex justify-end" @click.self="close">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close" />

        <!-- Drawer panel -->
        <Transition name="vt-drawer">
          <div
            v-if="cartOpen"
            class="relative z-10 w-full max-w-md h-full flex flex-col shadow-2xl"
            :class="isDark ? 'bg-[#0a1225]' : 'bg-white'"
          >
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b" :class="isDark ? 'border-white/10' : 'border-gray-100'">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" :class="isDark ? 'text-sky-400' : 'text-blue-800'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>
                </svg>
                <span class="font-heading font-bold text-lg" :class="isDark ? 'text-slate-100' : 'text-blue-950'">Keranjang</span>
                <span v-if="cartCount > 0" class="text-xs font-bold px-2 py-0.5 rounded-full" :class="isDark ? 'bg-sky-800 text-sky-200' : 'bg-blue-100 text-blue-700'">{{ cartCount }}</span>
              </div>
              <button @click="close" class="p-1.5 rounded-lg transition" :class="isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- Empty state -->
            <div v-if="cartItems.length === 0" class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
              <svg class="w-20 h-20 opacity-20" :class="isDark ? 'text-sky-400' : 'text-blue-300'" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>
              </svg>
              <p class="font-semibold" :class="isDark ? 'text-slate-300' : 'text-gray-500'">Keranjang kamu kosong</p>
              <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">Tambahkan produk dari halaman katalog.</p>
              <button @click="close" class="px-5 py-2 rounded-full text-white font-semibold text-sm" :class="isDark ? 'bg-sky-600 hover:bg-sky-500' : 'bg-blue-900 hover:bg-blue-800'">
                Jelajahi Produk
              </button>
            </div>

            <!-- Items list -->
            <div v-else class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div
                v-for="item in cartItems"
                :key="item.id"
                class="flex gap-3 p-3 rounded-xl border"
                :class="isDark ? 'border-white/8 bg-slate-800/50' : 'border-gray-100 bg-gray-50'"
              >
                <!-- Image -->
                <NuxtLink :to="`/products/${item.product?.slug ?? item.product_id}`" @click="close" class="shrink-0">
                  <NuxtImg
                    v-if="getImage(item)"
                    :src="getImage(item)"
                    :alt="item.product?.title"
                    width="72" height="72"
                    format="webp" quality="80" loading="lazy"
                    class="w-[72px] h-[72px] rounded-lg object-cover"
                  />
                  <div v-else class="w-[72px] h-[72px] rounded-lg flex items-center justify-center" :class="isDark ? 'bg-slate-700' : 'bg-gray-200'">
                    <svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
                  </div>
                </NuxtLink>

                <!-- Info -->
                <div class="flex-1 min-w-0 flex flex-col gap-1">
                  <NuxtLink :to="`/products/${item.product?.slug ?? item.product_id}`" @click="close">
                    <p class="text-sm font-semibold line-clamp-2 leading-snug" :class="isDark ? 'text-slate-100' : 'text-gray-900'">{{ item.product?.title }}</p>
                  </NuxtLink>
                  <p class="text-sm font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">
                    Rp {{ ((item.product?.price ?? 0) * item.quantity).toLocaleString('id-ID') }}
                  </p>

                  <!-- Quantity controls -->
                  <div class="flex items-center gap-2 mt-auto">
                    <button
                      @click="updateQuantity(item.id, item.quantity - 1)"
                      class="w-6 h-6 rounded-full border flex items-center justify-center transition text-sm font-bold"
                      :class="isDark ? 'border-white/20 text-gray-300 hover:bg-white/10' : 'border-gray-300 text-gray-600 hover:bg-gray-100'"
                    >−</button>
                    <span class="text-sm font-semibold min-w-[20px] text-center" :class="isDark ? 'text-slate-200' : 'text-gray-800'">{{ item.quantity }}</span>
                    <button
                      @click="updateQuantity(item.id, item.quantity + 1)"
                      :disabled="item.product?.stock !== null && item.quantity >= (item.product?.stock ?? 99)"
                      class="w-6 h-6 rounded-full border flex items-center justify-center transition text-sm font-bold disabled:opacity-40"
                      :class="isDark ? 'border-white/20 text-gray-300 hover:bg-white/10' : 'border-gray-300 text-gray-600 hover:bg-gray-100'"
                    >+</button>
                    <span v-if="item.product?.stock !== null" class="text-xs ml-1" :class="isDark ? 'text-slate-500' : 'text-gray-400'">/ {{ item.product?.stock }}</span>
                    <button
                      @click="removeFromCart(item.id)"
                      class="ml-auto transition"
                      :class="isDark ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600'"
                      title="Hapus"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div v-if="cartItems.length > 0" class="border-t px-5 py-4 space-y-3" :class="isDark ? 'border-white/10' : 'border-gray-100'">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Total</span>
                <span class="text-lg font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Rp {{ cartTotal.toLocaleString('id-ID') }}</span>
              </div>
              <NuxtLink
                to="/cart"
                @click="close"
                class="flex items-center justify-center gap-2 w-full py-3 rounded-full text-white font-semibold text-sm transition hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                :class="isDark ? 'bg-sky-600 hover:bg-sky-500' : 'bg-blue-900 hover:bg-blue-800'"
              >
                Lihat Keranjang & Checkout
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </NuxtLink>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.vt-overlay-enter-active,
.vt-overlay-leave-active { transition: opacity 0.2s; }
.vt-overlay-enter-from,
.vt-overlay-leave-to { opacity: 0; }

.vt-drawer-enter-active,
.vt-drawer-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.vt-drawer-enter-from,
.vt-drawer-leave-to { transform: translateX(100%); }
</style>
