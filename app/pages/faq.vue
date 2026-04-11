<script setup lang="ts">
definePageMeta({
  alias: ['/bantuan'],
})

useSeoMeta({
  title: 'Help Center | VivaThrift',
  description: 'Pusat bantuan VivaThrift untuk akun, pembayaran Xendit, pengiriman, COD kampus, dan keamanan transaksi.',
})

const { reveal } = useScrollReveal()

const searchQuery = ref('')
const activeCategory = ref('semua')

const categories = [
  {
    id: 'akun',
    label: 'Akun & Registrasi',
    icon: '👤',
    accent: 'from-sky-500 to-cyan-400',
    description: 'Daftar pakai email ITS, login, reset password, dan identitas akun.',
  },
  {
    id: 'transaksi',
    label: 'Pembayaran & Pesanan',
    icon: '💳',
    accent: 'from-blue-600 to-sky-500',
    description: 'Checkout, Xendit, offer, status pesanan, dan sengketa transaksi.',
  },
  {
    id: 'pengiriman',
    label: 'COD & Pengiriman',
    icon: '📦',
    accent: 'from-indigo-500 to-sky-500',
    description: 'Meetup kampus, OTP serah-terima, kurir, resi, dan retur barang.',
  },
  {
    id: 'keamanan',
    label: 'Keamanan',
    icon: '🛡️',
    accent: 'from-emerald-500 to-cyan-400',
    description: 'Tips aman, laporan penipuan, verifikasi identitas, dan perlindungan data.',
  },
  {
    id: 'lainnya',
    label: 'Kontak & Lainnya',
    icon: '💬',
    accent: 'from-fuchsia-500 to-sky-500',
    description: 'Hubungi admin, tanya fitur, mobile web, dan hal umum lainnya.',
  },
] as const

const quickLinks = [
  {
    title: 'Mulai Jual Barang',
    desc: 'Panduan posting produk, foto, harga, dan publish listing.',
    to: '/how-it-works',
    badge: 'Seller Guide',
  },
  {
    title: 'Aturan Pengiriman & Retur',
    desc: 'Baca detail COD kampus, kurir, dan kebijakan pengembalian.',
    to: '/shipping-policy',
    badge: 'Policy',
  },
  {
    title: 'Kontak Admin',
    desc: 'Butuh bantuan manual? Hubungi admin VivaThrift secara langsung.',
    to: '/contact',
    badge: 'Support',
  },
] as const

