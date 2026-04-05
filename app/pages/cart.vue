<script setup>
definePageMeta({ middleware: 'auth' })

useSeoMeta({ title: 'Keranjang Belanja — VivaThrift' })

const { isDark } = useDarkMode()
const { cartItems, cartTotal, cartCount, fetchCart, updateQuantity, removeFromCart, validateCartStock, clearCart } = useCart()
const user = useSupabaseUser()

const loading = ref(true)
const validating = ref(false)
const stockWarnings = ref([])
const toast = ref('')
const checkoutError = ref('')

async function load() {
  loading.value = true
  await fetchCart()
  loading.value = false
}

async function handleValidateAndCheckout() {
  if (cartItems.value.length === 0) return
  validating.value = true
  stockWarnings.value = []
  checkoutError.value = ''
  try {
    const { removed } = await validateCartStock()
    if (removed.length > 0) {
      stockWarnings.value = removed
      showToast(`${removed.length} produk dihapus karena tidak tersedia.`)
      return
    }
    await navigateTo('/cart/checkout')
  } catch (e) {
    checkoutError.value = e?.data?.statusMessage ?? e?.message ?? 'Terjadi kesalahan. Coba lagi.'
  } finally {
    validating.value = false
  }
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => toast.value = '', 4000)
}

function getImage(item) {
  const media = item.product?.product_media
  return (media?.find(m => m.is_primary) ?? media?.[0])?.media_url ?? null
}

// Group items by seller
const itemsBySeller = computed(() => {
  const map = new Map()
  for (const item of cartItems.value) {
    const sellerId = item.product?.seller_id ?? 'unknown'
    if (!map.has(sellerId)) {
      map.set(sellerId, {
        seller: item.product?.users,
        items: [],
        subtotal: 0,
      })
    }
    const group = map.get(sellerId)
    group.items.push(item)
    group.subtotal += (item.product?.price ?? 0) * item.quantity
  }
  return [...map.values()]
})

onMounted(load)
</script>

