<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Dispute & Refund — VivaThrift' })

const { isDark } = useDarkMode()
const toast = useToast()

const role = ref<'buyer' | 'seller'>('buyer')
const disputes = ref<any[]>([])
const loading = ref(true)

// ── New dispute form ──────────────────────────────────────────────────────
const showForm = ref(false)
const form = reactive({ orderId: '', reason: '' })
const formLoading = ref(false)

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  open:              { label: 'Terbuka',           color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  in_review:         { label: 'Ditinjau Admin',    color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  resolved_refund:   { label: 'Refund Penuh',      color: '#059669', bg: 'rgba(5,150,105,0.12)' },
  resolved_partial:  { label: 'Refund Sebagian',   color: '#0891b2', bg: 'rgba(8,145,178,0.12)' },
  resolved_rejected: { label: 'Ditolak',           color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  cancelled:         { label: 'Dibatalkan',        color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function timeAgo(iso: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} jam lalu`
  const days = Math.floor(hrs / 24)
  return `${days} hari lalu`
}

function getProductImage(dispute: any) {
  const items = dispute.order?.order_items
  if (!items?.length) return null
  const media = items[0]?.product?.product_media
  if (!media?.length) return null
  const primary = media.find((m: any) => m.is_primary) ?? media[0]
  if (primary.media_type?.startsWith('video') && primary.thumbnail_url) return primary.thumbnail_url
  return primary.media_url
}

async function fetchDisputes() {
  loading.value = true
  try {
    disputes.value = await $fetch<any[]>('/api/disputes', { query: { role: role.value } })
  } catch { disputes.value = [] }
  loading.value = false
}

async function submitDispute() {
  if (!form.orderId || form.reason.length < 10) return
  formLoading.value = true
  try {
    await $fetch('/api/disputes', {
      method: 'POST',
      body: { order_id: form.orderId, reason: form.reason },
    })
    toast.success('Dispute berhasil dibuka.')
    showForm.value = false
    form.orderId = ''
    form.reason = ''
    await fetchDisputes()
  } catch (e: any) {
    toast.error(e?.data?.statusMessage ?? 'Gagal membuka dispute.')
  }
  formLoading.value = false
}

async function cancelDispute(id: string) {
  if (!confirm('Yakin ingin membatalkan dispute ini?')) return
  try {
    await $fetch(`/api/disputes/${id}`, { method: 'PATCH', body: { action: 'cancel' } })
    toast.success('Dispute dibatalkan.')
    await fetchDisputes()
  } catch (e: any) {
    toast.error(e?.data?.statusMessage ?? 'Gagal membatalkan.')
  }
}

watch(role, () => fetchDisputes())
onMounted(fetchDisputes)
</script>

<template>
  <div class="w-full max-w-4xl mx-auto px-4 md:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          :style="isDark ? 'background:rgba(220,38,38,0.20);' : 'background:rgba(220,38,38,0.10);'">
          <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <h1 class="font-heading text-2xl font-bold" :style="isDark ? 'color:#f1f5f9;' : 'color:#1e3a8a;'">Dispute & Refund</h1>
      </div>
      <button v-if="role === 'buyer'" @click="showForm = !showForm"
        class="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
        style="background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);">
        {{ showForm ? 'Tutup' : '+ Buka Dispute' }}
      </button>
    </div>

    <!-- Role toggle -->
    <div class="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit"
      :style="isDark ? 'background:rgba(15,23,42,0.70);border:1px solid rgba(255,255,255,0.08);' : 'background:rgba(30,58,138,0.07);border:1px solid rgba(30,58,138,0.10);'">
      <button v-for="r in (['buyer', 'seller'] as const)" :key="r" @click="role = r"
        class="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        :class="role === r ? 'text-white shadow-sm' : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'"
        :style="role === r ? 'background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);' : ''">
        {{ r === 'buyer' ? '🛒 Sebagai Pembeli' : '🏪 Sebagai Penjual' }}
      </button>
    </div>

    <!-- New dispute form -->
    <Transition name="slide-down">
      <div v-if="showForm && role === 'buyer'" class="rounded-xl p-5 mb-6"
        :style="isDark
          ? 'background:rgba(15,23,42,0.80);border:1px solid rgba(255,255,255,0.08);'
          : 'background:rgba(255,255,255,0.90);border:1px solid rgba(226,232,240,0.60);box-shadow:0 2px 8px rgba(30,58,138,0.06);'"
      >
        <h3 class="text-sm font-bold mb-4" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Buka Dispute Baru</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs font-medium mb-1 block" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Order ID</label>
            <input v-model="form.orderId" placeholder="Paste Order ID dari halaman pesanan…"
              class="w-full text-sm rounded-xl px-4 py-2.5 border transition focus:outline-none focus:ring-2"
              :class="isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/30' : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-200'" />
          </div>
          <div>
            <label class="text-xs font-medium mb-1 block" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Alasan (min 10 karakter)</label>
            <textarea v-model="form.reason" rows="3" placeholder="Jelaskan masalah yang kamu alami…"
              class="w-full text-sm rounded-xl px-4 py-2.5 border transition focus:outline-none focus:ring-2 resize-none"
              :class="isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/30' : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-200'"></textarea>
          </div>
          <button @click="submitDispute" :disabled="formLoading || !form.orderId || form.reason.length < 10"
            class="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
            style="background:linear-gradient(to right,#dc2626,#ef4444);">
            {{ formLoading ? 'Mengirim…' : 'Kirim Dispute' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="rounded-xl p-4 h-28 animate-pulse"
        :class="isDark ? 'bg-slate-800' : 'bg-gray-100'"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="!disputes.length" class="text-center py-16">
      <p class="text-4xl mb-4">✅</p>
      <p class="text-sm font-medium" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
        Tidak ada dispute {{ role === 'buyer' ? 'darimu' : 'pada pesananmu' }}.
      </p>
    </div>

    <!-- Dispute list -->
    <div v-else class="space-y-3">
      <div v-for="d in disputes" :key="d.id" class="rounded-xl p-4 transition-all"
        :style="isDark
          ? 'background:rgba(15,23,42,0.80);border:1px solid rgba(255,255,255,0.08);'
          : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.60);box-shadow:0 2px 8px rgba(30,58,138,0.06);'"
      >
        <div class="flex items-start gap-3">
          <!-- Product image -->
          <div class="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700 shrink-0">
            <img v-if="getProductImage(d)" :src="getProductImage(d)!" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-xl">📦</div>
          </div>

          <div class="flex-1 min-w-0">
            <!-- Top row: product + status -->
            <div class="flex items-center justify-between gap-2 mb-1">
              <p class="text-sm font-semibold truncate" :class="isDark ? 'text-white' : 'text-gray-800'">
                {{ d.order?.order_items?.[0]?.product?.title ?? 'Pesanan' }}
              </p>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                :style="`background:${STATUS_MAP[d.status]?.bg ?? 'rgba(100,116,139,0.12)'};color:${STATUS_MAP[d.status]?.color ?? '#64748b'};`"
              >{{ STATUS_MAP[d.status]?.label ?? d.status }}</span>
            </div>

            <!-- Reason -->
            <p class="text-xs leading-relaxed mb-2" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ d.reason }}</p>

            <!-- Meta row -->
            <div class="flex items-center gap-3 text-[11px]" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
              <span>{{ formatRp(d.order?.total_amount ?? 0) }}</span>
              <span>·</span>
              <span>{{ role === 'buyer' ? d.seller?.name : d.buyer?.name }}</span>
              <span>·</span>
              <span>{{ timeAgo(d.created_at) }}</span>
            </div>

            <!-- Resolution note -->
            <div v-if="d.resolution_note" class="mt-2 p-2 rounded-lg text-xs"
              :style="isDark ? 'background:rgba(255,255,255,0.04);' : 'background:rgba(248,250,252,1);'">
              <span class="font-semibold" :class="isDark ? 'text-slate-300' : 'text-gray-600'">Admin:</span>
              <span class="ml-1" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ d.resolution_note }}</span>
              <span v-if="d.refund_amount > 0" class="ml-2 font-bold" :class="isDark ? 'text-emerald-400' : 'text-emerald-600'">
                Refund: {{ formatRp(d.refund_amount) }}
              </span>
            </div>

            <!-- Cancel button (buyer + open only) -->
            <button v-if="role === 'buyer' && d.status === 'open'" @click="cancelDispute(d.id)"
              class="mt-2 text-xs font-semibold px-3 py-1 rounded-lg transition"
              :class="isDark ? 'text-red-400 bg-red-900/20 hover:bg-red-900/30' : 'text-red-600 bg-red-50 hover:bg-red-100'">
              Batalkan Dispute
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.25s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
