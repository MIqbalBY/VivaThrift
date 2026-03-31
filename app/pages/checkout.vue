<script setup>
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

// ── Place Order ───────────────────────────────────────────────────
async function placeOrder() {
  if (placing.value || orderDone.value) return
  placing.value = true
  orderErr.value = ''
  try {
    // Guard against duplicate orders (e.g. double-click or back-navigation)
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('offer_id', offer.value.id)
      .eq('buyer_id', myId.value)
      .maybeSingle()
    if (existingOrder) {
      orderDone.value = true
      return
    }

    // Re-check current stock in real-time to prevent over-checkout
    const { data: currentProd } = await supabase
      .from('products')
      .select('stock, status')
      .eq('id', offer.value.product.id)
      .single()
    if (
      !currentProd ||
      currentProd.status === 'sold' || currentProd.status === 'deleted' ||
      (currentProd.stock !== null && currentProd.stock !== undefined && currentProd.stock < offer.value.quantity)
    ) {
      stockDepleted.value = true
      throw new Error('Maaf, stok produk ini sudah habis. Tawaran lain mungkin sudah dikonfirmasi lebih dulu.')
    }

    const sellerId = offer.value.chat?.seller_id ?? offer.value.product?.seller_id

    // 1. Create order
    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .insert({
        buyer_id:     myId.value,
        seller_id:    sellerId,
        total_amount: total.value,
        status:       'pending',
        offer_id:     offer.value.id,
      })
      .select('id')
      .single()
    if (ordErr) throw ordErr

    // 2. Create order item with locked unit price
    const { error: itemErr } = await supabase.from('order_items').insert({
      order_id:      order.id,
      product_id:    offer.value.product.id,
      quantity:      offer.value.quantity,
      price_at_time: offer.value.offered_price,
    })
    if (itemErr) throw itemErr

    // 3. Reduce product stock
    const { data: prod } = await supabase
      .from('products')
      .select('stock')
      .eq('id', offer.value.product.id)
      .single()
    if (prod && prod.stock !== null && prod.stock !== undefined) {
      const newStock = Math.max(0, prod.stock - offer.value.quantity)
      const stockUpdate = { stock: newStock }
      if (newStock === 0) stockUpdate.status = 'sold'
      await supabase.from('products')
        .update(stockUpdate)
        .eq('id', offer.value.product.id)
    }

    // 4. Mark offer as expired so it can't be checked out again
    await supabase
      .from('offers')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', offer.value.id)

    orderDone.value = true
  } catch (e) {
    orderErr.value = e.message ?? 'Terjadi kesalahan. Silakan coba lagi.'
  } finally {
    placing.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-lg mx-auto px-4 py-10">

    <button @click="$router.back()" class="mb-6 inline-flex items-center gap-2 text-sm transition" :class="isDark ? 'text-gray-400 hover:text-sky-300' : 'text-gray-500 hover:text-blue-800'">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
      Kembali ke chat
    </button>

    <!-- ── Success State ── -->
    <div v-if="orderDone" class="text-center py-16">
      <p class="text-6xl mb-4">🎉</p>
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
    <div v-else-if="stockDepleted" class="text-center py-16">
      <p class="text-6xl mb-4">😔</p>
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
      <h1 class="font-heading text-2xl font-bold mb-6" :style="isDark ? 'color:#ffffff;' : 'color:#1e3a8a;'">⚡ Checkout Tawaran</h1>

      <div
        class="vt-glass rounded-2xl p-5 mb-5"
        :style="isDark
          ? 'background:rgba(15,25,50,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.10);box-shadow:0 4px 24px rgba(0,0,0,0.4);'
          : 'background:rgba(255,255,255,0.70);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.5);box-shadow:0 4px 20px rgba(30,58,138,0.10);'"
      >
        <!-- Product row -->
        <div class="flex gap-4 items-center mb-5">
          <div class="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
            <img v-if="productCover" :src="productCover" class="w-full h-full object-cover" :alt="offer?.product?.title" />
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
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Harga ini sudah disetujui penjual. Koordinasikan pengambilan / COD langsung lewat chat.
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
        {{ placing ? 'Memproses…' : '✅ Konfirmasi Pembelian' }}
      </button>
    </template>

  </div>
</template>
