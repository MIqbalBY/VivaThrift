<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Pesanan Saya — VivaThrift' })

const route      = useRoute()
const { isDark } = useDarkMode()
const { reveal } = useScrollReveal()

const {
  loading, fetchErr,
  role, activeTab,
  tabCounts, filteredOrders,
  primaryMedia, productTitle, productSlug, chatId, formatRp, sellerReceives,
  actionLoading, actionErr, actionSuccess,
  fetchOrders, shipOrder, shipViaBiteship, completeOrder, startMeetup, confirmMeetup,
  isReviewed, markReviewed,
  ORDER_TABS,
} = useOrders()

// Review modal state
const reviewTarget = ref<{
  orderId: string
  productId: string
  sellerId: string
  productTitle: string
  sellerName: string
  productImage: string | null
} | null>(null)

function openReviewModal(order: any) {
  const item = order.order_items?.[0]
  reviewTarget.value = {
    orderId:      order.id,
    productId:    item?.product?.id ?? '',
    sellerId:     order.seller?.id ?? '',
    productTitle: item?.product?.title ?? '—',
    sellerName:   order.seller?.name ?? '—',
    productImage: primaryMedia(order),
  }
}

function onReviewSubmitted() {
  if (reviewTarget.value) markReviewed(reviewTarget.value.orderId)
  reviewTarget.value = null
}

// Per-order ship form state
const shipForms = ref<Record<string, { tracking: string; courier: string; open: boolean; manualMode: boolean }>>({})

function getShipForm(orderId: string) {
  if (!shipForms.value[orderId]) {
    shipForms.value[orderId] = { tracking: '', courier: '', open: false, manualMode: false }
  }
  return shipForms.value[orderId]
}

function toggleShipForm(orderId: string) {
  const form = getShipForm(orderId)
  form.open = !form.open
}

async function handleShip(orderId: string) {
  const form = getShipForm(orderId)
  await shipOrder(orderId, form.tracking, form.courier)
  if (actionSuccess.value[orderId]) form.open = false
}

async function handleShipViaBiteship(orderId: string) {
  const form = getShipForm(orderId)
  await shipViaBiteship(orderId)
  if (actionSuccess.value[orderId]) form.open = false
}

// Per-order tracking panel state
const trackingData    = ref<Record<string, any>>({})
const trackingLoading = ref<Record<string, boolean>>({})
const trackingError   = ref<Record<string, string>>({})
const trackingOpen    = ref<Record<string, boolean>>({})

async function loadTracking(orderId: string, biteshipOrderId: string) {
  if (trackingOpen.value[orderId] && trackingData.value[orderId]) {
    trackingOpen.value[orderId] = false
    return
  }
  trackingOpen.value[orderId]    = true
  trackingLoading.value[orderId] = true
  trackingError.value[orderId]   = ''
  try {
    const res = await $fetch<any>(`/api/shipping/track?order_id=${orderId}`)
    trackingData.value[orderId] = res
  } catch (e: any) {
    trackingError.value[orderId] = e?.data?.statusMessage ?? e?.message ?? 'Gagal memuat data pelacakan.'
  } finally {
    trackingLoading.value[orderId] = false
  }
}

// Meetup OTP state (per order)
const meetupOtpInputs = ref<Record<string, string>>({})

const MEETUP_LOCATION_LABELS: Record<string, string> = {
  aula_asrama:     'Aula Asrama ITS',
  rektorat:        'Depan Rektorat ITS',
  gedung_robotika: 'Gedung Robotika ITS',
  kantin_pusat:    'Kantin Pusat ITS',
  masjid_manarul:  'Masjid Manarul Ilmi ITS',
  research_center: 'Research Center ITS',
  taman_alumni:    'Taman Alumni ITS',
  taman_infinits:  'Taman Infinits',
  tower_1:         'Tower 1 ITS',
  tower_2:         'Tower 2 ITS',
  tower_3:         'Tower 3 ITS',
}

