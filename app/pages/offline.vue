<script setup lang="ts">
definePageMeta({ layout: false })

function retry() {
  window.location.href = '/'
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-indigo-50 dark:bg-gray-950 px-4">
    <div class="text-center max-w-sm">
      <div class="text-6xl mb-6">📡</div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        Tidak Ada Koneksi
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
        Sepertinya kamu sedang offline. Periksa koneksi internetmu dan coba lagi.
      </p>
      <button
        class="px-6 py-3 bg-navy-800 text-white font-semibold rounded-xl hover:bg-navy-700 transition-colors"
        @click="retry"
      >
        Coba Lagi
      </button>
    </div>
  </div>
</template>
