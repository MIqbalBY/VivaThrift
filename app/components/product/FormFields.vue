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