const faqs = [
  { id: 1, category: 'akun', q: 'Siapa saja yang bisa daftar VivaThrift?', a: 'VivaThrift eksklusif untuk mahasiswa aktif Institut Teknologi Sepuluh Nopember (ITS). Pendaftaran hanya bisa menggunakan email institusi berformat NRP@student.its.ac.id. Email selain itu tidak akan diterima sistem.' },
  { id: 2, category: 'akun', q: 'Bagaimana cara mendaftar akun?', a: 'Klik tombol "Daftar" di pojok kanan atas, masukkan email ITS aktifmu, buat password, lalu verifikasi melalui link yang dikirim ke emailmu. Proses ini biasanya selesai kurang dari 2 menit.' },
  { id: 3, category: 'akun', q: 'Bagaimana jika lupa password?', a: 'Klik "Lupa Password" di halaman login. Sistem akan mengirimkan link reset password ke email ITS-mu. Link berlaku selama 1 jam. Jika tidak menerima email, cek folder spam atau minta ulang setelah 5 menit.' },
  { id: 4, category: 'akun', q: 'Apakah saya bisa mengubah email akun?', a: 'Saat ini email akun tidak bisa diubah karena digunakan sebagai identitas utama. Jika kamu memiliki masalah serius terkait akun, hubungi tim kami melalui halaman Kontak.' },
  { id: 5, category: 'transaksi', q: 'Bagaimana cara membeli barang di VivaThrift?', a: 'Temukan barang yang kamu mau, klik "Beli Sekarang" atau "Tambah ke Keranjang". Pilih metode pengiriman (COD kampus atau kurir), lakukan pembayaran, dan tunggu konfirmasi penjual. Seluruh proses terpantau dari dashboard-mu.' },
  { id: 6, category: 'transaksi', q: 'Bagaimana cara menjual barang?', a: 'Klik "Jual Sekarang" di halaman utama, isi detail produk (nama, deskripsi, harga, foto), pilih kategori, dan publikasikan. Barangmu akan langsung tampil di marketplace dan bisa dicari oleh sesama mahasiswa ITS.' },
  { id: 7, category: 'transaksi', q: 'Bisakah saya menawar harga?', a: 'Ya. VivaThrift mendukung fitur negosiasi. Kamu bisa mengirim penawaran harga langsung kepada penjual melalui fitur chat. Penjual akan menerima, menolak, atau memberikan harga counter. Semua kesepakatan dicatat dalam sistem.' },
  { id: 8, category: 'transaksi', q: 'Apa saja metode pembayaran yang tersedia?', a: 'VivaThrift menggunakan Xendit sebagai payment gateway resmi. Setelah checkout, kamu diarahkan ke halaman pembayaran Xendit yang mendukung Virtual Account, QRIS, serta e-wallet seperti OVO, DANA, GoPay, dan ShopeePay. Pembayaran dikonfirmasi otomatis dan dana ditahan hingga barang diterima.' },
  { id: 9, category: 'transaksi', q: 'Bagaimana jika saya sudah bayar tapi penjual tidak merespons?', a: 'Jika penjual tidak merespons dalam 48 jam setelah pembayaran, kamu bisa mengajukan sengketa melalui halaman Pesananku. Tim kami akan mediasi dan memastikan dana tetap aman sampai ada penyelesaian.' },
  { id: 10, category: 'pengiriman', q: 'Apa itu COD kampus?', a: 'COD kampus di VivaThrift bukan bayar tunai saat ketemu. Alurnya: bayar dulu via Xendit, janjian meetup dengan penjual di area ITS, lalu tunjukkan kode OTP saat bertemu sebagai konfirmasi serah-terima barang. Tidak ada ongkos kirim.' },
  { id: 11, category: 'pengiriman', q: 'Di mana saja lokasi COD yang disarankan?', a: 'Lokasi COD rekomendasi kami: Kantin Pusat ITS, Taman Alumni, Research Center, Masjid Manarul Ilmi, atau area ramai lain dalam kampus ITS. Hindari lokasi sepi dan pilih jam aktif kampus.' },
  { id: 12, category: 'pengiriman', q: 'Apakah tersedia pengiriman via kurir?', a: 'Ya. Penjual dan pembeli bisa menyepakati pengiriman via kurir seperti JNE, SiCepat, Anteraja, J&T, atau Pos Indonesia. Ongkos kirim ditanggung pembeli kecuali ada kesepakatan lain.' },
  { id: 13, category: 'keamanan', q: 'Bagaimana VivaThrift menjaga keamanan transaksi?', a: 'Setiap pengguna wajib terverifikasi dengan email ITS aktif. Pembayaran diproses melalui Xendit, ada OTP untuk serah-terima COD, fitur dispute untuk sengketa, dan seluruh komunikasi tersimpan di dalam platform.' },
  { id: 14, category: 'keamanan', q: 'Apa yang harus dilakukan jika saya menemukan penipuan?', a: 'Segera ajukan dispute melalui halaman Pesananku dan laporkan ke tim kami lewat halaman Kontak. Sertakan screenshot chat, bukti pembayaran, serta dokumentasi barang agar proses investigasi lebih cepat.' },
  { id: 15, category: 'keamanan', q: 'Apakah data pribadi saya aman?', a: 'Data pribadimu disimpan dan dikelola sesuai kebijakan privasi kami. Kami tidak menjual data pengguna ke pihak ketiga dan hanya membagikan data seperlunya untuk memproses transaksi dan kewajiban hukum.' },
  { id: 16, category: 'lainnya', q: 'Bagaimana cara menghubungi tim VivaThrift?', a: 'Kamu bisa menghubungi kami melalui halaman Kontak di website ini atau kirim email ke admin@vivathrift.store. Tim aktif pada hari kerja Senin–Jumat pukul 08.00–17.00 WIB.' },
  { id: 17, category: 'lainnya', q: 'Apakah VivaThrift tersedia sebagai aplikasi mobile?', a: 'Saat ini VivaThrift berjalan sebagai web app yang sudah dioptimalkan untuk browser mobile. Versi native masih ada di roadmap, tetapi alur jual-beli utama sudah bisa dipakai nyaman dari HP.' },
] as const

const searchableFaqs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return faqs.filter((item) => {
    const inCategory = activeCategory.value === 'semua' || item.category === activeCategory.value
    if (!inCategory) return false
    if (!query) return true

    const categoryLabel = categories.find(cat => cat.id === item.category)?.label.toLowerCase() ?? ''
    return [item.q, item.a, categoryLabel].some(text => text.toLowerCase().includes(query))
  })
})

const visibleCategories = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return categories

  return categories.filter((category) => {
    const inCopy = `${category.label} ${category.description}`.toLowerCase().includes(query)
    const inFaq = faqs.some(item =>
      item.category === category.id
      && [item.q, item.a].some(text => text.toLowerCase().includes(query))
    )
    return inCopy || inFaq
  })
})

const resultsLabel = computed(() => `${searchableFaqs.value.length} artikel bantuan ditemukan`)

