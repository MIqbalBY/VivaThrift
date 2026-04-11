<script setup lang="ts">
const props = defineProps<{
  title?: string
  sections: Array<{ id: string, title: string }>
}>()

const activeId = ref('')
let sectionObserver: IntersectionObserver | null = null

function setActiveFromHash() {
  if (!import.meta.client) return
  const hash = window.location.hash.replace('#', '')
  activeId.value = hash || props.sections[0]?.id || ''
}

function observeSections() {
  if (!import.meta.client) return

  sectionObserver?.disconnect()
  const elements = props.sections
    .map(section => document.getElementById(section.id))
    .filter((element): element is HTMLElement => !!element)

  if (!elements.length) return

  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter(entry => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)

      const topEntry = visibleEntries[0]
      if (topEntry?.target?.id) {
        activeId.value = topEntry.target.id
      }
    },
    {
      rootMargin: '-18% 0px -58% 0px',
      threshold: [0.1, 0.4, 0.7],
    },
  )

  elements.forEach(element => sectionObserver?.observe(element))
}

onMounted(async () => {
  setActiveFromHash()
  await nextTick()
  observeSections()
  window.addEventListener('hashchange', setActiveFromHash)
})

onBeforeUnmount(() => {
  sectionObserver?.disconnect()
  window.removeEventListener('hashchange', setActiveFromHash)
})
</script>

<template>
  <div class="vt-help-toc sticky top-24 rounded-3xl p-5 md:p-6">
    <p class="vt-help-toc-label text-xs font-semibold tracking-[0.18em] uppercase mb-4">{{ title ?? 'Daftar Isi' }}</p>
    <nav class="flex flex-col gap-2">
      <a
        v-for="section in sections"
        :key="section.id"
        :href="`#${section.id}`"
        class="vt-help-toc-link rounded-2xl px-4 py-3 text-sm transition-colors"
        :class="{ 'vt-help-toc-link--active': activeId === section.id }"
        :aria-current="activeId === section.id ? 'location' : undefined"
        @click="activeId = section.id"
      >
        {{ section.title }}
      </a>
    </nav>
  </div>
</template>