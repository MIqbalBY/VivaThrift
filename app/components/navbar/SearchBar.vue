<script setup lang="ts">
const { isDark } = useDarkMode()
const {
  searchQuery, showSearchDropdown, searchFormRef,
  suggestions, isSearching, filteredRecent, showDropdown,
  handleSearch, selectSuggestion, selectRecent, removeRecent, clearRecent, getSuggestionImage,
  initRecentSearches,
} = useNavSearch()

onMounted(() => {
  initRecentSearches()
  document.addEventListener('click', handleOutsideClick)
})
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

function handleOutsideClick(e: MouseEvent) {
  if (searchFormRef.value && !searchFormRef.value.contains(e.target as Node)) {
    showSearchDropdown.value = false
  }
}
</script>

<template>
  <div ref="searchFormRef" class="flex-1 relative hidden md:block">
    <form @submit.prevent="handleSearch" class="vt-search-form flex items-stretch border border-gray-300 rounded-lg overflow-hidden focus-within:border-blue-700 transition-colors" :class="showDropdown ? 'rounded-b-none border-b-0' : ''">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Cari di VivaThrift"
        class="vt-search-input flex-1 px-4 py-2.5 text-sm text-gray-800 bg-transparent focus:outline-hidden placeholder-gray-400"
        @focus="showSearchDropdown = true"
        @keydown.escape="showSearchDropdown = false"
        autocomplete="off"
      />
      <button
        v-if="searchQuery"
        type="button"
        @click="searchQuery = ''; showSearchDropdown = true"
        class="px-2 text-gray-400 hover:text-gray-600 transition"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      <button type="submit" class="vt-search-submit-btn px-4 py-2.5 text-white transition hover:opacity-90 flex items-center justify-center shrink-0">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
        </svg>
      </button>
    </form>

    <!-- Search Dropdown -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="showDropdown"
        class="vt-glass-dropdown absolute left-0 right-0 top-full rounded-b-lg z-50 py-1 max-h-[420px] overflow-y-auto" :style="isDark
          ? 'background: rgba(15,23,42,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-top: none; box-shadow: 0 8px 32px rgba(0,0,0,0.4);'
          : 'background: rgba(255,255,255,0.90); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(30,58,138,0.12); border-top: none; box-shadow: 0 8px 32px rgba(30,58,138,0.12);'"
      >

        <!-- Live Suggestions -->
        <template v-if="searchQuery.trim()">
          <!-- Loading -->
          <div v-if="isSearching" class="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Mencari...
          </div>

          <!-- Results -->
          <template v-else-if="suggestions.length">
            <div class="px-4 py-1.5">
              <span class="text-xs text-gray-400 font-medium">Produk</span>
            </div>
            <button
              v-for="product in suggestions"
              :key="product.id"
              @click="selectSuggestion(product)"
              class="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <div class="w-9 h-9 rounded-sm shrink-0 overflow-hidden bg-gray-100">
                <img v-if="getSuggestionImage(product)" :src="getSuggestionImage(product)" width="40" height="40" loading="lazy" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full bg-gray-200"></div>
              </div>
              <div class="flex-1 min-w-0 text-left">
                <p class="truncate font-medium">{{ product.title }}</p>
                <p class="text-xs text-blue-900 font-semibold">Rp {{ product.price?.toLocaleString('id-ID') }}</p>
              </div>
              <svg class="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
              </svg>
            </button>
            <!-- Lihat semua hasil -->
            <button
              @click="handleSearch"
              class="w-full text-left px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 transition border-t border-gray-100 mt-1 font-medium"
            >
              Lihat semua hasil untuk &ldquo;{{ searchQuery.trim() }}&rdquo;
            </button>
          </template>

          <!-- Tidak ada hasil -->
          <div v-else class="px-4 py-3 text-sm text-gray-400">
            Tidak ada produk untuk &ldquo;{{ searchQuery.trim() }}&rdquo;
          </div>
        </template>

        <!-- Recent Searches -->
        <template v-if="!searchQuery.trim() && filteredRecent.length">
          <div class="flex items-center justify-between px-4 py-1.5">
            <span class="text-xs text-gray-400 font-medium">Pencarian Terakhir</span>
            <button @click="clearRecent" class="text-xs text-blue-600 hover:underline">Hapus Semua</button>
          </div>
          <button
            v-for="item in filteredRecent"
            :key="item"
            @click="selectRecent(item)"
            class="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition group"
          >
            <div class="flex items-center gap-2 min-w-0">
              <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="truncate">{{ item }}</span>
            </div>
            <button
              @click="(e: any) => removeRecent(item, e)"
              class="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition shrink-0"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </button>
        </template>

      </div>
    </Transition>
  </div>
</template>
