<script setup>
const siteUrl = 'https://vivathrift.store'
const defaultTitle = 'VivaThrift — Marketplace Preloved Mahasiswa ITS'
const defaultDesc = 'Cari dan jual barang bekas berkualitas khusus untuk mahasiswa ITS Surabaya. Fashion, elektronik, buku, dan lainnya dengan harga terjangkau.'

useSeoMeta({
  titleTemplate: (title) => title?.includes('VivaThrift') ? title : `${title} — VivaThrift`,
  description: defaultDesc,
  ogType: 'website',
  ogTitle: defaultTitle,
  ogDescription: defaultDesc,
  ogImage: `${siteUrl}/img/thumbnail.jpeg`,
  ogUrl: siteUrl,
  ogSiteName: 'VivaThrift',
  twitterCard: 'summary_large_image',
  twitterTitle: defaultTitle,
  twitterDescription: defaultDesc,
  twitterImage: `${siteUrl}/img/thumbnail.jpeg`,
})

useHead({
  htmlAttrs: { lang: 'id' },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
