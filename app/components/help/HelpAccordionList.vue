<script setup lang="ts">
interface HelpAccordionItem {
  id: number
  title: string
  body: string
  tag?: string
}

const props = defineProps<{
  items: HelpAccordionItem[]
}>()

const openItem = ref<number | null>(props.items[0]?.id ?? null)

function toggle(id: number) {
  openItem.value = openItem.value === id ? null : id
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <article
      v-for="item in items"
      :key="item.id"
      class="vt-help-article-card rounded-3xl overflow-hidden"
    >
      <button
        type="button"
        class="w-full px-6 py-5 md:px-7 md:py-6 text-left flex items-start justify-between gap-4"
        @click="toggle(item.id)"
      >
        <div>
          <span v-if="item.tag" class="vt-help-article-tag inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold mb-3">
            {{ item.tag }}
          </span>
          <h3 class="vt-help-article-title text-base md:text-lg font-bold leading-snug">{{ item.title }}</h3>
        </div>
        <span class="vt-help-article-toggle flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-transform duration-300" :class="{ 'rotate-45': openItem === item.id }">
          +
        </span>
      </button>

      <div v-show="openItem === item.id" class="px-6 pb-6 md:px-7 md:pb-7">
        <div class="vt-help-divider border-t mb-5"></div>
        <p class="vt-help-article-body text-sm md:text-base leading-relaxed">{{ item.body }}</p>
      </div>
    </article>
  </div>
</template>