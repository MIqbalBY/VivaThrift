<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Admin Dashboard — VivaThrift' })

const { isDark } = useDarkMode()

const activeTab = ref<'overview' | 'users' | 'products' | 'reports' | 'disputes'>('overview')

// ── Overview stats ────────────────────────────────────────────────────────────
const stats = ref<any>(null)
const statsLoading = ref(true)
async function loadStats() {
  statsLoading.value = true
  try { stats.value = await $fetch('/api/admin/stats') } catch {}
  statsLoading.value = false
}

// ── Users ─────────────────────────────────────────────────────────────────────
const users = ref<any[]>([])
const usersTotal = ref(0)
const usersPage = ref(1)
const usersSearch = ref('')
const usersLoading = ref(false)
async function loadUsers() {
  usersLoading.value = true
  try {
    const res = await $fetch<any>('/api/admin/users', { query: { q: usersSearch.value, page: usersPage.value, limit: 20 } })
    users.value = res.users
    usersTotal.value = res.total
  } catch {}
  usersLoading.value = false
}

const userActionLoading = ref<Record<string, boolean>>({})
const userActionErr = ref<Record<string, string>>({})

async function banUser(userId: string) {
  const reason = prompt('Alasan ban user ini:')
  if (!reason?.trim()) return
  userActionLoading.value[userId] = true
  userActionErr.value[userId] = ''
  try {
    await $fetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: { action: 'ban', reason } })
    await loadUsers()
  } catch (e: any) { userActionErr.value[userId] = e?.data?.statusMessage ?? 'Gagal.' }
  finally { userActionLoading.value[userId] = false }
}
async function unbanUser(userId: string) {
  userActionLoading.value[userId] = true
  try {
    await $fetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: { action: 'unban' } })
    await loadUsers()
  } catch (e: any) { userActionErr.value[userId] = e?.data?.statusMessage ?? 'Gagal.' }
  finally { userActionLoading.value[userId] = false }
}

// ── Products moderation ───────────────────────────────────────────────────────
const productTab = ref<'active' | 'moderated' | 'banned'>('active')
const products = ref<any[]>([])
const productsTotal = ref(0)
const productsPage = ref(1)
const productsSearch = ref('')
const productsLoading = ref(false)
async function loadProducts() {
  productsLoading.value = true
  try {
    const res = await $fetch<any>('/api/admin/products', { query: { status: productTab.value, q: productsSearch.value, page: productsPage.value, limit: 20 } })
    products.value = res.products
    productsTotal.value = res.total
  } catch {}
  productsLoading.value = false
}
watch(productTab, () => { productsPage.value = 1; loadProducts() })

const prodActionLoading = ref<Record<string, boolean>>({})
const prodActionErr = ref<Record<string, string>>({})

async function moderateProduct(productId: string, action: 'approve' | 'reject' | 'ban') {
  let reason = ''
  if (action === 'reject' || action === 'ban') {
    const input = prompt(`Alasan ${action === 'reject' ? 'penolakan' : 'ban'} produk ini:`)
    if (!input?.trim()) return
    reason = input
  }
  prodActionLoading.value[productId] = true
  prodActionErr.value[productId] = ''
  try {
    await $fetch(`/api/admin/products/${productId}`, { method: 'PATCH', body: { action, reason } })
    await loadProducts()
  } catch (e: any) { prodActionErr.value[productId] = e?.data?.statusMessage ?? 'Gagal.' }
  finally { prodActionLoading.value[productId] = false }
}

function getProductImage(product: any) {
  const media = product.product_media
  if (!media?.length) return null
  const primary = media.find((m: any) => m.is_primary) ?? media[0]
  return primary?.thumbnail_url ?? primary?.media_url ?? null
}

function formatRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days < 1) return 'Hari ini'
  if (days < 7) return `${days} hari lalu`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Reports ───────────────────────────────────────────────────────────────────
