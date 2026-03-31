<script setup>
definePageMeta({ layout: false })

const supabase = useSupabaseClient()

const name = ref('')
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

async function handleSignup() {
  errorMsg.value = ''

  if (!name.value.trim() || !nrp.value.trim() || !faculty.value || !department.value || !gender.value || !email.value.trim() || !password.value || !confirmPassword.value) {
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
        nrp: nrp.value.trim(),
        faculty: faculty.value,
        department: department.value,
        gender: gender.value,
      })
      if (insertError) throw insertError
    }

    await navigateTo('/auth/signin?signup=success')
  } catch (err) {
    errorMsg.value = err.message ?? 'Pendaftaran gagal. Coba lagi.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center relative overflow-hidden font-sans"
  >
    <!-- Background -->
    <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/img/Background.png');"></div>
    <div class="absolute inset-0 bg-black/40"></div>

    <!-- Tombol back -->
    <div class="relative z-10 w-full max-w-sm mx-4 mb-3">
      <NuxtLink
        to="/auth/signin"
        class="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors group"
      >
        <svg class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
        </svg>
        Kembali ke Login
      </NuxtLink>
    </div>

    <!-- Card Signup -->
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

      <h1 class="font-heading text-[1.85rem] font-bold text-white mb-6 leading-tight">Daftar</h1>

      <!-- Form -->
      <form @submit.prevent="handleSignup" class="space-y-5">

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
            class="px-8 py-2.5 rounded-full text-white font-semibold text-sm transition hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shadow-md" style="background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);"
          >
            <svg v-if="isLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {{ isLoading ? 'Memproses...' : 'Daftar' }}
          </button>
        </div>

      </form>
    </div>

    <!-- Link ke Login -->
    <p class="relative z-10 mt-4 text-sm text-white/60">
      Sudah punya akun?
      <NuxtLink to="/auth/signin" class="text-white font-semibold hover:underline">Masuk</NuxtLink>
    </p>

  </div>
</template>