async function handleStartMeetup(orderId: string) {
  await startMeetup(orderId)
}

async function handleConfirmMeetup(orderId: string) {
  const otp = meetupOtpInputs.value[orderId] ?? ''
  await confirmMeetup(orderId, otp)
  if (actionSuccess.value[orderId]) meetupOtpInputs.value[orderId] = ''
}

// Confirm dialog before "Pesanan Diterima"
const confirmCompleteId = ref<string | null>(null)

async function handleComplete(orderId: string) {
  await completeOrder(orderId)
  confirmCompleteId.value = null
}

// Status badge helpers
const STATUS_META: Record<string, { label: string; light: string; dark: string }> = {
  pending_payment: { label: 'Belum Bayar',      light: 'bg-amber-100 text-amber-700 border-amber-200',        dark: 'bg-amber-900/30 text-amber-300 border-amber-700/40' },
  confirmed:       { label: 'Dikemas',          light: 'bg-blue-100 text-blue-700 border-blue-200',           dark: 'bg-blue-900/30 text-sky-300 border-blue-700/40' },
  awaiting_meetup: { label: 'Menunggu Meetup',  light: 'bg-teal-100 text-teal-700 border-teal-200',           dark: 'bg-teal-900/30 text-teal-300 border-teal-700/40' },
  shipped:         { label: 'Dikirim',          light: 'bg-indigo-100 text-indigo-700 border-indigo-200',     dark: 'bg-indigo-900/30 text-indigo-300 border-indigo-700/40' },
  completed:       { label: 'Selesai',          light: 'bg-green-100 text-green-700 border-green-200',        dark: 'bg-green-900/30 text-green-300 border-green-700/40' },
  cancelled:       { label: 'Dibatalkan',       light: 'bg-red-100 text-red-600 border-red-200',              dark: 'bg-red-900/30 text-red-300 border-red-700/40' },
  payment_failed:  { label: 'Bayar Gagal',      light: 'bg-red-100 text-red-600 border-red-200',              dark: 'bg-red-900/30 text-red-300 border-red-700/40' },
}

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, light: 'bg-gray-100 text-gray-500', dark: 'bg-gray-800 text-gray-400' }
}

function relativeDate(isoString: string) {
  const d = new Date(isoString)
  const diff = Date.now() - d.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)    return 'baru saja'
  if (mins < 60)   return `${mins} menit lalu`
  if (hours < 24)  return `${hours} jam lalu`
  if (days < 30)   return `${days} hari lalu`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Payment link expires 15 min after order creation (matches Xendit invoice_duration: 900)
function isPaymentExpired(order: any) {
  return new Date(order.created_at).getTime() + 900_000 < Date.now()
}

// Fetch when user is hydrated (fixes race condition where auth session isn't
// restored yet when onMounted fires) and re-fetch whenever role changes.
const _ordersUser = useSupabaseUser()

// Apply ?tab= query param on first load
const _validTabKeys = ORDER_TABS.map(t => t.key)
if (route.query.tab && _validTabKeys.includes(route.query.tab as any)) {
  activeTab.value = route.query.tab as OrderTabKey
}

async function fetchAndAutoTab() {
  await fetchOrders()
  // If the current tab is empty, auto-switch to the first non-empty tab
  if (tabCounts.value[activeTab.value] === 0) {
    const firstNonEmpty = ORDER_TABS.find(t => tabCounts.value[t.key] > 0)
    if (firstNonEmpty) activeTab.value = firstNonEmpty.key
  }
}

watch(_ordersUser, (u) => { if (u?.id) fetchAndAutoTab() }, { immediate: true })
watch(role, () => fetchAndAutoTab())

// Extra fallback: if INITIAL_SESSION fired before @nuxtjs/supabase updated
// its reactive state (race condition on full-page load from external redirect),
// the watch above fires immediately with u=null and never fires again.
// onMounted triggers after hydration and fetches via auth.getUser() in the composable.
onMounted(async () => {
  if (!_ordersUser.value?.id) {
    await fetchAndAutoTab()
  }
})
</script>

