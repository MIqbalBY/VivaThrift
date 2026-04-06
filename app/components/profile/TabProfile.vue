<script setup lang="ts">
import { facultyAcronym } from '~/data/faculties'

const props = defineProps({
  name: { type: String, default: '' },
  username: { type: String, default: '' },
  faculty: { type: String, default: '' },
  department: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  nrp: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  gender: { type: String, default: '' },
  bio: { type: String, default: '' },
  profileLoading: { type: Boolean, default: false },
  profileSaving: { type: Boolean, default: false },
  profileMsg: { type: String, default: '' },
  profileMsgType: { type: String, default: '' },
  usernameError: { type: String, default: '' },
  usernameChecking: { type: Boolean, default: false },
  avatarUploading: { type: Boolean, default: false },
  myRating: { type: Number, default: null },
  myRatingCount: { type: Number, default: 0 },
  isDark: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:name', 'update:username', 'update:gender', 'update:bio',
  'save-profile', 'open-avatar-input', 'delete-avatar',
])

const localName = computed({
  get: () => props.name,
  set: (v) => emit('update:name', v),
})
const localUsername = computed({
  get: () => props.username,
  set: (v) => emit('update:username', v),
})
const localGender = computed({
  get: () => props.gender,
  set: (v) => emit('update:gender', v),
})
const localBio = computed({
  get: () => props.bio,
  set: (v) => emit('update:bio', v),
})
</script>

