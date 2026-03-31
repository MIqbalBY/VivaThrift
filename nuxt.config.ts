// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/variables.css',
    '~/assets/css/dark-overrides.css',
    '~/assets/css/components.css',
  ],
  compatibilityDate: '2025-07-15',
  devServer: { port: 3004 },
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase', '@vercel/analytics', '@vercel/speed-insights'],
  supabase: {
    redirect: false
  },
  app: {
    head: {
      title: 'VivaThrift - Situs Jual Beli Barang Preloved di ITS!',
      link: [
        { rel: 'icon', type: 'image/png', href: '/img/Logo VivaThrift.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap' }
      ]
    }
  }
})