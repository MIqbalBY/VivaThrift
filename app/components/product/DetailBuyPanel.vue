<script setup>
const props = defineProps({
  price:        { type: Number,  required: true },
  stock:        { type: Number,  default: null },
  isOutOfStock: { type: Boolean, default: false },
  isDark:       { type: Boolean, default: false },
  cartMsg:      { type: String,  default: '' },
})

const emit = defineEmits(['add-to-cart', 'buy-now'])

const qty = ref(1)

function decQty() { if (qty.value > 1) qty.value-- }
function incQty() {
  if (props.stock !== null && qty.value >= props.stock) return
  qty.value++
}

const subtotal = computed(() => (props.price * qty.value).toLocaleString('id-ID'))
</script>

<template>
  <div class="vt-glass rounded-2xl p-4 flex flex-col gap-4" :style="isDark
    ? 'background: rgba(15,25,50,0.80); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.3);'
    : 'background: rgba(255,255,255,0.70); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 20px rgba(30,58,138,0.10);'">
    <!-- Stok & Qty -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          @click="decQty"
          :disabled="qty <= 1"
          class="vt-qty-btn w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition"
        >−</button>
        <span class="w-6 text-center font-semibold text-gray-800">{{ qty }}</span>
        <button
          @click="incQty"
          :disabled="isOutOfStock || qty >= stock"
          class="vt-qty-btn w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition"
        >+</button>
      </div>
      <span class="text-sm text-gray-500">
        <template v-if="isOutOfStock"><span class="text-red-500 font-medium">Stok habis</span></template>
        <template v-else>Stok: <span class="font-medium text-gray-700">{{ stock }}</span></template>
      </span>
    </div>

    <!-- Subtotal -->
    <div class="flex items-center justify-between border-t border-gray-100 pt-3">
      <span class="text-sm text-gray-500">Subtotal</span>
      <span class="text-lg font-bold text-gray-900">Rp {{ subtotal }}</span>
    </div>

    <!-- Tombol aksi -->
    <div class="flex gap-3">
      <button
        @click="emit('add-to-cart')"
        :disabled="isOutOfStock"
        class="vt-btn-primary flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition hover:opacity-90 hover:shadow-lg text-sm inline-flex items-center justify-center gap-1.5"
        style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
        Keranjang
      </button>
      <button
        @click="emit('buy-now')"
        :disabled="isOutOfStock"
        class="vt-buy-outline-btn flex-1 py-3 rounded-xl border-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
        :style="isDark ? 'border-color: #38bdf8; color: #7dd3fc;' : 'border-color: #1e3a8a; color: #1e3a8a;'"
        :class="isDark ? 'hover:bg-sky-900/30' : 'hover:bg-blue-50'"
      >
        ⚡ Beli Langsung
      </button>
    </div>

    <!-- Toast -->
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 -translate-y-1" leave-active-class="transition duration-150" leave-to-class="opacity-0">
      <p v-if="cartMsg" class="text-center text-sm font-medium"
        :class="cartMsg === 'copied' ? 'text-gray-500' : 'text-green-600'">
        <template v-if="cartMsg === 'cart'">✅ Ditambahkan ke keranjang!</template>
        <template v-else-if="cartMsg === 'buy'">✅ Mengarahkan ke checkout...</template>
        <template v-else-if="cartMsg === 'copied'">🔗 Link disalin!</template>
      </p>
    </Transition>
  </div>
</template>