const accordionItems = computed(() => searchableFaqs.value.map(item => ({
  id: item.id,
  title: item.q,
  body: item.a,
  tag: categories.find(cat => cat.id === item.category)?.label,
})))

function selectCategory(categoryId: string) {
  activeCategory.value = categoryId
}
</script>

<template>
  <div class="vt-help-page">
    <HelpCenterHero
      badge="🆘 VivaThrift Help Center"
      title="Need help?"
      highlight="Kami siap bantu."
      description="Cari jawaban cepat untuk akun, pembayaran Xendit, COD kampus, pengiriman, hingga keamanan transaksi dalam satu pusat bantuan."
      :show-search="true"
      :search-value="searchQuery"
      search-placeholder="Cari topik bantuan, misalnya: Xendit, COD, retur, password"
      :search-meta="resultsLabel"
      @update:search-value="searchQuery = $event"
    />

    <section class="vt-categories-section py-16 md:py-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div class="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div :ref="reveal">
            <p class="vt-eyebrow text-xs font-semibold tracking-[0.18em] uppercase mb-3">Kategori bantuan</p>
            <h2 class="vt-section-title text-3xl md:text-4xl font-bold">Mulai dari topik yang paling relevan</h2>
          </div>
          <div :ref="reveal" class="flex flex-wrap gap-2">
            <button
              type="button"
              class="vt-filter-chip rounded-full px-4 py-2 text-sm font-semibold transition-all"
              :class="{ 'vt-filter-chip--active': activeCategory === 'semua' }"
              @click="selectCategory('semua')"
            >
              Semua topik
            </button>
            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              class="vt-filter-chip rounded-full px-4 py-2 text-sm font-semibold transition-all"
              :class="{ 'vt-filter-chip--active': activeCategory === category.id }"
              @click="selectCategory(category.id)"
            >
              {{ category.label }}
            </button>
          </div>
        </div>

        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          <button
            v-for="category in visibleCategories"
            :key="category.id"
            :ref="reveal"
            type="button"
            class="vt-category-card text-left rounded-3xl p-6 transition-all"
            @click="selectCategory(category.id)"
          >
            <div class="flex items-start justify-between gap-4 mb-5">
              <div :class="['bg-gradient-to-br', category.accent]" class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-sky-500/20">
                {{ category.icon }}
              </div>
              <span class="vt-category-count text-xs font-semibold rounded-full px-3 py-1.5">
                {{ faqs.filter(item => item.category === category.id).length }} artikel
              </span>
            </div>
            <h3 class="vt-category-title text-lg font-bold mb-2">{{ category.label }}</h3>
            <p class="vt-category-desc text-sm leading-relaxed mb-5">{{ category.description }}</p>
            <span class="vt-category-link inline-flex items-center gap-2 text-sm font-semibold">
              Buka topik <span aria-hidden="true">→</span>
            </span>
          </button>
        </div>
      </div>
    </section>

    <section class="vt-content-section pb-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10 grid xl:grid-cols-[1.05fr_0.95fr] gap-8 items-start">
        <div>
          <div :ref="reveal" class="mb-6">
            <p class="vt-eyebrow text-xs font-semibold tracking-[0.18em] uppercase mb-3">Topik populer</p>
            <h2 class="vt-section-title text-3xl md:text-4xl font-bold mb-3">Panduan cepat untuk masalah yang paling sering dicari</h2>
            <p class="vt-section-subtitle text-sm md:text-base leading-relaxed max-w-2xl">
              Cari berdasarkan kata kunci atau buka salah satu artikel di bawah untuk membaca langkah lengkapnya.
            </p>
          </div>

          <HelpAccordionList v-if="accordionItems.length" :items="accordionItems" />

          <div v-else :ref="reveal" class="vt-empty-state rounded-3xl p-8 text-center">
            <div class="text-5xl mb-4">🧭</div>
            <h3 class="vt-empty-title text-xl font-bold mb-2">Belum ada hasil yang cocok</h3>
            <p class="vt-empty-desc text-sm leading-relaxed max-w-md mx-auto mb-5">
              Coba kata kunci yang lebih umum atau pilih kategori lain. Kalau masih buntu, hubungi admin agar dibantu manual.
            </p>
            <NuxtLink to="/contact" class="vt-empty-btn inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all">
              Hubungi Admin →
            </NuxtLink>
          </div>
        </div>

        <aside class="flex flex-col gap-5 xl:sticky xl:top-24">
          <div :ref="reveal" class="vt-side-panel rounded-3xl p-6 md:p-7">
            <p class="vt-eyebrow text-xs font-semibold tracking-[0.18em] uppercase mb-3">Quick access</p>
            <h3 class="vt-side-title text-2xl font-bold mb-2">Butuh jalur cepat?</h3>
            <p class="vt-side-copy text-sm leading-relaxed mb-5">
              Kalau kamu tidak ingin baca semua FAQ, buka panduan utama yang paling sering dipakai pengguna VivaThrift.
            </p>

            <div class="flex flex-col gap-3">
              <HelpQuickLinkCard
                v-for="item in quickLinks"
                :key="item.title"
                :to="item.to"
                :title="item.title"
                :desc="item.desc"
                :badge="item.badge"
              />
            </div>
          </div>

          <div :ref="reveal" class="vt-side-cta rounded-3xl p-6 md:p-7">
            <p class="vt-eyebrow-dark text-xs font-semibold tracking-[0.18em] uppercase mb-3">Masih mentok?</p>
            <h3 class="text-2xl font-bold text-white mb-3">Hubungi admin VivaThrift</h3>
            <p class="text-white/78 text-sm leading-relaxed mb-6">
              Untuk kasus yang butuh bantuan manual, dispute, atau kendala pembayaran, admin siap bantu di jam kerja.
            </p>
            <NuxtLink to="/contact" class="vt-side-cta-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all">
              Kontak sekarang →
            </NuxtLink>
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>

