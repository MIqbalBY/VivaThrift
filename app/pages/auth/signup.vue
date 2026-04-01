<script setup>
definePageMeta({ layout: false })
useSeoMeta({ title: 'Daftar — VivaThrift' })

const supabase = useSupabaseClient()
const { isDark, init: initDark, toggle: toggleDark } = useDarkMode()
onMounted(() => initDark())

const name = ref('')
const username = ref('')
const nrp = ref('')
const faculty = ref('')
const department = ref('')
const gender = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')
const step = ref(1)

const FAKULTAS_DEPARTEMEN = {
  'Fakultas Desain Kreatif dan Bisnis Digital (FDKBD)': [
    'Desain Interior',
    'Desain Komunikasi Visual',
    'Desain Produk Industri',
    'Manajemen Bisnis',
    'Studi Pembangunan',
  ],
  'Fakultas Kedokteran dan Kesehatan (FKK)': [
    'Kedokteran',
    'Teknologi Kedokteran',
  ],
  'Fakultas Sains dan Analitika Data (FSAD)': [
    'Aktuaria',
    'Biologi',
    'Fisika',
    'Kimia',
    'Matematika',
    'Statistika',
  ],
  'Fakultas Teknik Sipil, Perencanaan, dan Kebumian (FTSPK)': [
    'Arsitektur',
    'Perencanaan Wilayah dan Kota',
    'Teknik Geofisika',
    'Teknik Geomatika',
    'Teknik Lingkungan',
    'Teknik Sipil',
  ],
  'Fakultas Teknologi Elektro dan Informatika Cerdas (FTEIC)': [
    'Sistem Informasi',
    'Teknik Biomedik',
    'Teknik Elektro',
    'Teknik Informatika',
    'Teknik Komputer',
    'Teknik Telekomunikasi',
    'Teknologi Informasi',
  ],
  'Fakultas Teknologi Industri dan Rekayasa Sistem (FTIRS)': [
    'Teknik dan Sistem Industri',
    'Teknik Fisika',
    'Teknik Kimia',
    'Teknik Material',
    'Teknik Mesin',
    'Teknik Pangan',
  ],
  'Fakultas Teknologi Kelautan (FTK)': [
    'Teknik Kelautan',
    'Teknik Lepas Pantai',
    'Teknik Perkapalan',
    'Teknik Sistem Perkapalan',
    'Teknik Transportasi Laut',
  ],
  'Fakultas Vokasi (FV)': [
    'Statistika Bisnis',
    'Teknik Elektro Otomasi',
    'Teknik Infrastruktur Sipil',
    'Teknik Instrumentasi',
    'Teknik Kimia Industri',
    'Teknik Mesin Industri',
  ],
}

const departemenOptions = computed(() => {
  if (!faculty.value) return []
  return FAKULTAS_DEPARTEMEN[faculty.value] ?? []
})

watch(faculty, () => { department.value = '' })

const usernameError = ref('')
const usernameChecking = ref(false)
let usernameTimer = null
const usernameRegex = /^[a-zA-Z0-9._]{3,30}$/

watch(username, (val) => {
  usernameError.value = ''
  if (usernameTimer) clearTimeout(usernameTimer)
  if (!val) return
  if (!usernameRegex.test(val)) {
    usernameError.value = 'Hanya huruf, angka, titik (.) dan underscore (_). 3–30 karakter.'
    return
  }
  usernameChecking.value = true
  usernameTimer = setTimeout(async () => {
    const { data } = await supabase.from('users').select('id').eq('username', val.toLowerCase()).maybeSingle()
    usernameChecking.value = false
    if (data) usernameError.value = 'Username sudah digunakan.'
  }, 500)
})

function validateStep1() {
  errorMsg.value = ''
  if (!name.value.trim() || !username.value.trim() || !nrp.value.trim() || !faculty.value || !department.value || !gender.value) {
    errorMsg.value = 'Semua field wajib diisi.'
    return false
  }
  if (!usernameRegex.test(username.value)) {
    errorMsg.value = 'Username tidak valid.'
    return false
  }
  if (usernameError.value) {
    errorMsg.value = usernameError.value
    return false
  }
  return true
}

function goStep2() {
  if (validateStep1()) {
    errorMsg.value = ''
    step.value = 2
  }
}

