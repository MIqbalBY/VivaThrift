<script setup>
const props = defineProps({
  form: { type: Object, required: true },
  categories: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  descriptionRows: { type: [Number, String], default: 7 },
})

// ── Formatting toolbar ────────────────────────────────────────────────────────
const descTextarea = ref(null)

function applyFormat(marker) {
  const el = descTextarea.value
  if (!el) return
  const start = el.selectionStart
  const end   = el.selectionEnd
  const selected = props.form.description.slice(start, end)
  const wrapped  = `${marker}${selected || 'teks'}${marker}`
  props.form.description = props.form.description.slice(0, start) + wrapped + props.form.description.slice(end)
  nextTick(() => {
    const cursor = start + marker.length + (selected || 'teks').length + marker.length
    el.setSelectionRange(cursor, cursor)
    el.focus()
  })
}
</script>

<template>
  <!-- Judul -->
  <div>
    <label class="block text-sm font-semibold text-gray-700 mb-1">Judul Barang <span class="text-red-500">*</span></label>
    <input
      v-model="form.title"
      type="text"
      placeholder="Contoh: Buku Kalkulus 1 edisi 2024"
      class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
      :disabled="disabled"
    />
  </div>

  <!-- Harga -->
  <div>
    <label class="block text-sm font-semibold text-gray-700 mb-1">Harga (Rp) <span class="text-red-500">*</span></label>
    <input
      v-model="form.price"
      type="number"
      min="0"
      placeholder="Contoh: 75000"
      class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
      :disabled="disabled"
    />
    <div class="flex flex-col gap-1.5 mt-2">
      <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" v-model="form.is_negotiable" class="accent-blue-900" />
        🤝 Harga bisa nego
      </label>
      <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" v-model="form.is_cod" class="accent-blue-900" />
        🚲 Tersedia COD
      </label>
    </div>
  </div>

  <!-- Stok -->
  <div>
    <label class="block text-sm font-semibold text-gray-700 mb-1">📦 Stok <span class="text-red-500">*</span></label>
    <input
      v-model.number="form.stock"
      type="number"
      min="0"
      placeholder="Jumlah unit tersedia"
      class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
      :disabled="disabled"
    />
    <slot name="stock-help" />
  </div>

  <!-- Kondisi -->
  <div>
    <label class="block text-sm font-semibold text-gray-700 mb-1">🔍 Kondisi <span class="text-red-500">*</span></label>
    <select
      v-model="form.condition"
      class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
      :disabled="disabled"
    >
      <option value="" disabled>Pilih kondisi barang</option>
      <option v-for="c in CONDITIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
    </select>
  </div>

  <!-- Kategori -->
  <div>
    <label class="block text-sm font-semibold text-gray-700 mb-1">🏷️ Kategori <span class="text-red-500">*</span></label>
    <select
      v-model="form.category_id"
      class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
      :disabled="disabled"
    >
      <option value="">Pilih kategori</option>
      <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ categoryLabel(cat.name) }}</option>
    </select>
  </div>

  <!-- Berat & Volume -->
  <div>
    <label class="block text-sm font-semibold text-gray-700 mb-1">⚖️ Berat & Ukuran Kemasan</label>
    <p class="text-xs text-gray-400 mb-2">Digunakan untuk kalkulasi ongkir. Kurir memakai angka terbesar antara berat asli vs berat volumetrik (P×L×T÷6000).</p>
    <!-- Berat -->
    <div class="flex items-center gap-2 mb-3">
      <div class="flex-1">
        <label class="block text-xs text-gray-500 mb-1">Berat (gram) <span class="text-red-500">*</span></label>
        <input
          v-model.number="form.weight"
          type="number"
          min="1"
          max="30000"
          placeholder="500"
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          :disabled="disabled"
        />
      </div>
      <div class="pt-5 text-xs text-gray-400 shrink-0">gram</div>
    </div>
    <!-- Dimensi opsional -->
    <p class="text-xs text-gray-500 mb-2 font-medium">Dimensi Kemasan <span class="font-normal text-gray-400">(opsional — untuk barat volumetrik)</span></p>
    <div class="grid grid-cols-3 gap-2">
      <div>
        <label class="block text-xs text-gray-500 mb-1">Panjang (cm)</label>
        <input
          v-model.number="form.length"
          type="number"
          min="1"
          max="300"
          placeholder="30"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          :disabled="disabled"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">Lebar (cm)</label>
        <input
          v-model.number="form.width"
          type="number"
          min="1"
          max="300"
          placeholder="20"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          :disabled="disabled"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">Tinggi (cm)</label>
        <input
          v-model.number="form.height"
          type="number"
          min="1"
          max="300"
          placeholder="5"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent"
          :disabled="disabled"
        />
      </div>
    </div>
    <!-- Preview berat volumetrik -->
    <div v-if="form.length && form.width && form.height" class="mt-2 flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
      <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span>
        Berat volumetrik: <strong>{{ Math.round((form.length * form.width * form.height) / 6000) }}g</strong>
        — kurir akan tagih berdasarkan
        <strong>{{ Math.max(form.weight || 0, Math.round((form.length * form.width * form.height) / 6000)) }}g</strong>
      </span>
    </div>
  </div>

  <!-- Deskripsi -->
  <div>
    <label class="block text-sm font-semibold text-gray-700 mb-1">Deskripsi <span class="text-red-500">*</span></label>
    <div class="flex items-center gap-1 mb-1">
      <button type="button" @click="applyFormat('**')" title="Bold" class="px-2 py-1 rounded-sm border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"><b>B</b></button>
      <button type="button" @click="applyFormat('*')" title="Italic" class="px-2 py-1 rounded-sm border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 transition"><i>I</i></button>
      <span class="text-[10px] text-gray-400 ml-1">**bold** &nbsp;*italic* &nbsp;·&nbsp; awali baris dengan <code class="bg-gray-100 px-1 rounded-sm">-</code> untuk bullet</span>
    </div>
    <textarea
      ref="descTextarea"
      v-model="form.description"
      :rows="descriptionRows"
      placeholder="Jelaskan kondisi, kelengkapan, alasan jual, dsb."
      class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:border-transparent resize-none"
      :disabled="disabled"
    ></textarea>
  </div>
</template>