<template>
  <div class="w-full max-w-3xl mx-auto px-4 py-8">

    <!-- Page header -->
    <div :ref="reveal" class="flex items-center gap-3 mb-6">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        :style="isDark ? 'background:rgba(14,165,233,0.18);' : 'background:rgba(30,58,138,0.10);'">
        <svg class="w-5 h-5" :class="isDark ? 'text-sky-400' : 'text-blue-800'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
        </svg>
      </div>
      <h1 class="font-heading text-2xl font-bold" :style="isDark ? 'color:#f1f5f9;' : 'color:#1e3a8a;'">Pesanan Saya</h1>
    </div>

    <!-- Role Toggle: Pembeli / Penjual -->
    <div :ref="reveal" data-delay="80" class="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit"
      :style="isDark ? 'background:rgba(15,23,42,0.70);border:1px solid rgba(255,255,255,0.08);' : 'background:rgba(30,58,138,0.07);border:1px solid rgba(30,58,138,0.10);'">
      <button
        v-for="r in [{ key: 'buyer', label: '🛒 Sebagai Pembeli' }, { key: 'seller', label: '🏪 Sebagai Penjual' }]"
        :key="r.key"
        @click="role = r.key as 'buyer'|'seller'"
        class="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
        :class="role === r.key
          ? isDark ? 'text-white shadow-sm' : 'text-white shadow-sm'
          : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'"
        :style="role === r.key ? (isDark ? 'background:linear-gradient(to right,#0369a1,#0ea5e9,#38bdf8);' : 'background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);') : ''"
      >{{ r.label }}</button>
    </div>

    <!-- Status Tabs -->
    <div :ref="reveal" data-delay="120" class="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
      <button
        v-for="tab in ORDER_TABS"
        :key="tab.key"
        @click="activeTab = tab.key"
        class="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all shrink-0"
        :class="activeTab === tab.key
          ? 'text-white border-transparent'
          : isDark
            ? 'text-slate-400 border-slate-700 hover:border-sky-500 hover:text-sky-300'
            : 'text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-700'"
        :style="activeTab === tab.key ? (isDark ? 'background:linear-gradient(to right,#0369a1,#0ea5e9,#38bdf8);' : 'background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);') : isDark ? 'background:rgba(15,23,42,0.50);' : 'background:rgba(255,255,255,0.80);'"
      >
        {{ tab.icon }} {{ tab.label }}
        <span
          v-if="tabCounts[tab.key] > 0"
          class="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
          :class="activeTab === tab.key ? 'bg-white/30 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'"
        >{{ tabCounts[tab.key] }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <div class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" :class="isDark ? 'border-sky-400' : 'border-blue-800'"></div>
      <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-400'">Memuat pesanan…</p>
    </div>

    <!-- Error -->
    <div v-else-if="fetchErr" class="text-center py-10 px-4">
      <p class="text-sm text-red-500">{{ fetchErr }}</p>
      <button @click="fetchOrders" class="mt-3 text-xs underline" :class="isDark ? 'text-sky-400' : 'text-blue-600'">Coba lagi</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!filteredOrders.length" class="flex flex-col items-center justify-center py-20 gap-3">
      <img src="/img/illustrations/empty-cart.svg" alt="Belum ada pesanan" width="160" height="160" loading="lazy" class="w-40 h-auto opacity-70" />
      <p class="text-sm font-semibold" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Belum ada pesanan di tab ini</p>
    </div>

    <!-- Order List -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="order in filteredOrders"
        :key="order.id"
        :ref="reveal"
        class="rounded-2xl overflow-hidden"
        :style="isDark
          ? 'background:rgba(15,23,42,0.80);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.08);box-shadow:0 4px 16px rgba(0,0,0,0.30);'
          : 'background:rgba(255,255,255,0.80);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.50);box-shadow:0 4px 16px rgba(30,58,138,0.08);'"
      >
        <!-- Card Header: product + status -->
        <div class="flex items-start gap-3 p-4">
          <!-- Product thumbnail -->
          <NuxtLink :to="productSlug(order) ? `/products/${productSlug(order)}` : '#'" class="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-slate-800">
            <img v-if="primaryMedia(order)" :src="primaryMedia(order)" width="64" height="64" loading="lazy" class="w-full h-full object-cover" :alt="productTitle(order)" />
            <div v-else class="w-full h-full flex items-center justify-center text-2xl">📦</div>
          </NuxtLink>

          <div class="flex-1 min-w-0">
            <!-- Product title -->
            <NuxtLink :to="productSlug(order) ? `/products/${productSlug(order)}` : '#'" class="block text-sm font-semibold truncate leading-snug hover:underline" :class="isDark ? 'text-white' : 'text-gray-800'">
              {{ productTitle(order) }}
            </NuxtLink>

            <!-- Counterparty -->
            <p class="text-xs mt-0.5 truncate" :class="isDark ? 'text-slate-400' : 'text-gray-400'">
              <template v-if="role === 'buyer'">Penjual: {{ order.seller?.name ?? '—' }}</template>
              <template v-else>Pembeli: {{ order.buyer?.name ?? '—' }}</template>
            </p>

            <!-- Amount -->
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span class="text-sm font-bold" :style="isDark ? 'color:#7dd3fc;' : 'color:#1e3a8a;'">
                {{ formatRp(order.total_amount) }}
              </span>
              <template v-if="role === 'seller' && order.status !== 'cancelled' && order.status !== 'payment_failed'">
                <span class="text-xs" :class="isDark ? 'text-slate-500' : 'text-gray-400'">→ kamu terima</span>
                <span class="text-xs font-semibold" :class="isDark ? 'text-green-400' : 'text-green-600'">
                  {{ formatRp(sellerReceives(order.total_amount, order.shipping_cost ?? 0, order.platform_fee ?? 0)) }}
                </span>
                <span class="text-[10px]" :class="isDark ? 'text-slate-600' : 'text-gray-400'">(harga penuh, biaya layanan ditanggung pembeli)</span>
              </template>
            </div>
          </div>

          <!-- Status badge + date -->
          <div class="flex flex-col items-end gap-1.5 shrink-0">
            <span
              class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
              :class="isDark ? statusMeta(order.status).dark : statusMeta(order.status).light"
            >{{ statusMeta(order.status).label }}</span>
            <span class="text-[10px]" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ relativeDate(order.created_at) }}</span>
          </div>
        </div>

        <!-- Tracking info (when shipped/completed) -->
        <div
          v-if="order.tracking_number"
          class="mx-4 mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
          :class="isDark ? 'bg-indigo-900/25 border border-indigo-700/30 text-indigo-300' : 'bg-indigo-50 border border-indigo-100 text-indigo-700'"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>
          </svg>
          <span>
            <strong>{{ order.courier_name ? order.courier_name + ' — ' : '' }}</strong>
            Resi: <strong>{{ order.tracking_number }}</strong>
          </span>
        </div>

        <!-- Meetup location info (COD orders — confirmed or awaiting_meetup) -->
        <div
          v-if="order.shipping_method === 'cod' && order.meetup_location && (order.status === 'confirmed' || order.status === 'awaiting_meetup')"
          class="mx-4 mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
          :class="isDark ? 'bg-teal-900/25 border border-teal-700/30 text-teal-300' : 'bg-teal-50 border border-teal-100 text-teal-700'"
        >
          📍 <span>Lokasi meetup: <strong>{{ MEETUP_LOCATION_LABELS[order.meetup_location] ?? order.meetup_location }}</strong></span>
        </div>

        <!-- Buyer: OTP display for awaiting_meetup -->
        <div
          v-if="role === 'buyer' && order.status === 'awaiting_meetup' && order.meetup_otp"
          class="mx-4 mb-3 rounded-xl p-4 text-center"
          :class="isDark ? 'bg-teal-900/30 border border-teal-700/40' : 'bg-teal-50 border border-teal-200'"
        >
          <p class="text-xs font-semibold mb-2" :class="isDark ? 'text-teal-300' : 'text-teal-700'">Kode OTP — Tunjukkan ke penjual saat bertemu</p>
          <div class="font-mono text-4xl font-bold tracking-widest my-2" :class="isDark ? 'text-white' : 'text-gray-900'">
            {{ order.meetup_otp }}
          </div>
          <p class="text-xs opacity-60" :class="isDark ? 'text-teal-300' : 'text-teal-700'">Jangan bagikan kepada pihak lain</p>
        </div>

        <!-- Seller: OTP input for awaiting_meetup -->
        <div
          v-if="role === 'seller' && order.status === 'awaiting_meetup'"
          class="mx-4 mb-3 rounded-xl p-4"
          :style="isDark ? 'background:rgba(13,68,41,0.25);border:1px solid rgba(20,184,166,0.25);' : 'background:rgba(240,253,250,0.90);border:1px solid rgba(153,246,228,0.60);'"
        >
          <p class="text-xs font-semibold mb-3" :class="isDark ? 'text-teal-300' : 'text-teal-700'">Masukkan kode OTP dari pembeli untuk konfirmasi serah terima:</p>
          <div class="flex gap-2">
            <input
              v-model="meetupOtpInputs[order.id]"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="6 digit OTP"
              class="flex-1 text-sm font-mono rounded-lg px-3 py-2 border focus:outline-none focus:ring-2 transition"
              :class="isDark
                ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-teal-400/30 focus:border-teal-400'
                : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-teal-200 focus:border-teal-400'"
            />
            <button
              @click="handleConfirmMeetup(order.id)"
              :disabled="actionLoading[order.id] || !(meetupOtpInputs[order.id] ?? '').trim()"
              class="px-4 py-2 rounded-lg text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50 shrink-0"
              style="background:linear-gradient(to right,#0d4429,#0f766e,#14b8a6);"
            >
              <span v-if="actionLoading[order.id]" class="flex items-center gap-1">
                <span class="w-3 h-3 rounded-full border border-t-transparent animate-spin border-white/50 border-t-white"></span>
                Memproses…
              </span>
              <span v-else>✅ Konfirmasi Meetup</span>
            </button>
          </div>
          <p v-if="actionErr[order.id]" class="text-xs text-red-500 mt-2">{{ actionErr[order.id] }}</p>
        </div>

        <!-- Disbursement note for seller (completed, no disbursement_id → bank belum diisi) -->
        <div
          v-if="role === 'seller' && order.status === 'completed' && !order.disbursement_id"
          class="mx-4 mb-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          :class="isDark ? 'bg-amber-900/25 border border-amber-700/30 text-amber-300' : 'bg-amber-50 border border-amber-100 text-amber-700'"
        >
          <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
          <span>Dana tertahan — Lengkapi data rekening bank di <NuxtLink to="/profile/edit?tab=bank" class="underline font-semibold">Profil → Rekening</NuxtLink> agar pencairan dapat diproses.</span>
        </div>

        <!-- Expired payment notice (pending_payment + 15 min passed) -->
        <div
          v-if="role === 'buyer' && order.status === 'pending_payment' && isPaymentExpired(order)"
          class="mx-4 mb-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          :class="isDark ? 'bg-red-900/25 border border-red-700/30 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'"
        >
          <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-.75 3.75h1.5m-1.5 0v.375m0-.375a2.25 2.25 0 10-4.5 0 2.25 2.25 0 004.5 0zm0 0v-.375M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364-6.364l-1.06 1.06M6.696 17.304l-1.06 1.06M17.304 17.304l-1.06-1.06M6.696 6.696l-1.06-1.06"/>
          </svg>
          <span>Link pembayaran sudah kadaluarsa (lewati 15 menit). <NuxtLink :to="chatId(order) ? `/chat/${chatId(order)}` : '#'" class="underline font-semibold">Chat penjual</NuxtLink> untuk negosiasi ulang jika perlu.</span>
        </div>

        <!-- Action buttons -->
        <div class="px-4 pb-4 flex flex-wrap gap-2">

          <!-- Chat link -->
          <NuxtLink
            v-if="chatId(order)"
            :to="`/chat/${chatId(order)}`"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition"
            :class="isDark ? 'border-slate-600 text-slate-300 hover:border-sky-500 hover:text-sky-300' : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-700'"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.836L3 20l1.09-3.27C3.39 15.522 3 13.809 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            Chat
          </NuxtLink>

          <!-- Buyer: "Bayar Sekarang" if pending_payment -->
          <a
            v-if="role === 'buyer' && order.status === 'pending_payment' && order.payment_url && !isPaymentExpired(order)"
            :href="order.payment_url"
            target="_blank"
            rel="noopener noreferrer"
            class="vt-btn-primary flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition hover:opacity-90"
            style="background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            Bayar Sekarang
          </a>

          <!-- Buyer: "Pesanan Diterima" if shipped -->
          <button
            v-if="role === 'buyer' && order.status === 'shipped'"
            @click="confirmCompleteId = order.id"
            :disabled="actionLoading[order.id]"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style="background:linear-gradient(to right,#14532d,#16a34a,#22c55e);"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            Pesanan Diterima
          </button>

          <!-- Buyer: "Beri Ulasan" if completed & not reviewed -->
          <button
            v-if="role === 'buyer' && order.status === 'completed' && !isReviewed(order.id)"
            @click="openReviewModal(order)"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition hover:opacity-90"
            style="background:linear-gradient(to right,#92400e,#d97706,#f59e0b);"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
            </svg>
            Beri Ulasan
          </button>

          <!-- Buyer: "Sudah Diulas" badge if completed & reviewed -->
          <span
            v-if="role === 'buyer' && order.status === 'completed' && isReviewed(order.id)"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            :class="isDark ? 'text-green-400 bg-green-900/20 border border-green-700/30' : 'text-green-600 bg-green-50 border border-green-100'"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            Sudah Diulas
          </span>

          <!-- Seller: COD — "Mulai Meetup" button if confirmed -->
          <button
            v-if="role === 'seller' && order.status === 'confirmed' && order.shipping_method === 'cod'"
            @click="handleStartMeetup(order.id)"
            :disabled="actionLoading[order.id]"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style="background:linear-gradient(to right,#0d4429,#0f766e,#14b8a6);"
          >
            <span v-if="actionLoading[order.id]" class="flex items-center gap-1">
              <span class="w-3 h-3 rounded-full border border-t-transparent animate-spin border-white/50 border-t-white"></span>
              Memproses…
            </span>
            <span v-else>🤝 Mulai Meetup</span>
          </button>

          <!-- Seller: Shipping — "Kirim Barang" toggle if confirmed -->
          <button
            v-if="role === 'seller' && order.status === 'confirmed' && order.shipping_method !== 'cod'"
            @click="toggleShipForm(order.id)"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white transition hover:opacity-90"
            style="background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>
            </svg>
            🚚 Kirim Barang
          </button>

          <!-- Action error -->
          <p v-if="actionErr[order.id]" class="w-full text-xs text-red-500 mt-1">{{ actionErr[order.id] }}</p>
        </div>

        <!-- Seller ship form (inline expand) -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="role === 'seller' && order.status === 'confirmed' && order.shipping_method !== 'cod' && getShipForm(order.id).open"
            class="mx-4 mb-4 rounded-xl p-4 space-y-3"
            :style="isDark ? 'background:rgba(30,58,138,0.15);border:1px solid rgba(56,189,248,0.15);' : 'background:rgba(239,246,255,0.80);border:1px solid rgba(147,197,253,0.50);'"
          >
            <!-- Biteship auto-create button (primary) -->
            <p class="text-xs font-semibold" :class="isDark ? 'text-sky-300' : 'text-blue-700'">Buat resi otomatis via Biteship</p>
            <button
              @click="handleShipViaBiteship(order.id)"
              :disabled="actionLoading[order.id]"
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style="background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);"
            >
              <span v-if="actionLoading[order.id]" class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin border-white/40 border-t-white"></span>
                Membuat pesanan Biteship…
              </span>
              <span v-else>🚀 Buat Resi Otomatis (Biteship)</span>
            </button>

            <!-- Manual toggle -->
            <button
              @click="getShipForm(order.id).manualMode = !getShipForm(order.id).manualMode"
              class="w-full text-xs text-center py-0.5 transition"
              :class="isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'"
            >
              {{ getShipForm(order.id).manualMode ? '▲ Sembunyikan form manual' : '▼ atau masukkan resi manual' }}
            </button>

            <!-- Manual form (hidden by default) -->
            <div
              v-if="getShipForm(order.id).manualMode"
              class="space-y-2 pt-2 border-t"
              :class="isDark ? 'border-slate-700' : 'border-blue-100'"
            >
              <div class="flex gap-2">
                <input
                  v-model="getShipForm(order.id).courier"
                  type="text"
                  placeholder="Kurir (opsional, misal JNE)"
                  class="flex-1 text-xs rounded-lg px-3 py-2 border focus:outline-none focus:ring-2 transition"
                  :class="isDark
                    ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/30 focus:border-sky-400'
                    : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-200 focus:border-blue-400'"
                />
              </div>
              <div class="flex gap-2">
                <input
                  v-model="getShipForm(order.id).tracking"
                  type="text"
                  placeholder="Nomor resi (wajib)"
                  class="flex-1 text-xs rounded-lg px-3 py-2 border focus:outline-none focus:ring-2 transition"
                  :class="isDark
                    ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/30 focus:border-sky-400'
                    : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-200 focus:border-blue-400'"
                />
                <button
                  @click="handleShip(order.id)"
                  :disabled="actionLoading[order.id] || !getShipForm(order.id).tracking.trim()"
                  class="px-4 py-2 rounded-lg text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50 shrink-0"
                  style="background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);"
                >
                  <span v-if="actionLoading[order.id]" class="flex items-center gap-1">
                    <span class="w-3 h-3 rounded-full border border-t-transparent animate-spin border-white/50 border-t-white"></span>
                    Menyimpan…
                  </span>
                  <span v-else>Konfirmasi Kirim</span>
                </button>
              </div>
            </div>

            <p v-if="actionErr[order.id]" class="text-xs text-red-500">{{ actionErr[order.id] }}</p>
          </div>
        </Transition>

        <!-- Biteship tracking panel (shipped / completed orders with biteship_order_id) -->
        <div
          v-if="order.biteship_order_id && (order.status === 'shipped' || order.status === 'completed')"
          class="mx-4 mb-3"
        >
          <button
            @click="loadTracking(order.id, order.biteship_order_id)"
            :disabled="trackingLoading[order.id]"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition"
            :class="isDark ? 'border-indigo-600 text-indigo-300 hover:bg-indigo-900/20 disabled:opacity-50' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50'"
          >
            <span v-if="trackingLoading[order.id]" class="flex items-center gap-1">
              <span class="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin border-current"></span>
              Memuat…
            </span>
            <span v-else>{{ trackingOpen[order.id] ? '▲ Tutup pelacakan' : '📍 Lacak Paket' }}</span>
          </button>

          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="trackingOpen[order.id] && trackingData[order.id]"
              class="mt-2 rounded-xl p-3 text-xs space-y-1.5"
              :class="isDark ? 'bg-slate-800/60 border border-slate-700' : 'bg-gray-50 border border-gray-200'"
            >
              <p class="font-semibold" :class="isDark ? 'text-indigo-300' : 'text-indigo-700'">
                Status Biteship: {{ trackingData[order.id].status ?? '—' }}
              </p>
              <p v-if="trackingData[order.id].tracking_number" :class="isDark ? 'text-slate-300' : 'text-gray-600'">
                Resi: <strong>{{ trackingData[order.id].tracking_number }}</strong>
              </p>
              <template v-if="trackingData[order.id].history?.length">
                <p class="font-medium pt-1" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Histori:</p>
                <div class="max-h-40 overflow-y-auto space-y-1">
                  <div
                    v-for="(evt, idx) in trackingData[order.id].history"
                    :key="idx"
                    class="flex gap-2"
                    :class="isDark ? 'text-slate-300' : 'text-gray-600'"
                  >
                    <span class="shrink-0 opacity-60 w-28">
                      {{ evt.updated_at ? new Date(evt.updated_at).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '' }}
                    </span>
                    <span>{{ evt.note || evt.description || evt.status }}</span>
                  </div>
                </div>
              </template>
              <p v-else class="opacity-60" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Belum ada histori pelacakan.</p>
            </div>
          </Transition>

          <p v-if="trackingError[order.id]" class="mt-1 text-xs text-red-500">{{ trackingError[order.id] }}</p>
        </div>
      </div>
    </div>

    <!-- Confirm Complete Modal -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="confirmCompleteId"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background:rgba(0,0,0,0.50);backdrop-filter:blur(4px);"
        @click.self="confirmCompleteId = null"
      >
        <div
          class="w-full max-w-sm rounded-2xl p-6"
          :style="isDark
            ? 'background:rgba(15,23,42,0.97);border:1px solid rgba(255,255,255,0.10);box-shadow:0 8px 32px rgba(0,0,0,0.50);'
            : 'background:rgba(255,255,255,0.98);border:1px solid rgba(30,58,138,0.12);box-shadow:0 8px 32px rgba(30,58,138,0.15);'"
        >
          <div class="text-center mb-5">
            <div class="text-4xl mb-3">📦</div>
            <h3 class="font-heading text-lg font-bold mb-1" :style="isDark ? 'color:#f1f5f9;' : 'color:#1e3a8a;'">Konfirmasi Penerimaan</h3>
            <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
              Pastikan kamu sudah menerima barang dalam kondisi baik. Dana akan diteruskan ke penjual setelah dikonfirmasi.
            </p>
          </div>
          <div class="flex gap-2">
            <button
              @click="confirmCompleteId = null"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium border transition"
              :class="isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
            >Batal</button>
            <button
              @click="handleComplete(confirmCompleteId)"
              :disabled="actionLoading[confirmCompleteId]"
              class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style="background:linear-gradient(to right,#14532d,#16a34a,#22c55e);"
            >
              <span v-if="actionLoading[confirmCompleteId]" class="flex items-center justify-center gap-1.5">
                <span class="w-4 h-4 rounded-full border-2 border-t-transparent border-white/50 border-t-white animate-spin"></span>
                Memproses…
              </span>
              <span v-else>✅ Ya, Sudah Diterima</span>
            </button>
          </div>
          <p v-if="confirmCompleteId && actionErr[confirmCompleteId]" class="text-xs text-red-500 text-center mt-2">
            {{ actionErr[confirmCompleteId] }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- Review Modal -->
    <ReviewModal
      v-if="reviewTarget"
      :order-id="reviewTarget.orderId"
      :product-id="reviewTarget.productId"
      :seller-id="reviewTarget.sellerId"
      :product-title="reviewTarget.productTitle"
      :seller-name="reviewTarget.sellerName"
      :product-image="reviewTarget.productImage"
      @close="reviewTarget = null"
      @submitted="onReviewSubmitted"
    />

  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
</style>