async function handleSignup() {
  errorMsg.value = ''

  if (!email.value.trim() || !password.value || !confirmPassword.value) {
    errorMsg.value = 'Semua field wajib diisi.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'Password dan konfirmasi password tidak cocok.'
    return
  }
  if (password.value.length < 6) {
    errorMsg.value = 'Password minimal 6 karakter.'
    return
  }
  if (!email.value.trim().toLowerCase().endsWith('@student.its.ac.id')) {
    errorMsg.value = 'Hanya email ITS (@student.its.ac.id) yang diizinkan.'
    return
  }

  isLoading.value = true
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
    })
    if (error) throw error

    if (data.user) {
      const { error: insertError } = await supabase.from('users').insert({
        id: data.user.id,
        email: email.value.trim(),
        name: name.value.trim(),
        username: username.value.trim().toLowerCase(),
        nrp: nrp.value.trim(),
        faculty: faculty.value,
        department: department.value,
        gender: gender.value,
      })
      if (insertError) throw insertError
    }

    await navigateTo('/auth/signin?signup=success')
  } catch (err) {
    const msg = err.message?.toLowerCase() ?? ''
    if (msg.includes('already registered') || msg.includes('already been registered'))
      errorMsg.value = 'Email sudah terdaftar. Silakan login.'
    else if (msg.includes('rate limit') || msg.includes('too many requests'))
      errorMsg.value = 'Terlalu banyak percobaan. Coba lagi nanti.'
    else if (msg.includes('weak password') || msg.includes('password'))
      errorMsg.value = 'Password terlalu lemah. Gunakan minimal 6 karakter.'
    else
      errorMsg.value = 'Pendaftaran gagal. Coba lagi nanti.'
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
    <img src="/img/banner-2.png" alt="" width="1920" height="600" class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" aria-hidden="true" />
    <div class="absolute inset-0 pointer-events-none" :style="isDark ? 'background: rgba(10,22,40,0.75)' : 'background: rgba(15,23,42,0.55)'"></div>

    <!-- Dark mode toggle -->
    <button
      @click="toggleDark"
      :aria-label="isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'"
      class="absolute top-5 right-5 z-20 w-9 h-9 rounded-full flex items-center justify-center transition backdrop-blur-sm"
      :style="isDark ? 'background: rgba(255,255,255,0.12)' : 'background: rgba(255,255,255,0.20)'"
    >
      <svg v-if="isDark" class="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m8.66-9H20M4 12H3m15.07-6.07-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"/>
      </svg>
      <svg v-else class="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
      </svg>
    </button>

    <!-- Tombol back -->
    <div class="vt-hero-enter vt-hero-enter-d1 relative z-10 w-full max-w-sm mx-4 mb-3">
      <NuxtLink
        to="/auth/signin"
        class="inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white transition-colors group"
      >
        <svg class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
        </svg>
        Kembali ke Login
      </NuxtLink>
    </div>

    <!-- Card Signup -->
    <div class="vt-hero-enter vt-hero-enter-d2 relative z-10 w-full max-w-sm mx-4 rounded-2xl px-10 py-10" style="background: rgba(255,255,255,0.15); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 8px 32px rgba(0,0,0,0.25);">

      <!-- Brand header -->
      <div class="flex flex-col items-center gap-2 mb-6">
        <div class="flex items-center gap-3">
          <img src="/img/logo-vivathrift.png" alt="VivaThrift" width="40" height="40" class="h-10" />
          <div class="w-px h-8 bg-white/25"></div>
          <a href="https://www.its.ac.id/" target="_blank" rel="noopener noreferrer" title="Institut Teknologi Sepuluh Nopember">
            <img src="/img/logo-its.png" alt="ITS" width="36" height="36" class="h-9 opacity-90" />
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
      <img src="/img/illustrations/sign-up.svg" alt="" width="128" height="128" loading="lazy" class="w-32 h-auto mx-auto mb-4 opacity-80" aria-hidden="true" />

      <h1 class="font-heading text-[1.85rem] font-bold text-white mb-1 leading-tight">Daftar</h1>
      <!-- Step indicator -->
      <div class="flex items-center gap-2 mb-6">
        <div class="flex items-center gap-1.5">
          <span
            class="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
            :class="step === 1 ? (isDark ? 'text-white' : 'bg-white text-blue-900') : 'bg-white/30 text-white'"
            :style="step === 1 && isDark ? 'background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8);' : ''"
          >1</span>
          <span class="text-xs text-white/70">Data Diri</span>
        </div>
        <div class="flex-1 h-px" :class="step >= 2 ? 'bg-white/70' : 'bg-white/20'"></div>
        <div class="flex items-center gap-1.5">
          <span
            class="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
            :class="step === 2 ? (isDark ? 'text-white' : 'bg-white text-blue-900') : 'bg-white/30 text-white'"
            :style="step === 2 && isDark ? 'background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8);' : ''"
          >2</span>
          <span class="text-xs text-white/70">Akun</span>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="step === 1 ? goStep2() : handleSignup()" class="space-y-5">

        <!-- ══ STEP 1: Data Diri ══ -->
        <template v-if="step === 1">

        <!-- Nama Lengkap -->
        <div class="border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
          <input
            v-model="name"
            type="text"
            placeholder="Nama Lengkap"
            autocomplete="name"
            class="w-full px-3 py-1.5 text-sm text-white placeholder-white/50 bg-transparent focus:outline-none"
            :disabled="isLoading"
          />
        </div>

        <!-- NRP -->
        <div class="border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm select-none">@</span>
            <input
              v-model="username"
              type="text"
              placeholder="Username (misal: john.doe)"
              autocomplete="off"
              class="w-full pr-3 py-1.5 text-sm text-white placeholder-white/50 bg-transparent focus:outline-none"
              style="padding-left: 1.75rem"
              :disabled="isLoading"
              maxlength="30"
            />
          </div>
          <div v-if="usernameChecking" class="text-xs text-white/40 mt-0.5 px-3">Memeriksa...</div>
          <div v-else-if="usernameError" class="text-xs text-red-300 mt-0.5 px-3">{{ usernameError }}</div>
        </div>

        <!-- NRP -->
        <div class="border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
          <input
            v-model="nrp"
            type="text"
            placeholder="NRP (Nomor Registrasi Pokok)"
            autocomplete="off"
            class="w-full px-3 py-1.5 text-sm text-white placeholder-white/50 bg-transparent focus:outline-none"
            :disabled="isLoading"
          />
        </div>

        <!-- Fakultas -->
        <div class="border-b transition-colors pb-1" :class="isLoading ? 'border-white/20' : 'border-white/30 focus-within:border-white/70'">
          <div class="relative">
            <select
              v-model="faculty"
              class="w-full pl-3 py-1.5 pr-7 text-sm bg-transparent focus:outline-none appearance-none cursor-pointer"
              :class="faculty ? 'text-white' : 'text-white/50'"
              :disabled="isLoading"
            >
              <option value="" disabled hidden style="color: #1f2937;">Pilih Fakultas</option>
              <option v-for="f in Object.keys(FAKULTAS_DEPARTEMEN)" :key="f" :value="f" style="color: #1f2937; background: white;">{{ f }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>

        <!-- Departemen -->
        <div class="border-b transition-colors pb-1" :class="(!faculty || isLoading) ? 'border-white/20' : 'border-white/30 focus-within:border-white/70'">
          <div class="relative">
            <select
              v-model="department"
              class="w-full pl-3 py-1.5 pr-7 text-sm bg-transparent focus:outline-none appearance-none transition-colors"
              :class="[
                department ? 'text-white' : 'text-white/50',
                (!faculty || isLoading) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              ]"
              :disabled="isLoading || !faculty"
            >
              <option value="" disabled hidden style="color: #1f2937;">{{ faculty ? 'Pilih Departemen' : 'Pilih Fakultas terlebih dahulu' }}</option>
              <option v-for="d in departemenOptions" :key="d" :value="d" style="color: #1f2937; background: white;">{{ d }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" :class="(!faculty || isLoading) ? 'text-white/20' : 'text-white/50'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>

        <!-- Jenis Kelamin -->
        <div class="border-b transition-colors pb-1" :class="isLoading ? 'border-white/20' : 'border-white/30 focus-within:border-white/70'">
          <div class="relative">
            <select
              v-model="gender"
              class="w-full pl-3 py-1.5 pr-7 text-sm bg-transparent focus:outline-none appearance-none cursor-pointer"
              :class="gender ? 'text-white' : 'text-white/50'"
              :disabled="isLoading"
            >
              <option value="" disabled hidden style="color: #1f2937;">Jenis Kelamin</option>
              <option value="Laki-laki" style="color: #1f2937; background: white;">Laki-laki</option>
              <option value="Perempuan" style="color: #1f2937; background: white;">Perempuan</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>

        <!-- Error (step 1) -->
        <p v-if="errorMsg" class="text-red-300 text-sm">{{ errorMsg }}</p>

        <!-- Lanjut button -->
        <div class="flex justify-end pt-1">
          <button
            type="submit"
            class="px-8 py-2.5 rounded-full text-white font-semibold text-sm transition hover:opacity-90 hover:shadow-lg flex items-center gap-2 shadow-md"
            :style="isDark ? 'background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8);' : 'background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);'"
          >
            Lanjut
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
          </button>
        </div>

        </template>

        <!-- ══ STEP 2: Akun ══ -->
        <template v-if="step === 2">

        <!-- Back to step 1 -->
        <button type="button" @click="step = 1; errorMsg = ''" class="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
          Kembali
        </button>

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

        <!-- Password -->
        <div class="relative border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Password (min. 6 karakter)"
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

        <!-- Konfirmasi Password -->
        <div class="relative border-b border-white/30 focus-within:border-white/70 transition-colors pb-1">
          <input
            v-model="confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="Konfirmasi Password"
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

        <!-- Error -->
        <p v-if="errorMsg" class="text-red-300 text-sm">{{ errorMsg }}</p>

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
            {{ isLoading ? 'Memproses...' : 'Daftar' }}
          </button>
        </div>

        </template>

      </form>
    </div>

    <!-- Link ke Login -->
    <p class="relative z-10 mt-4 text-sm text-white/80">
      Sudah punya akun?
      <NuxtLink to="/auth/signin" class="text-white font-semibold hover:underline">Masuk</NuxtLink>
    </p>

  </div>
</template>

<style scoped>
input::placeholder {
  color: rgba(255, 255, 255, 0.70);
}
</style>
