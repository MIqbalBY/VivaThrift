<script setup>
defineProps({
  show: { type: Boolean, default: false },
  offerPrice: { type: [String, Number], default: '' },
  offerQty: { type: Number, default: 1 },
  offerError: { type: String, default: '' },
  submittingOffer: { type: Boolean, default: false },
  maxQty: { type: Number, default: 99 },
  isDark: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:show', 'update:offerPrice', 'update:offerQty',
  'submit',
])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style="background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);"
      @click.self="emit('update:show', false)"
    >
      <div
        class="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
        :style="isDark
          ? 'background: rgba(15,25,50,0.97); box-shadow: 0 8px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08);'
          : 'background: rgba(255,255,255,0.97); box-shadow: 0 8px 40px rgba(30,58,138,0.18);'"
      >
        <h3 class="font-heading text-lg font-bold" :style="isDark ? 'color:#93c5fd;' : 'color:#1e3a8a;'">Ajukan Penawaran</h3>

        <div>
          <label class="block text-xs font-semibold mb-1" :class="isDark ? 'text-gray-300' : 'text-gray-600'">Harga Tawar (Rp)</label>
          <input
            :value="offerPrice"
            @input="emit('update:offerPrice', $event.target.value)"
            type="number"
            min="1"
            placeholder="Masukkan harga"
            class="w-full rounded-xl px-4 py-2.5 text-sm outline-hidden transition"
            :class="isDark
              ? 'bg-white/10 border border-white/10 text-white placeholder-gray-500 focus:border-blue-400'
              : 'border border-gray-200 text-gray-900 focus:border-blue-400'"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold mb-1" :class="isDark ? 'text-gray-300' : 'text-gray-600'">
            Jumlah <span :class="isDark ? 'text-gray-500' : 'text-gray-400'">(maks. {{ maxQty }})</span>
          </label>
          <div class="flex items-center gap-3">
            <button
              @click="offerQty > 1 && emit('update:offerQty', offerQty - 1)"
              class="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition"
              :class="isDark
                ? 'border border-white/10 text-gray-200 hover:bg-white/10'
                : 'border border-gray-200 hover:bg-gray-50'"
            >−</button>
            <span class="flex-1 text-center font-semibold" :class="isDark ? 'text-gray-100' : 'text-gray-800'">{{ offerQty }}</span>
            <button
              @click="offerQty < maxQty && emit('update:offerQty', offerQty + 1)"
              class="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition"
              :class="isDark
                ? 'border border-white/10 text-gray-200 hover:bg-white/10'
                : 'border border-gray-200 hover:bg-gray-50'"
            >+</button>
          </div>
        </div>

        <p v-if="offerError" class="text-xs text-red-400">{{ offerError }}</p>

        <div class="flex gap-3">
          <button
            @click="emit('update:show', false)"
            class="flex-1 py-2.5 rounded-xl text-sm transition"
            :class="isDark
              ? 'border border-white/10 text-gray-300 hover:bg-white/10'
              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'"
          >
            Batal
          </button>
          <button
            @click="emit('submit')"
            :disabled="submittingOffer"
            class="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition"
            :style="isDark
              ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8);'
              : 'background: linear-gradient(135deg,#1e3a8a,#2563eb);'"
          >
            {{ submittingOffer ? 'Mengirim...' : 'Kirim Penawaran' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
