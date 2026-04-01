// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  site: {
    url: 'https://vivathrift.store',
    name: 'VivaThrift',
  },
  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/variables.css',
    '~/assets/css/dark-overrides.css',
    '~/assets/css/components.css',
    '~/assets/css/animations.css',
  ],
  compatibilityDate: '2025-07-15',
  devServer: { port: 3004 },
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    '@nuxt/image',
    '@nuxt/fonts',
    '@vercel/analytics',
    '@vercel/speed-insights',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
  ],
  supabase: {
    redirect: false
  },
  image: {
    quality: 80,
    format: ['webp', 'avif'],
  },
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600] },
      { name: 'Plus Jakarta Sans', provider: 'google', weights: [500, 600, 700] },
    ],
  },
  app: {
    head: {
      title: 'VivaThrift - Situs Jual Beli Barang Preloved di ITS!',
      script: [
        {
          innerHTML: '(function(){try{var d=localStorage.getItem("vt-dark");var p=d!==null?d==="1":window.matchMedia("(prefers-color-scheme:dark)").matches;if(p)document.documentElement.classList.add("dark")}catch(e){}})()',
          type: 'text/javascript',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/img/logo-vivathrift.png' },
        { rel: 'preconnect', href: 'https://jwnisdkjgqnoergsoorf.supabase.co' },
        { rel: 'dns-prefetch', href: 'https://jwnisdkjgqnoergsoorf.supabase.co' },
      ]
    }
  },
  routeRules: {
    '/': { isr: 3600 },
    '/products/**': { isr: 1800 },
    '/profile/**': { isr: 1200 },
    '/about': { prerender: true },
    '/img/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },
  nitro: {
    compressPublicAssets: true,
  },
  sitemap: {
    xslColumns: [
      { label: 'URL', width: '65%' },
      { label: 'Last Modified', select: 'sitemap:lastmod', width: '25%' },
    ],
    exclude: ['/auth/**', '/chat/**', '/checkout', '/profile/edit', '/products/create', '/products/edit/**'],
  },
  robots: {
    disallow: ['/auth/', '/chat/', '/checkout', '/profile/edit', '/products/create', '/products/edit/'],
  },
  experimental: {
    payloadExtraction: true,
  },
})