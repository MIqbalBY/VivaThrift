<script setup>
definePageMeta({ layout: false })
useSeoMeta({ title: 'Konfirmasi — VivaThrift' })

const supabase = useSupabaseClient()
const route = useRoute()
const isProcessing = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  try {
    // For PKCE flow: Supabase client's _initialize() automatically exchanges
    // the ?code= param for a session. getSession() awaits initialization.
    const type = route.query.type

    const { data: { session } } = await supabase.auth.getSession()

    if (type === 'recovery' || route.query.type === 'recovery') {
      if (session) {
        // Valid recovery session — redirect to reset password page
        await navigateTo('/auth/reset-password', { replace: true })
      } else {
        errorMsg.value = 'Link reset password tidak valid atau sudah kedaluwarsa.'
      }
    } else if (type === 'signup' || type === 'email') {
      // Email verification — redirect to signin with success
      await navigateTo('/auth/signin?verified=true', { replace: true })
    } else if (session) {
      // Other valid session — go home
      await navigateTo('/', { replace: true })
    } else {
      errorMsg.value = 'Link konfirmasi tidak valid atau sudah kedaluwarsa.'
    }
  } catch (err) {
    errorMsg.value = 'Terjadi kesalahan saat memproses konfirmasi. Silakan coba lagi.'
  } finally {
    isProcessing.value = false
  }
})
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center relative overflow-hidden font-sans"
  >
    <!-- Background -->
    <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/img/Background.png');"></div>
    <div class="absolute inset-0 bg-black/40"></div>

    <!-- Card -->
    <div class="relative z-10 w-full max-w-sm mx-4 rounded-2xl px-10 py-10" style="background: rgba(255,255,255,0.15); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 8px 32px rgba(0,0,0,0.25);">

      <!-- Brand header -->
      <div class="flex flex-col items-center gap-2 mb-6">
        <div class="flex items-center gap-3">
          <img src="/img/Logo VivaThrift.png" alt="VivaThrift" class="h-10" />
          <div class="w-px h-8 bg-white/25"></div>
          <a href="https://www.its.ac.id/" target="_blank" rel="noopener noreferrer" title="Institut Teknologi Sepuluh Nopember">
            <img src="/img/Logo ITS.png" alt="ITS" class="h-9 opacity-90" />
          </a>
        </div>
        <span
          class="font-himpun text-[2.1rem] leading-none"
          style="background: linear-gradient(to right, #38bdf8, #7dd3fc, #bae6fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
        >VivaThrift</span>
      </div>

      <!-- Illustration -->
      <img src="/img/illustrations/mail-sent.svg" alt="" class="w-28 h-auto mx-auto mb-4 opacity-80" aria-hidden="true" />

      <!-- Loading -->
      <div v-if="isProcessing" class="flex flex-col items-center gap-3 py-6">
        <svg class="w-8 h-8 animate-spin text-white/60" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p class="text-white/70 text-sm">Memproses konfirmasi...</p>
      </div>

      <!-- Error -->
      <div v-else-if="errorMsg" class="space-y-4">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
          <h1 class="font-heading text-lg font-bold text-white leading-tight">Konfirmasi Gagal</h1>
        </div>

        <div class="flex items-start gap-2.5 border border-amber-200/20 rounded-xl px-4 py-3" style="background: rgba(245, 158, 11, 0.1);">
          <p class="text-sm text-amber-200/80 leading-snug">{{ errorMsg }}</p>
        </div>

        <div class="flex flex-col gap-2 pt-1">
          <NuxtLink
            to="/auth/forgot-password"
            class="w-full px-6 py-2.5 rounded-full text-white font-semibold text-sm text-center transition hover:opacity-90 hover:shadow-lg shadow-md"
            style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
          >
            Minta Link Reset Baru
          </NuxtLink>
          <NuxtLink
            to="/auth/signin"
            class="w-full px-6 py-2.5 rounded-full text-white/80 font-semibold text-sm text-center transition hover:text-white hover:bg-white/10 border border-white/20"
          >
            Kembali ke Masuk
          </NuxtLink>
        </div>
      </div>

    </div>
  </div>
</template>
