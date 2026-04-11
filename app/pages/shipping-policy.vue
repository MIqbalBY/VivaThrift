<script setup lang="ts">
useSeoMeta({
  title: 'Shipping & Returns | VivaThrift',
  description: 'Informasi lengkap tentang metode pengiriman, COD kampus, dan kebijakan pengembalian barang di VivaThrift.',
})

const { reveal } = useScrollReveal()

const shippingMethods = [
  {
    icon: '🤝',
    title: 'COD Kampus ITS',
    badge: 'Paling Populer',
    badgeColor: '#15803d',
    desc: 'Pembayaran dilakukan online via Xendit sebelum pertemuan. Lalu, janjian meetup dengan penjual di titik janjian dalam kampus ITS yang disepakati. Serah terima dikonfirmasi dengan kode OTP.',
    pros: ['Tanpa ongkos kirim', 'Barang bisa dicek langsung', 'Transaksi instan', 'Lebih aman'],
    cons: ['Harus janjian dulu', 'Terbatas jam kampus'],
    locations: ['Kantin Pusat ITS', 'Perpustakaan Pusat', 'Taman Alumni', 'Student Center', 'Selasar Departemen'],
  },
  {
    icon: '📦',
    title: 'Pengiriman Kurir',
    badge: 'Fleksibel',
    badgeColor: '#0369a1',
    desc: 'Barang dikirim via jasa kurir ke alamat pilihanmu. Cocok untuk yang tidak bisa COD.',
    pros: ['Tanpa perlu ketemu langsung', 'Jangkauan lebih luas', 'Ada nomor resi tracking'],
    cons: ['Ada ongkos kirim', 'Butuh waktu 1–5 hari'],
    couriers: ['JNE', 'SiCepat', 'Anteraja', 'J&T Express', 'Pos Indonesia'],
  },
]

const returnPolicy = [
  {
    icon: '✅',
    title: 'Barang Tidak Sesuai Deskripsi',
    desc: 'Jika barang yang diterima berbeda signifikan dari deskripsi penjual (kondisi, fungsi, atau spesifikasi), kamu berhak mengajukan pengembalian dalam 2x24 jam setelah menerima barang.',
    eligible: true,
  },
  {
    icon: '✅',
    title: 'Barang Rusak saat Pengiriman',
    desc: 'Jika barang rusak akibat proses pengiriman, dokumentasikan kerusakan dengan foto/video segera saat paket dibuka, lalu ajukan dispute. Kami akan mediasi dengan penjual.',
    eligible: true,
  },
  {
    icon: '✅',
    title: 'Barang Tidak Tiba',
    desc: 'Jika barang tidak tiba dalam 14 hari kerja dari pengiriman, dan penjual tidak bisa memberikan penjelasan, kamu berhak mendapatkan pengembalian dana penuh.',
    eligible: true,
  },
  {
    icon: '❌',
    title: 'Berubah Pikiran',
    desc: 'Pengembalian karena berubah pikiran atau tidak menyukai barang (bukan karena ketidaksesuaian dengan deskripsi) tidak termasuk dalam kebijakan pengembalian kami.',
    eligible: false,
  },
  {
    icon: '❌',
    title: 'Barang Sesuai Deskripsi',
    desc: 'Jika barang sudah dideskripsikan dengan jelas (termasuk cacat atau kekurangan) dan kamu setuju sebelum membeli, pengembalian tidak bisa diproses.',
    eligible: false,
  },
]

const returnSteps = [
  {
    num: '01',
    icon: '📸',
    title: 'Dokumentasikan Masalah',
    desc: 'Ambil foto/video bukti ketidaksesuaian barang segera setelah menerima. Jangan buang kemasan terlebih dahulu.',
  },
  {
    num: '02',
    icon: '📩',
    title: 'Ajukan Dispute',
    desc: 'Buka halaman "Pesananku", temukan pesanan terkait, dan klik "Ajukan Sengketa". Isi formulir dengan bukti yang sudah disiapkan.',
  },
  {
    num: '03',
    icon: '⏳',
    title: 'Tunggu Mediasi',
    desc: 'Tim VivaThrift akan menghubungi kedua pihak dalam 1–3 hari kerja. Cooperate dengan proses mediasi kami.',
  },
  {
    num: '04',
    icon: '💰',
    title: 'Resolusi',
    desc: 'Jika pengembalian disetujui, dana refund akan diproses Xendit ke metode pembayaran asalmu dalam 3–7 hari kerja tergantung metode pembayaran.',
  },
]
</script>

