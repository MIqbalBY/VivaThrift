<script setup>
defineProps({
  userSettings: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-setting'])
</script>

<template>
  <!-- Chat Settings -->
  <div class="vt-card p-6 md:p-8 flex flex-col gap-6">
    <div>
      <h2 class="font-bold text-base vt-text-primary flex items-center gap-2">💬 Pengaturan Chat</h2>
      <p class="text-sm vt-text-muted mt-1">Atur preferensi chat dan privasi pesanmu.</p>
    </div>

    <!-- Chat Popup -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium vt-text-primary">Popup Notifikasi Chat</p>
        <p class="text-xs vt-text-muted mt-0.5">Tampilkan popup saat ada pesan baru di pojok kanan bawah.</p>
      </div>
      <button
        @click="emit('toggle-setting', 'chat_popup')"
        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-hidden"
        :style="userSettings.chat_popup ? (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb)') : ''"
        :class="!userSettings.chat_popup ? 'bg-gray-300 dark:bg-slate-600' : ''"
        role="switch" :aria-checked="userSettings.chat_popup"
      >
        <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out" :class="userSettings.chat_popup ? 'translate-x-5' : 'translate-x-0'" />
      </button>
    </div>

    <div class="border-t border-gray-100 dark:border-slate-700/50"></div>

    <!-- Read Receipts -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium vt-text-primary">Tanda Baca (Read Receipts)</p>
        <p class="text-xs vt-text-muted mt-0.5">Kirim dan tampilkan centang biru saat pesan sudah dibaca. Jika dinonaktifkan, kamu juga tidak bisa melihat tanda baca dari orang lain.</p>
      </div>
      <button
        @click="emit('toggle-setting', 'read_receipts')"
        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-hidden"
        :style="userSettings.read_receipts ? (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb)') : ''"
        :class="!userSettings.read_receipts ? 'bg-gray-300 dark:bg-slate-600' : ''"
        role="switch" :aria-checked="userSettings.read_receipts"
      >
        <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out" :class="userSettings.read_receipts ? 'translate-x-5' : 'translate-x-0'" />
      </button>
    </div>

    <div class="border-t border-gray-100 dark:border-slate-700/50"></div>

    <!-- Online Status -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium vt-text-primary">Status Online</p>
        <p class="text-xs vt-text-muted mt-0.5">Tampilkan status online dan terakhir dilihat ke pengguna lain. Jika dinonaktifkan, kamu juga tidak bisa melihat status online orang lain.</p>
      </div>
      <button
        @click="emit('toggle-setting', 'show_online')"
        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-hidden"
        :style="userSettings.show_online ? (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb)') : ''"
        :class="!userSettings.show_online ? 'bg-gray-300 dark:bg-slate-600' : ''"
        role="switch" :aria-checked="userSettings.show_online"
      >
        <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out" :class="userSettings.show_online ? 'translate-x-5' : 'translate-x-0'" />
      </button>
    </div>
  </div>

  <!-- Notification Settings -->
  <div class="vt-card p-6 md:p-8 flex flex-col gap-6">
    <div>
      <h2 class="font-bold text-base vt-text-primary flex items-center gap-2">🔔 Pengaturan Notifikasi</h2>
      <p class="text-sm vt-text-muted mt-1">Atur notifikasi yang ingin kamu terima.</p>
    </div>

    <!-- Product Notifications -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium vt-text-primary">Notifikasi Produk</p>
        <p class="text-xs vt-text-muted mt-0.5">Terima notifikasi tentang produk baru, restock, dan stok habis di panel lonceng.</p>
      </div>
      <button
        @click="emit('toggle-setting', 'notif_product')"
        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-hidden"
        :style="userSettings.notif_product ? (isDark ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8)' : 'background: linear-gradient(135deg,#1e3a8a,#2563eb)') : ''"
        :class="!userSettings.notif_product ? 'bg-gray-300 dark:bg-slate-600' : ''"
        role="switch" :aria-checked="userSettings.notif_product"
      >
        <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out" :class="userSettings.notif_product ? 'translate-x-5' : 'translate-x-0'" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.vt-card { background: #ffffff; border: 1px solid rgba(0,0,0,0.07); border-radius: 1rem; }
.dark .vt-card { background: #0d1829; border-color: rgba(255,255,255,0.07); }
.vt-text-primary { color: #0f172a; }
.dark .vt-text-primary { color: #f1f5f9; }
.vt-text-muted { color: #6b7280; }
.dark .vt-text-muted { color: #94a3b8; }
</style>
