<script setup lang="ts">
const supabase = useSupabaseClient()
const user     = useSupabaseUser()
const { isDark } = useDarkMode()

const props = defineProps<{
  /** 'product' or 'user' */
  targetType: 'product' | 'user'
  targetId: string
  targetLabel: string
}>()

const emit = defineEmits<{ close: []; submitted: [] }>()

const REASONS: Record<string, string[]> = {
  product: [
    'Foto buram / tidak jelas',
    'Barang palsu / KW',
    'Barang terlarang / ilegal',
    'Deskripsi menyesatkan',
    'Harga tidak wajar / scam',
    'Spam / duplikat listing',
    'Lainnya',
  ],
  user: [
    'Penipuan / tidak kirim barang',
    'Pelecehan / perilaku tidak sopan',
    'Akun palsu / impersonasi',
    'Spam / promosi berlebihan',
    'Lainnya',
  ],
}

const selectedReason = ref('')
const customReason   = ref('')
const loading        = ref(false)
const error          = ref('')
const success        = ref(false)

const finalReason = computed(() => {
  if (selectedReason.value === 'Lainnya') return customReason.value.trim()
  return selectedReason.value
})

async function submit() {
  error.value = ''
  if (!finalReason.value) {
    error.value = 'Pilih atau tulis alasan pelaporan.'
    return
  }
  if (!user.value) {
    error.value = 'Kamu harus login dulu.'
    return
  }

  loading.value = true
  try {
    const payload = {
      reporter_id: (user.value as any).id as string,
      reason:      finalReason.value,
      status:      'pending' as const,
      reported_product_id: props.targetType === 'product' ? props.targetId : null,
      reported_user_id:    props.targetType === 'user'    ? props.targetId : null,
    }

    const { error: insertErr } = await supabase.from('reports').insert(payload)

    if (insertErr) {
      if (insertErr.code === '23505') {
        error.value = 'Kamu sudah pernah melaporkan ini sebelumnya.'
      } else {
        error.value = insertErr.message
      }
      return
    }

    success.value = true
    setTimeout(() => emit('submitted'), 1500)
  } catch (e: any) {
    error.value = e?.message ?? 'Gagal mengirim laporan.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-sm rounded-2xl overflow-hidden"
        :style="isDark
          ? 'background:rgba(15,23,42,0.97);border:1px solid rgba(255,255,255,0.10);box-shadow:0 12px 40px rgba(0,0,0,0.60);'
          : 'background:rgba(255,255,255,0.98);border:1px solid rgba(30,58,138,0.10);box-shadow:0 12px 40px rgba(30,58,138,0.15);'"
      >
        <!-- Header -->
        <div class="px-6 pt-6 pb-3 flex items-center justify-between">
          <h3 class="font-heading text-lg font-bold" :style="isDark ? 'color:#f1f5f9;' : 'color:#dc2626;'">
            Laporkan {{ targetType === 'product' ? 'Produk' : 'Pengguna' }}
          </h3>
          <button @click="emit('close')" class="w-8 h-8 rounded-full flex items-center justify-center transition" :class="isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-gray-100 text-gray-400'">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Success -->
        <div v-if="success" class="px-6 pb-8 text-center">
          <div class="text-4xl mb-3">📢</div>
          <p class="font-semibold mb-1" :class="isDark ? 'text-white' : 'text-gray-800'">Laporan terkirim</p>
          <p class="text-sm" :class="isDark ? 'text-slate-400' : 'text-gray-500'">Tim kami akan meninjau laporan ini. Terima kasih!</p>
        </div>

        <!-- Form -->
        <template v-else>
          <div class="px-6 pb-2">
            <p class="text-xs mb-4" :class="isDark ? 'text-slate-400' : 'text-gray-500'">
              Melaporkan: <strong>{{ targetLabel }}</strong>
            </p>

            <!-- Reason radio buttons -->
            <div class="space-y-2 mb-4">
              <label
                v-for="r in REASONS[targetType]"
                :key="r"
                class="flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition"
                :class="selectedReason === r
                  ? isDark ? 'border-red-500/50 bg-red-900/20' : 'border-red-300 bg-red-50'
                  : isDark ? 'border-slate-700 hover:border-slate-500' : 'border-gray-200 hover:border-gray-300'"
              >
                <input v-model="selectedReason" :value="r" type="radio" class="accent-red-500 w-4 h-4" />
                <span class="text-sm" :class="isDark ? 'text-slate-200' : 'text-gray-700'">{{ r }}</span>
              </label>
            </div>

            <!-- Custom reason -->
            <textarea
              v-if="selectedReason === 'Lainnya'"
              v-model="customReason"
              rows="3"
              maxlength="500"
              placeholder="Jelaskan alasan pelaporan…"
              class="w-full rounded-xl px-4 py-3 text-sm border resize-none transition focus:outline-none focus:ring-2 mb-2"
              :class="isDark
                ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:ring-red-400/30 focus:border-red-400'
                : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-red-200 focus:border-red-400'"
            />
          </div>

          <p v-if="error" class="px-6 text-xs text-red-500 mb-2">{{ error }}</p>

          <div class="px-6 pb-6 flex gap-2">
            <button @click="emit('close')" class="flex-1 py-2.5 rounded-xl text-sm font-medium border transition"
              :class="isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'">
              Batal
            </button>
            <button @click="submit" :disabled="loading || !finalReason"
              class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style="background:linear-gradient(to right,#7f1d1d,#dc2626,#ef4444);">
              <span v-if="loading" class="flex items-center justify-center gap-1.5">
                <span class="w-4 h-4 rounded-full border-2 border-t-transparent border-white/50 animate-spin"></span>
                Mengirim…
              </span>
              <span v-else>Kirim Laporan</span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>
