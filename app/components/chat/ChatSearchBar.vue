<script setup>
defineProps({
  searchOpen: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  searchTotal: { type: Number, default: 0 },
  searchCurrentIdx: { type: Number, default: 0 },
  isDark: { type: Boolean, default: false },
})

const emit = defineEmits(['update:searchQuery', 'go-result', 'toggle-search'])
</script>

<template>
  <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 -translate-y-2" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-2">
    <div
      v-if="searchOpen"
      class="shrink-0 flex items-center gap-2 px-4 py-2 border-b"
      :style="isDark
        ? 'background: #0f1932; border-color: rgba(255,255,255,0.08);'
        : 'background: rgba(255,255,255,0.9); border-color: rgba(30,58,138,0.1);'"
    >
      <div class="flex-1 flex items-center gap-2 rounded-xl px-3 py-2" :style="isDark ? 'background:#0f1932; border:1px solid rgba(255,255,255,0.15);' : 'background:rgba(30,58,138,0.05); border:1px solid rgba(30,58,138,0.12);'">
        <svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
        <input
          id="chat-search-input"
          :value="searchQuery"
          @input="emit('update:searchQuery', $event.target.value)"
          type="text"
          placeholder="Cari pesan..."
          class="flex-1 bg-transparent outline-hidden text-sm placeholder-gray-400"
          :class="isDark ? 'text-white' : 'text-gray-800'"
          @keydown.enter.prevent="emit('go-result', 'next')"
          @keydown.escape="emit('toggle-search')"
        />
        <button v-if="searchQuery" @click="emit('update:searchQuery', '')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <span v-if="searchQuery.trim()" class="text-xs font-medium shrink-0" :class="isDark ? 'text-gray-400' : 'text-gray-500'">{{ searchTotal ? `${searchCurrentIdx + 1}/${searchTotal}` : '0/0' }}</span>
      <button @click="emit('go-result', 'prev')" :disabled="!searchTotal" class="p-1 rounded-sm hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-30" title="Sebelumnya">
        <svg class="w-4 h-4" :class="isDark ? 'text-gray-300' : 'text-gray-600'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
      </button>
      <button @click="emit('go-result', 'next')" :disabled="!searchTotal" class="p-1 rounded-sm hover:bg-gray-100 dark:hover:bg-white/10 transition disabled:opacity-30" title="Berikutnya">
        <svg class="w-4 h-4" :class="isDark ? 'text-gray-300' : 'text-gray-600'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </button>
    </div>
  </Transition>
</template>