const reportTab = ref<'pending' | 'resolved' | 'dismissed'>('pending')
const reports = ref<any[]>([])
const reportsTotal = ref(0)
const reportsPage = ref(1)
const reportsLoading = ref(false)
async function loadReports() {
  reportsLoading.value = true
  try {
    const res = await $fetch<any>('/api/admin/reports', { query: { status: reportTab.value, page: reportsPage.value, limit: 20 } })
    reports.value = res.reports
    reportsTotal.value = res.total
  } catch {}
  reportsLoading.value = false
}
watch(reportTab, () => { reportsPage.value = 1; loadReports() })

const reportActionLoading = ref<Record<string, boolean>>({})
const reportActionErr = ref<Record<string, string>>({})

async function handleReport(reportId: string, action: string) {
  let notes = ''
  if (action !== 'dismiss') {
    const input = prompt('Catatan admin (opsional):')
    if (input === null) return // cancelled
    notes = input
  }
  reportActionLoading.value[reportId] = true
  reportActionErr.value[reportId] = ''
  try {
    await $fetch(`/api/admin/reports/${reportId}`, { method: 'PATCH', body: { action, notes } })
    await loadReports()
    await loadStats() // refresh pending count
  } catch (e: any) {
    reportActionErr.value[reportId] = e?.data?.statusMessage ?? 'Gagal.'
  } finally {
    reportActionLoading.value[reportId] = false
  }
}

function getReportProductImage(report: any) {
  const media = report.reported_product?.product_media
  if (!media?.length) return null
  const primary = media.find((m: any) => m.is_primary) ?? media[0]
  return primary?.thumbnail_url ?? primary?.media_url ?? null
}

// ── Disputes ─────────────────────────────────────────────────────────────────
const disputeTab = ref<'open' | 'in_review' | 'resolved_refund' | 'resolved_partial' | 'resolved_rejected'>('open')
const adminDisputes = ref<any[]>([])
const disputesTotal = ref(0)
const disputesPage = ref(1)
const disputesLoading = ref(false)
async function loadDisputes() {
  disputesLoading.value = true
  try {
    const res = await $fetch<any>('/api/admin/disputes', { query: { status: disputeTab.value, page: disputesPage.value, limit: 20 } })
    adminDisputes.value = res.disputes
    disputesTotal.value = res.total
  } catch {}
  disputesLoading.value = false
}
watch(disputeTab, () => { disputesPage.value = 1; loadDisputes() })

const disputeActionLoading = ref<Record<string, boolean>>({})

async function resolveDispute(disputeId: string, resolution: 'refund' | 'partial' | 'rejected') {
  let refundAmount = 0
  if (resolution !== 'rejected') {
    const input = prompt(`Masukkan jumlah refund (Rupiah):`)
    if (!input) return
    refundAmount = Number(input)
    if (isNaN(refundAmount) || refundAmount <= 0) { alert('Jumlah tidak valid.'); return }
  }
  const note = prompt('Catatan resolusi (opsional):') ?? ''
  disputeActionLoading.value[disputeId] = true
  try {
    await $fetch(`/api/disputes/${disputeId}`, {
      method: 'PATCH',
      body: { action: 'resolve', resolution, refund_amount: refundAmount, resolution_note: note },
    })
    await loadDisputes()
  } catch (e: any) { alert(e?.data?.statusMessage ?? 'Gagal.') }
  finally { disputeActionLoading.value[disputeId] = false }
}

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(() => { loadStats(); loadUsers(); loadProducts(); loadReports(); loadDisputes() })
</script>

