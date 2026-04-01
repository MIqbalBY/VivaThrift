<script setup>
defineProps({
  replyingTo: { type: Object, default: null },
  messageText: { type: String, default: '' },
  sending: { type: Boolean, default: false },
  isDark: { type: Boolean, default: false },
  isBuyer: { type: Boolean, default: false },
  isNegotiable: { type: Boolean, default: false },
  productAvailable: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:messageText', 'send', 'input-keydown',
  'cancel-reply', 'open-offer',
])
</script>

<template>
  <div
    class="shrink-0 border-t"
    :style="isDark
      ? 'background: rgba(15,25,50,0.90); backdrop-filter: blur(12px); border-color: rgba(255,255,255,0.08);'
      : 'background: rgba(255,255,255,0.9); backdrop-filter: blur(12px); border-color: rgba(30,58,138,0.1);'"
  >
    <!-- Reply preview strip -->
    <div v-if="replyingTo" class="flex items-center gap-2 px-4 pt-2 pb-0">
      <div class="flex-1 flex items-center gap-2 rounded-xl px-3 py-1.5 border-l-2 border-blue-400 bg-blue-50 dark:bg-sky-900/20">
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-blue-700 dark:text-sky-400 truncate">&#8618; {{ replyingTo.sender_name }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ (replyingTo.content ?? '').slice(0, 60) }}</p>
        </div>
        <button @click="emit('cancel-reply')" class="shrink-0 text-gray-400 hover:text-red-400 transition text-base leading-none">&times;</button>
      </div>
    </div>

    <div class="flex items-end gap-2 px-4 py-3">
      <!-- Offer button (buyer + negotiable + still has stock only) -->
      <button
        v-if="isBuyer && isNegotiable && productAvailable"
        @click="emit('open-offer')"
        class="shrink-0 p-2.5 rounded-xl border border-blue-200 dark:border-sky-400 text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-sky-400/10 transition text-sm"
        title="Ajukan penawaran"
      >
        🤝
      </button>

      <textarea
        :value="messageText"
        @input="emit('update:messageText', $event.target.value)"
        @keydown="emit('input-keydown', $event)"
        rows="1"
        placeholder="Ketik pesan..."
        class="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none border transition text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 border-gray-200 dark:border-white/10 focus:border-blue-400 dark:focus:border-blue-500"
        :style="isDark ? 'max-height: 120px; background: rgba(255,255,255,0.07);' : 'max-height: 120px; background: rgba(255,255,255,0.8);'"
      />

      <button
        @click="emit('send')"
        :disabled="!messageText.trim() || sending"
        class="shrink-0 p-2.5 rounded-xl text-white transition disabled:opacity-40"
        :style="isDark
          ? 'background: linear-gradient(135deg,#0ea5e9,#38bdf8);'
          : 'background: linear-gradient(135deg,#1e3a8a,#2563eb);'"
      >
        <svg v-if="!sending" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
        <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </button>
    </div>
  </div>
</template>
