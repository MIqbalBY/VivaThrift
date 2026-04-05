<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route       = useRoute()
const supabase    = useSupabaseClient()
const currentUser = useSupabaseUser()
const { isDark }  = useDarkMode()

// Resolve user ID reliably (useSupabaseUser() can be null before auth state settles)
const { data: { session } } = await supabase.auth.getSession()
const myId = computed(() => session?.user?.id ?? currentUser.value?.id ?? null)

const offerId = route.query.offer_id

// ── Order state (declared early so the alreadyOrdered guard below can set it) ──
const placing       = ref(false)
const orderDone     = ref(false)
const orderErr      = ref('')
const stockDepleted = ref(false)

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
      .select('id')
      .eq('offer_id', offerId)
      .eq('buyer_id', myId.value)
      .maybeSingle(),
  ])
  const offerData = offerRes.data
  const product = offerData?.product
  const stockDepleted =
    product?.status === 'sold' || product?.status === 'deleted' ||
    (product?.stock !== null && product?.stock !== undefined && product.stock < (offerData?.quantity ?? 1))
  return {
    offer: offerData ?? null,
    alreadyOrdered: !!orderRes.data,
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
  const primary = media.find(m => m.is_primary) ?? media[0]
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
  return primary.media_url
})

const total = computed(() =>
  (offer.value?.offered_price ?? 0) * (offer.value?.quantity ?? 1)
)

// ── Checkout via Xendit Payment Gateway ──────────────────────────
async function placeOrder() {
  if (placing.value || orderDone.value) return
  placing.value = true
  orderErr.value = ''
  try {
    const result = await $fetch<{ orderId: string; paymentUrl: string }>('/api/checkout', {
      method: 'POST',
      body: { offerId: offer.value.id },
    })
    // Redirect ke halaman invoice Xendit (rekening bersama)
    if (result.paymentUrl) {
      await navigateTo(result.paymentUrl, { external: true })
    }
  } catch (e: any) {
    const msg: string = e?.data?.statusMessage ?? e?.message ?? 'Terjadi kesalahan.'
    if (msg === 'stock_depleted') {
      stockDepleted.value = true
      orderErr.value = 'Maaf, stok produk ini sudah habis. Tawaran lain mungkin sudah dikonfirmasi lebih dulu.'
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

    <!-- ── Success State ── -->
    <div v-if="orderDone" class="vt-hero-enter vt-hero-enter-d2 text-center py-16">
      <img src="/img/illustrations/order-confirmed.svg" alt="Pesanan berhasil" width="192" height="192" loading="lazy" class="w-48 h-auto mx-auto mb-4 opacity-90" />
      <h2 class="font-heading text-2xl font-bold mb-2" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">Pesanan Berhasil!</h2>
      <p class="text-sm mb-6" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Silakan hubungi penjual untuk mengatur pengiriman / COD.</p>
      <NuxtLink
        :to="`/chat/${offer?.chat?.id}`"
        class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold text-sm hover:opacity-90 transition"
        :style="isDark
          ? 'background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8);'
          : 'background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8);'"
      >
        💬 Kembali ke Chat
      </NuxtLink>
    </div>

    <!-- ── Stock Depleted State ── -->
    <div v-else-if="stockDepleted" class="vt-hero-enter vt-hero-enter-d2 text-center py-16">
      <img src="/img/illustrations/void.svg" alt="Stok habis" width="176" height="176" loading="lazy" class="w-44 h-auto mx-auto mb-4 opacity-80" />
      <h2 class="font-heading text-2xl font-bold mb-2" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">Stok Habis</h2>
      <p class="text-sm mb-6" :class="isDark ? 'text-gray-400' : 'text-gray-500'">Maaf, stok produk ini sudah habis karena tawaran lain telah dikonfirmasi lebih dulu.</p>
      <NuxtLink
        :to="`/chat/${offer?.chat?.id}`"
        class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold text-sm hover:opacity-90 transition"
        style="background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8);"
      >
        💬 Kembali ke Chat
      </NuxtLink>
    </div>

    <!-- ── Checkout Form ── -->
    <template v-else>
      <h1 class="vt-hero-enter vt-hero-enter-d2 font-heading text-2xl font-bold mb-6" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">⚡ Checkout Tawaran</h1>

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
          <div class="flex justify-between pt-3 mt-1" :class="isDark ? 'border-t border-white/10' : 'border-t border-gray-100'">
            <span class="font-semibold" :class="isDark ? 'text-white' : 'text-gray-700'">Total</span>
            <span class="text-lg font-bold" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">
              Rp {{ total.toLocaleString('id-ID') }}
            </span>
          </div>
        </div>
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
        @click="placeOrder"
        :disabled="placing"
        class="w-full py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition"
        :style="isDark
          ? 'background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8);'
          : 'background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8);'"
      >
        {{ placing ? 'Menyiapkan pembayaran…' : '🔒 Bayar Sekarang' }}
      </button>
    </template>

  </div>
</template>
