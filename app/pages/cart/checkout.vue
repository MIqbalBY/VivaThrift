<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Checkout Keranjang — VivaThrift' })

const { isDark } = useDarkMode()
const runtimeConfig = useRuntimeConfig()
const { cartItems, cartTotal, cartCount, fetchCart } = useCart()
const route    = useRoute()
const supabase = useSupabaseClient()
const user     = useSupabaseUser()

const placing      = ref(false)
const errorMsg     = ref('')
const paymentFailed = computed(() => !!route.query.payment_failed)
const existingPaymentUrl = ref('')
const canRegenerateInvoice = ref(false)

// ── Shipping state ──────────────────────────────────────────────────────────
const MEETUP_LOCATIONS = [
  { id: 'aula_asrama',     label: 'Aula Asrama ITS' },
  { id: 'rektorat',        label: 'Depan Rektorat ITS' },
  { id: 'gedung_robotika', label: 'Gedung Robotika ITS' },
  { id: 'kantin_pusat',    label: 'Kantin Pusat ITS' },
  { id: 'masjid_manarul',  label: 'Masjid Manarul Ilmi ITS' },
  { id: 'research_center', label: 'Research Center ITS' },
  { id: 'taman_alumni',    label: 'Taman Alumni ITS' },
  { id: 'taman_infinits',  label: 'Taman Infinits' },
  { id: 'tower_1',         label: 'Tower 1 ITS' },
  { id: 'tower_2',         label: 'Tower 2 ITS' },
  { id: 'tower_3',         label: 'Tower 3 ITS' },
  { id: 'other',           label: 'Lainnya' },
] as const

const shippingMethod  = ref<'cod' | 'shipping'>('cod')
const paymentChannel  = ref<string>('qris')
const meetupLocation  = ref<string>('rektorat')
const meetupCustom    = ref<string>('')
const destPostal      = ref<string>('')
const rates           = ref<any[]>([])
const selectedRate    = ref<any | null>(null)
const ratesLoading    = ref(false)
const ratesErr        = ref('')

// ── Buyer address (auto-fetched from profile) ───────────────────────────────
const buyerAddress        = ref<any>(null)
const buyerAddressLoading = ref(false)

const ongkirAmount = computed(() =>
  shippingMethod.value === 'shipping' ? (selectedRate.value?.price ?? 0) : 0
)

