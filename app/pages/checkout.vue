<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route       = useRoute()
const runtimeConfig = useRuntimeConfig()
const supabase    = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark }  = useDarkMode()

// Resolve user ID reliably (useSupabaseUser() can be null before auth state settles)
const { data: { session } } = await supabase.auth.getSession()
const myId = computed(() => session?.user?.id ?? currentUser.value?.id ?? null)

const offerId       = typeof route.query.offer_id === 'string' ? route.query.offer_id : undefined
const paymentFailed = computed(() => route.query.payment_failed === '1')

// ── Order state (declared early so the alreadyOrdered guard below can set it) ──
const placing       = ref(false)
const orderDone     = ref(false)
const orderErr      = ref('')
const stockDepleted = ref(false)
const existingPaymentUrl = ref('')
const canRegenerateInvoice = ref(false)

// ── Shipping / meetup state (declared before watchers to avoid TDZ) ──────────
const destPostal           = ref<string>('')
const shippingMethod       = ref<'cod' | 'shipping'>('cod')
const paymentChannel       = ref<string>('qris')
const meetupLocation       = ref<string>('rektorat')
const customMeetupLocation = ref<string>('')
const rates                = ref<any[]>([])
const selectedRate         = ref<any | null>(null)
const ratesLoading         = ref(false)
const ratesErr             = ref('')

const MEETUP_LOCATIONS = [
  { id: 'aula_asrama',     label: 'Aula Asrama ITS' },
  { id: 'gedung_robotika', label: 'Gedung Robotika ITS' },
  { id: 'kantin_pusat',    label: 'Kantin Pusat ITS' },
  { id: 'masjid_manarul',  label: 'Masjid Manarul Ilmi ITS' },
  { id: 'rektorat',        label: 'Rektorat ITS' },
  { id: 'research_center', label: 'Research Center ITS' },
  { id: 'taman_alumni',    label: 'Taman Alumni ITS' },
  { id: 'taman_infinits',  label: 'Taman Infinits' },
  { id: 'tower_1',         label: 'Tower 1 ITS' },
  { id: 'tower_2',         label: 'Tower 2 ITS' },
  { id: 'tower_3',         label: 'Tower 3 ITS' },
  { id: 'other',           label: '✏️ Lainnya (isi manual)' },
] as const

// ── Buyer shipping address (always fresh, no SSR cache) ──────────────────────
const { data: addrData } = await useAsyncData('buyer-address', async () => {
  if (!myId.value) return null
  const { data } = await supabase
    .from('addresses')
    .select('label, full_address, city, postal_code, lat, lng')
    .eq('user_id', myId.value)
    .eq('address_type', 'shipping')
    .maybeSingle()
  return data ?? null
}, { server: false })

// Derived as computed so it reacts when the client-side fetch resolves
const buyerAddress = computed(() => addrData.value ?? null)

// Auto-fill destPostal reactively once address data arrives, then auto-fetch rates
watch(addrData, (addr) => {
  if (addr?.postal_code) {
    destPostal.value = addr.postal_code
    // Auto-fetch ongkir if user has already selected shipping method
    if (shippingMethod.value === 'shipping') fetchRates()
  }
}, { immediate: true })

// Auto-fetch when user switches to shipping and postal is already filled
watch(shippingMethod, (method) => {
  if (method === 'shipping' && destPostal.value.trim().length >= 5) fetchRates()
})

// ── Load Offer + check for existing order in one round-trip ───────
const { data: checkoutData, pending, error: loadError } = await useAsyncData(`checkout-${offerId}`, async () => {
  if (!offerId || !myId.value) return null
  const [offerRes, orderRes] = await Promise.all([
    supabase
      .from('offers')
      .select(`
        id, offered_price, quantity, status,
        product:products (
          id, title, price, seller_id, stock, status,
          product_media ( media_url, media_type, thumbnail_url, is_primary )
        ),
        chat:chats ( id, seller_id )
      `)
      .eq('id', offerId)
      .eq('buyer_id', myId.value)
      .single(),
    supabase
      .from('orders')
      .select('id, status')
      .eq('offer_id', offerId)
      .eq('buyer_id', myId.value)
      .maybeSingle(),
  ])
  const offerData = offerRes.data
  const product = offerData?.product
  const stockDepleted =
    product?.status === 'sold' || product?.status === 'deleted' ||
    (product?.stock !== null && product?.stock !== undefined && product.stock < (offerData?.quantity ?? 1))
  // Only treat as already ordered if the order is in an active state.
  // payment_failed orders should allow the buyer to retry.
  const orderStatus = (orderRes.data as any)?.status
  const alreadyOrdered = !!orderRes.data &&
    orderStatus !== 'payment_failed' &&
    orderStatus !== 'cancelled'
  return {
    offer: offerData ?? null,
    alreadyOrdered,
    stockDepleted,
  }
})

