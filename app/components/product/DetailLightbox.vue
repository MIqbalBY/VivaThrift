<script setup>
const props = defineProps({
  show:         { type: Boolean, default: false },
  media:        { type: Array,   required: true },
  activeIndex:  { type: Number,  default: 0 },
  productTitle: { type: String,  default: '' },
})

const emit = defineEmits(['close', 'update:activeIndex'])

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
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[9998] bg-black flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <!-- Close -->
        <button @click="emit('close')" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <!-- Counter -->
        <span v-if="media.length > 1" class="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-3 py-1 rounded-full">
          {{ activeIndex + 1 }} / {{ media.length }}
        </span>

        <!-- Prev -->
        <button v-if="media.length > 1" @click="prev" class="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>

        <!-- Media -->
        <template v-if="activeMedia">
          <VideoPlayer
            v-if="activeMedia.isVideo"
            :src="activeMedia.url"
            autoplay
            video-class="max-w-[85vw] max-h-[75vh] object-contain select-none"
            class="rounded-lg"
          />
          <img
            v-else
            :src="activeMedia.url"
            :alt="productTitle"
            loading="lazy"
            class="max-w-[85vw] max-h-[75vh] object-contain rounded-lg select-none"
          />
        </template>

        <!-- Next -->
        <button v-if="media.length > 1" @click="next" class="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
