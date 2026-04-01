<script setup>
definePageMeta({ layout: false })
useSeoMeta({ title: 'Atur Ulang Password — VivaThrift' })

const supabase = useSupabaseClient()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')
const successMsg = ref(false)
const isValidSession = ref(false)
const isChecking = ref(true)

// Verify that user has a valid recovery session
onMounted(async () => {
  // Clean up recovery flag
  localStorage.removeItem('__vt_pending_recovery')

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      isValidSession.value = true
    } else {
      errorMsg.value = 'Sesi reset password tidak valid atau sudah kedaluwarsa. Silakan minta link reset baru.'
    }
  } catch {
    errorMsg.value = 'Terjadi kesalahan saat memverifikasi sesi. Silakan coba lagi.'
  } finally {
    isChecking.value = false
  }
})

async function handleResetPassword() {
  errorMsg.value = ''

  if (!password.value || !confirmPassword.value) {
    errorMsg.value = 'Semua field wajib diisi.'
    return
  }
  if (password.value.length < 6) {
    errorMsg.value = 'Password minimal 6 karakter.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'Konfirmasi password tidak cocok.'
    return
  }

  isLoading.value = true
  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    })
    if (error) throw error
    successMsg.value = true
  } catch (err) {
    const msg = err.message?.toLowerCase() ?? ''
    if (msg.includes('same_password') || msg.includes('same as'))
      errorMsg.value = 'Password baru tidak boleh sama dengan password lama.'
    else if (msg.includes('weak password'))
      errorMsg.value = 'Password terlalu lemah. Gunakan minimal 6 karakter.'
    else if (msg.includes('session') || msg.includes('not authenticated'))
      errorMsg.value = 'Sesi sudah berakhir. Silakan minta link reset password lagi.'
    else
      errorMsg.value = 'Gagal mengubah password. Coba lagi nanti.'
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
    <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/img/banner-2.png');"></div>
    <div class="absolute inset-0 bg-black/40"></div>

    <!-- Tombol back di atas card -->
    <div class="relative z-10 w-full max-w-sm mx-4 mb-3">
      <NuxtLink
        to="/auth/signin"
        class="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors group"
      >
        <svg class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
        </svg>
        Kembali ke Masuk
      </NuxtLink>
    </div>

    <!-- Card Reset Password -->
    <div class="relative z-10 w-full max-w-sm mx-4 rounded-2xl px-10 py-10" style="background: rgba(255,255,255,0.15); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 8px 32px rgba(0,0,0,0.25);">

      <!-- Brand header -->
      <div class="flex flex-col items-center gap-2 mb-6">
        <div class="flex items-center gap-3">
          <img src="/img/logo-vivathrift.png" alt="VivaThrift" class="h-10" />
          <div class="w-px h-8 bg-white/25"></div>
          <a href="https://www.its.ac.id/" target="_blank" rel="noopener noreferrer" title="Institut Teknologi Sepuluh Nopember">
            <img src="/img/logo-its.png" alt="ITS" class="h-9 opacity-90" />
          </a>
        </div>
        <span
          class="font-himpun text-[2.1rem] leading-none"
          style="background: linear-gradient(to right, #38bdf8, #7dd3fc, #bae6fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
        >VivaThrift</span>
      </div>

      <!-- Illustration -->
      <img src="/img/illustrations/secure-login.svg" alt="" class="w-28 h-auto mx-auto mb-4 opacity-80" aria-hidden="true" />

      <!-- Loading State -->
      <div v-if="isChecking" class="flex flex-col items-center gap-3 py-8">
        <svg class="w-8 h-8 animate-spin text-white/60" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p class="text-white/60 text-sm">Memverifikasi sesi reset password...</p>
      </div>

      <!-- Invalid Session State -->
      <div v-else-if="!isValidSession && !successMsg" class="space-y-4">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
          <h1 class="font-heading text-xl font-bold text-white leading-tight">Sesi Tidak Valid</h1>
        </div>

        <div class="flex items-start gap-2.5 border border-amber-200/20 rounded-xl px-4 py-3" style="background: rgba(245, 158, 11, 0.1);">
          <p class="text-sm text-amber-200/80 leading-snug">
            {{ errorMsg }}
          </p>
        </div>

        <div class="flex flex-col gap-2 pt-2">
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

      <!-- Success State -->
      <div v-else-if="successMsg" class="space-y-4">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h1 class="font-heading text-xl font-bold text-white leading-tight">Password Berhasil Diubah!</h1>
        </div>

        <div class="flex items-start gap-2.5 border border-green-200/30 rounded-xl px-4 py-3" style="background: rgba(34, 197, 94, 0.12);">
          <p class="text-sm text-green-300/90 leading-snug">
            Password kamu telah berhasil diubah. Sekarang kamu bisa masuk dengan password baru.
          </p>
        </div>

        <div class="pt-2">
          <NuxtLink
            to="/auth/signin"
            class="block w-full px-6 py-2.5 rounded-full text-white font-semibold text-sm text-center transition hover:opacity-90 hover:shadow-lg shadow-md"
            style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
          >
            Masuk dengan Password Baru
          </NuxtLink>
        </div>
      </div>

      <!-- Form Reset Password -->
      <template v-else>
        <h1 class="font-heading text-[1.85rem] font-bold text-white mb-2 leading-tight">Atur Ulang Password</h1>
        <p class="text-white/60 text-sm mb-6 leading-relaxed">
          Masukkan password baru untuk akun kamu. Minimal 6 karakter.
        </p>

        <form @submit.prevent="handleResetPassword" class="space-y-6">

          <!-- Password Baru -->
          <div>
            <label class="block text-white/70 text-xs font-medium mb-1.5 pl-1">Password Baru</label>
            <div class="relative border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Minimal 6 karakter"
                autocomplete="new-password"
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
          </div>

          <!-- Konfirmasi Password -->
          <div>
            <label class="block text-white/70 text-xs font-medium mb-1.5 pl-1">Konfirmasi Password Baru</label>
            <div class="relative border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
              <input
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Ketik ulang password baru"
                autocomplete="new-password"
                class="w-full px-3 py-1.5 pr-9 text-sm text-white placeholder-white/50 bg-transparent focus:outline-none"
                :disabled="isLoading"
              />
              <button type="button" @click="showConfirmPassword = !showConfirmPassword" tabindex="-1" class="absolute right-1 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors p-1">
                <svg v-if="!showConfirmPassword" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Password strength indicator -->
          <div v-if="password" class="space-y-1.5 -mt-2">
            <div class="flex gap-1">
              <div class="h-1 flex-1 rounded-full transition-colors" :class="password.length >= 6 ? 'bg-green-400' : 'bg-white/20'"></div>
              <div class="h-1 flex-1 rounded-full transition-colors" :class="password.length >= 8 ? 'bg-green-400' : 'bg-white/20'"></div>
              <div class="h-1 flex-1 rounded-full transition-colors" :class="password.length >= 8 && /(?=.*[A-Z])(?=.*[0-9])/.test(password) ? 'bg-green-400' : 'bg-white/20'"></div>
            </div>
            <p class="text-xs" :class="password.length >= 6 ? 'text-green-400/80' : 'text-white/40'">
              {{ password.length < 6 ? `${password.length}/6 karakter minimum` : password.length < 8 ? 'Cukup kuat' : password.length >= 8 && /(?=.*[A-Z])(?=.*[0-9])/.test(password) ? 'Sangat kuat 💪' : 'Kuat' }}
            </p>
          </div>

          <!-- Error -->
          <p v-if="errorMsg" class="text-red-300 text-sm -mt-2">{{ errorMsg }}</p>

          <!-- Button -->
          <div class="flex justify-end pt-1">
            <button
              type="submit"
              :disabled="isLoading"
              class="px-8 py-2.5 rounded-full text-white font-semibold text-sm transition hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
              style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
            >
              <svg v-if="isLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {{ isLoading ? 'Menyimpan...' : 'Simpan Password Baru' }}
            </button>
          </div>

        </form>
      </template>

    </div>

  </div>
</template>
