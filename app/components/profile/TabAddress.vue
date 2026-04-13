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

const regionsApiBase = 'https://www.emsifa.com/api-wilayah-indonesia/api'

const provinces = ref<any[]>([])
const shippingRegion = reactive({ regencies: [] as any[], districts: [] as any[], villages: [] as any[] })
const sellerRegion = reactive({ regencies: [] as any[], districts: [] as any[], villages: [] as any[] })
const regionsLoading = reactive({
  provinces: false,
  shippingRegencies: false,
  shippingDistricts: false,
  shippingVillages: false,
  sellerRegencies: false,
  sellerDistricts: false,
  sellerVillages: false,
})

function formByType(type: 'shipping' | 'seller') {
  return type === 'seller' ? props.sellerForm as any : props.shippingForm as any
}

function regionStateByType(type: 'shipping' | 'seller') {
  return type === 'seller' ? sellerRegion : shippingRegion
}

function resetRegionChildren(type: 'shipping' | 'seller', level: 'province' | 'city' | 'district') {
  const form = formByType(type)
  const state = regionStateByType(type)

  if (level === 'province') {
    form.city = ''
    form.city_id = ''
    form.district = ''
    form.district_id = ''
    form.village = ''
    form.village_id = ''
    state.regencies = []
    state.districts = []
    state.villages = []
    return
  }

  if (level === 'city') {
    form.district = ''
    form.district_id = ''
    form.village = ''
    form.village_id = ''
    state.districts = []
    state.villages = []
    return
  }

  form.village = ''
  form.village_id = ''
  state.villages = []
}

async function loadProvinces() {
  if (provinces.value.length || regionsLoading.provinces) return
  regionsLoading.provinces = true
  try {
    const data = await $fetch<any[]>(`${regionsApiBase}/provinces.json`)
    provinces.value = Array.isArray(data) ? data : []
  } catch {
    provinces.value = []
  } finally {
    regionsLoading.provinces = false
  }
}

async function loadRegencies(type: 'shipping' | 'seller', provinceId?: string) {
  const form = formByType(type)
  const state = regionStateByType(type)
  const id = String(provinceId ?? form.province_id ?? '').trim()

  if (!id) {
    resetRegionChildren(type, 'province')
    return
  }

  const loadingKey = type === 'seller' ? 'sellerRegencies' : 'shippingRegencies'
  regionsLoading[loadingKey] = true
  try {
    const data = await $fetch<any[]>(`${regionsApiBase}/regencies/${id}.json`)
    state.regencies = Array.isArray(data) ? data : []
  } catch {
    state.regencies = []
  } finally {
    regionsLoading[loadingKey] = false
  }
}

async function loadDistricts(type: 'shipping' | 'seller', cityId?: string) {
  const form = formByType(type)
  const state = regionStateByType(type)
  const id = String(cityId ?? form.city_id ?? '').trim()

  if (!id) {
    resetRegionChildren(type, 'city')
    return
  }

  const loadingKey = type === 'seller' ? 'sellerDistricts' : 'shippingDistricts'
  regionsLoading[loadingKey] = true
  try {
    const data = await $fetch<any[]>(`${regionsApiBase}/districts/${id}.json`)
    state.districts = Array.isArray(data) ? data : []
  } catch {
    state.districts = []
  } finally {
    regionsLoading[loadingKey] = false
  }
}

async function loadVillages(type: 'shipping' | 'seller', districtId?: string) {
  const form = formByType(type)
  const state = regionStateByType(type)
  const id = String(districtId ?? form.district_id ?? '').trim()

  if (!id) {
    resetRegionChildren(type, 'district')
    return
  }

  const loadingKey = type === 'seller' ? 'sellerVillages' : 'shippingVillages'
  regionsLoading[loadingKey] = true
  try {
    const data = await $fetch<any[]>(`${regionsApiBase}/villages/${id}.json`)
    state.villages = Array.isArray(data) ? data : []
  } catch {
    state.villages = []
  } finally {
    regionsLoading[loadingKey] = false
  }
}

function onProvinceChange(type: 'shipping' | 'seller') {
  const form = formByType(type)
  const selected = provinces.value.find((item: any) => item.id === form.province_id)
  form.province = selected?.name ?? ''
  resetRegionChildren(type, 'province')
  loadRegencies(type)
}

function onCityChange(type: 'shipping' | 'seller') {
  const form = formByType(type)
  const state = regionStateByType(type)
  const selected = state.regencies.find((item: any) => item.id === form.city_id)
  form.city = selected?.name ?? ''
  resetRegionChildren(type, 'city')
  loadDistricts(type)
}

function onDistrictChange(type: 'shipping' | 'seller') {
  const form = formByType(type)
  const state = regionStateByType(type)
  const selected = state.districts.find((item: any) => item.id === form.district_id)
  form.district = selected?.name ?? ''
  resetRegionChildren(type, 'district')
  loadVillages(type)
}

function onVillageChange(type: 'shipping' | 'seller') {
  const form = formByType(type)
  const state = regionStateByType(type)
  const selected = state.villages.find((item: any) => item.id === form.village_id)
  form.village = selected?.name ?? ''
}

