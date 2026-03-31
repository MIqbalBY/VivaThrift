<script setup>
definePageMeta({ layout: false })

const supabase = useSupabaseClient()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')
const route = useRoute()
const signupSuccess = computed(() => route.query.signup === 'success')

async function handleLogin() {
  errorMsg.value = ''
  if (!email.value.trim() || !password.value) {
    errorMsg.value = 'Email dan password wajib diisi.'
    return
  }

  isLoading.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    })
    if (error) throw error
    await navigateTo('/')
  } catch (err) {
    errorMsg.value = err.message ?? 'Login gagal. Periksa email dan password kamu.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center relative overflow-hidden font-sans"
  >
    <!-- Background dengan overlay opacity -->
    <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/img/Background.png');"></div>
    <div class="absolute inset-0 bg-black/40"></div>



    <!-- Tombol back di atas card -->
    <div class="relative z-10 w-full max-w-sm mx-4 mb-3">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors group"
      >
        <svg class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
        </svg>
        Kembali ke Beranda
      </NuxtLink>
    </div>

    <!-- Card Login -->
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

      <!-- Heading -->
      <h1 class="font-heading text-[1.85rem] font-bold text-white mb-6 leading-tight">Masuk</h1>

      <!-- Form -->
      <form @submit.prevent="handleLogin" class="space-y-6">

        <!-- Email -->
        <div class="border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
          <input
            v-model="email"
            type="email"
            placeholder="Email ITS"
            autocomplete="email"
            class="w-full px-3 py-1.5 text-sm text-white placeholder-white/50 bg-transparent focus:outline-none"
            :disabled="isLoading"
          />
        </div>

        <!-- Password -->
        <div class="relative border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Password"
            autocomplete="current-password"
            class="w-full px-3 py-1.5 pr-9 text-sm text-white placeholder-white/50 bg-transparent focus:outline-none"
            :disabled="isLoading"
          />
          <button type="button" @click="showPassword = !showPassword" tabindex="-1" class="absolute right-1 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors p-1">
            <svg v-if="!showPassword" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"/>
            </svg>
          </button>
        </div>

        <!-- Forgot password -->
        <NuxtLink to="/auth/forgot-password" class="block text-sm text-white/70 hover:text-white hover:underline -mt-2 transition-colors">Lupa password?</NuxtLink>

        <!-- Signup success notification -->
        <div v-if="signupSuccess" class="flex items-start gap-2.5 border border-green-200 rounded-xl px-4 py-3 -mt-1" style="background: linear-gradient(to right, #f0fdf4, #dcfce7, #bbf7d0);">
          <svg class="w-4 h-4 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-sm text-green-700 leading-snug">
            Akun berhasil dibuat! Link verifikasi telah dikirim ke email ITS kamu.
          </p>
        </div>

        <!-- Error -->
        <p v-if="errorMsg" class="text-red-300 text-sm -mt-2">{{ errorMsg }}</p>

        <!-- Button kanan -->
        <div class="flex justify-end pt-1">
          <button
            type="submit"
            :disabled="isLoading"
            class="px-8 py-2.5 rounded-full text-white font-semibold text-sm transition hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-md" style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
          >
            <svg v-if="isLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {{ isLoading ? 'Memproses...' : 'Lanjut' }}
          </button>
        </div>

      </form>

    </div>

    <!-- Daftar -->
    <p class="relative z-10 mt-4 text-sm text-white/60">
      Belum punya akun?
      <NuxtLink to="/auth/signup" class="text-white font-semibold hover:underline">Daftar</NuxtLink>
    </p>

  </div>
</template>
