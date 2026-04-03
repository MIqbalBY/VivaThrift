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

// Floating particles for visual flair
const particles = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  size: 4 + Math.random() * 8,
  x: 10 + Math.random() * 80,
  y: 10 + Math.random() * 80,
  delay: Math.random() * 4,
  duration: 6 + Math.random() * 6,
}))
</script>

<template>
  <div class="vt-error-page relative min-h-screen flex flex-col overflow-hidden" :class="isDark ? 'bg-[#0a1225]' : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'">

    <!-- Background decorations -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <!-- Grid pattern -->
      <svg class="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="error-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" :stroke="isDark ? '#7dd3fc' : '#1e3a8a'" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#error-grid)"/>
      </svg>

      <!-- Gradient orbs -->
      <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl"
           :style="`background: radial-gradient(circle, ${isDark ? 'rgba(14,165,233,0.08)' : 'rgba(30,58,138,0.06)'}, transparent 70%);`"></div>
      <div class="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full blur-3xl"
           :style="`background: radial-gradient(circle, ${isDark ? 'rgba(56,189,248,0.06)' : 'rgba(99,102,241,0.05)'}, transparent 70%);`"></div>

      <!-- Floating particles -->
      <div
        v-for="p in particles"
        :key="p.id"
        class="absolute rounded-full"
        :style="{
          width: p.size + 'px',
          height: p.size + 'px',
          left: p.x + '%',
          top: p.y + '%',
          background: isDark ? 'rgba(56,189,248,0.15)' : 'rgba(30,58,138,0.08)',
          animation: `vt-float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
        }"
      ></div>
    </div>

    <!-- Main content -->
    <div class="relative flex-1 flex flex-col items-center justify-center px-6 py-16">

      <!-- Error card -->
      <div
        class="vt-hero-enter vt-hero-enter-d1 w-full max-w-lg text-center"
      >
        <!-- Status code (large) -->
        <p
          class="vt-hero-enter vt-hero-enter-d1 font-heading font-bold leading-none select-none mb-2"
          :class="is404 ? 'text-[120px] sm:text-[160px]' : 'text-[100px] sm:text-[130px]'"
          :style="isDark
            ? 'background: linear-gradient(135deg, #1e3a5f 0%, #0c4a6e 30%, #0369a1 60%, #38bdf8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; opacity: 0.35;'
            : 'background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 30%, #93c5fd 60%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; opacity: 0.30;'"
        >
          {{ statusCode }}
        </p>

        <!-- Illustration -->
        <div class="vt-hero-enter vt-hero-enter-d2 relative mx-auto -mt-10 mb-6">
          <img
            v-if="is404"
            src="/img/illustrations/page-not-found.svg"
            alt="Halaman tidak ditemukan"
            width="240"
            height="240"
            class="w-52 sm:w-60 h-auto mx-auto drop-shadow-sm"
          />
          <img
            v-else
            src="/img/illustrations/void.svg"
            alt="Terjadi kesalahan"
            width="240"
            height="240"
            class="w-48 sm:w-56 h-auto mx-auto drop-shadow-sm"
          />
        </div>

        <!-- Heading -->
        <h1
          class="vt-hero-enter vt-hero-enter-d3 font-heading text-2xl sm:text-3xl font-bold mb-3"
          :style="isDark ? 'color: #f1f5f9;' : 'color: #1e3a8a;'"
        >
          <template v-if="is404">Waduh, nyasar nih!</template>
          <template v-else>Oops, ada yang error!</template>
        </h1>

        <!-- Description -->
        <p
          class="vt-hero-enter vt-hero-enter-d4 text-sm sm:text-base max-w-sm mx-auto mb-8 leading-relaxed"
          :class="isDark ? 'text-gray-400' : 'text-gray-500'"
        >
          <template v-if="is404">
            Halaman yang kamu cari nggak ada atau sudah dipindahkan. Mungkin link-nya salah, atau produknya udah laku!
          </template>
          <template v-else>
            {{ error?.message || 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi nanti.' }}
          </template>
        </p>

        <!-- Action buttons -->
        <div class="vt-hero-enter vt-hero-enter-d5 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            @click="goHome"
            class="group flex items-center gap-2 px-7 py-3 rounded-full text-white font-bold text-sm shadow-lg transition hover:opacity-90 hover:shadow-xl hover:-translate-y-0.5"
            :style="isDark
              ? 'background: linear-gradient(to right, #0369a1, #0ea5e9, #38bdf8);'
              : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);'"
          >
            <svg class="w-4 h-4 transition group-hover:-translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            Ke Beranda
          </button>
          <button
            @click="goBack"
            class="group flex items-center gap-2 px-7 py-3 rounded-full border-2 font-bold text-sm transition hover:-translate-y-0.5"
            :style="isDark
              ? 'border-color: #38bdf8; color: #7dd3fc; background: rgba(14,165,233,0.06);'
              : 'border-color: #1e3a8a; color: #1e3a8a; background: rgba(255,255,255,0.80);'"
            :class="isDark ? 'hover:bg-sky-500/10' : 'hover:bg-blue-50'"
          >
            <svg class="w-4 h-4 transition group-hover:-translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Kembali
          </button>
        </div>
      </div>

      <!-- Subtle branding -->
      <div class="vt-hero-enter vt-hero-enter-d5 mt-16 flex items-center gap-2 opacity-40">
        <img src="/img/logo-vivathrift.png" alt="" width="20" height="20" class="h-5" />
        <span class="text-xs font-medium" :class="isDark ? 'text-gray-500' : 'text-gray-400'">VivaThrift</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes vt-float {
  from { transform: translateY(0) rotate(0deg); }
  to   { transform: translateY(-20px) rotate(8deg); }
}
</style>