// Mirror platform fee tiers from server/utils/domain-rules.ts
function calcPlatformFee(subtotal: number): number {
  if (subtotal <= 100_000) return 1_000
  if (subtotal <= 500_000) return 2_000
  return Math.round(subtotal * 0.005)
}
const platformFee = computed(() => calcPlatformFee(cartTotal.value))
const feeByChannelMap = computed<Record<string, { percent?: number; flat?: number }>>(() => {
  try {
    const parsed = JSON.parse(String(runtimeConfig.public.xenditPaymentFeeByChannelJson ?? '{}'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
})

const paymentChargeBreakdown = computed(() => {
  const key = String(paymentChannel.value ?? '').toLowerCase()
  const byChannel = feeByChannelMap.value[key]
  const percent = Number(byChannel?.percent ?? runtimeConfig.public.xenditPaymentFeePercent ?? 0)
  const flat = Math.round(Number(byChannel?.flat ?? runtimeConfig.public.xenditPaymentFeeFlat ?? 0))
  const taxPercent = Number(runtimeConfig.public.xenditPaymentFeeTaxPercent ?? 11)
  const baseAmount = cartTotal.value + ongkirAmount.value
  const gatewayFeeBase = Math.round((Math.max(0, baseAmount) * Math.max(0, percent)) / 100) + Math.max(0, flat)
  const gatewayFeeTax = Math.round((Math.max(0, gatewayFeeBase) * Math.max(0, taxPercent)) / 100)
  return {
    gatewayFeeBase,
    gatewayFeeTax,
    total: gatewayFeeBase + gatewayFeeTax,
  }
})

const grandTotal = computed(() => cartTotal.value + ongkirAmount.value)

async function fetchRates() {
  if (!destPostal.value.trim()) {
    ratesErr.value = 'Masukkan kode pos tujuan.'
    return
  }
  ratesLoading.value = true
  ratesErr.value     = ''
  selectedRate.value = null
  rates.value        = []
  try {
    const shippingItems = cartItems.value.map(item => ({
      weight: (item.product as any)?.weight ?? 500,
      length: (item.product as any)?.length ?? null,
      width:  (item.product as any)?.width  ?? null,
      height: (item.product as any)?.height ?? null,
    }))

    // Pakai koordinat jika buyer sudah pinpoint (munculkan GoSend/GrabExpress)
    // Fallback ke kode pos jika belum ada koordinat
    const hasCoords = buyerAddress.value?.lat && buyerAddress.value?.lng
    const rateBody = hasCoords
      ? {
          // ITS Sukolilo sebagai titik origin (lat/lng)
          origin_lat:       -7.2826,
          origin_lng:       112.7955,
          destination_lat:  Number(buyerAddress.value.lat),
          destination_lng:  Number(buyerAddress.value.lng),
          items:            shippingItems,
        }
      : {
          origin_postal_code:      '60111',
          destination_postal_code: destPostal.value.trim(),
          items:                   shippingItems,
        }

    const res = await $fetch<{ rates: any[] }>('/api/shipping/rates', {
      method: 'POST',
      body: rateBody,
    })
    rates.value = res.rates ?? []
    if (!rates.value.length) ratesErr.value = 'Tidak ada layanan pengiriman tersedia untuk kode pos ini.'
  } catch (e: any) {
    ratesErr.value = e?.data?.statusMessage ?? e?.message ?? 'Gagal mengambil tarif pengiriman.'
  } finally {
    ratesLoading.value = false
  }
}

// Pastikan cart terisi sebelum render, dan fetch alamat pembeli dari profil
onMounted(async () => {
  if (cartItems.value.length === 0) await fetchCart()
  if (cartItems.value.length === 0) await navigateTo('/cart')

  // Gunakan getSession() langsung seperti checkout.vue — lebih reliable dari useSupabaseUser()
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id ?? user.value?.id
  if (!uid) return

  buyerAddressLoading.value = true
  const { data } = await supabase
    .from('addresses')
    .select('label, full_address, city, postal_code, lat, lng')
    .eq('user_id', uid)
    .eq('address_type', 'shipping')
    .maybeSingle()
  buyerAddress.value = data ?? null
  if (data?.postal_code) destPostal.value = data.postal_code
  buyerAddressLoading.value = false
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
  return mediaUrl((media?.find((m: any) => m.is_primary) ?? media?.[0])?.media_url ?? null)
}

async function handleCheckout(forceRegenerateInvoice = false) {
  if (placing.value) return
  existingPaymentUrl.value = ''
  canRegenerateInvoice.value = false
  if (shippingMethod.value === 'shipping' && !selectedRate.value) {
    errorMsg.value = 'Pilih layanan pengiriman terlebih dahulu.'
    return
  }
  placing.value = true
  errorMsg.value = ''
  try {
    const body: any = {
      shippingMethod: shippingMethod.value,
      paymentChannel: paymentChannel.value,
      forceRegenerateInvoice,
    }
    if (shippingMethod.value === 'cod') {
      const loc = meetupLocation.value === 'other'
        ? meetupCustom.value.trim()
        : meetupLocation.value
      if (!loc) {
        errorMsg.value = 'Masukkan nama lokasi meetup.'
        placing.value = false
        return
      }
      body.meetupLocation = loc
    } else {
      body.shippingCost = selectedRate.value!.price
      body.courierCode  = selectedRate.value!.courier_code
    }
    const result = await $fetch<{ paymentUrl: string }>('/api/checkout/cart', { method: 'POST', body })
    if (result.paymentUrl) {
      await navigateTo(result.paymentUrl, { external: true })
    }
  } catch (e: any) {
    const msg = e?.data?.statusMessage ?? e?.message ?? 'Terjadi kesalahan. Coba lagi.'
    const statusCode = Number(e?.data?.statusCode ?? 0)
    const existingUrl = String(e?.data?.data?.existingPaymentUrl ?? '')
    const canReissue = e?.data?.data?.canRegenerateInvoice === true
    if (statusCode === 409 && existingUrl) {
      existingPaymentUrl.value = existingUrl
      canRegenerateInvoice.value = canReissue
    }
    errorMsg.value = msg
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

        <!-- ── Metode Pengiriman ── -->
        <div
          class="rounded-xl border p-5"
          :class="isDark ? 'border-white/10 bg-slate-900/50' : 'border-gray-200 bg-white'"
        >
          <p class="text-sm font-semibold mb-3" :class="isDark ? 'text-white' : 'text-gray-700'">Metode Pengiriman</p>
          <div class="grid grid-cols-2 gap-3">
            <!-- COD -->
            <button
              @click="shippingMethod = 'cod'; selectedRate = null; rates = []"
              class="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 text-sm font-semibold border-2 transition"
              :class="shippingMethod === 'cod'
                ? (isDark ? 'border-sky-500 bg-sky-900/40 text-sky-300' : 'border-blue-600 bg-blue-50 text-blue-700')
                : (isDark ? 'border-white/10 text-gray-400 hover:border-white/20' : 'border-gray-200 text-gray-500 hover:border-gray-300')"
            >
              <span class="text-xl">🤝</span>
              <span>COD / Meetup</span>
              <span class="text-xs font-normal opacity-70">Ketemu di kampus</span>
            </button>
            <!-- Shipping -->
            <button
              @click="shippingMethod = 'shipping'"
              class="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 text-sm font-semibold border-2 transition"
              :class="shippingMethod === 'shipping'
                ? (isDark ? 'border-sky-500 bg-sky-900/40 text-sky-300' : 'border-blue-600 bg-blue-50 text-blue-700')
                : (isDark ? 'border-white/10 text-gray-400 hover:border-white/20' : 'border-gray-200 text-gray-500 hover:border-gray-300')"
            >
              <span class="text-xl">🚚</span>
              <span>Kirim Paket</span>
              <span class="text-xs font-normal opacity-70">Semua Kurir</span>
            </button>
          </div>

          <!-- COD: Meetup location picker -->
          <div v-if="shippingMethod === 'cod'" class="mt-4">
            <p class="text-xs font-semibold mb-2" :class="isDark ? 'text-gray-400' : 'text-gray-500'">LOKASI MEETUP</p>
            <div class="space-y-2">
              <label
                v-for="loc in MEETUP_LOCATIONS"
                :key="loc.id"
                class="flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition"
                :class="meetupLocation === loc.id
                  ? (isDark ? 'border-sky-500 bg-sky-900/30' : 'border-blue-500 bg-blue-50')
                  : (isDark ? 'border-white/10 hover:border-white/20' : 'border-gray-200 hover:border-gray-300')"
              >
                <input
                  type="radio"
                  name="meetupLocation"
                  :value="loc.id"
                  v-model="meetupLocation"
                  class="accent-blue-600"
                />
                <p class="text-sm font-medium" :class="isDark ? 'text-white' : 'text-gray-800'">{{ loc.label }}</p>
              </label>
            </div>
            <!-- Custom location input for "Lainnya" -->
            <div v-if="meetupLocation === 'other'" class="mt-2">
              <input
                v-model="meetupCustom"
                type="text"
                maxlength="100"
                placeholder="Ketik nama lokasi meetup..."
                class="w-full rounded-xl px-3 py-2 text-sm border outline-none transition"
                :class="isDark
                  ? 'bg-slate-800 border-sky-500/60 text-white placeholder-gray-500 focus:border-sky-500'
                  : 'bg-white border-blue-400 text-gray-800 placeholder-gray-400 focus:border-blue-600'"
              />
            </div>
          </div>

          <!-- Shipping: Alamat Pengiriman (dari profil) -->
          <div v-if="shippingMethod === 'shipping'" class="mt-4">
            <p class="text-xs font-semibold mb-2" :class="isDark ? 'text-gray-400' : 'text-gray-500'">ALAMAT PENGIRIMAN</p>
            <div v-if="buyerAddressLoading" class="text-xs" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Memuat alamat…</div>
            <div v-else-if="buyerAddress" class="rounded-xl border p-3 text-sm" :class="isDark ? 'border-white/10 bg-slate-800/50' : 'border-gray-200 bg-gray-50'">
              <p v-if="buyerAddress.label" class="text-xs font-semibold uppercase tracking-wide mb-1" :class="isDark ? 'text-sky-400' : 'text-blue-700'">{{ buyerAddress.label }}</p>
              <p :class="isDark ? 'text-slate-200' : 'text-gray-800'">{{ buyerAddress.full_address }}</p>
              <p v-if="buyerAddress.city" class="text-xs mt-0.5" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                {{ buyerAddress.city }}<template v-if="buyerAddress.postal_code"> · {{ buyerAddress.postal_code }}</template>
              </p>
              <NuxtLink to="/profile/edit?tab=address" class="text-xs mt-1 inline-block hover:underline" :class="isDark ? 'text-sky-400' : 'text-blue-500'">Ganti alamat</NuxtLink>
            </div>
            <div v-else class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" :class="isDark ? 'border-amber-700/40 bg-amber-900/20 text-amber-300' : ''">
              ⚠️ Belum ada alamat pengiriman.
              <NuxtLink to="/profile/edit?tab=address" class="font-semibold underline ml-1">Isi di profil</NuxtLink> sebelum checkout.
            </div>
          </div>

          <!-- Shipping: Ongkir calculator -->
          <div v-if="shippingMethod === 'shipping'" class="mt-4">
            <p class="text-xs font-semibold mb-2" :class="isDark ? 'text-gray-400' : 'text-gray-500'">KALKULASI ONGKIR</p>
            <p class="text-xs mb-2" :class="isDark ? 'text-gray-500' : 'text-gray-400'">Dari: Kampus ITS Surabaya (60111)</p>
            <div class="flex gap-2">
              <input
                v-model="destPostal"
                type="text"
                inputmode="numeric"
                maxlength="5"
                placeholder="Kode pos tujuan"
                class="flex-1 rounded-xl px-3 py-2 text-sm border outline-none transition"
                :class="isDark
                  ? 'bg-slate-800 border-white/10 text-white placeholder-gray-500 focus:border-sky-500'
                  : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-blue-500'"
                @keydown.enter="fetchRates"
              />
              <button
                @click="fetchRates"
                :disabled="ratesLoading"
                class="px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60"
                :style="isDark
                  ? 'background:linear-gradient(to right,#0ea5e9,#38bdf8);'
                  : 'background:linear-gradient(to right,#1e3a8a,#1e40af);'"
              >
                {{ ratesLoading ? '…' : 'Cek' }}
              </button>
            </div>
            <p v-if="ratesErr" class="text-xs text-red-500 mt-1.5">{{ ratesErr }}</p>

            <!-- Rate options -->
            <div v-if="rates.length" class="mt-3 space-y-2">
              <label
                v-for="rate in rates"
                :key="`${rate.courier_code}-${rate.service}`"
                class="flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition"
                :class="selectedRate === rate
                  ? (isDark ? 'border-sky-500 bg-sky-900/30' : 'border-blue-500 bg-blue-50')
                  : (isDark ? 'border-white/10 hover:border-white/20' : 'border-gray-200 hover:border-gray-300')"
              >
                <input
                  type="radio"
                  name="shippingRate"
                  :value="rate"
                  v-model="selectedRate"
                  class="accent-blue-600"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium" :class="isDark ? 'text-white' : 'text-gray-800'">
                    {{ rate.courier_name }} — {{ rate.description }}
                  </p>
                  <p class="text-xs" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
                    Estimasi {{ rate.etd }}
                  </p>
                </div>
                <span class="text-sm font-bold shrink-0" :class="isDark ? 'text-sky-300' : 'text-blue-700'">
                  Rp {{ rate.price.toLocaleString('id-ID') }}
                </span>
              </label>
            </div>
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

        <div>
          <p class="text-xs font-semibold mb-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">METODE PEMBAYARAN</p>
          <select
            v-model="paymentChannel"
            class="w-full rounded-xl px-3 py-2 text-sm border outline-none transition"
            :class="isDark
              ? 'bg-slate-800 border-white/10 text-white focus:border-sky-500'
              : 'bg-white border-gray-200 text-gray-800 focus:border-blue-500'"
          >
            <option value="qris">QRIS</option>
            <option value="bca_va">Virtual Account BCA</option>
            <option value="bni_va">Virtual Account BNI</option>
            <option value="bri_va">Virtual Account BRI</option>
            <option value="mandiri_va">Virtual Account Mandiri</option>
            <option value="ovo">OVO</option>
            <option value="gopay">GoPay</option>
            <option value="dana">DANA</option>
            <option value="shopeepay">ShopeePay</option>
          </select>
        </div>

        <div class="space-y-2 text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
          <div class="flex justify-between">
            <span>Total item</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">{{ cartCount }} item</span>
          </div>
          <div class="flex justify-between">
            <span>Subtotal</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Rp {{ cartTotal.toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between">
            <span>Ongkos Kirim</span>
            <span
              class="font-medium"
              :class="shippingMethod === 'cod'
                ? (isDark ? 'text-green-400' : 'text-green-600')
                : selectedRate
                  ? (isDark ? 'text-slate-200' : 'text-gray-700')
                  : (isDark ? 'text-slate-500' : 'text-gray-400')"
            >
              {{ shippingMethod === 'cod' ? 'Gratis (COD)' : selectedRate ? `Rp ${selectedRate.price.toLocaleString('id-ID')}` : '—' }}
            </span>
          </div>
          <div class="flex justify-between">
            <span>Biaya Layanan</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Rp {{ platformFee.toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between">
            <span>Biaya Payment Gateway</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Rp {{ paymentChargeBreakdown.gatewayFeeBase.toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between">
            <span>PPN Payment Gateway</span>
            <span class="font-medium" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Rp {{ paymentChargeBreakdown.gatewayFeeTax.toLocaleString('id-ID') }}</span>
          </div>
          <p class="text-[11px] pt-0.5" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
            Biaya layanan, payment gateway, dan PPN ditanggung penjual.
          </p>
        </div>

        <div class="border-t pt-3" :class="isDark ? 'border-white/10' : 'border-gray-100'">
          <div class="flex justify-between items-center mb-4">
            <span class="font-bold" :class="isDark ? 'text-slate-100' : 'text-gray-900'">Total</span>
            <span class="text-xl font-bold" :style="isDark ? 'color:#7dd3fc' : 'color:#1e3a8a'">Rp {{ grandTotal.toLocaleString('id-ID') }}</span>
          </div>

          <p v-if="errorMsg" class="text-red-500 text-xs mb-3 p-2.5 rounded-lg bg-red-50 border border-red-100">{{ errorMsg }}</p>

          <button
            v-if="existingPaymentUrl"
            @click="navigateTo(existingPaymentUrl, { external: true })"
            class="w-full py-2.5 rounded-full text-sm font-semibold border mb-3 transition"
            :class="isDark ? 'border-sky-500/40 text-sky-300 hover:bg-sky-900/20' : 'border-blue-200 text-blue-700 hover:bg-blue-50'"
          >
            Lanjutkan Invoice Aktif
          </button>

          <button
            v-if="canRegenerateInvoice"
            @click="handleCheckout(true)"
            :disabled="placing"
            class="w-full py-2.5 rounded-full text-sm font-semibold border mb-3 transition disabled:opacity-60"
            :class="isDark ? 'border-amber-500/40 text-amber-300 hover:bg-amber-900/20' : 'border-amber-200 text-amber-700 hover:bg-amber-50'"
          >
            Ganti Metode & Buat Invoice Baru
          </button>

          <button
            @click="handleCheckout()"
            :disabled="placing || cartItems.length === 0"
            class="vt-btn-primary w-full py-3 rounded-full text-white font-bold text-sm transition hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'">ShopeePay</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vt-btn-primary { background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); }
.dark .vt-btn-primary { background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8); }
</style>
