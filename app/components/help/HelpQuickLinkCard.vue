<script setup lang="ts">
defineProps<{
  to: string
  title: string
  desc: string
  badge?: string
}>()
</script>

<template>
  <NuxtLink :to="to" class="vt-help-quick-card rounded-[1.35rem] p-5 transition-all block group">
    <div class="flex items-center justify-between gap-4 mb-3">
      <h4 class="vt-help-quick-title text-lg font-bold leading-snug">{{ title }}</h4>
      <span v-if="badge" class="vt-help-quick-badge text-[11px] font-semibold rounded-full px-3 py-1.5 shrink-0">{{ badge }}</span>
    </div>
    <p class="vt-help-quick-desc text-[15px] leading-8">{{ desc }}</p>
    <div class="mt-4 flex items-center gap-2 text-sm font-semibold vt-ql-link">
      <span>Buka halaman</span>
      <span class="transition-transform duration-200 group-hover:translate-x-1">→</span>
    </div>
  </NuxtLink>
</template>