// Offer must belong to this buyer
if (!checkoutData.value) await navigateTo('/')

const offer = computed(() => checkoutData.value?.offer ?? null)

useSeoMeta({ title: () => {
  const productTitle = offer.value?.product?.title
  if (productTitle) return `Checkout ${productTitle} — VivaThrift`
  return 'Checkout — VivaThrift'
} })

// If an order already exists, jump straight to success view
if (checkoutData.value?.alreadyOrdered) {
  orderDone.value = true
// Otherwise the offer must still be accepted; anything else is invalid
} else if (!offer.value || offer.value.status !== 'accepted') {
  await navigateTo('/')
} else if (checkoutData.value?.stockDepleted) {
  stockDepleted.value = true
}

const productCover = computed(() => {
  const media = offer.value?.product?.product_media
  if (!media?.length) return null
  const primary = media.find((m: any) => m.is_primary) ?? media[0]!
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return mediaUrl(primary.thumbnail_url)
  return mediaUrl(primary.media_url)
})

const subtotal = computed(() =>
  (offer.value?.offered_price ?? 0) * (offer.value?.quantity ?? 1)
)

const ongkirAmount = computed(() =>
  shippingMethod.value === 'shipping' ? (selectedRate.value?.price ?? 0) : 0
)

// Mirror platform fee tiers from server/utils/domain-rules.ts
function calcPlatformFee(sub: number): number {
  if (sub <= 100_000) return 1_000
  if (sub <= 500_000) return 2_000
  return Math.round(sub * 0.005)
}
const platformFee = computed(() => calcPlatformFee(subtotal.value))
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
  const baseAmount = subtotal.value + ongkirAmount.value + platformFee.value
  const gatewayFeeBase = Math.round((Math.max(0, baseAmount) * Math.max(0, percent)) / 100) + Math.max(0, flat)
  const gatewayFeeTax = Math.round((Math.max(0, gatewayFeeBase) * Math.max(0, taxPercent)) / 100)
  return {
    gatewayFeeBase,
    gatewayFeeTax,
    total: gatewayFeeBase + gatewayFeeTax,
  }
})

const total = computed(() => subtotal.value + ongkirAmount.value + platformFee.value + paymentChargeBreakdown.value.total)

// ── Ongkir calculator ─────────────────────────────────────────────────────────
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
    const res = await $fetch<{ rates: any[] }>('/api/shipping/rates', {
      method: 'POST',
      body: {
        origin_postal_code:      '60111',          // ITS Surabaya - Sukolilo
        destination_postal_code: destPostal.value.trim(),
        items: [{ weight: 500 }],                  // default 500g per item
      },
    })
    rates.value = res.rates ?? []
    if (!rates.value.length) ratesErr.value = 'Tidak ada layanan pengiriman tersedia untuk kode pos ini.'
  } catch (e: any) {
    ratesErr.value = e?.data?.statusMessage ?? e?.message ?? 'Gagal mengambil tarif pengiriman.'
  } finally {
    ratesLoading.value = false
  }
}

