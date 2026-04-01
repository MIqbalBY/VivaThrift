<script setup>
defineProps({
  show: Boolean,
  mediaList: { type: Array, default: () => [] },
  currentIndex: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'prev', 'next'])
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      @click.self="emit('close')"
    >
      <!-- Close -->
      <button type="button" @click="emit('close')" class="absolute top-4 right-4 text-white hover:text-gray-300 z-10">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>

      <!-- Prev -->
      <button
        v-if="mediaList.length > 1"
        type="button"
        @click="emit('prev')"
        class="absolute left-4 text-white hover:text-gray-300 z-10"
      >
        <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>

      <!-- Viewer -->
      <div class="max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden flex items-center justify-center">
        <img
          v-if="mediaList[currentIndex]?.type === 'image'"
          :src="mediaList[currentIndex]?.preview"
          class="block max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
          alt=""
        />
        <VideoPlayer
          v-else
          :src="mediaList[currentIndex]?.preview"
          autoplay
          video-class="block max-w-[90vw] max-h-[90vh]"
        />
      </div>

      <!-- Next -->
      <button
        v-if="mediaList.length > 1"
        type="button"
        @click="emit('next')"
        class="absolute right-4 text-white hover:text-gray-300 z-10"
      >
        <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>

      <!-- Dots + counter -->
      <div class="absolute bottom-5 left-0 right-0 flex flex-col items-center gap-1.5">
        <div class="flex gap-1.5">
          <span
            v-for="(m, i) in mediaList"
            :key="i"
            class="w-2 h-2 rounded-full transition"
            :class="i === currentIndex ? 'bg-white' : 'bg-white/35'"
          />
        </div>
        <span class="text-white/60 text-xs">{{ currentIndex + 1 }} / {{ mediaList.length }}</span>
        <span v-if="mediaList[currentIndex]?.isCover" class="text-yellow-400 text-xs font-bold">⭐ Cover</span>
      </div>
    </div>
  </Teleport>
</template>
