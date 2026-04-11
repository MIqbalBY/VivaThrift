<script setup lang="ts">
defineProps<{
  title?: string
  sections: Array<{ id: string, title: string }>
}>()
</script>

<template>
  <div class="vt-help-toc sticky top-24 rounded-3xl p-5">
    <p class="vt-help-toc-label text-xs font-semibold tracking-[0.18em] uppercase mb-4">{{ title ?? 'Daftar Isi' }}</p>
    <nav class="flex flex-col gap-1.5">
      <a
        v-for="section in sections"
        :key="section.id"
        :href="`#${section.id}`"
        class="vt-help-toc-link rounded-xl px-3 py-2 text-sm transition-colors"
      >
        {{ section.title }}
      </a>
    </nav>
  </div>
</template>