// ── Checkout via Xendit Payment Gateway ──────────────────────────
async function placeOrder(forceRegenerateInvoice = false) {
  if (placing.value || orderDone.value) return
  existingPaymentUrl.value = ''
  canRegenerateInvoice.value = false

  // Validate shipping selection
  if (shippingMethod.value === 'shipping' && !buyerAddress.value) {
    orderErr.value = 'Tambahkan alamat pengiriman di profil terlebih dahulu.'
    return
  }
  if (shippingMethod.value === 'shipping' && !selectedRate.value) {
    orderErr.value = 'Pilih layanan pengiriman terlebih dahulu.'
    return
  }
  if (shippingMethod.value === 'cod' && !meetupLocation.value) {
    orderErr.value = 'Pilih lokasi meetup.'
    return
  }

  placing.value = true
  orderErr.value = ''
  try {
    const body: any = {
      offerId:        offer.value!.id,
      shippingMethod: shippingMethod.value,
      paymentChannel: paymentChannel.value,
      forceRegenerateInvoice,
    }
    if (shippingMethod.value === 'cod') {
      const loc = meetupLocation.value === 'other' ? customMeetupLocation.value.trim() : meetupLocation.value
      if (!loc || loc.length < 2) {
        orderErr.value = 'Isi lokasi meetup terlebih dahulu.'
        placing.value = false
        return
      }
      body.meetupLocation = loc
    } else {
      body.shippingCost   = selectedRate.value!.price
      body.courierCode    = selectedRate.value!.courier_code
      body.courierService = selectedRate.value!.service
    }

    const result = await $fetch<{ orderId: string; paymentUrl: string }>('/api/checkout', {
      method: 'POST',
      body,
    })
    if (result.paymentUrl) {
      await navigateTo(result.paymentUrl, { external: true })
    }
  } catch (e: any) {
    const msg: string = e?.data?.statusMessage ?? e?.message ?? 'Terjadi kesalahan.'
    const statusCode = Number(e?.data?.statusCode ?? 0)
    const existingUrl = String(e?.data?.data?.existingPaymentUrl ?? '')
    const canReissue = e?.data?.data?.canRegenerateInvoice === true
    if (msg === 'stock_depleted') {
      stockDepleted.value = true
      orderErr.value = 'Maaf, stok produk ini sudah habis. Tawaran lain mungkin sudah dikonfirmasi lebih dulu.'
    } else if (statusCode === 409 && existingUrl) {
      existingPaymentUrl.value = existingUrl
      canRegenerateInvoice.value = canReissue
      orderErr.value = msg
    } else {
      orderErr.value = msg
    }
  } finally {
    placing.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-lg mx-auto px-4 py-10">

    <button @click="$router.back()" class="vt-hero-enter vt-hero-enter-d1 mb-6 inline-flex items-center gap-2 text-sm transition" :class="isDark ? 'text-gray-400 hover:text-sky-300' : 'text-gray-500 hover:text-blue-800'">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      Kembali ke chat
    </button>

    <!-- Payment failed banner -->
    <div
      v-if="paymentFailed"
      class="vt-hero-enter vt-hero-enter-d2 mb-5 flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
      :class="isDark ? 'bg-red-900/30 border border-red-700/40 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'"
    >
      <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
      </svg>
      <span>Pembayaran sebelumnya gagal atau kadaluarsa. Kamu bisa mencoba lagi sekarang.</span>
    </div>

    <!-- ── Success State ── -->
    <div v-if="orderDone" class="vt-hero-enter vt-hero-enter-d2 text-center py-16">
      <img src="/img/illustrations/order-confirmed.svg" alt="Pesanan berhasil" width="192" height="192" loading="lazy" class="w-48 h-auto mx-auto mb-4 opacity-90" />
      <h2 class="font-heading text-2xl font-bold mb-2" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">Pesanan Berhasil!</h2>
      <p class="text-sm mb-6" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Pembayaran sedang diproses. Cek halaman Pesanan untuk memantau status.</p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <NuxtLink
          to="/orders?tab=confirmed"
          class="vt-btn-primary inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold text-sm hover:opacity-90 transition"
        >
          📦 Lihat Pesanan
        </NuxtLink>
        <NuxtLink
          :to="`/chat/${offer?.chat?.id}`"
          class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition border"
          :class="isDark ? 'border-white/20 text-gray-300 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
        >
          💬 Kembali ke Chat
        </NuxtLink>
      </div>
    </div>

    <!-- ── Stock Depleted State ── -->
    <div v-else-if="stockDepleted" class="vt-hero-enter vt-hero-enter-d2 text-center py-16">
      <img src="/img/illustrations/void.svg" alt="Stok habis" width="176" height="176" loading="lazy" class="w-44 h-auto mx-auto mb-4 opacity-80" />
      <h2 class="font-heading text-2xl font-bold mb-2" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">Stok Habis</h2>
      <p class="text-sm mb-6" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Maaf, stok produk ini sudah habis karena tawaran lain telah dikonfirmasi lebih dulu.</p>
      <NuxtLink
        :to="`/chat/${offer?.chat?.id}`"
        class="vt-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold text-sm hover:opacity-90 transition"
      >
        💬 Kembali ke Chat
      </NuxtLink>
    </div>

    <!-- ── Checkout Form ── -->
    <template v-else>
      <h1 class="vt-hero-enter vt-hero-enter-d2 font-heading text-2xl font-bold mb-6" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">⚡ Checkout Tawaran</h1>

      <!-- Product card -->
      <div
        class="vt-glass rounded-2xl p-5 mb-5"
        :style="isDark
          ? 'background:rgba(15,25,50,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.10);box-shadow:0 4px 24px rgba(0,0,0,0.4);'
          : 'background:rgba(255,255,255,0.70);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.5);box-shadow:0 4px 20px rgba(30,58,138,0.10);'"
      >
        <!-- Product row -->
        <div class="flex gap-4 items-center mb-5">
          <div class="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
            <img v-if="productCover" :src="productCover" width="80" height="80" loading="lazy" class="w-full h-full object-cover" :alt="offer?.product?.title" />
            <div v-else class="w-full h-full flex items-center justify-center text-2xl">📷</div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm truncate font-semibold" :class="isDark ? 'text-white' : 'text-gray-800'">{{ offer?.product?.title }}</p>
            <p class="text-xs mt-0.5" :class="isDark ? 'text-gray-400' : 'text-gray-400'">
              Harga asal: Rp {{ offer?.product?.price?.toLocaleString('id-ID') }}
            </p>
          </div>
        </div>

        <!-- Price breakdown -->
        <div class="pt-4 space-y-2 text-sm" :class="isDark ? 'border-t border-white/10' : 'border-t border-gray-100'">
          <div class="flex justify-between">
            <span :class="isDark ? 'text-gray-400' : 'text-gray-500'">Harga Tawaran</span>
            <span class="font-medium" :class="isDark ? 'text-white' : 'text-gray-800'">Rp {{ offer?.offered_price?.toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between">
            <span :class="isDark ? 'text-gray-400' : 'text-gray-500'">Jumlah</span>
            <span class="font-medium" :class="isDark ? 'text-white' : 'text-gray-800'">× {{ offer?.quantity }}</span>
          </div>
          <div v-if="shippingMethod === 'shipping'" class="flex justify-between">
            <span :class="isDark ? 'text-gray-400' : 'text-gray-500'">Ongkos Kirim</span>
            <span class="font-medium" :class="selectedRate ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-gray-500' : 'text-gray-400')">
              {{ selectedRate ? `Rp ${selectedRate.price.toLocaleString('id-ID')}` : '—' }}
            </span>
          </div>
          <div v-if="shippingMethod === 'cod'" class="flex justify-between">
            <span :class="isDark ? 'text-gray-400' : 'text-gray-500'">Ongkos Kirim</span>
            <span class="font-semibold" :class="isDark ? 'text-green-400' : 'text-green-600'">Gratis (COD)</span>
          </div>
          <div class="flex justify-between">
            <span :class="isDark ? 'text-gray-400' : 'text-gray-500'">Biaya Layanan</span>
            <span class="font-medium" :class="isDark ? 'text-white' : 'text-gray-800'">Rp {{ platformFee.toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between">
            <span :class="isDark ? 'text-gray-400' : 'text-gray-500'">Biaya Payment Gateway</span>
            <span class="font-medium" :class="isDark ? 'text-white' : 'text-gray-800'">Rp {{ paymentChargeBreakdown.gatewayFeeBase.toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between">
            <span :class="isDark ? 'text-gray-400' : 'text-gray-500'">PPN Payment Gateway</span>
            <span class="font-medium" :class="isDark ? 'text-white' : 'text-gray-800'">Rp {{ paymentChargeBreakdown.gatewayFeeTax.toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between pt-3 mt-1" :class="isDark ? 'border-t border-white/10' : 'border-t border-gray-100'">
            <span class="font-semibold" :class="isDark ? 'text-white' : 'text-gray-700'">Total</span>
            <span class="text-lg font-bold" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">
              Rp {{ total.toLocaleString('id-ID') }}
            </span>
          </div>
        </div>
      </div>

      <!-- ── Shipping Method Toggle ── -->
      <div
        class="rounded-2xl p-5 mb-5"
        :style="isDark
          ? 'background:rgba(15,25,50,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.10);'
          : 'background:rgba(255,255,255,0.70);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.5);box-shadow:0 4px 20px rgba(30,58,138,0.10);'"
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
            <span class="text-xs font-normal opacity-70">Via Kurir</span>
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
              <div>
                <p class="text-sm font-medium" :class="isDark ? 'text-white' : 'text-gray-800'">{{ loc.label }}</p>
              </div>
            </label>
          </div>
          <!-- Manual input for 'other' option -->
          <div v-if="meetupLocation === 'other'" class="mt-3">
            <input
              v-model="customMeetupLocation"
              type="text"
              maxlength="100"
              placeholder="Contoh: Lobby Gedung Informatika ITS"
              class="w-full rounded-xl px-3 py-2 text-sm border outline-none transition"
              :class="isDark
                ? 'bg-slate-800 border-white/10 text-white placeholder-gray-500 focus:border-sky-500'
                : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-blue-500'"
            />
          </div>
        </div>

        <!-- Shipping: Ongkir calculator -->
        <div v-if="shippingMethod === 'shipping'" class="mt-4">
          <p class="text-xs font-semibold mb-2" :class="isDark ? 'text-gray-400' : 'text-gray-500'">ALAMAT PENGIRIMAN</p>

          <!-- No address warning -->
          <div v-if="!buyerAddress" class="flex items-start gap-2 text-xs rounded-xl px-3 py-3 mb-3 border"
            :class="isDark ? 'bg-amber-900/20 border-amber-700/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'">
            <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
            <span>Kamu belum punya alamat pengiriman. <NuxtLink to="/profile/edit?tab=address" class="underline font-semibold">Tambahkan sekarang</NuxtLink></span>
          </div>

          <!-- Address card -->
          <div v-else class="rounded-xl p-3 mb-3 border"
            :class="isDark ? 'bg-slate-800/60 border-white/10' : 'bg-gray-50 border-gray-200'">
            <p class="text-xs font-semibold mb-1" :class="isDark ? 'text-sky-400' : 'text-blue-600'">
              {{ buyerAddress.label ?? 'Alamat Pengiriman' }}
            </p>
            <p class="text-sm" :class="isDark ? 'text-white' : 'text-gray-800'">
              {{ buyerAddress.full_address }}
            </p>
            <p class="text-xs mt-0.5" :class="isDark ? 'text-gray-400' : 'text-gray-500'">
              {{ [buyerAddress.city, buyerAddress.postal_code].filter(Boolean).join(', ') }}
            </p>
            <NuxtLink to="/profile/edit?tab=address" class="text-xs mt-1.5 inline-block underline" :class="isDark ? 'text-sky-400' : 'text-blue-600'">Ubah alamat</NuxtLink>
          </div>

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
              style="background:linear-gradient(to right,#1e3a8a,#1e40af);"
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

      <!-- ── Payment Channel ── -->
      <div
        class="rounded-2xl p-5 mb-5"
        :style="isDark
          ? 'background:rgba(15,25,50,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.10);'
          : 'background:rgba(255,255,255,0.70);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.5);box-shadow:0 4px 20px rgba(30,58,138,0.10);'"
      >
        <p class="text-sm font-semibold mb-3" :class="isDark ? 'text-white' : 'text-gray-700'">Metode Pembayaran</p>
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

      <!-- Info banner -->
      <div class="flex items-start gap-2 text-xs rounded-xl px-4 py-3 mb-5" :class="isDark ? 'text-sky-300 bg-sky-900/30 border border-sky-700/40' : 'text-blue-700 bg-blue-50 border border-blue-100'">
        <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
        Pembayaran diamankan oleh <strong class="mx-0.5">Xendit</strong> (Rekening Bersama). Dana hanya diteruskan ke penjual setelah transaksi selesai.
      </div>

      <p v-if="orderErr" class="text-red-600 text-sm border border-red-100 bg-red-50 rounded-xl px-4 py-3 mb-4">
        {{ orderErr }}
      </p>

      <button
        v-if="existingPaymentUrl"
        @click="navigateTo(existingPaymentUrl, { external: true })"
        class="w-full py-3 rounded-xl font-semibold text-sm border mb-3 transition"
        :class="isDark ? 'border-sky-500/40 text-sky-300 hover:bg-sky-900/20' : 'border-blue-200 text-blue-700 hover:bg-blue-50'"
      >
        Lanjutkan Invoice Aktif
      </button>

      <button
        v-if="canRegenerateInvoice"
        @click="placeOrder(true)"
        :disabled="placing"
        class="w-full py-3 rounded-xl font-semibold text-sm border mb-3 transition disabled:opacity-60"
        :class="isDark ? 'border-amber-500/40 text-amber-300 hover:bg-amber-900/20' : 'border-amber-200 text-amber-700 hover:bg-amber-50'"
      >
        Ganti Metode & Buat Invoice Baru
      </button>

      <button
        @click="placeOrder()"
        :disabled="placing"
        class="vt-btn-primary w-full py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition"
      >
        {{ placing ? 'Menyiapkan pembayaran…' : '🔒 Bayar Sekarang' }}
      </button>
    </template>

  </div>
</template>

<style scoped>
.vt-btn-primary { background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); }
.dark .vt-btn-primary { background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8); }
</style>
