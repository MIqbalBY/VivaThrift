<script setup>
const BANK_LIST = [
  { code: 'BCA',       name: 'Bank Central Asia (BCA)' },
  { code: 'BNI',       name: 'Bank Negara Indonesia (BNI)' },
  { code: 'BRI',       name: 'Bank Rakyat Indonesia (BRI)' },
  { code: 'MANDIRI',   name: 'Bank Mandiri' },
  { code: 'CIMB',      name: 'CIMB Niaga' },
  { code: 'PERMATA',   name: 'Bank Permata' },
  { code: 'DANAMON',   name: 'Bank Danamon' },
  { code: 'OCBC',      name: 'OCBC NISP' },
  { code: 'BSI',       name: 'Bank Syariah Indonesia (BSI)' },
  { code: 'JAGO',      name: 'Bank Jago' },
  { code: 'SEABANK',   name: 'SeaBank' },
  { code: 'GOPAY',     name: 'GoPay' },
  { code: 'OVO',       name: 'OVO' },
  { code: 'DANA',      name: 'DANA' },
  { code: 'SHOPEEPAY', name: 'ShopeePay' },
  { code: 'LINKAJA',   name: 'LinkAja' },
]

const props = defineProps({
  bankCode:          { type: String, default: '' },
  bankAccountNumber: { type: String, default: '' },
  bankAccountName:   { type: String, default: '' },
  rekeningLoading:   { type: Boolean, default: false },
  rekeningMsg:       { type: String, default: '' },
  rekeningMsgType:   { type: String, default: '' },
  walletLoading:     { type: Boolean, default: false },
  walletSubmitting:  { type: Boolean, default: false },
  walletMsg:         { type: String, default: '' },
  walletMsgType:     { type: String, default: '' },
  withdrawAmount:    { type: [Number, String], default: '' },
  walletSummary:     { type: Object, default: () => ({ available_balance: 0, total_credited: 0, total_withdrawn: 0, updated_at: null }) },
  walletTransactions:{ type: Array, default: () => [] },
})

const emit = defineEmits([
  'update:bankCode',
  'update:bankAccountNumber',
  'update:bankAccountName',
  'update:withdrawAmount',
  'save-rekening',
  'submit-withdraw',
  'refresh-wallet',
])

const localBankCode = computed({
  get: () => props.bankCode,
  set: (v) => emit('update:bankCode', v),
})
const localBankAccountNumber = computed({
  get: () => props.bankAccountNumber,
  set: (v) => emit('update:bankAccountNumber', v),
})
const localBankAccountName = computed({
  get: () => props.bankAccountName,
  set: (v) => emit('update:bankAccountName', v),
})

const localWithdrawAmount = computed({
  get: () => props.withdrawAmount,
  set: (v) => emit('update:withdrawAmount', v),
})

