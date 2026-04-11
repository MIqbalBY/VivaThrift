import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    r2AccountId:       process.env.R2_ACCOUNT_ID ?? '',
    r2AccessKeyId:     process.env.R2_ACCESS_KEY_ID ?? '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    r2BucketName:      process.env.R2_BUCKET_NAME ?? 'vivathrift-media',
    r2Endpoint:        process.env.R2_ENDPOINT ?? '',
    r2Region:          process.env.R2_REGION ?? 'auto',
    public: {
      r2PublicUrl: process.env.R2_PUBLIC_URL ?? '',
    },
  },
  site: {
    url: 'https://www.vivathrift.store',
    name: 'VivaThrift',
  },
  css: [
    '~/assets/css/tailwind.css',
    '~/assets/css/fonts.css',
    '~/assets/css/variables.css',
    '~/assets/css/dark-overrides.css',
    '~/assets/css/components.css',
    '~/assets/css/animations.css',
    'leaflet/dist/leaflet.css',
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
    plugins: [tailwindcss() as any],
  },
  supabase: {
    url: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    key: process.env.SUPABASE_KEY || 'placeholder-key',
    redirect: false,
  },
  image: {
    quality: 80,
    format: ['webp', 'avif'],
    domains: ['cdn.vivathrift.store', 'pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev'],
  },
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600] },
      { name: 'Plus Jakarta Sans', provider: 'google', weights: [500, 600, 700] },
    ],
  },
  app: {
    head: {
      title: 'VivaThrift — Marketplace Preloved Khusus Mahasiswa ITS',
      meta: [
        { name: 'theme-color', content: '#1e3a8a' },
      ],
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
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'preconnect', href: 'https://cdn.vivathrift.store' },
        { rel: 'dns-prefetch', href: 'https://cdn.vivathrift.store' },
        { rel: 'preconnect', href: 'https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev' },
        { rel: 'dns-prefetch', href: 'https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev' },
      ]
    }
  },
  routeRules: {
    '/about': { prerender: true },
    '/img/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    // File statis OG image harus public agar WhatsApp/Telegram scraper bisa mengaksesnya
    '/thumbnail.png': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/*.png': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/*.ico': { headers: { 'cache-control': 'public, max-age=86400' } },
    // Paksa semua halaman SSR tidak pernah di-cache oleh Vercel CDN / proxy manapun.
    // Ini mencegah ISR cache poisoning (sesi user A tersimpan & dikirim ke user B).
    '/**': { headers: { 'cache-control': 'private, no-store' } },
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