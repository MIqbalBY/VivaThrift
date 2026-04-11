<script setup lang="ts">
useSeoMeta({
  title: 'How It Works | VivaThrift',
  description: 'Pelajari cara beli dan jual di VivaThrift — marketplace preloved eksklusif mahasiswa ITS dalam beberapa langkah mudah.',
})

const { reveal } = useScrollReveal()

const buySteps = [
  {
    num: '01',
    icon: '🔍',
    title: 'Cari Barang',
    desc: 'Browse katalog produk preloved dari sesama mahasiswa ITS. Filter berdasarkan kategori, harga, atau kondisi barang.',
    accent: '#1e3a8a',
  },
  {
    num: '02',
    icon: '💬',
    title: 'Hubungi Penjual',
    desc: 'Tertarik? Chat langsung dengan penjual. Tanya kondisi barang, nego harga, atau atur jadwal COD kampus.',
    accent: '#0369a1',
  },
  {
    num: '03',
    icon: '🛒',
    title: 'Pesan & Bayar',
    desc: 'Klik “Beli Sekarang”, pilih metode pengiriman (COD atau kurir), lalu selesaikan pembayaran via Xendit — mendukung Virtual Account, QRIS, dan e-wallet. Dana ditahan sistem hingga barang diterima.',
    accent: '#15803d',
  },
  {
    num: '04',
    icon: '📦',
    title: 'Terima Barang',
    desc: 'Konfirmasi penerimaan barang setelah COD atau barang tiba. Dana baru diteruskan ke penjual setelah kamu konfirmasi.',
    accent: '#b45309',
  },
]

const sellSteps = [
  {
    num: '01',
    icon: '📸',
    title: 'Foto Barang',
    desc: 'Ambil foto produk dari berbagai sudut dengan pencahayaan yang baik. Foto yang jelas = pembeli lebih percaya.',
    accent: '#7c3aed',
  },
  {
    num: '02',
    icon: '✍️',
    title: 'Buat Listing',
    desc: 'Isi nama produk, deskripsi kondisi jujur, harga, dan kategori. Posting dalam hitungan menit tanpa biaya apapun.',
    accent: '#1e3a8a',
  },
  {
    num: '03',
    icon: '🤝',
    title: 'Terima Pesanan',
    desc: 'Notifikasi masuk saat ada yang minat. Konfirmasi pesanan, atur pengiriman atau jadwal COD dengan pembeli.',
    accent: '#0369a1',
  },
  {
    num: '04',
    icon: '💰',
    title: 'Dana Cair',
    desc: 'Setelah pembeli konfirmasi penerimaan barang, dana hasil penjualanmu akan diproses dan diteruskan sesuai jadwal disbursement Xendit. Seluruh transaksi dijamin aman melalui sistem escrow.',
    accent: '#15803d',
  },
]

const features = [
  {
    icon: '🛡️',
    title: 'Transaksi Aman',
    desc: 'Dana tertahan sampai pembeli konfirmasi penerimaan. Sistem escrow sederhana untuk keamanan dua pihak.',
  },
  {
    icon: '🤝',
    title: 'COD di Kampus',
    desc: 'Bayar via Xendit terlebih dahulu, lalu janjian meetup dengan penjual di titik janjian dalam kampus ITS yang disepakati bersama. Serah terima barang dikonfirmasi dengan kode OTP. Tanpa ongkos kirim.',
  },
  {
    icon: '💬',
    title: 'Chat Terproteksi',
    desc: 'Negosiasi langsung dengan fitur chat dalam Platform. Semua komunikasi tercatat untuk keamanan transaksi.',
  },
  {
    icon: '⚖️',
    title: 'Mediasi Sengketa',
    desc: 'Terjadi masalah? Tim VivaThrift siap jadi mediator untuk memastikan penyelesaian yang adil bagi semua pihak.',
  },
  {
    icon: '🔒',
    title: '100% Komunitas ITS',
    desc: 'Hanya mahasiswa ITS berverifikasi yang bisa bertransaksi. Komunitas yang homogen = lebih aman dan terpercaya.',
  },
  {
    icon: '🌱',
    title: 'Gratis Listing',
    desc: 'Tidak ada biaya pendaftaran, biaya listing, atau komisi tersembunyi. Jual dan beli sepenuhnya gratis.',
  },
]

const categories = [
  { icon: '👕', label: 'Fashion & Pakaian' },
  { icon: '📱', label: 'Gadget & Elektronik' },
  { icon: '📚', label: 'Buku & Alat Kuliah' },
  { icon: '🪑', label: 'Furnitur Kos' },
  { icon: '🎮', label: 'Hobi & Koleksi' },
  { icon: '🧴', label: 'Kosmetik & Perawatan' },
  { icon: '🎒', label: 'Tas & Aksesori' },
  { icon: '🍳', label: 'Peralatan Dapur' },
]
</script>

