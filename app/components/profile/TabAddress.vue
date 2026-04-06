<script setup>
const props = defineProps({
  addrLoading: { type: Boolean, default: false },
  addrSaving: { type: Boolean, default: false },
  addrMsg: { type: String, default: '' },
  addrMsgType: { type: String, default: '' },
  addrDeleting: { type: Boolean, default: false },
  gpsLoading: { type: Boolean, default: false },
  addrActiveType: { type: String, default: 'shipping' },
  shippingForm: { type: Object, required: true },
  _shippingId: { type: [String, null], default: null },
  shippingEditMode: { type: Boolean, default: false },
  sellerForm: { type: Object, required: true },
  _sellerId: { type: [String, null], default: null },
  sellerEditMode: { type: Boolean, default: false },
  syncAddress: { type: Boolean, default: false },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  gender: { type: String, default: '' },
})

const emit = defineEmits([
  'update:addrActiveType', 'update:shippingEditMode', 'update:sellerEditMode',
  'save-address', 'delete-address', 'toggle-sync-address',
  'use-gps', 'open-map-link',
])
</script>

<template>
  <div v-if="addrLoading" class="flex justify-center py-16">
    <svg class="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  </div>

  <template v-else>
    <!-- Feedback -->
    <p v-if="addrMsg" class="text-sm font-medium px-4 py-2 rounded-lg mb-2" :class="addrMsgType === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'">
      {{ addrMsg }}
    </p>

    <!-- Sub-tabs: Pengiriman | Pengirim -->
    <div class="flex gap-2 mb-4">
      <button
        @click="emit('update:addrActiveType', 'shipping')"
        class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition border"
        :class="addrActiveType === 'shipping' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-sky-400 border-blue-200 dark:border-blue-700' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'"
      >
        📦 Pengiriman
        <svg v-if="_shippingId" class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
      </button>
      <button
        @click="emit('update:addrActiveType', 'seller')"
        class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition border"
        :class="addrActiveType === 'seller' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-sky-400 border-blue-200 dark:border-blue-700' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'"
      >
        🏠 Pengirim
        <svg v-if="_sellerId" class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
      </button>
    </div>

    <!-- ════ SHIPPING ADDRESS ════════════════════════════ -->
    <template v-if="addrActiveType === 'shipping'">
      <!-- Card view -->
      <template v-if="_shippingId && !shippingEditMode">
        <div class="vt-card p-6 md:p-8 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-base vt-text-primary">📦 Alamat Pengiriman</h2>
            <div class="flex items-center gap-3">
              <button @click="emit('update:shippingEditMode', true)" class="text-xs font-medium text-blue-700 dark:text-sky-400 hover:underline">Edit</button>
              <button @click="emit('delete-address', 'shipping')" :disabled="addrDeleting" class="text-xs font-medium text-red-500 dark:text-red-400 hover:underline disabled:opacity-50">Hapus</button>
            </div>
          </div>
          <button
            @click="emit('update:shippingEditMode', true)"
            class="w-full text-left border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 rounded-r-xl px-4 py-4 flex items-start justify-between gap-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition"
          >
            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <span v-if="shippingForm.label" class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{{ shippingForm.label }}</span>
              <p class="font-bold text-sm text-gray-800 dark:text-slate-100 leading-snug flex items-center gap-1.5">
                {{ name || '—' }}
                <span v-if="gender === 'Laki-laki'" title="Laki-laki">♂️</span>
                <span v-else-if="gender === 'Perempuan'" title="Perempuan">♀️</span>
              </p>
              <p v-if="phone" class="text-sm text-gray-600 dark:text-slate-400">{{ phone }}</p>
              <p class="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                {{ shippingForm.full_address }}<template v-if="shippingForm.notes"> ({{ shippingForm.notes }})</template>
              </p>
              <div v-if="shippingForm.lat && shippingForm.lng" class="flex items-center gap-1 mt-1">
                <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                </svg>
                <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">Sudah Pinpoint</span>
              </div>
            </div>
            <svg class="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
          </button>
        </div>
      </template>
      <!-- Form -->
      <template v-else>
        <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-base vt-text-primary">📦 {{ _shippingId ? 'Edit Alamat Pengiriman' : 'Tambah Alamat Pengiriman' }}</h2>
            <button v-if="_shippingId" @click="emit('update:shippingEditMode', false)" class="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition">← Kembali</button>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Label Alamat</label>
            <input v-model="shippingForm.label" type="text" placeholder="Contoh: Kosan Keputih, Rumah Sidoarjo" class="vt-input" maxlength="50" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Alamat Lengkap <span class="text-red-500">*</span></label>
            <textarea v-model="shippingForm.full_address" rows="3" placeholder="Jl. Raya ITS No. ..., Keputih, Sukolilo, Surabaya" class="vt-input resize-none" maxlength="300"></textarea>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Kota / Kabupaten</label>
            <input v-model="shippingForm.city" type="text" placeholder="Surabaya" class="vt-input" maxlength="80" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Kode Pos</label>
            <input v-model="shippingForm.postal_code" type="text" inputmode="numeric" placeholder="60111" class="vt-input" maxlength="10" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Catatan Pengiriman</label>
            <input v-model="shippingForm.notes" type="text" placeholder="Contoh: Lantai 2, kamar paling kiri" class="vt-input" maxlength="150" />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold vt-label">📍 Pin Lokasi</label>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" @click="emit('use-gps', 'shipping')" :disabled="gpsLoading"
                class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-sm font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60">
                <svg v-if="!gpsLoading" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                </svg>
                <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                {{ gpsLoading ? 'Mengambil lokasi...' : 'Pakai GPS saat ini' }}
              </button>
              <button v-if="shippingForm.lat && shippingForm.lng" type="button" @click="emit('open-map-link', 'shipping')"
                class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                🗺️ Lihat di Maps
              </button>
            </div>
            <div class="flex gap-2">
              <div class="flex flex-col gap-1 flex-1">
                <label class="text-xs vt-text-muted">Latitude</label>
                <input v-model.number="shippingForm.lat" type="number" step="0.0000001" placeholder="-7.2885618..." class="vt-input text-xs font-mono" />
              </div>
              <div class="flex flex-col gap-1 flex-1">
                <label class="text-xs vt-text-muted">Longitude</label>
                <input v-model.number="shippingForm.lng" type="number" step="0.0000001" placeholder="112.7917407..." class="vt-input text-xs font-mono" />
              </div>
            </div>
            <p class="text-xs vt-text-muted opacity-60">Isi otomatis dengan GPS atau masukkan manual. Contoh: Asrama Mahasiswa ITS Blok H → -7.2885618, 112.7917407.</p>
          </div>
          <button
            @click="emit('save-address', 'shipping')"
            :disabled="addrSaving"
            class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
          >
            <svg v-if="addrSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            {{ addrSaving ? 'Menyimpan...' : 'Simpan Alamat' }}
          </button>
        </div>
      </template>
    </template>

    <!-- ════ SELLER ADDRESS ══════════════════════════════ -->
    <template v-if="addrActiveType === 'seller'">
      <!-- Samakan toggle -->
      <div class="vt-card p-4 mb-4 flex items-center gap-3">
        <button
          @click="emit('toggle-sync-address')"
          :disabled="addrSaving"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-50"
          :class="syncAddress ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'"
        >
          <span class="inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform" :class="syncAddress ? 'translate-x-6' : 'translate-x-1'"></span>
        </button>
        <span class="text-sm vt-text-primary font-medium">Samakan dengan Alamat Pengiriman</span>
      </div>

      <!-- Card view -->
      <template v-if="_sellerId && !sellerEditMode">
        <div class="vt-card p-6 md:p-8 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-base vt-text-primary">🏠 Alamat Pengirim</h2>
            <div class="flex items-center gap-3">
              <button @click="emit('update:sellerEditMode', true)" class="text-xs font-medium text-blue-700 dark:text-sky-400 hover:underline">Edit</button>
              <button @click="emit('delete-address', 'seller')" :disabled="addrDeleting" class="text-xs font-medium text-red-500 dark:text-red-400 hover:underline disabled:opacity-50">Hapus</button>
            </div>
          </div>
          <button
            @click="emit('update:sellerEditMode', true)"
            class="w-full text-left border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r-xl px-4 py-4 flex items-start justify-between gap-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
          >
            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <span v-if="sellerForm.label" class="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{{ sellerForm.label }}</span>
              <p class="font-bold text-sm text-gray-800 dark:text-slate-100 leading-snug flex items-center gap-1.5">
                {{ name || '—' }}
                <span v-if="gender === 'Laki-laki'" title="Laki-laki">♂️</span>
                <span v-else-if="gender === 'Perempuan'" title="Perempuan">♀️</span>
              </p>
              <p v-if="phone" class="text-sm text-gray-600 dark:text-slate-400">{{ phone }}</p>
              <p class="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                {{ sellerForm.full_address }}<template v-if="sellerForm.notes"> ({{ sellerForm.notes }})</template>
              </p>
              <div v-if="sellerForm.lat && sellerForm.lng" class="flex items-center gap-1 mt-1">
                <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                </svg>
                <span class="text-xs font-medium text-blue-600 dark:text-blue-400">Sudah Pinpoint</span>
              </div>
              <div v-if="syncAddress" class="flex items-center gap-1 mt-1">
                <span class="text-xs text-gray-400 dark:text-slate-500 italic">Sama dengan Alamat Pengiriman</span>
              </div>
            </div>
            <svg class="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
          </button>
        </div>
      </template>
      <!-- Form -->
      <template v-else-if="!syncAddress">
        <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-base vt-text-primary">🏠 {{ _sellerId ? 'Edit Alamat Pengirim' : 'Tambah Alamat Pengirim' }}</h2>
            <button v-if="_sellerId" @click="emit('update:sellerEditMode', false)" class="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition">← Kembali</button>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Label Alamat</label>
            <input v-model="sellerForm.label" type="text" placeholder="Contoh: Asrama ITS, Kost Gebang" class="vt-input" maxlength="50" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Alamat Lengkap <span class="text-red-500">*</span></label>
            <textarea v-model="sellerForm.full_address" rows="3" placeholder="Jl. Raya ITS No. ..., Keputih, Sukolilo, Surabaya" class="vt-input resize-none" maxlength="300"></textarea>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Kota / Kabupaten</label>
            <input v-model="sellerForm.city" type="text" placeholder="Surabaya" class="vt-input" maxlength="80" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Kode Pos</label>
            <input v-model="sellerForm.postal_code" type="text" inputmode="numeric" placeholder="60111" class="vt-input" maxlength="10" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Catatan</label>
            <input v-model="sellerForm.notes" type="text" placeholder="Contoh: Blok H lantai 3" class="vt-input" maxlength="150" />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold vt-label">📍 Pin Lokasi</label>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" @click="emit('use-gps', 'seller')" :disabled="gpsLoading"
                class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 text-sm font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60">
                <svg v-if="!gpsLoading" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                </svg>
                <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                {{ gpsLoading ? 'Mengambil lokasi...' : 'Pakai GPS saat ini' }}
              </button>
              <button v-if="sellerForm.lat && sellerForm.lng" type="button" @click="emit('open-map-link', 'seller')"
                class="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                🗺️ Lihat di Maps
              </button>
            </div>
            <div class="flex gap-2">
              <div class="flex flex-col gap-1 flex-1">
                <label class="text-xs vt-text-muted">Latitude</label>
                <input v-model.number="sellerForm.lat" type="number" step="0.0000001" placeholder="-7.2885618..." class="vt-input text-xs font-mono" />
              </div>
              <div class="flex flex-col gap-1 flex-1">
                <label class="text-xs vt-text-muted">Longitude</label>
                <input v-model.number="sellerForm.lng" type="number" step="0.0000001" placeholder="112.7917407..." class="vt-input text-xs font-mono" />
              </div>
            </div>
            <p class="text-xs vt-text-muted opacity-60">Isi otomatis dengan GPS atau masukkan manual. Contoh: Asrama Mahasiswa ITS Blok H → -7.2885618, 112.7917407.</p>
          </div>
          <button
            @click="emit('save-address', 'seller')"
            :disabled="addrSaving"
            class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
          >
            <svg v-if="addrSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            {{ addrSaving ? 'Menyimpan...' : 'Simpan Alamat' }}
          </button>
        </div>
      </template>
    </template>
  </template>
</template>

<style scoped>
.vt-card { background: #ffffff; border: 1px solid rgba(0,0,0,0.07); border-radius: 1rem; }
.dark .vt-card { background: #0d1829; border-color: rgba(255,255,255,0.07); }
.vt-text-primary { color: #0f172a; }
.dark .vt-text-primary { color: #f1f5f9; }
.vt-text-muted { color: #6b7280; }
.dark .vt-text-muted { color: #94a3b8; }
.vt-label { color: #374151; }
.dark .vt-label { color: #cbd5e1; }
.vt-input { width: 100%; padding: 0.6rem 0.875rem; border: 1px solid rgba(0,0,0,0.15); border-radius: 0.6rem; font-size: 0.875rem; background: #fff; color: #0f172a; transition: border-color 0.15s; outline: none; }
.vt-input:focus { border-color: #1e3a8a; box-shadow: 0 0 0 3px rgba(30,58,138,0.10); }
.dark .vt-input { background: #0f172a; border-color: rgba(255,255,255,0.12); color: #f1f5f9; }
.dark .vt-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.12); }
.vt-btn-primary { background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); }
.dark .vt-btn-primary { background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8); }
</style>
