<script setup>
const siteUrl = 'https://www.vivathrift.store'
const defaultTitle = 'VivaThrift — Marketplace Preloved Khusus Mahasiswa ITS'
const defaultDesc = 'Cari dan jual barang preloved berkualitas khusus untuk mahasiswa ITS. Fashion, elektronik, buku, dan lainnya dengan harga terjangkau.'

useSeoMeta({
  titleTemplate: (title) => title?.includes('VivaThrift') ? title : `${title} — VivaThrift`,
  description: defaultDesc,
  ogType: 'website',
  ogTitle: defaultTitle,
  ogDescription: defaultDesc,
  ogImage: `${siteUrl}/thumbnail.png`,
  ogUrl: siteUrl,
  ogSiteName: 'VivaThrift',
  twitterCard: 'summary_large_image',
  twitterTitle: defaultTitle,
  twitterDescription: defaultDesc,
  twitterImage: `${siteUrl}/thumbnail.png`,
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