<template>
  <div class="w-full max-w-6xl mx-auto px-4 md:px-8 py-8">

    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(220,38,38,0.12);">
        <svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
        </svg>
      </div>
      <h1 class="font-heading text-2xl font-bold" :style="isDark ? 'color:#f1f5f9;' : 'color:#1e3a8a;'">Admin Dashboard</h1>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit" :style="isDark ? 'background:rgba(15,23,42,0.70);border:1px solid rgba(255,255,255,0.08);' : 'background:rgba(30,58,138,0.07);border:1px solid rgba(30,58,138,0.10);'">
      <button v-for="t in ([{ key: 'overview', label: '📊 Overview' }, { key: 'users', label: '👥 Users' }, { key: 'products', label: '📦 Produk' }, { key: 'reports', label: '📢 Reports' }, { key: 'disputes', label: '⚠️ Dispute' }] as const)" :key="t.key" @click="activeTab = t.key"
        class="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
        :class="activeTab === t.key ? 'text-white shadow-sm' : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'"
        :style="activeTab === t.key ? 'background:linear-gradient(to right,#7f1d1d,#dc2626,#ef4444);' : ''"
      >{{ t.label }}</button>
    </div>

    <!-- ═══ OVERVIEW TAB ═══ -->
    <div v-if="activeTab === 'overview'" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div v-for="(s, i) in [
        { label: 'Total Users', value: stats?.totalUsers, icon: '👥' },
        { label: 'Produk Aktif', value: stats?.totalProducts, icon: '📦' },
        { label: 'Total Pesanan', value: stats?.totalOrders, icon: '📋' },
        { label: 'Pesanan Selesai', value: stats?.completedOrders, icon: '✅' },
        { label: 'Total Revenue', value: stats?.totalRevenue != null ? formatRp(stats.totalRevenue) : '—', icon: '💰' },
        { label: 'User Banned', value: stats?.bannedUsers, icon: '🚫' },
        { label: 'Produk Dimoderasi', value: stats?.moderatedProducts, icon: '⚠️' },
        { label: 'Laporan Pending', value: stats?.pendingReports, icon: '📢' },
      ]" :key="i"
        class="rounded-xl p-4"
        :style="isDark
          ? 'background:rgba(15,23,42,0.80);border:1px solid rgba(255,255,255,0.08);'
          : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.60);box-shadow:0 2px 8px rgba(30,58,138,0.06);'"
      >
        <span class="text-2xl">{{ s.icon }}</span>
        <p class="text-xs mt-2 font-medium" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ s.label }}</p>
        <p v-if="statsLoading" class="h-6 w-16 rounded animate-pulse mt-1" :class="isDark ? 'bg-slate-700' : 'bg-gray-200'"></p>
        <p v-else class="text-lg font-bold mt-1" :class="isDark ? 'text-white' : 'text-gray-800'">{{ s.value ?? '—' }}</p>
      </div>
    </div>

    <!-- ═══ USERS TAB ═══ -->
    <div v-if="activeTab === 'users'">
      <!-- Search -->
      <div class="flex items-center gap-3 mb-4">
        <input v-model="usersSearch" @keyup.enter="usersPage = 1; loadUsers()" placeholder="Cari user (nama, email, NRP)…" class="flex-1 text-sm rounded-xl px-4 py-2.5 border transition focus:outline-none focus:ring-2" :class="isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/30' : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-200'" />
        <button @click="usersPage = 1; loadUsers()" class="px-4 py-2.5 rounded-xl text-sm font-bold text-white" style="background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);">Cari</button>
      </div>

      <p class="text-xs mb-3" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ usersTotal }} user ditemukan</p>

      <!-- Loading -->
      <div v-if="usersLoading" class="py-10 flex justify-center">
        <div class="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" :class="isDark ? 'border-sky-400' : 'border-blue-800'"></div>
      </div>

      <!-- User rows -->
      <div v-else class="space-y-2">
        <div v-for="u in users" :key="u.id" class="flex items-center gap-3 rounded-xl p-3"
          :style="isDark
            ? 'background:rgba(15,23,42,0.70);border:1px solid rgba(255,255,255,0.06);'
            : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.50);'"
        >
          <div class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0" :style="isDark ? 'background:linear-gradient(135deg,#0ea5e9,#38bdf8);' : 'background:linear-gradient(135deg,#1e3a8a,#2563eb);'">
            <img v-if="u.avatar_url" :src="u.avatar_url" class="w-full h-full object-cover" />
            <span v-else>{{ (u.name ?? '?')[0] }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <p class="text-sm font-semibold truncate" :class="isDark ? 'text-white' : 'text-gray-800'">{{ u.name ?? '—' }}</p>
              <span v-if="u.role === 'admin'" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">ADMIN</span>
              <span v-else-if="u.role === 'moderator'" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">MOD</span>
              <span v-if="u.banned_at" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-900/20 text-red-400">BANNED</span>
            </div>
            <p class="text-xs truncate" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ u.nrp }} · {{ u.faculty ?? '' }} · {{ u.email }}</p>
            <p v-if="u.banned_at" class="text-xs text-red-400 mt-0.5">Ban: {{ u.banned_reason }}</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[10px]" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ relativeDate(u.created_at) }}</span>
            <button v-if="!u.banned_at && u.role === 'user'" @click="banUser(u.id)" :disabled="userActionLoading[u.id]"
              class="px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
              :class="isDark ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'"
            >Ban</button>
            <button v-if="u.banned_at" @click="unbanUser(u.id)" :disabled="userActionLoading[u.id]"
              class="px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
              :class="isDark ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-600 hover:bg-green-100'"
            >Unban</button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="usersTotal > 20" class="flex justify-center gap-2 mt-4">
        <button @click="usersPage = Math.max(1, usersPage - 1); loadUsers()" :disabled="usersPage <= 1" class="px-3 py-1 rounded-lg text-xs border disabled:opacity-40" :class="isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600'">Prev</button>
        <span class="text-xs self-center" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ usersPage }} / {{ Math.ceil(usersTotal / 20) }}</span>
        <button @click="usersPage++; loadUsers()" :disabled="usersPage * 20 >= usersTotal" class="px-3 py-1 rounded-lg text-xs border disabled:opacity-40" :class="isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600'">Next</button>
      </div>
    </div>

    <!-- ═══ PRODUCTS TAB ═══ -->
    <div v-if="activeTab === 'products'">
      <!-- Sub-tabs -->
      <div class="flex items-center gap-2 mb-4">
        <button v-for="pt in ([{ key: 'active', label: 'Aktif' }, { key: 'moderated', label: 'Dimoderasi' }, { key: 'banned', label: 'Banned' }] as const)" :key="pt.key" @click="productTab = pt.key"
          class="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
          :class="productTab === pt.key ? 'text-white border-transparent' : isDark ? 'text-slate-400 border-slate-600 hover:text-white' : 'text-gray-500 border-gray-200 hover:text-blue-700'"
          :style="productTab === pt.key ? 'background:linear-gradient(to right,#7f1d1d,#dc2626,#ef4444);' : ''"
        >{{ pt.label }}</button>
      </div>

      <!-- Search -->
      <div class="flex items-center gap-3 mb-4">
        <input v-model="productsSearch" @keyup.enter="productsPage = 1; loadProducts()" placeholder="Cari produk…" class="flex-1 text-sm rounded-xl px-4 py-2.5 border transition focus:outline-none focus:ring-2" :class="isDark ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-sky-400/30' : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-blue-200'" />
        <button @click="productsPage = 1; loadProducts()" class="px-4 py-2.5 rounded-xl text-sm font-bold text-white" style="background:linear-gradient(to right,#162d6e,#1e3a8a,#1e40af);">Cari</button>
      </div>

      <p class="text-xs mb-3" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ productsTotal }} produk</p>

      <!-- Loading -->
      <div v-if="productsLoading" class="py-10 flex justify-center">
        <div class="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" :class="isDark ? 'border-sky-400' : 'border-blue-800'"></div>
      </div>

      <!-- Product rows -->
      <div v-else class="space-y-2">
        <div v-for="p in products" :key="p.id" class="flex items-start gap-3 rounded-xl p-3"
          :style="isDark
            ? 'background:rgba(15,23,42,0.70);border:1px solid rgba(255,255,255,0.06);'
            : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.50);'"
        >
          <!-- Thumbnail -->
          <NuxtLink :to="`/products/${p.slug ?? p.id}`" class="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100">
            <img v-if="getProductImage(p)" :src="getProductImage(p)" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-xl">📦</div>
          </NuxtLink>

          <div class="flex-1 min-w-0">
            <NuxtLink :to="`/products/${p.slug ?? p.id}`" class="text-sm font-semibold truncate block hover:underline" :class="isDark ? 'text-white' : 'text-gray-800'">{{ p.title }}</NuxtLink>
            <p class="text-xs" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
              {{ formatRp(p.price) }} · {{ p.condition }} · Seller: {{ p.seller?.name ?? '—' }} ({{ p.seller?.nrp ?? '' }})
            </p>
            <p v-if="p.moderation_reason" class="text-xs mt-1 px-2 py-1 rounded-lg inline-block" :class="isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'">
              Alasan: {{ p.moderation_reason }}
            </p>
            <p v-if="prodActionErr[p.id]" class="text-xs text-red-500 mt-1">{{ prodActionErr[p.id] }}</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[10px]" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ relativeDate(p.created_at) }}</span>

            <!-- Active products: Reject -->
            <button v-if="productTab === 'active'" @click="moderateProduct(p.id, 'reject')" :disabled="prodActionLoading[p.id]"
              class="px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
              :class="isDark ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'"
            >Tolak</button>

            <!-- Moderated products: Approve or Ban -->
            <template v-if="productTab === 'moderated'">
              <button @click="moderateProduct(p.id, 'approve')" :disabled="prodActionLoading[p.id]"
                class="px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
                :class="isDark ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-600 hover:bg-green-100'"
              >Approve</button>
              <button @click="moderateProduct(p.id, 'ban')" :disabled="prodActionLoading[p.id]"
                class="px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
                :class="isDark ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'"
              >Ban</button>
            </template>
          </div>
        </div>

        <div v-if="products.length === 0" class="text-center py-12">
          <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">Tidak ada produk di tab ini.</p>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="productsTotal > 20" class="flex justify-center gap-2 mt-4">
        <button @click="productsPage = Math.max(1, productsPage - 1); loadProducts()" :disabled="productsPage <= 1" class="px-3 py-1 rounded-lg text-xs border disabled:opacity-40" :class="isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600'">Prev</button>
        <span class="text-xs self-center" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ productsPage }} / {{ Math.ceil(productsTotal / 20) }}</span>
        <button @click="productsPage++; loadProducts()" :disabled="productsPage * 20 >= productsTotal" class="px-3 py-1 rounded-lg text-xs border disabled:opacity-40" :class="isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600'">Next</button>
      </div>
    </div>

    <!-- ═══ REPORTS TAB ═══ -->
    <div v-if="activeTab === 'reports'">
      <!-- Sub-tabs -->
      <div class="flex items-center gap-2 mb-4">
        <button v-for="rt in ([{ key: 'pending', label: 'Pending' }, { key: 'resolved', label: 'Resolved' }, { key: 'dismissed', label: 'Dismissed' }] as const)" :key="rt.key" @click="reportTab = rt.key"
          class="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
          :class="reportTab === rt.key ? 'text-white border-transparent' : isDark ? 'text-slate-400 border-slate-600 hover:text-white' : 'text-gray-500 border-gray-200 hover:text-red-700'"
          :style="reportTab === rt.key ? 'background:linear-gradient(to right,#7f1d1d,#dc2626,#ef4444);' : ''"
        >{{ rt.label }}</button>
      </div>

      <p class="text-xs mb-3" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ reportsTotal }} laporan</p>

      <div v-if="reportsLoading" class="py-10 flex justify-center">
        <div class="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" :class="isDark ? 'border-sky-400' : 'border-blue-800'"></div>
      </div>

      <div v-else class="space-y-3">
        <div v-for="r in reports" :key="r.id" class="rounded-xl p-4"
          :style="isDark
            ? 'background:rgba(15,23,42,0.70);border:1px solid rgba(255,255,255,0.06);'
            : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.50);'"
        >
          <!-- Report header -->
          <div class="flex items-start gap-3 mb-3">
            <!-- Target thumbnail -->
            <div class="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
              <img v-if="getReportProductImage(r)" :src="getReportProductImage(r)" class="w-full h-full object-cover" />
              <img v-else-if="r.reported_user?.avatar_url" :src="r.reported_user.avatar_url" class="w-full h-full object-cover" />
              <span v-else class="text-xl">{{ r.reported_product ? '📦' : '👤' }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-0.5">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="r.reported_product ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'">
                  {{ r.reported_product ? 'PRODUK' : 'USER' }}
                </span>
                <span class="text-[10px]" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ relativeDate(r.created_at) }}</span>
              </div>
              <!-- Target name -->
              <p class="text-sm font-semibold truncate" :class="isDark ? 'text-white' : 'text-gray-800'">
                <template v-if="r.reported_product">{{ r.reported_product.title }}</template>
                <template v-else-if="r.reported_user">{{ r.reported_user.name }} (@{{ r.reported_user.username }})</template>
              </p>
              <p class="text-xs" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
                Dilaporkan oleh: {{ r.reporter?.name ?? '—' }}
              </p>
            </div>
          </div>

          <!-- Reason -->
          <div class="rounded-lg px-3 py-2 mb-3 text-sm" :class="isDark ? 'bg-red-900/20 text-red-300 border border-red-700/30' : 'bg-red-50 text-red-700 border border-red-100'">
            <strong class="text-xs uppercase tracking-wide">Alasan:</strong> {{ r.reason }}
          </div>

          <!-- Admin notes (for resolved/dismissed) -->
          <div v-if="r.admin_notes" class="rounded-lg px-3 py-2 mb-3 text-xs" :class="isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-gray-50 text-gray-600'">
            <strong>Admin notes:</strong> {{ r.admin_notes }}
          </div>

          <!-- Action error -->
          <p v-if="reportActionErr[r.id]" class="text-xs text-red-500 mb-2">{{ reportActionErr[r.id] }}</p>

          <!-- Actions (only for pending) -->
          <div v-if="reportTab === 'pending'" class="flex flex-wrap gap-2">
            <button @click="handleReport(r.id, 'dismiss')" :disabled="reportActionLoading[r.id]"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
              :class="isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            >Dismiss</button>
            <button @click="handleReport(r.id, 'resolve')" :disabled="reportActionLoading[r.id]"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
              :class="isDark ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-green-50 text-green-600 hover:bg-green-100'"
            >Resolve (No Action)</button>
            <button v-if="r.reported_product" @click="handleReport(r.id, 'resolve_takedown_product')" :disabled="reportActionLoading[r.id]"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
              :class="isDark ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'"
            >Take Down Produk</button>
            <button v-if="r.reported_user" @click="handleReport(r.id, 'resolve_ban_user')" :disabled="reportActionLoading[r.id]"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
              :class="isDark ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'"
            >Ban User</button>
          </div>
        </div>

        <div v-if="reports.length === 0" class="text-center py-12">
          <span class="text-4xl block mb-2">📢</span>
          <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">Tidak ada laporan di tab ini.</p>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="reportsTotal > 20" class="flex justify-center gap-2 mt-4">
        <button @click="reportsPage = Math.max(1, reportsPage - 1); loadReports()" :disabled="reportsPage <= 1" class="px-3 py-1 rounded-lg text-xs border disabled:opacity-40" :class="isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600'">Prev</button>
        <span class="text-xs self-center" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ reportsPage }} / {{ Math.ceil(reportsTotal / 20) }}</span>
        <button @click="reportsPage++; loadReports()" :disabled="reportsPage * 20 >= reportsTotal" class="px-3 py-1 rounded-lg text-xs border disabled:opacity-40" :class="isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600'">Next</button>
      </div>
    </div>

    <!-- ═══ DISPUTES TAB ═══ -->
    <div v-if="activeTab === 'disputes'">
      <!-- Status filter -->
      <div class="flex items-center gap-1 p-1 rounded-xl mb-4 w-fit flex-wrap"
        :style="isDark ? 'background:rgba(15,23,42,0.50);border:1px solid rgba(255,255,255,0.06);' : 'background:rgba(248,250,252,1);border:1px solid rgba(226,232,240,0.50);'">
        <button v-for="dt in ([
          { key: 'open', label: 'Terbuka' },
          { key: 'in_review', label: 'Ditinjau' },
          { key: 'resolved_refund', label: 'Refund' },
          { key: 'resolved_partial', label: 'Partial' },
          { key: 'resolved_rejected', label: 'Ditolak' },
        ] as const)" :key="dt.key" @click="disputeTab = dt.key"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="disputeTab === dt.key ? 'bg-red-600 text-white' : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'"
        >{{ dt.label }}</button>
      </div>

      <p class="text-xs mb-3" :class="isDark ? 'text-slate-500' : 'text-gray-400'">{{ disputesTotal }} dispute ditemukan</p>

      <!-- Loading -->
      <div v-if="disputesLoading" class="py-10 flex justify-center">
        <div class="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" :class="isDark ? 'border-sky-400' : 'border-blue-800'"></div>
      </div>

      <!-- Dispute rows -->
      <div v-else class="space-y-3">
        <div v-for="d in adminDisputes" :key="d.id" class="rounded-xl p-4"
          :style="isDark
            ? 'background:rgba(15,23,42,0.70);border:1px solid rgba(255,255,255,0.06);'
            : 'background:rgba(255,255,255,0.80);border:1px solid rgba(226,232,240,0.50);'"
        >
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="text-xs font-semibold" :class="isDark ? 'text-sky-400' : 'text-blue-700'">{{ d.buyer?.name ?? '—' }}</span>
                <span class="text-[10px]" :class="isDark ? 'text-slate-500' : 'text-gray-400'">→</span>
                <span class="text-xs font-semibold" :class="isDark ? 'text-amber-400' : 'text-amber-700'">{{ d.seller?.name ?? '—' }}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  :style="d.status === 'open' ? 'background:rgba(217,119,6,0.12);color:#d97706;' : 'background:rgba(124,58,237,0.12);color:#7c3aed;'">
                  {{ d.status }}
                </span>
              </div>
              <p class="text-sm mb-1" :class="isDark ? 'text-slate-300' : 'text-gray-700'">{{ d.reason }}</p>
              <p class="text-[11px]" :class="isDark ? 'text-slate-500' : 'text-gray-400'">
                Order: {{ formatRp(d.order?.total_amount ?? 0) }} · {{ new Date(d.created_at).toLocaleDateString('id-ID') }}
              </p>
            </div>
            <!-- Action buttons (only for open/in_review) -->
            <div v-if="['open', 'in_review'].includes(d.status)" class="flex flex-col gap-1 shrink-0">
              <button @click="resolveDispute(d.id, 'refund')" :disabled="disputeActionLoading[d.id]"
                class="px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
                :class="isDark ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'"
              >Refund Penuh</button>
              <button @click="resolveDispute(d.id, 'partial')" :disabled="disputeActionLoading[d.id]"
                class="px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
                :class="isDark ? 'bg-sky-900/30 text-sky-400 hover:bg-sky-900/50' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'"
              >Partial</button>
              <button @click="resolveDispute(d.id, 'rejected')" :disabled="disputeActionLoading[d.id]"
                class="px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50"
                :class="isDark ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'"
              >Tolak</button>
            </div>
          </div>
          <!-- Resolution note -->
          <div v-if="d.resolution_note" class="mt-2 p-2 rounded-lg text-xs"
            :style="isDark ? 'background:rgba(255,255,255,0.04);' : 'background:#f8fafc;'">
            <span class="font-semibold" :class="isDark ? 'text-slate-300' : 'text-gray-600'">Resolusi:</span>
            <span class="ml-1" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ d.resolution_note }}</span>
            <span v-if="d.refund_amount > 0" class="ml-2 font-bold text-emerald-600">{{ formatRp(d.refund_amount) }}</span>
          </div>
        </div>

        <div v-if="adminDisputes.length === 0" class="text-center py-12">
          <span class="text-4xl block mb-2">⚠️</span>
          <p class="text-sm" :class="isDark ? 'text-slate-500' : 'text-gray-400'">Tidak ada dispute di tab ini.</p>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="disputesTotal > 20" class="flex justify-center gap-2 mt-4">
        <button @click="disputesPage = Math.max(1, disputesPage - 1); loadDisputes()" :disabled="disputesPage <= 1" class="px-3 py-1 rounded-lg text-xs border disabled:opacity-40" :class="isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600'">Prev</button>
        <span class="text-xs self-center" :class="isDark ? 'text-slate-400' : 'text-gray-500'">{{ disputesPage }} / {{ Math.ceil(disputesTotal / 20) }}</span>
        <button @click="disputesPage++; loadDisputes()" :disabled="disputesPage * 20 >= disputesTotal" class="px-3 py-1 rounded-lg text-xs border disabled:opacity-40" :class="isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600'">Next</button>
      </div>
    </div>

  </div>
</template>
