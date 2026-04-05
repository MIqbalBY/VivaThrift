import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  site: {
    url: 'https://vivathrift.store',
    name: 'VivaThrift',
  },
  css: [
    '~/assets/css/tailwind.css',
    '~/assets/css/fonts.css',
    '~/assets/css/variables.css',
    '~/assets/css/dark-overrides.css',
    '~/assets/css/components.css',
    '~/assets/css/animations.css',
  ],
  compatibilityDate: '2026-04-04',
  devServer: { port: 3004 },
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  modules: [
    '@nuxtjs/supabase',
    '@nuxt/image',
    '@nuxt/fonts',
    '@vercel/analytics',
    '@vercel/speed-insights',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  supabase: {
    redirect: false
  },
  image: {
    quality: 80,
    format: ['webp', 'avif'],
    domains: ['jwnisdkjgqnoergsoorf.supabase.co'],
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
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/img/logo-vivathrift.png' },
        { rel: 'preconnect', href: 'https://jwnisdkjgqnoergsoorf.supabase.co' },
        { rel: 'dns-prefetch', href: 'https://jwnisdkjgqnoergsoorf.supabase.co' },
      ]
    }
  },
  routeRules: {
    '/about': { prerender: true },
    '/img/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  },
  $production: {
    routeRules: {
      '/': { isr: 3600 },
      '/products/**': { isr: 1800 },
      '/profile/**': { isr: 1200 },
    },
  },
  nitro: {
    compressPublicAssets: true,
  },
  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    xslColumns: [
      { label: 'URL', width: '65%' },
      { label: 'Last Modified', select: 'sitemap:lastmod', width: '25%' },
    ],
    exclude: ['/auth/**', '/chat/**', '/checkout', '/profile/edit', '/products/create', '/products/edit/**'],
  },
  robots: {
    disallow: ['/auth/', '/chat/', '/checkout', '/profile/edit', '/products/create', '/products/edit/'],
  },
})