<script setup lang="ts">
const props = withDefaults(defineProps<{
  badge: string
  title: string
  highlight?: string
  description: string
  meta?: string
  showSearch?: boolean
  searchValue?: string
  searchPlaceholder?: string
  searchMeta?: string
  variant?: 'support' | 'legal' | 'policy' | 'contact'
}>(), {
  highlight: '',
  meta: '',
  showSearch: false,
  searchValue: '',
  searchPlaceholder: 'Cari bantuan...',
  searchMeta: '',
  variant: 'support',
})

const emit = defineEmits<{
  'update:searchValue': [value: string]
}>()

const variantTitle = computed(() => {
  switch (props.variant) {
    case 'legal':
      return 'Dokumen Legal'
    case 'policy':
      return 'Panduan Kebijakan'
    case 'contact':
      return 'Kontak Admin'
    default:
      return 'Pusat Bantuan'
  }
})

const illustrationSrc = computed(() => {
  switch (props.variant) {
    case 'legal':
      return '/img/illustrations/help-legal.svg'
    case 'policy':
      return '/img/illustrations/help-policy.svg'
    case 'contact':
      return '/img/illustrations/help-contact.svg'
    default:
      return '/img/illustrations/help-support.svg'
  }
})
</script>

<template>
  <section class="vt-help-hero relative overflow-hidden pt-28 pb-20 md:pb-24" :data-variant="variant">
    <div class="vt-help-hero-noise absolute inset-0 pointer-events-none"></div>
    <div class="vt-help-hero-orb vt-help-hero-orb--left absolute pointer-events-none"></div>
    <div class="vt-help-hero-orb vt-help-hero-orb--right absolute pointer-events-none"></div>

    <div class="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
      <div class="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10 items-center">
        <div class="text-center lg:text-left max-w-3xl">
          <span class="vt-help-hero-pill inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-[0.18em] uppercase mb-6">
            {{ badge }}
          </span>
          <h1 class="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
            {{ title }}
            <template v-if="highlight">
              <br>
              <span class="vt-help-hero-brand">{{ highlight }}</span>
            </template>
          </h1>
          <p class="text-base md:text-lg text-white/78 leading-relaxed max-w-2xl" :class="{ 'mx-auto lg:mx-0': true }">
            {{ description }}
          </p>
          <p v-if="meta" class="mt-4 text-xs text-white/58">{{ meta }}</p>

          <div v-if="showSearch" class="vt-help-search-shell max-w-2xl rounded-2xl p-3 md:p-4 mt-8">
            <div class="vt-help-search-row flex items-center gap-3 rounded-xl px-4 py-3 md:px-5 md:py-4">
              <span class="text-xl md:text-2xl">🔎</span>
              <input
                :value="searchValue"
                type="text"
                :placeholder="searchPlaceholder"
                class="vt-help-search-input w-full bg-transparent outline-none text-sm md:text-base"
                @input="emit('update:searchValue', ($event.target as HTMLInputElement).value)"
              >
            </div>
            <p v-if="searchMeta" class="vt-help-search-meta text-xs md:text-sm px-1 pt-3">{{ searchMeta }}</p>
          </div>

          <slot name="footer" />
        </div>

        <div class="hidden lg:flex justify-end">
          <div class="vt-help-illustration w-full max-w-[360px] rounded-[2rem] p-5">
            <div class="vt-help-illustration-stage rounded-[1.6rem] p-5 relative overflow-hidden">
              <img :src="illustrationSrc" :alt="variantTitle" class="vt-help-illustration-img" width="320" height="240">
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
