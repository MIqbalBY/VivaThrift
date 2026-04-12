<script setup>
// MapPicker.vue — Leaflet map dengan draggable pin
// Props: lat, lng (nullable — default ke ITS Sukolilo)
// Emits: update:lat, update:lng

const props = defineProps({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
})

const emit = defineEmits(['update:lat', 'update:lng'])

// ITS Sukolilo sebagai default
const DEFAULT_LAT = -7.2813
const DEFAULT_LNG = 112.7971

const mapEl = ref(null)

// Simpan instance Leaflet agar bisa diakses dari watch (GPS update)
let mapInstance = null
let markerInstance = null

onMounted(async () => {
  if (!mapEl.value) return

  // Dynamic import — hindari SSR error dan hanya load CSS saat komponen dipakai
  await import('leaflet/dist/leaflet.css')
  const leafletModule = await import('leaflet')
  const L = leafletModule.default ?? leafletModule

  // Custom SVG pin icon — tidak butuh asset eksternal
  const pinIcon = L.divIcon({
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#1e3a8a" stroke="#fff" stroke-width="2"/>
      <circle cx="14" cy="14" r="6" fill="#fff"/>
    </svg>`,
  })

  const initLat = props.lat ?? DEFAULT_LAT
  const initLng = props.lng ?? DEFAULT_LNG

  mapInstance = L.map(mapEl.value, { zoomControl: true }).setView([initLat, initLng], 16)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapInstance)

  markerInstance = L.marker([initLat, initLng], {
    draggable: true,
    icon: pinIcon,
  }).addTo(mapInstance)

  // Drag pin → emit baru
  markerInstance.on('dragend', () => {
    const pos = markerInstance.getLatLng()
    emit('update:lat', parseFloat(pos.lat.toFixed(7)))
    emit('update:lng', parseFloat(pos.lng.toFixed(7)))
  })

  // Klik peta → pindahkan pin
  mapInstance.on('click', (e) => {
    markerInstance.setLatLng(e.latlng)
    emit('update:lat', parseFloat(e.latlng.lat.toFixed(7)))
    emit('update:lng', parseFloat(e.latlng.lng.toFixed(7)))
  })
})

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
    markerInstance = null
  }
})

// Watch: ketika GPS atau input eksternal mengubah lat/lng → pan peta ke sana
watch(
  () => [props.lat, props.lng],
  ([newLat, newLng]) => {
    if (!mapInstance || !markerInstance) return
    if (newLat == null || newLng == null) return
    const curr = markerInstance.getLatLng()
    // Hanya pan jika perubahan signifikan (> 0.00001 derajat ≈ 1 meter)
    if (Math.abs(curr.lat - newLat) > 0.00001 || Math.abs(curr.lng - newLng) > 0.00001) {
      markerInstance.setLatLng([newLat, newLng])
      mapInstance.setView([newLat, newLng], mapInstance.getZoom())
    }
  },
)
</script>

<template>
  <div>
    <!-- Peta -->
    <div
      ref="mapEl"
      class="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-slate-600"
      style="height: 260px;"
    />
    <!-- Koordinat display -->
    <div v-if="lat && lng" class="flex items-center gap-1.5 mt-1.5">
      <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
      </svg>
      <span class="text-xs font-mono text-emerald-700 dark:text-emerald-400">{{ lat }}, {{ lng }}</span>
      <span class="text-xs text-gray-400 dark:text-slate-500">· Sudah pinpoint ✓</span>
    </div>
    <p v-else class="text-xs text-gray-400 dark:text-slate-500 mt-1.5">Klik atau geser pin untuk menentukan lokasi.</p>
  </div>
</template>
