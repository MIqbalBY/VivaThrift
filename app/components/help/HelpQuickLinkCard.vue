<script setup lang="ts">
defineProps<{
  to: string
  title: string
  desc: string
  badge?: string
}>()
</script>

<template>
  <NuxtLink :to="to" class="vt-help-quick-card rounded-2xl p-4 transition-all block">
    <div class="flex items-center justify-between gap-4 mb-2">
      <h4 class="vt-help-quick-title text-sm font-bold">{{ title }}</h4>
      <span v-if="badge" class="vt-help-quick-badge text-[11px] font-semibold rounded-full px-2.5 py-1">{{ badge }}</span>
    </div>
    <p class="vt-help-quick-desc text-sm leading-relaxed">{{ desc }}</p>
  </NuxtLink>
</template>