<script setup>
const props = defineProps({
  show:    { type: Boolean, default: false },
  product: { type: Object,  required: true },
  isDark:  { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'saved'])

const supabase = useSupabaseClient()
const saving = ref(false)
const saveError = ref('')

const editForm = reactive({
  title: '',
  price: 0,
  stock: null,
  is_negotiable: false,
  is_cod: false,
  description: '',
  condition: '',
})

watch(() => props.show, (val) => {
  if (val && props.product) {
    Object.assign(editForm, {
      title:         props.product.title ?? '',
      price:         props.product.price ?? 0,
      stock:         props.product.stock,
      is_negotiable: props.product.is_negotiable ?? false,
      is_cod:        props.product.is_cod ?? false,
      description:   props.product.description ?? '',
      condition:     props.product.condition ?? '',
    })
    saveError.value = ''
  }
})

async function save() {
  if (!props.product?.id) return
  saving.value = true
  saveError.value = ''
  const stockVal = editForm.stock === null || editForm.stock === '' ? null : Number(editForm.stock)
  const cleanedTitle = stripUrls(editForm.title.trim())
  const newSlug = generateSlug(cleanedTitle, props.product.id)
  const payload = {
    title: cleanedTitle,
    slug: newSlug,
    price: Number(editForm.price),
    stock: stockVal,
    is_negotiable: editForm.is_negotiable,
    is_cod: editForm.is_cod,
    description: editForm.description,
    condition: editForm.condition,
    updated_at: new Date().toISOString(),
  }
  if (stockVal !== null) payload.status = stockVal > 0 ? 'active' : 'sold'
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', props.product.id)
    .select('id, title, price, stock, status, is_negotiable, is_cod, description, condition, updated_at, created_at')
    .single()
  saving.value = false
  if (error) { saveError.value = 'Gagal menyimpan. Coba lagi.'; return }
  emit('saved', data)
}
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0" leave-active-class="transition duration-150" leave-to-class="opacity-0">
      <div
        v-if="show"
        class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto py-8 px-4"
        style="background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);"
        @click.self="emit('close')"
      >
        <div class="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 mt-8 mb-8" :style="isDark
          ? 'background: rgba(15,23,42,0.97); box-shadow: 0 8px 40px rgba(0,0,0,0.4);'
          : 'background: rgba(255,255,255,0.97); box-shadow: 0 8px 40px rgba(30,58,138,0.18);'">
          <div class="flex items-center justify-between">
            <h2 class="font-heading text-xl font-bold" :style="isDark ? 'color: #7dd3fc' : 'color: #1e3a8a'">✏️ Edit Produk</h2>
            <button @click="emit('close')" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Judul -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Judul Produk</label>
            <input v-model="editForm.title" type="text" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" placeholder="Judul produk" />
          </div>

          <!-- Harga -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Harga (Rp)</label>
            <input v-model="editForm.price" type="number" min="0" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" placeholder="0" />
          </div>

          <!-- Stok -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Stok</label>
            <input v-model="editForm.stock" type="number" min="0" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" placeholder="Jumlah unit tersedia" />
          </div>

          <!-- Kondisi -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Kondisi</label>
            <select v-model="editForm.condition" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
              <option v-for="c in CONDITIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>

          <!-- Opsi -->
          <div class="flex gap-6">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input v-model="editForm.is_negotiable" type="checkbox" class="w-4 h-4 rounded accent-blue-800" />
              <span class="text-sm text-gray-700">🤝 Bisa Nego</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input v-model="editForm.is_cod" type="checkbox" class="w-4 h-4 rounded accent-blue-800" />
              <span class="text-sm text-gray-700">🚲 COD</span>
            </label>
          </div>

          <!-- Deskripsi -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-gray-600">Deskripsi</label>
            <textarea v-model="editForm.description" rows="10" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none" placeholder="Tulis deskripsi produk..."></textarea>
          </div>

          <!-- Error -->
          <p v-if="saveError" class="text-sm text-red-500 text-center">{{ saveError }}</p>

          <!-- Tombol -->
          <div class="flex gap-3 pt-1">
            <button
              @click="emit('close')"
              class="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >Batal</button>
            <button
              @click="save"
              :disabled="saving"
              class="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition hover:opacity-90"
              style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
            >{{ saving ? 'Menyimpan...' : '💾 Simpan Perubahan' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