<template>
  <div class="vt-info-page">
    <!-- ══════════════════════════════════════
         HERO
         ══════════════════════════════════════ -->
    <HelpCenterHero
      badge="🚀 Panduan Platform"
      title="Cara Kerja"
      highlight="VivaThrift"
      description="Beli dan jual barang preloved dengan sesama mahasiswa ITS dalam beberapa langkah mudah. Aman, cepat, dan gratis."
      variant="support"
    >
      <template #footer>
        <div class="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
          <NuxtLink
            to="/auth/signup"
            class="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-white font-semibold text-sm vt-cta-dark transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Mulai Sekarang →
          </NuxtLink>
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-sm vt-cta-outline transition-all hover:-translate-y-0.5"
          >
            Lihat Produk
          </NuxtLink>
        </div>
      </template>
    </HelpCenterHero>

    <!-- ══════════════════════════════════════
         HOW TO BUY
         ══════════════════════════════════════ -->
    <section class="vt-section-light py-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div v-reveal class="text-center mb-14">
          <span class="text-xs font-semibold tracking-widest uppercase mb-3 block vt-label-accent">Untuk Pembeli</span>
          <h2 class="vt-heading text-3xl md:text-4xl font-bold mb-3">Cara Membeli Barang</h2>
          <p class="vt-subheading text-base max-w-xl mx-auto">Belanja preloved dari sesama anak ITS dengan 4 langkah simpel.</p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="(step, i) in buySteps"
            :key="step.num"
            v-reveal
            class="vt-step-card relative rounded-2xl p-7 flex flex-col"
          >
            <!-- Connector line (desktop) -->
            <div v-if="i < buySteps.length - 1" class="vt-connector hidden lg:block absolute top-[3.25rem] left-full w-6 h-0.5 z-10"></div>

            <div class="flex items-center gap-3 mb-5">
              <span class="vt-step-num text-3xl font-black" :style="{ color: step.accent }">{{ step.num }}</span>
              <span class="text-2xl">{{ step.icon }}</span>
            </div>
            <h3 class="vt-step-title font-bold text-base mb-2">{{ step.title }}</h3>
            <p class="vt-step-desc text-sm leading-relaxed flex-1">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════
         HOW TO SELL
         ══════════════════════════════════════ -->
    <section class="vt-section-alt py-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div v-reveal class="text-center mb-14">
          <span class="text-xs font-semibold tracking-widest uppercase mb-3 block vt-label-accent">Untuk Penjual</span>
          <h2 class="vt-heading text-3xl md:text-4xl font-bold mb-3">Cara Menjual Barang</h2>
          <p class="vt-subheading text-base max-w-xl mx-auto">Uang jajan tambahan dari barang yang sudah tidak terpakai. Mulai dalam menit.</p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="step in sellSteps"
            :key="step.num"
            v-reveal
            class="vt-step-card rounded-2xl p-7 flex flex-col"
          >
            <div class="flex items-center gap-3 mb-5">
              <span class="vt-step-num text-3xl font-black" :style="{ color: step.accent }">{{ step.num }}</span>
              <span class="text-2xl">{{ step.icon }}</span>
            </div>
            <h3 class="vt-step-title font-bold text-base mb-2">{{ step.title }}</h3>
            <p class="vt-step-desc text-sm leading-relaxed flex-1">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════
         FEATURES
         ══════════════════════════════════════ -->
    <section class="vt-section-light py-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div v-reveal class="text-center mb-14">
          <span class="text-xs font-semibold tracking-widest uppercase mb-3 block vt-label-accent">Kenapa VivaThrift?</span>
          <h2 class="vt-heading text-3xl md:text-4xl font-bold mb-3">Fitur yang Melindungimu</h2>
          <p class="vt-subheading text-base max-w-xl mx-auto">Kami bangun platform dengan kepercayaan dan keamanan sebagai prioritas utama.</p>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="f in features"
            :key="f.title"
            v-reveal
            class="vt-feature-card rounded-2xl p-6 flex gap-4 hover:-translate-y-1 transition-transform duration-200"
          >
            <div class="text-2xl flex-shrink-0">{{ f.icon }}</div>
            <div>
              <h3 class="vt-feature-title font-bold text-sm mb-1.5">{{ f.title }}</h3>
              <p class="vt-feature-desc text-sm leading-relaxed">{{ f.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════
         CATEGORIES
         ══════════════════════════════════════ -->
    <section class="vt-section-alt py-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div v-reveal class="text-center mb-10">
          <span class="text-xs font-semibold tracking-widest uppercase mb-3 block vt-label-accent">Kategori</span>
          <h2 class="vt-heading text-3xl font-bold mb-3">Apa yang Bisa Dijual?</h2>
          <p class="vt-subheading text-base max-w-lg mx-auto">Hampir semua barang preloved boleh dijual, selama legal dan sesuai kondisi yang jujur.</p>
        </div>

        <div v-reveal class="flex flex-wrap justify-center gap-3">
          <div
            v-for="cat in categories"
            :key="cat.label"
            class="vt-cat-pill inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium"
          >
            <span>{{ cat.icon }}</span> {{ cat.label }}
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
          <p class="text-xs font-semibold tracking-widest uppercase mb-4 vt-label-cta">Siap mulai?</p>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">Bergabung dengan komunitas preloved ITS</h2>
          <p class="text-white/75 text-base mb-8">Daftar gratis dengan email ITS-mu dan mulai transaksi hari ini.</p>
          <div class="flex flex-wrap justify-center gap-3">
            <NuxtLink
              to="/auth/signup"
              class="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white font-semibold text-sm vt-cta-btn-text transition-all hover:bg-white/90 hover:shadow-xl hover:-translate-y-0.5"
            >
              Daftar Sekarang →
            </NuxtLink>
            <NuxtLink
              to="/faq"
              class="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm vt-cta-outline-btn transition-all hover:-translate-y-0.5"
            >
              Baca FAQ
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
/* ── Category pills ── */
</style>