<template>
  <div v-if="profileLoading" class="flex justify-center py-16">
    <svg class="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  </div>

  <template v-else>
    <!-- Avatar Section -->
    <div class="vt-card p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6">
      <div class="relative group shrink-0">
        <div class="w-24 h-24 rounded-full overflow-hidden ring-4 ring-blue-100 dark:ring-blue-900/40">
          <img v-if="avatarUrl" :src="avatarUrl" alt="Foto profil" width="96" height="96" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-3xl font-bold text-white"
               :style="isDark ? 'background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc)' : 'background: linear-gradient(135deg, #162d6e, #1e3a8a, #1e40af)'">
            {{ name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?' }}
          </div>
        </div>
        <!-- Camera overlay -->
        <button
          @click="emit('open-avatar-input')"
          :disabled="avatarUploading"
          class="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer"
          title="Ubah foto"
        >
          <svg v-if="!avatarUploading" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.577.360-.463.705a2.31 2.31 0 002.455 1.538l.06-.007M6.827 6.175C7.38 5.99 7.887 5.6 8.245 5.068A2.31 2.31 0 0110.44 4h3.12a2.31 2.31 0 012.195 1.068c.357.533.865.922 1.418 1.107m-10.346 0v.007m10.346-.007v.007m0 0A2.31 2.31 0 0118.814 7.23c.38.054.577.360.463.705a2.31 2.31 0 01-2.455 1.538l-.06-.007M12 13.5a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12z"/>
          </svg>
          <svg v-else class="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </button>
      </div>
      <div class="flex flex-col items-start gap-1">
        <p class="font-bold text-base vt-text-primary truncate flex items-center gap-1.5">
          {{ name || '—' }}
          <span v-if="gender === 'Laki-laki'" title="Laki-laki">♂️</span>
          <span v-else-if="gender === 'Perempuan'" title="Perempuan">♀️</span>
        </p>
        <p class="text-xs text-gray-500 dark:text-slate-400 truncate">
          <span v-if="username" class="text-blue-600 dark:text-sky-400 font-medium">@{{ username }}</span>
          <template v-else>{{ nrp || '-' }}</template>
          <template v-if="faculty || department">
            ({{ [facultyAcronym(faculty), department].filter(Boolean).join(' - ') }})
          </template>
        </p>
        <div class="flex items-center gap-1 mt-0.5 w-full">
          <svg class="w-3 h-3 text-yellow-400 fill-current shrink-0" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <span v-if="myRatingCount > 0" class="text-xs text-gray-500 dark:text-slate-400">{{ myRating!.toFixed(1) }} / 5.0 · {{ myRatingCount }} ulasan</span>
          <span v-else class="text-xs text-gray-400 dark:text-slate-500">Belum ada ulasan</span>
        </div>
        <div class="mt-2 flex items-center gap-3">
          <button
            @click="emit('open-avatar-input')"
            class="text-xs text-blue-600 dark:text-sky-400 font-medium hover:underline"
          >📷 Ubah Foto Profil</button>
          <button
            v-if="avatarUrl"
            @click="emit('delete-avatar')"
            :disabled="avatarUploading"
            class="text-xs text-red-500 dark:text-red-400 font-medium hover:underline disabled:opacity-50"
          >🗑️ Hapus Foto</button>
        </div>
        <p class="text-xs vt-text-muted opacity-60 mt-0.5">Format JPG/PNG/WebP · Maks. 5 MB</p>
      </div>
    </div>

    <!-- Editable Info -->
    <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
      <h2 class="font-bold text-base vt-text-primary">Informasi Pribadi</h2>

      <!-- Nama -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold vt-label">Nama Lengkap</label>
        <input v-model="localName" type="text" placeholder="Nama lengkapmu" class="vt-input" maxlength="100" />
      </div>

      <!-- Username -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold vt-label">Username</label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm select-none">@</span>
          <input v-model="localUsername" type="text" placeholder="username_kamu" class="vt-input" style="padding-left: 1.75rem" maxlength="30" />
        </div>
        <div v-if="usernameChecking" class="text-xs text-gray-400">Memeriksa...</div>
        <div v-else-if="usernameError" class="text-xs text-red-500 dark:text-red-400">{{ usernameError }}</div>
        <div v-else-if="username && !usernameError" class="text-xs text-gray-400 dark:text-slate-500">Huruf, angka, titik (.) dan underscore (_). 3–30 karakter.</div>
      </div>

      <!-- Bio -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold vt-label">Bio</label>
        <textarea v-model="localBio" placeholder="Tulis biomu di sini... (opsional)" class="vt-input resize-none" maxlength="160" rows="3" />
        <span class="text-xs self-end" :class="isDark ? 'text-gray-500' : 'text-gray-400'">{{ bio.length }}/160</span>
      </div>

      <!-- Jenis Kelamin -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold vt-label">Jenis Kelamin</label>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" v-model="localGender" value="Laki-laki" class="accent-blue-900 w-4 h-4" />
            <span class="text-sm vt-text-primary">Laki-laki</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" v-model="localGender" value="Perempuan" class="accent-blue-900 w-4 h-4" />
            <span class="text-sm vt-text-primary">Perempuan</span>
          </label>
        </div>
      </div>

      <!-- Feedback -->
      <p v-if="profileMsg" class="text-sm font-medium px-4 py-2 rounded-lg" :class="profileMsgType === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'">
        {{ profileMsg }}
      </p>

      <button
        @click="emit('save-profile')"
        :disabled="profileSaving"
        class="vt-btn-primary self-start px-6 py-2.5 rounded-full text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-60"
      >
        <svg v-if="profileSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
        {{ profileSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}
      </button>
    </div>

    <!-- Read-only Identity -->
    <div class="vt-card p-6 md:p-8 flex flex-col gap-5">
      <div class="flex items-center gap-2">
        <h2 class="font-bold text-base vt-text-primary">Informasi Identitas</h2>
        <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
          🔒 Tidak Dapat Diubah
        </span>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold vt-label">Email Institusi</label>
          <div class="vt-input-readonly flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
            </svg>
            <span class="text-sm font-mono truncate">{{ email }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold vt-label">NRP</label>
          <div class="vt-input-readonly flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"/>
            </svg>
            <span class="text-sm font-mono">{{ nrp }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold vt-label">Fakultas</label>
          <div class="vt-input-readonly flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"/>
            </svg>
            <span class="text-sm truncate">{{ faculty || '—' }}</span>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold vt-label">Departemen</label>
          <div class="vt-input-readonly flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/>
            </svg>
            <span class="text-sm truncate">{{ department || '—' }}</span>
          </div>
        </div>
      </div>
      <p class="text-xs vt-text-muted opacity-60">Data identitas dikunci untuk menjaga keamanan ekosistem VivaThrift. Hubungi admin jika ada kesalahan data.</p>
    </div>
  </template>
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
.vt-input-readonly { width: 100%; padding: 0.6rem 0.875rem; border: 1px solid rgba(0,0,0,0.08); border-radius: 0.6rem; font-size: 0.875rem; background: #f8fafc; color: #6b7280; }
.dark .vt-input-readonly { background: #1e293b; border-color: rgba(255,255,255,0.06); color: #64748b; }
.vt-btn-primary { background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af); }
.dark .vt-btn-primary { background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8); }
</style>