<style scoped>
.vt-help-page {
  background: #f8fafc;
}

.dark .vt-help-page {
  background: #08111f;
}

.vt-categories-section,
.vt-content-section {
  background: inherit;
}

.vt-eyebrow {
  color: #4f46e5;
}

.dark .vt-eyebrow {
  color: #7dd3fc;
}

.vt-section-title,
.vt-empty-title,
.vt-side-title {
  color: #0f172a;
}

.dark .vt-section-title,
.dark .vt-empty-title,
.dark .vt-side-title {
  color: #f8fafc;
}

.vt-section-subtitle,
.vt-empty-desc,
.vt-side-copy {
  color: #64748b;
}

.dark .vt-section-subtitle,
.dark .vt-empty-desc,
.dark .vt-side-copy {
  color: #e2e8f0;
}

.vt-filter-chip {
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  color: #475569;
}

.vt-filter-chip:hover,
.vt-filter-chip--active {
  background: #eef2ff;
  border-color: rgba(79, 70, 229, 0.18);
  color: #312e81;
}

.dark .vt-filter-chip {
  background: rgba(15, 23, 42, 0.84);
  border-color: rgba(148, 163, 184, 0.12);
  color: #cbd5e1;
}

.dark .vt-filter-chip:hover,
.dark .vt-filter-chip--active {
  background: rgba(14, 165, 233, 0.14);
  border-color: rgba(125, 211, 252, 0.28);
  color: #e0f2fe;
}

.vt-category-card,
.vt-side-panel,
.vt-empty-state {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 22px 50px rgba(15, 23, 42, 0.05);
}

.dark .vt-category-card,
.dark .vt-side-panel,
.dark .vt-empty-state {
  background: rgba(15, 23, 42, 0.96);
  border-color: rgba(148, 163, 184, 0.12);
  box-shadow: 0 28px 66px rgba(0, 0, 0, 0.24);
}

.vt-category-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 28px 64px rgba(79, 70, 229, 0.12);
}

.dark .vt-category-card:hover {
  box-shadow: 0 34px 80px rgba(14, 165, 233, 0.12);
}

.vt-category-count {
  background: #eef2ff;
  color: #4338ca;
}

.dark .vt-category-count {
  background: rgba(14, 165, 233, 0.12);
  color: #bae6fd;
}

.vt-category-title {
  color: #0f172a;
}

.dark .vt-category-title {
  color: #f8fafc;
}

.vt-category-desc {
  color: #64748b;
}

.dark .vt-category-desc {
  color: #e2e8f0;
}

.vt-category-link {
  color: #4338ca;
}

.dark .vt-category-link {
  color: #7dd3fc;
}

.vt-side-cta {
  background: linear-gradient(160deg, #1d4ed8 0%, #2563eb 50%, #38bdf8 100%);
  box-shadow: 0 34px 70px rgba(37, 99, 235, 0.22);
}

.dark .vt-side-cta {
  background: linear-gradient(160deg, #0f2044 0%, #12315c 50%, #0ea5e9 100%);
  box-shadow: 0 34px 70px rgba(14, 165, 233, 0.18);
}

.vt-eyebrow-dark {
  color: rgba(255, 255, 255, 0.72);
}

.vt-side-cta-btn,
.vt-empty-btn {
  background: #ffffff;
  color: #1e3a8a;
}

.vt-side-cta-btn:hover,
.vt-empty-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(255,255,255,0.18);
}

.dark .vt-empty-btn {
  background: linear-gradient(135deg, #0284c7, #0ea5e9, #38bdf8);
  color: #ffffff;
}
</style>