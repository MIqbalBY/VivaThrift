<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Pembayaran Berhasil — VivaThrift' })

const { isDark } = useDarkMode()
const { clearCart } = useCart()
const route = useRoute()

const orderId = computed(() => route.query.order_id as string | undefined)

// Verify payment status from Xendit and update order on mount
// (handles local dev where Xendit webhook can't reach localhost)
onMounted(async () => {
  clearCart()
  if (orderId.value) {
    try {
      await $fetch(`/api/checkout/verify?order_id=${orderId.value}`)
    } catch {
      // Silently ignore — non-critical, webhook will handle in production
    }
  }
})
</script>

<template>
  <div class="w-full max-w-lg mx-auto px-4 py-16 text-center">
    <img
      src="/img/illustrations/order-confirmed.svg"
      alt="Pembayaran berhasil"
      width="192" height="192"
      loading="lazy"
      class="w-48 h-auto mx-auto mb-6 opacity-90"
    />

    <h1 class="font-heading text-2xl font-bold mb-2" :style="isDark ? 'color:#ffffff' : 'color:#1e3a8a'">
      Pembayaran Berhasil!
    </h1>
    <p class="text-sm mb-2" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
      Pesananmu sedang diproses. Penjual akan segera mengonfirmasi.
    </p>
    <p class="text-xs mb-8" :class="isDark ? 'text-gray-500' : 'text-gray-400'">
      Pantau status pesanan, konfirmasi pengiriman, dan serah terima COD di halaman Pesanan.
    </p>

    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      <NuxtLink
        to="/orders?tab=confirmed"
        class="vt-btn-primary inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold text-sm hover:opacity-90 transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM1 9h22M1 15h22"/>
        </svg>
        Lihat Pesanan
      </NuxtLink>
      <NuxtLink
        to="/chat"
        class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition border"
        :class="isDark ? 'border-white/20 text-gray-300 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
      >
        Buka Chat
      </NuxtLink>
      <NuxtLink
        to="/"
        class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition border"
        :class="isDark ? 'border-white/20 text-gray-300 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
      >
        Lanjut Belanja
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.vt-btn-primary { background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); }
.dark .vt-btn-primary { background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8); }
</style>
