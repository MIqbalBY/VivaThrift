<script setup>
const props = defineProps({
  media:        { type: Array,   required: true },
  activeIndex:  { type: Number,  default: 0 },
  productTitle: { type: String,  default: '' },
  isOutOfStock: { type: Boolean, default: false },
})

const emit = defineEmits(['update:activeIndex', 'open-lightbox'])

const activeMedia = computed(() => props.media[props.activeIndex] ?? null)

function prev() {
  if (!props.media.length) return
  emit('update:activeIndex', (props.activeIndex - 1 + props.media.length) % props.media.length)
}
function next() {
  if (!props.media.length) return
  emit('update:activeIndex', (props.activeIndex + 1) % props.media.length)
}
</script>

<template>
  <!-- Main image -->
  <div class="relative overflow-hidden rounded-2xl shadow-sm bg-gray-50 group">
    <template v-if="activeMedia">
      <VideoPlayer
        v-if="activeMedia.isVideo"
        :src="activeMedia.url"
        video-class="w-full aspect-square object-contain"
        preload="metadata"
      />
      <NuxtImg
        v-else
        :src="activeMedia.url"
        :alt="productTitle"
        width="600"
        height="600"
        densities="1x 2x"
        format="webp"
        quality="85"
        class="w-full aspect-square object-cover cursor-zoom-in"
        @click="emit('open-lightbox')"
      />
    </template>
    <div v-else class="aspect-square flex items-center justify-center text-gray-300 text-6xl">📷</div>

    <!-- Sold Out overlay -->
    <div v-if="isOutOfStock" class="absolute inset-0 bg-black/50 flex items-center justify-center z-20 pointer-events-none rounded-2xl">
      <span class="text-white text-3xl font-bold tracking-widest uppercase rotate-[-15deg] border-4 border-white px-6 py-2 rounded-lg">Sold Out!</span>
    </div>

    <!-- Nav arrows -->
    <template v-if="media.length > 1">
      <button @click.stop="prev" class="vt-img-nav-btn absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition opacity-0 group-hover:opacity-100 z-10">
        <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <button @click.stop="next" class="vt-img-nav-btn absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition opacity-0 group-hover:opacity-100 z-10">
        <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>
    </template>

    <!-- Expand -->
    <button v-if="!activeMedia?.isVideo" @click.stop="emit('open-lightbox')" class="vt-img-nav-btn absolute bottom-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition opacity-0 group-hover:opacity-100 z-10">
      <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
    </button>

    <!-- Counter -->
    <span v-if="media.length > 1" class="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
      {{ activeIndex + 1 }} / {{ media.length }}
    </span>
  </div>

  <!-- Thumbnail strip -->
  <div v-if="media.length > 1" class="flex gap-2 flex-wrap">
    <button
      v-for="(m, i) in media"
      :key="i"
      @click="emit('update:activeIndex', i)"
      class="w-16 h-16 rounded-xl overflow-hidden border-2 transition relative"
      :class="activeIndex === i ? 'vt-thumb-active border-[#1e3a8a] shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'"
    >
      <img v-if="m.isVideo && m.thumbnailUrl" :src="m.thumbnailUrl" width="64" height="64" loading="lazy" class="w-full h-full object-cover" />
      <video v-else-if="m.isVideo" :src="m.url" class="w-full h-full object-cover" preload="metadata" muted />
      <img v-else :src="m.url" width="64" height="64" loading="lazy" class="w-full h-full object-cover" />
      <div v-if="m.isVideo" class="absolute inset-0 flex items-center justify-center bg-black/20">
        <svg class="w-5 h-5 text-white drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </div>
    </button>
  </div>
  <p v-if="media.length > 1" class="text-xs text-gray-400 px-1">{{ media.length }} media</p>
</template>
