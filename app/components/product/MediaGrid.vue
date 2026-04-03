<script setup>
const props = defineProps({
  mediaList: { type: Array, default: () => [] },
  photoCount: { type: Number, default: 0 },
  videoCount: { type: Number, default: 0 },
  photoMax: { type: Number, default: 5 },
  videoMax: { type: Number, default: 1 },
  disabled: Boolean,
})

const emit = defineEmits(['open-viewer', 'set-cover', 'remove', 'open-thumb-picker', 'file-input'])

const mediaInput = ref(null)

function triggerFileInput() {
  mediaInput.value?.click()
}
</script>

<template>
  <div>
    <label class="block text-sm font-semibold text-gray-700 mb-1">
      Foto &amp; Video <span class="text-red-500">*</span>
      <span class="text-gray-400 font-normal ml-1">
        ({{ photoCount }}/{{ photoMax }} foto · {{ videoCount }}/{{ videoMax }} video)
      </span>
    </label>

    <!-- Thumbnail grid -->
    <div v-if="mediaList.length > 0" class="grid grid-cols-3 gap-2 mb-2">
      <div
        v-for="(media, index) in mediaList"
        :key="index"
        class="relative group"
      >
        <!-- 1:1 thumbnail -->
        <div
          class="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer border-2 transition"
          :class="media.isCover ? 'border-blue-700 dark:border-sky-400' : 'border-transparent hover:border-gray-300'"
          @click="emit('open-viewer', index)"
        >
          <img
            v-if="media.type === 'image'"
            :src="media.preview"
            width="200"
            height="200"
            loading="lazy"
            class="w-full h-full object-cover"
            alt=""
          />
          <img
            v-else-if="media.thumbnail"
            :src="media.thumbnail"
            width="200"
            height="200"
            loading="lazy"
            class="w-full h-full object-cover"
            alt=""
          />
          <video
            v-else
            :src="media.preview"
            class="w-full h-full object-cover"
            muted
            preload="metadata"
          />
          <!-- Play icon overlay for video -->
          <div v-if="media.type === 'video'" class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="bg-black/50 rounded-full p-2">
              <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <!-- Cover badge -->
          <div v-if="media.isCover" class="absolute top-1 left-1 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm pointer-events-none bg-gradient-to-r from-[#162d6e] via-blue-800 to-blue-700 dark:from-sky-500 dark:via-sky-400 dark:to-cyan-400">COVER</div>
        </div>

        <!-- Hover actions -->
        <div class="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            v-if="!media.isCover && (media.type === 'image' || media.thumbnail)"
            type="button"
            title="Jadikan cover"
            @click.stop="emit('set-cover', index)"
            class="bg-white rounded-full p-1 shadow-sm hover:bg-yellow-50"
          >
            <svg class="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
          <button
            v-if="media.type === 'video'"
            type="button"
            title="Pilih thumbnail"
            @click.stop="emit('open-thumb-picker', index)"
            class="bg-white dark:bg-gray-700 rounded-full p-1 shadow-sm hover:bg-blue-50 dark:hover:bg-gray-600"
          >
            <svg class="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
          </button>
          <button
            type="button"
            title="Hapus"
            @click.stop="emit('remove', index)"
            class="bg-white rounded-full p-1 shadow-sm hover:bg-red-50"
          >
            <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Add more slot -->
      <div
        v-if="photoCount < photoMax || videoCount < videoMax"
        class="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-700 hover:text-blue-700 transition text-gray-400"
        @click="triggerFileInput"
      >
        <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        <span class="text-[10px] mt-1 font-medium">Tambah</span>
      </div>
    </div>

    <!-- Empty drop zone -->
    <div
      v-if="mediaList.length === 0"
      class="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#1e3a8a] transition"
      @click="triggerFileInput"
    >
      <p class="text-3xl mb-2">📷</p>
      <p class="text-sm text-gray-500 font-medium">Klik untuk upload foto atau video</p>
      <p class="text-xs text-gray-400 mt-1">Maks {{ photoMax }} foto (JPG/PNG/WebP · 4 MB) &nbsp;·&nbsp; Maks {{ videoMax }} video (MP4/MOV · 20 MB)</p>
    </div>

    <input
      ref="mediaInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
      multiple
      class="hidden"
      @change="emit('file-input', $event)"
      :disabled="disabled"
    />
    <p v-if="mediaList.length > 0" class="text-xs text-gray-400 mt-1.5">Klik thumbnail untuk pratinjau · Hover untuk aksi · ⭐ untuk jadikan cover</p>
  </div>
</template>
