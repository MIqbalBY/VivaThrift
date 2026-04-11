<script setup lang="ts">
defineProps<{
  id?: string
  title: string
  content: string
}>()
</script>

<template>
  <section :id="id" class="vt-help-section-card rounded-3xl p-8">
    <h2 class="vt-help-section-title text-xl font-bold mb-5">{{ title }}</h2>
    <div class="vt-help-divider border-t mb-5"></div>
    <p class="vt-help-section-body text-sm leading-relaxed whitespace-pre-line">{{ content }}</p>
  </section>
</template>