function formatRupiah(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function txLabel(txType) {
  if (txType === 'credit') return 'Kredit'
  if (txType === 'withdraw') return 'Withdraw'
  if (txType === 'debit') return 'Debit'
  return txType || '-'
}
</script>

<template>
  <!-- Wallet summary -->
  <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h2 class="font-bold text-base vt-text-primary">💼 Saldo Penjual</h2>
      <button
        @click="emit('refresh-wallet')"
        :disabled="walletLoading"
        class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60"
      >
        {{ walletLoading ? 'Memuat...' : 'Refresh' }}
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="rounded-xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 p-4">
        <p class="text-xs text-emerald-700 dark:text-emerald-300">Saldo Tersedia</p>
        <p class="text-lg font-bold text-emerald-800 dark:text-emerald-200">{{ formatRupiah(walletSummary.available_balance) }}</p>
      </div>
      <div class="rounded-xl border border-blue-200 dark:border-blue-700/40 bg-blue-50 dark:bg-blue-900/20 p-4">
        <p class="text-xs text-blue-700 dark:text-blue-300">Total Kredit</p>
        <p class="text-lg font-bold text-blue-800 dark:text-blue-200">{{ formatRupiah(walletSummary.total_credited) }}</p>
      </div>
      <div class="rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 p-4">
        <p class="text-xs text-amber-700 dark:text-amber-300">Total Withdraw</p>
        <p class="text-lg font-bold text-amber-800 dark:text-amber-200">{{ formatRupiah(walletSummary.total_withdrawn) }}</p>
      </div>
    </div>

    <p class="text-xs text-gray-500 dark:text-slate-400">Update terakhir: {{ formatDate(walletSummary.updated_at) }}</p>

    <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold vt-label">Nominal Withdraw (Rp)</label>
        <input
          v-model="localWithdrawAmount"
          type="text"
          inputmode="numeric"
          placeholder="Contoh: 150000"
          class="vt-input"
          maxlength="12"
        />
      </div>
      <button
        @click="emit('submit-withdraw')"
        :disabled="walletSubmitting || walletLoading"
        class="vt-btn-primary px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-60"
      >
        <svg v-if="walletSubmitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        {{ walletSubmitting ? 'Memproses...' : 'Tarik Dana' }}
      </button>
    </div>

    <p
      v-if="walletMsg"
      class="text-sm font-medium px-4 py-2 rounded-lg"
      :class="walletMsgType === 'ok'
        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
        : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'"
    >
      {{ walletMsg }}
    </p>

    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold vt-text-primary">Riwayat Wallet Terbaru</h3>
      <div v-if="walletTransactions.length" class="max-h-64 overflow-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table class="w-full text-xs">
          <thead class="bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300">
            <tr>
              <th class="text-left px-3 py-2">Waktu</th>
              <th class="text-left px-3 py-2">Tipe</th>
              <th class="text-right px-3 py-2">Nominal</th>
              <th class="text-right px-3 py-2">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tx in walletTransactions" :key="tx.id" class="border-t border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-200">
              <td class="px-3 py-2 whitespace-nowrap">{{ formatDate(tx.created_at) }}</td>
              <td class="px-3 py-2">{{ txLabel(tx.tx_type) }}</td>
              <td class="px-3 py-2 text-right font-semibold">{{ formatRupiah(tx.amount) }}</td>
              <td class="px-3 py-2 text-right">{{ formatRupiah(tx.balance_after) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-xs text-gray-500 dark:text-slate-400">Belum ada transaksi wallet.</p>
    </div>
  </div>

  <!-- Info card -->
  <div class="vt-card p-5 flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50">
    <svg class="w-5 h-5 text-blue-600 dark:text-sky-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
    </svg>
    <p class="text-sm text-blue-700 dark:text-sky-300 leading-relaxed">
      Rekening bank ini digunakan untuk menerima pencairan dana (withdraw) dari hasil penjualan Anda di VivaThrift. Pastikan data sudah benar sebelum menyimpan.
    </p>
  </div>

  <!-- Form card -->
  <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
    <h2 class="font-bold text-base vt-text-primary">🏦 Informasi Rekening Bank</h2>

    <!-- Bank -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-semibold vt-label">Bank / E-Wallet</label>
      <select v-model="localBankCode" class="vt-input">
        <option value="">— Pilih bank atau e-wallet —</option>
        <option v-for="bank in BANK_LIST" :key="bank.code" :value="bank.code">
          {{ bank.name }}
        </option>
      </select>
    </div>

    <!-- Account Number -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-semibold vt-label">Nomor Rekening / Nomor HP</label>
      <input
        v-model="localBankAccountNumber"
        type="text"
        inputmode="numeric"
        placeholder="Contoh: 1234567890"
        class="vt-input"
        maxlength="30"
      />
    </div>

    <!-- Account Name -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-semibold vt-label">Nama Pemilik Rekening</label>
      <input
        v-model="localBankAccountName"
        type="text"
        placeholder="Sesuai nama di buku rekening"
        class="vt-input"
        maxlength="100"
      />
      <p class="text-xs text-gray-400 dark:text-slate-500">Pastikan nama sesuai dengan yang terdaftar di bank.</p>
    </div>

    <!-- Feedback -->
    <p
      v-if="rekeningMsg"
      class="text-sm font-medium px-4 py-2 rounded-lg"
      :class="rekeningMsgType === 'ok'
        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
        : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'"
    >
      {{ rekeningMsg }}
    </p>

    <button
      @click="emit('save-rekening')"
      :disabled="rekeningLoading"
      class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
    >
      <svg v-if="rekeningLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      {{ rekeningLoading ? 'Menyimpan...' : 'Simpan Rekening' }}
    </button>
  </div>
</template>

<style scoped>
.vt-card { background: #ffffff; border: 1px solid rgba(0,0,0,0.07); border-radius: 1rem; }
.dark .vt-card { background: #0d1829; border-color: rgba(255,255,255,0.07); }
.vt-text-primary { color: #0f172a; }
.dark .vt-text-primary { color: #f1f5f9; }
.vt-label { color: #374151; }
.dark .vt-label { color: #cbd5e1; }
.vt-input { width: 100%; padding: 0.6rem 0.875rem; border: 1px solid rgba(0,0,0,0.15); border-radius: 0.6rem; font-size: 0.875rem; background: #fff; color: #0f172a; transition: border-color 0.15s; outline: none; }
.vt-input:focus { border-color: #1e3a8a; box-shadow: 0 0 0 3px rgba(30,58,138,0.10); }
.dark .vt-input { background: #0f172a; border-color: rgba(255,255,255,0.12); color: #f1f5f9; }
.dark .vt-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.12); }
.vt-btn-primary { background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); }
.dark .vt-btn-primary { background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8); }
</style>
