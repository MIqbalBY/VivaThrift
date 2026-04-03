<script setup>
import { useDarkMode } from '~/composables/useDarkMode'

const props = defineProps({ error: Object })
const { isDark, init: initDark } = useDarkMode()
onMounted(() => initDark())

const is404 = computed(() => props.error?.statusCode === 404)
const statusCode = computed(() => props.error?.statusCode ?? 500)

useHead({
  title: computed(() => is404.value ? 'Halaman Tidak Ditemukan — VivaThrift' : `Error ${statusCode.value} — VivaThrift`),
})

function goHome() {
  clearError({ redirect: '/' })
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    goHome()
  }
}
</script>

<template>
  <div class="relative min-h-screen flex flex-col" :class="isDark ? 'bg-[#0a1225]' : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'">

    <!-- Background decorations -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl"
           :style="`background: radial-gradient(circle, ${isDark ? 'rgba(14,165,233,0.08)' : 'rgba(30,58,138,0.06)'}, transparent 70%);`"></div>
      <div class="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full blur-3xl"
           :style="`background: radial-gradient(circle, ${isDark ? 'rgba(56,189,248,0.06)' : 'rgba(99,102,241,0.05)'}, transparent 70%);`"></div>
    </div>

    <!-- Main content -->
    <div class="relative flex-1 flex items-center justify-center px-6">
      <div class="w-full max-w-md text-center space-y-6">

        <!-- Status code -->
        <p
          class="vt-hero-enter vt-hero-enter-d1 font-heading font-extrabold leading-none select-none"
          :class="is404 ? 'text-[140px] sm:text-[180px]' : 'text-[120px] sm:text-[150px]'"
          :style="isDark
            ? 'background: linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #38bdf8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;'
            : 'background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #93c5fd 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;'"
        >
          {{ statusCode }}
        </p>

        <!-- Heading -->
        <h1
          class="vt-hero-enter vt-hero-enter-d2 font-heading text-2xl sm:text-3xl font-bold"
          :class="isDark ? 'text-slate-100' : 'text-blue-950'"
        >
          <template v-if="is404">Halaman tidak ditemukan</template>
          <template v-else>Terjadi kesalahan</template>
        </h1>

        <!-- Description -->
        <p
          class="vt-hero-enter vt-hero-enter-d3 text-sm sm:text-base leading-relaxed max-w-sm mx-auto"
          :class="isDark ? 'text-gray-400' : 'text-gray-500'"
        >
          <template v-if="is404">
            Halaman yang kamu cari tidak ada atau sudah dipindahkan. Cek kembali URL-nya atau kembali ke beranda.
          </template>
          <template v-else>
            {{ error?.message || 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi nanti.' }}
          </template>
        </p>

        <!-- Action buttons -->
        <div class="vt-hero-enter vt-hero-enter-d4 flex items-center justify-center gap-3 pt-2">
          <button
            @click="goHome"
            class="group flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold text-sm transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            :class="isDark ? 'bg-sky-600 hover:bg-sky-500' : 'bg-blue-900 hover:bg-blue-800'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            Ke Beranda
          </button>
          <button
            @click="goBack"
            class="group flex items-center gap-2 px-6 py-2.5 rounded-full border font-semibold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
            :class="isDark
              ? 'border-sky-500/40 text-sky-300 hover:bg-sky-500/10'
              : 'border-blue-900/20 text-blue-900 hover:bg-blue-50'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Kembali
          </button>
        </div>
      </div>
    </div>

    <!-- Subtle branding -->
    <div class="relative py-6 flex items-center justify-center gap-2 opacity-40">
      <img src="/img/logo-vivathrift.png" alt="" width="20" height="20" class="h-5" />
      <span class="text-xs font-medium" :class="isDark ? 'text-gray-500' : 'text-gray-400'">VivaThrift</span>
    </div>
  </div>
</template>
