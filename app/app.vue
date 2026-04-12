<script setup>
const siteUrl = 'https://www.vivathrift.store'
const defaultTitle = 'VivaThrift — Marketplace Preloved Khusus Mahasiswa ITS'
const defaultDesc = 'Cari dan jual barang preloved berkualitas khusus untuk mahasiswa ITS. Fashion, elektronik, buku, dan lainnya dengan harga terjangkau.'
const defaultOgImage = `${siteUrl}/img/logo-vivathrift.png`

useSeoMeta({
  titleTemplate: (title) => title?.includes('VivaThrift') ? title : `${title} — VivaThrift`,
  description: defaultDesc,
  ogType: 'website',
  ogTitle: defaultTitle,
  ogDescription: defaultDesc,
  ogImage: defaultOgImage,
  ogUrl: siteUrl,
  ogSiteName: 'VivaThrift',
  twitterCard: 'summary_large_image',
  twitterTitle: defaultTitle,
  twitterDescription: defaultDesc,
  twitterImage: defaultOgImage,
})

const { public: { gaId } } = useRuntimeConfig()

useHead({
  htmlAttrs: { lang: 'id' },
  ...(gaId ? {
    script: [
      { src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`, async: true },
      {
        innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}')`,
        type: 'text/javascript',
      },
    ],
  } : {}),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <AppToast />
</template>
