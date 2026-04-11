<script setup lang="ts">
defineProps<{
  id?: string
  title: string
  content: string
}>()
</script>

<template>
  <section :id="id" class="vt-help-section-card rounded-3xl p-7 md:p-9 scroll-mt-28">
    <h2 class="vt-help-section-title text-2xl md:text-[1.75rem] font-bold tracking-tight mb-5 md:mb-6">{{ title }}</h2>
    <div class="vt-help-divider border-t mb-5 md:mb-6"></div>
    <p class="vt-help-section-body text-[15px] md:text-base leading-8 whitespace-pre-line">{{ content }}</p>
  </section>
</template>