<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Checkout Keranjang — VivaThrift' })

const { isDark } = useDarkMode()
const { cartItems, cartTotal, cartCount, fetchCart } = useCart()
const route = useRoute()

const placing      = ref(false)
const errorMsg     = ref('')
const paymentFailed = computed(() => !!route.query.payment_failed)

// Pastikan cart terisi sebelum render
onMounted(async () => {
  if (cartItems.value.length === 0) await fetchCart()
  if (cartItems.value.length === 0) await navigateTo('/cart')
})

// Kelompok per penjual (untuk tampilan summary)
const itemsBySeller = computed(() => {
  const map = new Map<string, { sellerName: string; items: typeof cartItems.value; subtotal: number }>()
  for (const item of cartItems.value) {
    const sellerId = item.product?.seller_id ?? 'unknown'
    if (!map.has(sellerId)) {
      map.set(sellerId, {
        sellerName: item.product?.users?.name ?? 'Penjual',
        items:      [],
        subtotal:   0,
      })
    }
    const g = map.get(sellerId)!
    g.items.push(item)
    g.subtotal += (item.product?.price ?? 0) * item.quantity
  }
  return [...map.values()]
})

function getImage(item: any) {
  const media = item.product?.product_media
  return (media?.find((m: any) => m.is_primary) ?? media?.[0])?.media_url ?? null
}

async function handleCheckout() {
  if (placing.value) return
  placing.value = true
  errorMsg.value = ''
  try {
    const result = await $fetch<{ paymentUrl: string }>('/api/checkout/cart', { method: 'POST' })
    if (result.paymentUrl) {
      await navigateTo(result.paymentUrl, { external: true })
    }
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage ?? e?.message ?? 'Terjadi kesalahan. Coba lagi.'
  } finally {
    placing.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-5xl mx-auto px-4 md:px-8 py-8">

    <!-- Header -->
    <div class="vt-hero-enter vt-hero-enter-d1 flex items-center gap-3 mb-8">
      <NuxtLink to="/cart" class="vt-back-btn inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a8a] transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        Keranjang
      </NuxtLink>
      <h1 class="font-heading text-2xl font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Konfirmasi Pembayaran</h1>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

      <!-- Kiri: ringkasan item -->
      <div class="space-y-4">

        <!-- Payment failed banner -->
        <div v-if="paymentFailed" class="flex items-start gap-3 rounded-xl px-4 py-3 border border-red-200 bg-red-50 text-sm text-red-700">
          <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          Pembayaran sebelumnya gagal atau dibatalkan. Silakan coba lagi.
        </div>

        <!-- Items grouped by seller -->
        <div
          v-for="group in itemsBySeller"
          :key="group.sellerName"
          class="rounded-xl border overflow-hidden"
          :class="isDark ? 'border-white/10 bg-slate-900/50' : 'border-gray-200 bg-white'"
        >
          <!-- Seller header -->
          <div class="flex items-center gap-2 px-4 py-3 border-b text-xs font-semibold" :class="isDark ? 'border-white/8 bg-slate-800/50 text-slate-300' : 'border-gray-100 bg-gray-50 text-gray-600'">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            {{ group.sellerName }}
          </div>

          <!-- Items -->
          <div class="divide-y" :class="isDark ? 'divide-white/8' : 'divide-gray-100'">
            <div v-for="item in group.items" :key="item.id" class="flex gap-3 p-4">
              <img
                v-if="getImage(item)"
                :src="getImage(item)"
                :alt="item.product?.title"
                width="64" height="64"
                loading="lazy"
                class="w-16 h-16 rounded-lg object-cover shrink-0"
              />
              <div v-else class="w-16 h-16 rounded-lg shrink-0 flex items-center justify-center" :class="isDark ? 'bg-slate-700' : 'bg-gray-100'">
                <svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold line-clamp-2" :class="isDark ? 'text-slate-100' : 'text-gray-900'">{{ item.product?.title }}</p>
                <p class="text-xs mt-1" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                  {{ item.quantity }} × Rp {{ item.product?.price?.toLocaleString('id-ID') }}
                </p>
                <p class="text-sm font-bold mt-1" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">
                  Rp {{ ((item.product?.price ?? 0) * item.quantity).toLocaleString('id-ID') }}
                </p>
              </div>
            </div>
          </div>

          <!-- Group subtotal -->
          <div class="flex justify-between px-4 py-2.5 border-t text-xs font-semibold" :class="isDark ? 'border-white/8 bg-slate-800/30 text-slate-400' : 'border-gray-100 bg-gray-50 text-gray-500'">
            <span>Subtotal penjual ini</span>
            <span :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Rp {{ group.subtotal.toLocaleString('id-ID') }}</span>
          </div>
        </div>

        <!-- Xendit info banner -->
        <div class="flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs" :class="isDark ? 'bg-sky-900/30 border border-sky-700/40 text-sky-300' : 'bg-blue-50 border border-blue-100 text-blue-700'">
          <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <span>Pembayaran diamankan oleh <strong class="mx-0.5">Xendit</strong>. Tersedia QRIS, Transfer Bank, Virtual Account, dan E-Wallet (OVO, GoPay, Dana, ShopeePay). Dana hanya diteruskan ke penjual setelah transaksi selesai.</span>
        </div>
      </div>

      <!-- Kanan: total & tombol bayar -->
      <div class="rounded-xl border p-5 space-y-4 lg:sticky lg:top-24" :class="isDark ? 'border-white/10 bg-slate-900/50' : 'border-gray-200 bg-white'">
        <h2 class="font-heading font-bold text-base" :class="isDark ? 'text-slate-100' : 'text-gray-900'">Ringkasan Pembayaran</h2>

        <div class="space-y-2 text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
          <div class="flex justify-between">
            <span>Total item</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">{{ cartCount }} item</span>
          </div>
          <div class="flex justify-between">
            <span>Subtotal</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Rp {{ cartTotal.toLocaleString('id-ID') }}</span>
          </div>
        </div>

        <div class="border-t pt-3" :class="isDark ? 'border-white/10' : 'border-gray-100'">
          <div class="flex justify-between items-center mb-4">
            <span class="font-bold" :class="isDark ? 'text-slate-100' : 'text-gray-900'">Total</span>
            <span class="text-xl font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Rp {{ cartTotal.toLocaleString('id-ID') }}</span>
          </div>

          <p v-if="errorMsg" class="text-red-500 text-xs mb-3 p-2.5 rounded-lg bg-red-50 border border-red-100">{{ errorMsg }}</p>

          <button
            @click="handleCheckout"
            :disabled="placing || cartItems.length === 0"
            class="w-full py-3 rounded-full text-white font-bold text-sm transition hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            :class="isDark ? 'bg-sky-600 hover:bg-sky-500' : 'bg-blue-900 hover:bg-blue-800'"
          >
            <svg v-if="placing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {{ placing ? 'Menyiapkan pembayaran…' : '🔒 Bayar Sekarang' }}
          </button>

          <!-- Metode pembayaran tersedia -->
          <div class="mt-4 flex flex-wrap gap-1.5 justify-center">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'">QRIS</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'">Transfer Bank</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'">Virtual Account</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'">OVO</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'">GoPay</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'">Dana</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
