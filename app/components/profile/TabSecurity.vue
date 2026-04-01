<script setup lang="ts">
defineProps({
  pwOld: { type: String, default: '' },
  pwNew: { type: String, default: '' },
  pwConfirm: { type: String, default: '' },
  pwSaving: { type: Boolean, default: false },
  pwMsg: { type: String, default: '' },
  pwMsgType: { type: String, default: '' },
  showPwOld: { type: Boolean, default: false },
  showPwNew: { type: Boolean, default: false },
  showPwConfirm: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:pwOld', 'update:pwNew', 'update:pwConfirm',
  'update:showPwOld', 'update:showPwNew', 'update:showPwConfirm',
  'change-password',
])
</script>

<template>
  <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
    <h2 class="font-bold text-base vt-text-primary">Ubah Password</h2>
    <p class="text-sm vt-text-muted -mt-2">Masukkan password lama dan password baru untuk mengubah password akunmu.</p>

    <!-- Password Lama -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-semibold vt-label">Password Lama</label>
      <div class="relative">
        <input
          :value="pwOld"
          @input="emit('update:pwOld', ($event.target as HTMLInputElement).value)"
          :type="showPwOld ? 'text' : 'password'"
          placeholder="Masukkan password lama"
          class="vt-input pr-10"
          autocomplete="current-password"
        />
        <button type="button" @click="emit('update:showPwOld', !showPwOld)" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
          <svg v-if="!showPwOld" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
        </button>
      </div>
    </div>

    <!-- Password Baru -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-semibold vt-label">Password Baru</label>
      <div class="relative">
        <input
          :value="pwNew"
          @input="emit('update:pwNew', ($event.target as HTMLInputElement).value)"
          :type="showPwNew ? 'text' : 'password'"
          placeholder="Minimal 6 karakter"
          class="vt-input pr-10"
          autocomplete="new-password"
        />
        <button type="button" @click="emit('update:showPwNew', !showPwNew)" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
          <svg v-if="!showPwNew" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
        </button>
      </div>
    </div>

    <!-- Konfirmasi Password -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-semibold vt-label">Konfirmasi Password Baru</label>
      <div class="relative">
        <input
          :value="pwConfirm"
          @input="emit('update:pwConfirm', ($event.target as HTMLInputElement).value)"
          :type="showPwConfirm ? 'text' : 'password'"
          placeholder="Ketik ulang password baru"
          class="vt-input pr-10"
          autocomplete="new-password"
        />
        <button type="button" @click="emit('update:showPwConfirm', !showPwConfirm)" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
          <svg v-if="!showPwConfirm" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
        </button>
      </div>
    </div>

    <!-- Feedback -->
    <p v-if="pwMsg" class="text-sm font-medium px-4 py-2 rounded-lg" :class="pwMsgType === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'">
      {{ pwMsg }}
    </p>

    <button
      @click="emit('change-password')"
      :disabled="pwSaving"
      class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
    >
      <svg v-if="pwSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
      {{ pwSaving ? 'Menyimpan...' : 'Ubah Password' }}
    </button>
  </div>

  <!-- Lupa Password Link -->
  <div class="vt-card p-6 md:p-8 flex flex-col gap-3">
    <h2 class="font-bold text-base vt-text-primary">Lupa Password?</h2>
    <p class="text-sm vt-text-muted">Jika kamu lupa password lama, kamu bisa reset melalui email.</p>
    <NuxtLink
      to="/auth/forgot-password"
      class="text-sm font-semibold text-blue-700 dark:text-sky-400 hover:underline self-start"
    >
      Kirim Link Reset Password →
    </NuxtLink>
  </div>
</template>

<style scoped>
.vt-card { background: #ffffff; border: 1px solid rgba(0,0,0,0.07); border-radius: 1rem; }
.dark .vt-card { background: #0d1829; border-color: rgba(255,255,255,0.07); }
.vt-text-primary { color: #0f172a; }
.dark .vt-text-primary { color: #f1f5f9; }
.vt-text-muted { color: #6b7280; }
.dark .vt-text-muted { color: #94a3b8; }
.vt-label { color: #374151; }
.dark .vt-label { color: #cbd5e1; }
.vt-input { width: 100%; padding: 0.6rem 0.875rem; border: 1px solid rgba(0,0,0,0.15); border-radius: 0.6rem; font-size: 0.875rem; background: #fff; color: #0f172a; transition: border-color 0.15s; outline: none; }
.vt-input:focus { border-color: #1e3a8a; box-shadow: 0 0 0 3px rgba(30,58,138,0.10); }
.dark .vt-input { background: #0f172a; border-color: rgba(255,255,255,0.12); color: #f1f5f9; }
.dark .vt-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.12); }
.vt-btn-primary { background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); }
.dark .vt-btn-primary { background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8); }
</style>
