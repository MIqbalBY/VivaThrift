<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Seller Analytics — VivaThrift' })

const { isDark } = useDarkMode()

const data = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatMonth(ym: string) {
  const parts = ym.split('-')
  const y = parts[0] ?? ''
  const m = parts[1] ?? '01'
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const
  return `${months[parseInt(m) - 1] ?? 'Jan'} ${y}`
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'Belum Bayar', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  confirmed:       { label: 'Dikemas',     color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  awaiting_meetup: { label: 'Meetup',      color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  shipped:         { label: 'Dikirim',     color: '#0891b2', bg: 'rgba(8,145,178,0.12)' },
  completed:       { label: 'Selesai',     color: '#059669', bg: 'rgba(5,150,105,0.12)' },
}

async function loadAnalytics() {
  loading.value = true
  error.value = null
  try {
    data.value = await $fetch('/api/seller/analytics')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Gagal memuat data analytics.'
  }
  loading.value = false
}

// Max revenue for bar chart scaling
const maxRevenue = computed(() => {
  if (!data.value?.monthlyRevenue?.length) return 1
  return Math.max(...data.value.monthlyRevenue.map((m: any) => m.revenue), 1)
})

onMounted(loadAnalytics)
</script>

<template>
  <div class="w-full max-w-5xl mx-auto px-4 md:px-8 py-8">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        :style="isDark ? 'background:rgba(5,150,105,0.20);' : 'background:rgba(5,150,105,0.12);'">
        <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
        </svg>
      </div>
      <div>
        <h1 class="font-heading text-2xl font-bold" :style="isDark ? 'color:#f1f5f9;' : 'color:#1e3a8a;'">Seller Analytics</h1>
        <p class="text-xs mt-0.5" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Statistik penjualan dan performa tokomu</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div v-for="i in 4" :key="i" class="rounded-xl p-4 h-24 animate-pulse"
        :class="isDark ? 'bg-slate-800' : 'bg-gray-100'"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-16">
      <p class="text-4xl mb-4">😵</p>
      <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ error }}</p>
      <button @click="loadAnalytics" class="mt-4 px-4 py-2 rounded-xl text-sm font-bold text-white"
        style="background:linear-gradient(to right,#162d6e,#1e3a8a);">Coba Lagi</button>
    </div>

    <template v-else-if="data">
      <!-- ═══ STATS CARDS ═══ -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div v-for="(s, i) in [
          { icon: '💰', label: 'Total Pendapatan', value: formatRp(data.totalRevenue) },
          { icon: '📦', label: 'Pesanan Selesai', value: data.completedOrders },
          { icon: '🛍️', label: 'Produk Aktif', value: data.activeProducts },
          { icon: '⭐', label: 'Rating Rata-rata', value: data.avgRating ? `${data.avgRating} (${data.totalReviews})` : 'Belum ada' },
        ]" :key="i"
          class="rounded-xl p-4 transition-all"
          :style="isDark
            ? 'background:rgba(15,23,42,0.80);border:1px solid rgba(255,255,255,0.08);'
            : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.60);box-shadow:0 2px 8px rgba(30,58,138,0.06);'"
        >
          <span class="text-2xl">{{ s.icon }}</span>
          <p class="text-xs mt-2 font-medium" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ s.label }}</p>
          <p class="text-lg font-bold mt-1" :class="isDark ? 'text-white' : 'text-gray-800'">{{ s.value }}</p>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6 mb-8">
        <!-- ═══ MONTHLY REVENUE CHART ═══ -->
        <div class="rounded-xl p-5"
          :style="isDark
            ? 'background:rgba(15,23,42,0.80);border:1px solid rgba(255,255,255,0.08);'
            : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.60);box-shadow:0 2px 8px rgba(30,58,138,0.06);'"
        >
          <h2 class="text-sm font-bold mb-4" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Pendapatan Bulanan</h2>
          <div v-if="!data.monthlyRevenue?.length" class="py-8 text-center text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
            Belum ada data penjualan.
          </div>
          <div v-else class="space-y-2.5">
            <div v-for="m in data.monthlyRevenue" :key="m.month" class="flex items-center gap-3">
              <span class="text-xs font-medium w-16 shrink-0" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ formatMonth(m.month) }}</span>
              <div class="flex-1 h-6 rounded-lg overflow-hidden" :class="isDark ? 'bg-slate-700' : 'bg-gray-100'">
                <div class="h-full rounded-lg transition-all duration-500"
                  :style="{
                    width: `${Math.max((m.revenue / maxRevenue) * 100, 4)}%`,
                    background: isDark ? 'linear-gradient(to right,#059669,#34d399)' : 'linear-gradient(to right,#1e3a8a,#3b82f6)',
                  }"></div>
              </div>
              <span class="text-xs font-semibold w-24 text-right shrink-0" :class="isDark ? 'text-slate-300' : 'text-gray-600'">{{ formatRp(m.revenue) }}</span>
            </div>
          </div>
        </div>

        <!-- ═══ TOP PRODUCTS ═══ -->
        <div class="rounded-xl p-5"
          :style="isDark
            ? 'background:rgba(15,23,42,0.80);border:1px solid rgba(255,255,255,0.08);'
            : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.60);box-shadow:0 2px 8px rgba(30,58,138,0.06);'"
        >
          <h2 class="text-sm font-bold mb-4" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Produk Terlaris</h2>
          <div v-if="!data.topProducts?.length" class="py-8 text-center text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
            Belum ada produk terjual.
          </div>
          <div v-else class="space-y-3">
            <div v-for="(p, idx) in data.topProducts" :key="p.id" class="flex items-center gap-3">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                :style="idx === 0
                  ? 'background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#78350f;'
                  : isDark ? 'background:rgba(255,255,255,0.08);color:#94a3b8;' : 'background:rgba(30,58,138,0.08);color:#64748b;'"
              >{{ Number(idx) + 1 }}</span>
              <p class="flex-1 text-sm font-medium truncate" :class="isDark ? 'text-slate-200' : 'text-gray-700'">{{ p.title }}</p>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                :style="isDark ? 'background:rgba(5,150,105,0.20);color:#34d399;' : 'background:rgba(5,150,105,0.10);color:#059669;'"
              >{{ p.sold }} terjual</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ RECENT ORDERS ═══ -->
      <div class="rounded-xl p-5"
        :style="isDark
          ? 'background:rgba(15,23,42,0.80);border:1px solid rgba(255,255,255,0.08);'
          : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.60);box-shadow:0 2px 8px rgba(30,58,138,0.06);'"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold" :class="isDark ? 'text-slate-200' : 'text-gray-700'">Pesanan Terbaru</h2>
          <NuxtLink to="/orders" class="text-xs font-semibold" :class="isDark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700'">Lihat semua →</NuxtLink>
        </div>
        <div v-if="!data.recentOrders?.length" class="py-8 text-center text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
          Belum ada pesanan masuk.
        </div>
        <div v-else class="space-y-2">
          <div v-for="o in data.recentOrders" :key="o.id" class="flex items-center gap-3 rounded-xl p-3 transition-colors"
            :style="isDark ? 'background:rgba(255,255,255,0.03);' : 'background:rgba(248,250,252,0.80);'"
          >
            <div class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0"
              :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8);' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb);'">
              <img v-if="o.buyer_avatar" :src="o.buyer_avatar" class="w-full h-full object-cover" />
              <span v-else>{{ (o.buyer_name ?? '?')[0] }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate" :class="isDark ? 'text-white' : 'text-gray-800'">{{ o.product_title }}</p>
              <p class="text-xs" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                {{ o.buyer_name }}
                <span v-if="o.item_count > 1"> · +{{ o.item_count - 1 }} item</span>
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-bold" :class="isDark ? 'text-emerald-400' : 'text-emerald-600'">{{ formatRp(o.total_amount) }}</p>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                :style="`background:${STATUS_LABELS[o.status]?.bg ?? 'rgba(100,116,139,0.12)'};color:${STATUS_LABELS[o.status]?.color ?? '#64748b'};`"
              >{{ STATUS_LABELS[o.status]?.label ?? o.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
