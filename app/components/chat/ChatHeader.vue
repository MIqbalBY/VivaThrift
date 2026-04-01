<script setup>
const props = defineProps({
  chat: { type: Object, default: null },
  otherParty: { type: Object, default: null },
  otherOnline: { type: Boolean, default: false },
  otherStatusText: { type: String, default: '' },
  productCover: { type: String, default: null },
  productSlug: { type: String, default: null },
  productAvailable: { type: Boolean, default: true },
  localProductStock: { type: Number, default: null },
  searchOpen: { type: Boolean, default: false },
  isDark: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-search', 'show-profile'])

function avatarInitial(name) {
  return (name ?? '?')[0].toUpperCase()
}
</script>

<template>
  <div
    class="shrink-0 flex items-center gap-3 px-4 py-3 border-b"
    :style="isDark
      ? 'background: rgba(15,25,50,0.90); backdrop-filter: blur(12px); border-color: rgba(255,255,255,0.08);'
      : 'background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border-color: rgba(30,58,138,0.1);'"
  >
    <button @click="$router.back()" class="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-white/10 transition text-gray-500 dark:text-gray-300">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
      </svg>
    </button>

    <!-- Product thumbnail -->
    <NuxtLink :to="productSlug ? `/products/${productSlug}` : '#'" class="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-white/10 shrink-0">
      <img v-if="productCover" :src="productCover" :alt="chat?.product?.title" width="48" height="48" loading="lazy" class="w-full h-full object-cover"/>
      <div v-else class="w-full h-full flex items-center justify-center text-lg">📷</div>
    </NuxtLink>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <NuxtLink
        :to="productSlug ? `/products/${productSlug}` : '#'"
        class="font-semibold text-sm text-gray-800 dark:text-white truncate hover:text-blue-600 dark:hover:text-sky-400 transition block"
      >{{ chat?.product?.title }}</NuxtLink>
      <div class="flex items-center gap-2 mt-0.5">
        <button
          v-if="otherParty"
          @click="emit('show-profile', otherParty.id)"
          class="shrink-0 w-7 h-7 rounded-full overflow-hidden bg-gray-200 dark:bg-white/10 hover:ring-2 ring-sky-400 transition"
        >
          <img v-if="otherParty.avatar_url" :src="otherParty.avatar_url" :alt="otherParty.name" width="36" height="36" loading="lazy" class="w-full h-full object-cover" />
          <span v-else class="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-300">{{ avatarInitial(otherParty.name) }}</span>
        </button>
        <div class="min-w-0">
          <button
            v-if="otherParty"
            @click="emit('show-profile', otherParty.id)"
            class="text-xs text-gray-400 hover:text-sky-400 dark:hover:text-sky-400 transition truncate max-w-full text-left block leading-tight"
          >{{ otherParty.name }}</button>
          <p v-if="otherStatusText" class="text-[10px] leading-tight" :class="otherOnline ? 'text-green-500 font-medium' : 'text-gray-400 dark:text-gray-500'">{{ otherStatusText }}</p>
          <p v-else-if="!otherParty" class="text-xs text-gray-400">...</p>
        </div>
      </div>
    </div>

    <!-- Price badge -->
    <div class="shrink-0 text-right">
      <p v-if="!productAvailable" class="text-xs font-bold text-red-500">Stok habis</p>
      <template v-else>
        <p class="text-xs font-bold text-blue-900 dark:text-sky-400">
          Rp {{ (chat?.product?.price ?? 0).toLocaleString('id-ID') }}
        </p>
        <p v-if="localProductStock !== null && localProductStock !== undefined" class="text-xs text-gray-400 dark:text-gray-500">Stok: {{ localProductStock }}</p>
        <p v-if="chat?.product?.is_negotiable" class="text-xs text-green-500">🤝 Bisa Nego</p>
      </template>
    </div>

    <!-- Search toggle -->
    <button @click="emit('toggle-search')" class="p-1.5 rounded-lg transition shrink-0" :class="searchOpen ? 'bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
    </button>
  </div>
</template>