onMounted(() => {
  loadProvinces()
})

watch(
  () => props.syncAddress,
  (next) => {
    if (!next) return
    sellerRegion.regencies = [...shippingRegion.regencies]
    sellerRegion.districts = [...shippingRegion.districts]
    sellerRegion.villages = [...shippingRegion.villages]
  }
)
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
              <div v-if="shippingForm.village || shippingForm.district || shippingForm.city || shippingForm.province || shippingForm.rt || shippingForm.rw" class="flex flex-wrap items-center gap-1.5 mt-1">
                <span v-if="shippingForm.village" class="vt-tag">Kel. {{ shippingForm.village }}</span>
                <span v-if="shippingForm.district" class="vt-tag">Kec. {{ shippingForm.district }}</span>
                <span v-if="shippingForm.city" class="vt-tag">{{ shippingForm.city }}</span>
                <span v-if="shippingForm.province" class="vt-tag">{{ shippingForm.province }}</span>
                <span v-if="shippingForm.rt || shippingForm.rw" class="vt-tag">RT {{ shippingForm.rt || '-' }} / RW {{ shippingForm.rw || '-' }}</span>
              </div>
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
            <label class="text-xs font-semibold vt-label">Alamat Jalan / Detail Gedung <span class="text-red-500">*</span></label>
            <textarea v-model="shippingForm.road_address" rows="3" placeholder="Asrama ITS Blok H-318, Jalan Teknik Elektro" class="vt-input resize-none" maxlength="300"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Provinsi <span class="text-red-500">*</span></label>
              <select v-model="shippingForm.province_id" class="vt-input" :disabled="regionsLoading.provinces" @change="onProvinceChange('shipping')">
                <option value="">Pilih provinsi</option>
                <option v-for="province in provinces" :key="`ship-prov-${province.id}`" :value="province.id">{{ province.name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Kota / Kabupaten <span class="text-red-500">*</span></label>
              <select v-model="shippingForm.city_id" class="vt-input" :disabled="!shippingForm.province_id || regionsLoading.shippingRegencies" @change="onCityChange('shipping')">
                <option value="">Pilih kota/kabupaten</option>
                <option v-for="city in shippingRegion.regencies" :key="`ship-city-${city.id}`" :value="city.id">{{ city.name }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Kecamatan <span class="text-red-500">*</span></label>
              <select v-model="shippingForm.district_id" class="vt-input" :disabled="!shippingForm.city_id || regionsLoading.shippingDistricts" @change="onDistrictChange('shipping')">
                <option value="">Pilih kecamatan</option>
                <option v-for="district in shippingRegion.districts" :key="`ship-district-${district.id}`" :value="district.id">{{ district.name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Kelurahan <span class="text-red-500">*</span></label>
              <select v-model="shippingForm.village_id" class="vt-input" :disabled="!shippingForm.district_id || regionsLoading.shippingVillages" @change="onVillageChange('shipping')">
                <option value="">Pilih kelurahan</option>
                <option v-for="village in shippingRegion.villages" :key="`ship-village-${village.id}`" :value="village.id">{{ village.name }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">RT <span class="text-red-500">*</span></label>
              <input v-model="shippingForm.rt" type="text" inputmode="numeric" placeholder="001" class="vt-input" maxlength="3" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">RW <span class="text-red-500">*</span></label>
              <input v-model="shippingForm.rw" type="text" inputmode="numeric" placeholder="005" class="vt-input" maxlength="3" />
            </div>
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Kode Pos <span class="text-red-500">*</span></label>
              <input v-model="shippingForm.postal_code" type="text" inputmode="numeric" placeholder="60111" class="vt-input" maxlength="10" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Catatan untuk Kurir</label>
            <input v-model="shippingForm.notes" type="text" placeholder="Contoh: Titip satpam lobby, hubungi sebelum sampai" class="vt-input" maxlength="150" />
          </div>
          <!-- Pin Lokasi -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold vt-label">📍 Pin Lokasi</label>
              <button type="button" @click="emit('use-gps', 'shipping')" :disabled="gpsLoading"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60">
                <svg v-if="!gpsLoading" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                </svg>
                <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                {{ gpsLoading ? 'Mengambil...' : 'Pakai GPS' }}
              </button>
            </div>
            <ClientOnly>
              <MapPicker
                :lat="shippingForm.lat"
                :lng="shippingForm.lng"
                @update:lat="shippingForm.lat = $event"
                @update:lng="shippingForm.lng = $event"
              />
            </ClientOnly>
            <p class="text-xs vt-text-muted opacity-60">Klik di peta atau geser pin biru untuk menentukan lokasi persis. Atau gunakan tombol GPS.</p>
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
              <div v-if="sellerForm.village || sellerForm.district || sellerForm.city || sellerForm.province || sellerForm.rt || sellerForm.rw" class="flex flex-wrap items-center gap-1.5 mt-1">
                <span v-if="sellerForm.village" class="vt-tag">Kel. {{ sellerForm.village }}</span>
                <span v-if="sellerForm.district" class="vt-tag">Kec. {{ sellerForm.district }}</span>
                <span v-if="sellerForm.city" class="vt-tag">{{ sellerForm.city }}</span>
                <span v-if="sellerForm.province" class="vt-tag">{{ sellerForm.province }}</span>
                <span v-if="sellerForm.rt || sellerForm.rw" class="vt-tag">RT {{ sellerForm.rt || '-' }} / RW {{ sellerForm.rw || '-' }}</span>
              </div>
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
            <label class="text-xs font-semibold vt-label">Alamat Jalan / Detail Gedung <span class="text-red-500">*</span></label>
            <textarea v-model="sellerForm.road_address" rows="3" placeholder="Asrama ITS Blok H-318, Jalan Teknik Elektro" class="vt-input resize-none" maxlength="300"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Provinsi <span class="text-red-500">*</span></label>
              <select v-model="sellerForm.province_id" class="vt-input" :disabled="regionsLoading.provinces" @change="onProvinceChange('seller')">
                <option value="">Pilih provinsi</option>
                <option v-for="province in provinces" :key="`sell-prov-${province.id}`" :value="province.id">{{ province.name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Kota / Kabupaten <span class="text-red-500">*</span></label>
              <select v-model="sellerForm.city_id" class="vt-input" :disabled="!sellerForm.province_id || regionsLoading.sellerRegencies" @change="onCityChange('seller')">
                <option value="">Pilih kota/kabupaten</option>
                <option v-for="city in sellerRegion.regencies" :key="`sell-city-${city.id}`" :value="city.id">{{ city.name }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Kecamatan <span class="text-red-500">*</span></label>
              <select v-model="sellerForm.district_id" class="vt-input" :disabled="!sellerForm.city_id || regionsLoading.sellerDistricts" @change="onDistrictChange('seller')">
                <option value="">Pilih kecamatan</option>
                <option v-for="district in sellerRegion.districts" :key="`sell-district-${district.id}`" :value="district.id">{{ district.name }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Kelurahan <span class="text-red-500">*</span></label>
              <select v-model="sellerForm.village_id" class="vt-input" :disabled="!sellerForm.district_id || regionsLoading.sellerVillages" @change="onVillageChange('seller')">
                <option value="">Pilih kelurahan</option>
                <option v-for="village in sellerRegion.villages" :key="`sell-village-${village.id}`" :value="village.id">{{ village.name }}</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">RT <span class="text-red-500">*</span></label>
              <input v-model="sellerForm.rt" type="text" inputmode="numeric" placeholder="001" class="vt-input" maxlength="3" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">RW <span class="text-red-500">*</span></label>
              <input v-model="sellerForm.rw" type="text" inputmode="numeric" placeholder="005" class="vt-input" maxlength="3" />
            </div>
            <div class="col-span-2 flex flex-col gap-1.5">
              <label class="text-xs font-semibold vt-label">Kode Pos <span class="text-red-500">*</span></label>
              <input v-model="sellerForm.postal_code" type="text" inputmode="numeric" placeholder="60111" class="vt-input" maxlength="10" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold vt-label">Catatan untuk Kurir</label>
            <input v-model="sellerForm.notes" type="text" placeholder="Contoh: Titip satpam lobby, hubungi sebelum sampai" class="vt-input" maxlength="150" />
          </div>
          <!-- Pin Lokasi -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold vt-label">📍 Pin Lokasi</label>
              <button type="button" @click="emit('use-gps', 'seller')" :disabled="gpsLoading"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 text-xs font-medium text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-60">
                <svg v-if="!gpsLoading" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                </svg>
                <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                {{ gpsLoading ? 'Mengambil...' : 'Pakai GPS' }}
              </button>
            </div>
            <ClientOnly>
              <MapPicker
                :lat="sellerForm.lat"
                :lng="sellerForm.lng"
                @update:lat="sellerForm.lat = $event"
                @update:lng="sellerForm.lng = $event"
              />
            </ClientOnly>
            <p class="text-xs vt-text-muted opacity-60">Klik di peta atau geser pin biru untuk menentukan lokasi persis. Atau gunakan tombol GPS.</p>
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
.vt-tag { font-size: 0.7rem; line-height: 1; padding: 0.28rem 0.5rem; border-radius: 9999px; color: #155e75; background: #cffafe; border: 1px solid #67e8f9; }
.dark .vt-tag { color: #a5f3fc; background: rgba(8, 47, 73, 0.5); border-color: rgba(34, 211, 238, 0.35); }
.vt-input { width: 100%; padding: 0.6rem 0.875rem; border: 1px solid rgba(0,0,0,0.15); border-radius: 0.6rem; font-size: 0.875rem; background: #fff; color: #0f172a; transition: border-color 0.15s; outline: none; }
.vt-input:focus { border-color: #1e3a8a; box-shadow: 0 0 0 3px rgba(30,58,138,0.10); }
.dark .vt-input { background: #0f172a; border-color: rgba(255,255,255,0.12); color: #f1f5f9; }
.dark .vt-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.12); }
.vt-btn-primary { background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); }
.dark .vt-btn-primary { background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8); }
</style>