<template>
  <div class="w-full max-w-5xl mx-auto px-4 md:px-8 py-8">

    <!-- Header -->
    <div class="vt-hero-enter vt-hero-enter-d1 flex items-center gap-3 mb-8">
      <NuxtLink to="/" class="vt-back-btn inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a8a] transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        Kembali
      </NuxtLink>
      <h1 class="font-heading text-2xl font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Keranjang Belanja</h1>
      <span v-if="!loading && cartCount > 0" class="text-sm font-medium px-2.5 py-0.5 rounded-full" :class="isDark ? 'bg-sky-900/60 text-sky-300' : 'bg-blue-50 text-blue-700'">
        {{ cartCount }} item
      </span>
    </div>

    <!-- Toast -->
    <Transition name="vt-toast">
      <div
        v-if="toast"
        class="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-sm font-semibold text-white shadow-lg"
        style="background: linear-gradient(135deg, #dc2626, #b91c1c);"
      >
        {{ toast }}
      </div>
    </Transition>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="rounded-xl p-4 animate-pulse flex gap-4" :class="isDark ? 'bg-slate-800' : 'bg-gray-100'">
        <div class="w-20 h-20 rounded-lg" :class="isDark ? 'bg-slate-700' : 'bg-gray-200'" />
        <div class="flex-1 space-y-2">
          <div class="h-4 rounded w-2/3" :class="isDark ? 'bg-slate-700' : 'bg-gray-200'" />
          <div class="h-4 rounded w-1/3" :class="isDark ? 'bg-slate-700' : 'bg-gray-200'" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="cartItems.length === 0" class="vt-hero-enter vt-hero-enter-d2 flex flex-col items-center text-center py-24 gap-4">
      <svg class="w-20 h-20 opacity-20" :class="isDark ? 'text-sky-400' : 'text-blue-300'" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/>
      </svg>
      <p class="font-semibold text-lg" :class="isDark ? 'text-slate-300' : 'text-gray-500'">Keranjang kamu kosong</p>
      <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">Tambahkan produk dari halaman katalog untuk mulai belanja.</p>
      <NuxtLink to="/" class="mt-2 px-6 py-2.5 rounded-full text-white font-semibold text-sm transition hover:shadow-lg hover:-translate-y-0.5" :class="isDark ? 'bg-sky-600 hover:bg-sky-500' : 'bg-blue-900 hover:bg-blue-800'">
        Jelajahi Produk
      </NuxtLink>
    </div>

    <!-- Cart content -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

      <!-- Left: items grouped by seller -->
      <div class="space-y-5">

        <!-- Stock warning -->
        <div v-if="stockWarnings.length > 0" class="rounded-xl p-4 border border-red-200 bg-red-50 text-sm">
          <p class="font-semibold text-red-700 mb-1">Beberapa produk dihapus karena stok habis:</p>
          <ul class="list-disc pl-4 text-red-600 space-y-0.5">
            <li v-for="name in stockWarnings" :key="name">{{ name }}</li>
          </ul>
        </div>

        <div v-for="group in itemsBySeller" :key="group.seller?.id ?? 'unknown'" class="rounded-xl border overflow-hidden" :class="isDark ? 'border-white/10 bg-slate-900/50' : 'border-gray-200 bg-white'">
          <!-- Seller header -->
          <div class="flex items-center gap-2 px-4 py-3 border-b" :class="isDark ? 'border-white/8 bg-slate-800/50' : 'border-gray-100 bg-gray-50'">
            <div class="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold shrink-0" :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background:linear-gradient(to right,#162d6e,#1e40af)'">
              <img v-if="group.seller?.avatar_url" :src="group.seller.avatar_url" class="w-full h-full object-cover" />
              <span v-else>{{ (group.seller?.name ?? '?')[0] }}</span>
            </div>
            <span class="text-xs font-semibold truncate" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ group.seller?.name ?? 'Penjual' }}</span>
          </div>

          <!-- Items -->
          <div class="divide-y" :class="isDark ? 'divide-white/8' : 'divide-gray-100'">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="flex gap-3 p-4"
            >
              <NuxtLink :to="`/products/${item.product?.slug ?? item.product_id}`" class="shrink-0">
                <NuxtImg
                  v-if="getImage(item)"
                  :src="getImage(item)"
                  :alt="item.product?.title"
                  width="88" height="88"
                  format="webp" quality="80" loading="lazy"
                  class="w-[88px] h-[88px] rounded-lg object-cover"
                />
                <div v-else class="w-[88px] h-[88px] rounded-lg flex items-center justify-center" :class="isDark ? 'bg-slate-700' : 'bg-gray-100'">
                  <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
                </div>
              </NuxtLink>

              <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                <NuxtLink :to="`/products/${item.product?.slug ?? item.product_id}`">
                  <p class="text-sm font-semibold line-clamp-2 leading-snug hover:underline" :class="isDark ? 'text-slate-100' : 'text-gray-900'">{{ item.product?.title }}</p>
                </NuxtLink>
                <p class="text-sm font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">
                  Rp {{ ((item.product?.price ?? 0) * item.quantity).toLocaleString('id-ID') }}
                  <span class="text-xs font-normal ml-1" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
                    ({{ item.quantity }} × Rp {{ item.product?.price?.toLocaleString('id-ID') }})
                  </span>
                </p>

                <!-- Stock indicator -->
                <p v-if="item.product?.stock !== null" class="text-xs" :class="(item.product?.stock ?? 0) <= 3 ? 'text-orange-500 font-semibold' : isDark ? 'text-slate-500' : 'text-gray-400'">
                  Sisa {{ item.product?.stock }} unit
                </p>

                <!-- Quantity + remove -->
                <div class="flex items-center gap-2 mt-auto">
                  <button @click="updateQuantity(item.id, item.quantity - 1)" class="w-7 h-7 rounded-full border flex items-center justify-center transition font-bold text-sm" :class="isDark ? 'border-white/20 text-gray-300 hover:bg-white/10' : 'border-gray-300 text-gray-600 hover:bg-gray-100'">−</button>
                  <span class="text-sm font-semibold min-w-[24px] text-center" :class="isDark ? 'text-slate-100' : 'text-gray-800'">{{ item.quantity }}</span>
                  <button
                    @click="updateQuantity(item.id, item.quantity + 1)"
                    :disabled="item.product?.stock !== null && item.quantity >= (item.product?.stock ?? 99)"
                    class="w-7 h-7 rounded-full border flex items-center justify-center transition font-bold text-sm disabled:opacity-40"
                    :class="isDark ? 'border-white/20 text-gray-300 hover:bg-white/10' : 'border-gray-300 text-gray-600 hover:bg-gray-100'"
                  >+</button>

                  <button @click="removeFromCart(item.id)" class="ml-auto text-sm transition flex items-center gap-1" :class="isDark ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600'">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Group subtotal -->
          <div class="flex items-center justify-between px-4 py-3 border-t text-sm font-semibold" :class="isDark ? 'border-white/8 bg-slate-800/30 text-slate-300' : 'border-gray-100 bg-gray-50 text-gray-600'">
            <span>Subtotal penjual ini</span>
            <span :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Rp {{ group.subtotal.toLocaleString('id-ID') }}</span>
          </div>
        </div>
      </div>

      <!-- Right: summary + checkout -->
      <div class="rounded-xl border p-5 space-y-4 lg:sticky lg:top-24" :class="isDark ? 'border-white/10 bg-slate-900/50' : 'border-gray-200 bg-white'">
        <h2 class="font-heading font-bold text-base" :class="isDark ? 'text-slate-100' : 'text-gray-900'">Ringkasan Pesanan</h2>

        <div class="space-y-2 text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
          <div class="flex justify-between">
            <span>Total item</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">{{ cartCount }} item</span>
          </div>
          <div class="flex justify-between">
            <span>Subtotal</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Rp {{ cartTotal.toLocaleString('id-ID') }}</span>
          </div>
          <p class="text-xs pt-1" :class="isDark ? 'text-slate-500' : 'text-gray-400'">Ongkir dihitung saat checkout berdasarkan metode pengiriman.</p>
        </div>

        <div class="border-t pt-3" :class="isDark ? 'border-white/10' : 'border-gray-100'">
          <div class="flex justify-between items-center">
            <span class="font-bold" :class="isDark ? 'text-slate-100' : 'text-gray-900'">Total</span>
            <span class="text-xl font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Rp {{ cartTotal.toLocaleString('id-ID') }}</span>
          </div>
        </div>

        <p v-if="checkoutError" class="text-red-500 text-xs p-2.5 rounded-lg border border-red-100 bg-red-50">
          {{ checkoutError }}
        </p>

        <button
          @click="handleValidateAndCheckout"
          :disabled="validating || cartItems.length === 0"
          class="w-full py-3 rounded-full text-white font-bold text-sm transition hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          :class="isDark ? 'bg-sky-600 hover:bg-sky-500' : 'bg-blue-900 hover:bg-blue-800'"
        >
          <svg v-if="validating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
          <span>{{ validating ? 'Memvalidasi stok…' : 'Lanjutkan ke Checkout' }}</span>
        </button>

        <button @click="clearCart" class="w-full text-xs text-center transition" :class="isDark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'">
          Kosongkan keranjang
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vt-toast-enter-active, .vt-toast-leave-active { transition: all 0.25s ease; }
.vt-toast-enter-from, .vt-toast-leave-to { opacity: 0; transform: translate(-50%, -12px); }
</style>
