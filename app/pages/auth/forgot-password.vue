<script setup>
definePageMeta({ layout: false })
useSeoMeta({ title: 'Lupa Password — VivaThrift' })

const supabase = useSupabaseClient()
const route = useRoute()
const { isDark, init: initDark } = useDarkMode()
onMounted(() => initDark())

const email = ref('')
const isLoading = ref(false)
const errorMsg = ref(route.query.expired === 'true' ? 'Link reset password sudah kedaluwarsa. Silakan kirim ulang.' : '')
const successMsg = ref(false)

async function handleResetRequest() {
  errorMsg.value = ''
  successMsg.value = false

  const trimmed = email.value.trim()
  if (!trimmed) {
    errorMsg.value = 'Email wajib diisi.'
    return
  }
  if (!trimmed.endsWith('@student.its.ac.id')) {
    errorMsg.value = 'Gunakan email ITS kamu (@student.its.ac.id).'
    return
  }

  isLoading.value = true
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
    })
    if (error) throw error
    // Flag for supabase-recovery plugin — PKCE flow doesn't fire PASSWORD_RECOVERY event
    localStorage.setItem('__vt_pending_recovery', Date.now().toString())
    successMsg.value = true
  } catch (err) {
    const msg = err.message?.toLowerCase() ?? ''
    if (msg.includes('rate limit') || msg.includes('too many requests'))
      errorMsg.value = 'Terlalu banyak permintaan. Coba lagi nanti.'
    else
      errorMsg.value = 'Gagal mengirim link reset password. Coba lagi nanti.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center relative overflow-hidden font-sans"
  >
    <!-- Background banner + overlay -->
    <img src="/img/Banner 2.png" alt="" class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" aria-hidden="true" />
    <div class="absolute inset-0 pointer-events-none" :style="isDark ? 'background: rgba(10,22,40,0.75)' : 'background: rgba(15,23,42,0.55)'"></div>

    <!-- Tombol back di atas card -->
    <div class="relative z-10 w-full max-w-sm mx-4 mb-3">
      <NuxtLink
        to="/auth/signin"
        class="inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white transition-colors group"
      >
        <svg class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
        </svg>
        Kembali ke Masuk
      </NuxtLink>
    </div>

    <!-- Card Lupa Password -->
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
          :style="isDark
            ? 'background: linear-gradient(to right, #38bdf8, #7dd3fc, #bae6fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;'
            : 'background: linear-gradient(to right, #1e3a8a, #2563eb, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;'"
        >VivaThrift</span>
      </div>

      <!-- Illustration -->
      <img src="/img/illustrations/secure-login.svg" alt="" class="w-28 h-auto mx-auto mb-4 opacity-80" aria-hidden="true" />

      <!-- Heading -->
      <h1 class="font-heading text-[1.85rem] font-bold text-white mb-2 leading-tight">Lupa Password</h1>
      <p class="text-white/80 text-sm mb-6 leading-relaxed">
        Masukkan email ITS kamu dan kami akan mengirim link untuk mengatur ulang password.
      </p>

      <!-- Success State -->
      <div v-if="successMsg" class="space-y-4">
        <div class="flex items-start gap-2.5 border border-green-200/30 rounded-xl px-4 py-3" style="background: rgba(34, 197, 94, 0.12);">
          <svg class="w-5 h-5 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p class="text-sm text-green-300 font-semibold leading-snug">Email Terkirim!</p>
            <p class="text-sm text-green-300/80 leading-snug mt-1">
              Link reset password telah dikirim ke <strong class="text-green-200">{{ email }}</strong>.
              Silakan cek inbox atau folder spam kamu.
            </p>
          </div>
        </div>

        <div class="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
          <p class="text-white/60 text-xs leading-relaxed">
            <span class="text-white/80 font-semibold">💡 Tips:</span> Email dikirim dari <strong class="text-sky-300">admin@vivathrift.store</strong>.
            Periksa folder spam/junk jika tidak menemukan email dalam beberapa menit.
          </p>
        </div>

        <div class="flex flex-col gap-2 pt-2">
          <button
            @click="successMsg = false; email = ''"
            class="w-full px-6 py-2.5 rounded-full text-white/80 font-semibold text-sm transition hover:text-white hover:bg-white/10 border border-white/20"
          >
            Kirim Ulang ke Email Lain
          </button>
          <NuxtLink
            to="/auth/signin"
            class="w-full px-6 py-2.5 rounded-full text-white font-semibold text-sm text-center transition hover:opacity-90 hover:shadow-lg shadow-md"
            :style="isDark ? 'background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8);' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);'"
          >
            Kembali ke Halaman Masuk
          </NuxtLink>
        </div>
      </div>

      <!-- Form State -->
      <form v-else @submit.prevent="handleResetRequest" class="space-y-6">

        <!-- Email -->
        <div class="border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
          <input
            v-model="email"
            type="email"
            placeholder="Email ITS (@student.its.ac.id)"
            autocomplete="email"
            class="w-full px-3 py-1.5 text-sm text-white placeholder-white/50 bg-transparent focus:outline-none"
            :disabled="isLoading"
          />
        </div>

        <!-- Error -->
        <p v-if="errorMsg" class="text-red-300 text-sm -mt-2">{{ errorMsg }}</p>

        <!-- Button -->
        <div class="flex justify-end pt-1">
          <button
            type="submit"
            :disabled="isLoading"
            class="px-8 py-2.5 rounded-full text-white font-semibold text-sm transition hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
            :style="isDark ? 'background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8);' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);'"
          >
            <svg v-if="isLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {{ isLoading ? 'Mengirim...' : 'Kirim Link Reset' }}
          </button>
        </div>

      </form>

    </div>

    <!-- Kembali ke Masuk -->
    <p class="relative z-10 mt-4 text-sm text-white/80">
      Sudah ingat password?
      <NuxtLink to="/auth/signin" class="text-white font-semibold hover:underline">Masuk</NuxtLink>
    </p>

  </div>
</template>

<style scoped>
input::placeholder {
  color: rgba(255, 255, 255, 0.70);
}
</style>