<template>
  <div class="vt-info-page">
    <!-- ══════════════════════════════════════
         HERO
         ══════════════════════════════════════ -->
    <HelpCenterHero
      badge="📦 Pengiriman & Retur"
      title="Pengiriman &"
      highlight="Pengembalian"
      description="Pilih cara pengiriman yang paling cocok dan pahami kebijakan pengembalian barang VivaThrift dengan alur yang jelas."
      variant="policy"
    />

    <!-- ══════════════════════════════════════
         SHIPPING METHODS
         ══════════════════════════════════════ -->
    <section class="vt-section-light py-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div v-reveal class="text-center mb-14">
          <span class="text-xs font-semibold tracking-widest uppercase mb-3 block vt-label-accent">Metode Pengiriman</span>
          <h2 class="vt-heading text-3xl md:text-4xl font-bold mb-3">Pilih Cara yang Paling Cocok</h2>
          <p class="vt-subheading text-base max-w-xl mx-auto">VivaThrift mendukung dua opsi pengiriman yang bisa disepakati antara pembeli dan penjual.</p>
        </div>

        <div class="grid md:grid-cols-2 gap-8">
          <div
            v-for="m in shippingMethods"
            :key="m.title"
            v-reveal
            class="vt-method-card rounded-2xl p-8"
          >
            <div class="flex items-start justify-between gap-4 mb-5">
              <div class="flex items-center gap-3">
                <span class="text-3xl">{{ m.icon }}</span>
                <h3 class="vt-method-title font-bold text-lg">{{ m.title }}</h3>
              </div>
              <span
                class="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full"
                :style="{ background: m.badgeColor + '18', color: m.badgeColor, border: '1px solid ' + m.badgeColor + '35' }"
              >{{ m.badge }}</span>
            </div>
            <p class="vt-method-desc text-sm leading-relaxed mb-6">{{ m.desc }}</p>

            <div class="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider vt-pros-label mb-2">Keunggulan</p>
                <ul class="flex flex-col gap-1.5">
                  <li v-for="p in m.pros" :key="p" class="vt-pros-item text-sm flex items-start gap-2">
                    <span class="text-green-500 flex-shrink-0">✓</span> {{ p }}
                  </li>
                </ul>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider vt-cons-label mb-2">Keterbatasan</p>
                <ul class="flex flex-col gap-1.5">
                  <li v-for="c in m.cons" :key="c" class="vt-cons-item text-sm flex items-start gap-2">
                    <span class="text-amber-500 flex-shrink-0">!</span> {{ c }}
                  </li>
                </ul>
              </div>
            </div>

            <div v-if="m.locations" class="vt-divider border-t pt-5">
              <p class="text-xs font-semibold uppercase tracking-wider vt-detail-label mb-2">Lokasi COD Rekomendasi</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="loc in m.locations" :key="loc" class="vt-loc-pill text-xs px-3 py-1 rounded-full">{{ loc }}</span>
              </div>
            </div>
            <div v-if="m.couriers" class="vt-divider border-t pt-5">
              <p class="text-xs font-semibold uppercase tracking-wider vt-detail-label mb-2">Kurir yang Disarankan</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="c in m.couriers" :key="c" class="vt-courier-pill text-xs px-3 py-1 rounded-full">{{ c }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════
         RETURN POLICY
         ══════════════════════════════════════ -->
    <section class="vt-section-alt py-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div v-reveal class="text-center mb-14">
          <span class="text-xs font-semibold tracking-widest uppercase mb-3 block vt-label-accent">Kebijakan Retur</span>
          <h2 class="vt-heading text-3xl md:text-4xl font-bold mb-3">Kapan Pengembalian Bisa Diajukan?</h2>
          <p class="vt-subheading text-base max-w-xl mx-auto">Kami menjamin keadilan untuk pembeli dan penjual. Pahami kondisi yang memenuhi syarat pengembalian.</p>
        </div>

        <div class="flex flex-col gap-4 max-w-3xl mx-auto">
          <div
            v-for="r in returnPolicy"
            :key="r.title"
            v-reveal
            class="vt-return-card rounded-2xl p-6 flex gap-4"
            :class="r.eligible ? 'vt-return-eligible' : 'vt-return-ineligible'"
          >
            <span class="text-2xl flex-shrink-0 mt-0.5">{{ r.icon }}</span>
            <div>
              <h3 class="vt-return-title font-bold text-sm mb-1.5">{{ r.title }}</h3>
              <p class="vt-return-desc text-sm leading-relaxed">{{ r.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════
         RETURN PROCESS
         ══════════════════════════════════════ -->
    <section class="vt-section-light py-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div v-reveal class="text-center mb-14">
          <span class="text-xs font-semibold tracking-widest uppercase mb-3 block vt-label-accent">Proses Pengembalian</span>
          <h2 class="vt-heading text-3xl font-bold mb-3">Langkah-langkah Mengajukan Retur</h2>
          <p class="vt-subheading text-base max-w-lg mx-auto">Ikuti langkah berikut untuk proses pengembalian yang cepat dan lancar.</p>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="step in returnSteps"
            :key="step.num"
            v-reveal
            class="vt-step-card rounded-2xl p-6"
          >
            <div class="flex items-center gap-3 mb-4">
              <span class="vt-step-num text-3xl font-black">{{ step.num }}</span>
              <span class="text-2xl">{{ step.icon }}</span>
            </div>
            <h3 class="vt-step-title font-bold text-sm mb-2">{{ step.title }}</h3>
            <p class="vt-step-desc text-sm leading-relaxed">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════
         CTA
         ══════════════════════════════════════ -->
    <section class="vt-cta-wrapper py-24 relative overflow-hidden">
      <div class="vt-cta-glow absolute inset-0 pointer-events-none"></div>
      <div class="max-w-7xl mx-auto px-6 md:px-10 relative">
        <div v-reveal class="text-center max-w-xl mx-auto">
          <p class="text-xs font-semibold tracking-widest uppercase mb-4 vt-label-cta">Masih ada pertanyaan?</p>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">Kami siap membantu</h2>
          <p class="text-white/75 text-base mb-8">Cek FAQ kami atau hubungi tim langsung untuk masalah pengiriman dan pengembalian.</p>
          <div class="flex flex-wrap justify-center gap-3">
            <NuxtLink
              to="/faq"
              class="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white font-semibold text-sm vt-cta-btn-text transition-all hover:bg-white/90 hover:shadow-xl hover:-translate-y-0.5"
            >
              Lihat FAQ →
            </NuxtLink>
            <NuxtLink
              to="/contact"
              class="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm vt-cta-outline-btn transition-all hover:-translate-y-0.5"
            >
              Kontak Kami
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
</style>
