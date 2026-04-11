<script setup lang="ts">
useSeoMeta({
  title: 'Terms & Conditions | VivaThrift',
  description: 'Syarat dan ketentuan penggunaan platform VivaThrift — marketplace preloved eksklusif mahasiswa ITS.',
})

const lastUpdated = '1 April 2025'

const sections = [
  {
    id: 'penerimaan',
    title: '1. Penerimaan Ketentuan',
    content: `Dengan mengakses atau menggunakan platform VivaThrift ("Platform"), kamu menyatakan telah membaca, memahami, dan menyetujui seluruh Syarat & Ketentuan ("S&K") ini. Jika kamu tidak setuju dengan salah satu ketentuan, harap hentikan penggunaan Platform.

S&K ini berlaku bagi seluruh pengguna Platform, termasuk pengunjung, pembeli, dan penjual. VivaThrift berhak memperbarui S&K sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui email atau notifikasi dalam Platform.`,
  },
  {
    id: 'eligibilitas',
    title: '2. Kelayakan Pengguna',
    content: `VivaThrift bersifat eksklusif dan hanya terbuka bagi:

• Mahasiswa aktif Institut Teknologi Sepuluh Nopember (ITS) Surabaya.
• Memiliki email institusi aktif berformat NRP@student.its.ac.id.
• Berusia minimal 17 tahun.
• Memiliki kapasitas hukum penuh untuk membuat perjanjian yang mengikat.

Pendaftaran menggunakan email selain email ITS tidak akan diproses. Jika kamu lulus atau tidak lagi berstatus mahasiswa aktif, akses Platform dapat dicabut sewaktu-waktu.`,
  },
  {
    id: 'akun',
    title: '3. Akun Pengguna',
    content: `Kamu bertanggung jawab penuh atas:

• Kerahasiaan password akun — jangan bagikan ke siapa pun.
• Seluruh aktivitas yang terjadi di bawah akunmu.
• Memastikan informasi profil akurat dan terkini.

VivaThrift berhak menangguhkan atau menghapus akun yang terbukti melanggar S&K ini, melakukan penipuan, atau menyalahgunakan Platform.`,
  },
  {
    id: 'transaksi',
    title: '4. Transaksi & Pembayaran',
    content: `VivaThrift berperan sebagai fasilitator antara penjual dan pembeli, bukan sebagai pihak dalam transaksi.

• Penjual wajib mendeskripsikan kondisi barang secara jujur dan akurat.
• Harga yang tercantum adalah harga yang disepakati antara penjual dan pembeli.
• Negosiasi harga diperbolehkan melalui fitur chat yang tersedia.
• Pembayaran wajib dilakukan melalui mekanisme yang disediakan Platform, termasuk Xendit untuk Virtual Account, QRIS, dan e-wallet.
• Transaksi di luar Platform sepenuhnya menjadi risiko pengguna.`,
  },
  {
    id: 'pengiriman',
    title: '5. Pengiriman & COD',
    content: `Platform mendukung dua metode pemenuhan pesanan:

COD Kampus: transaksi tatap muka dalam lingkungan ITS. Disarankan di lokasi ramai dan pada jam aktif kampus. Platform tidak bertanggung jawab atas kejadian selama proses COD.

Pengiriman Kurir: ongkos kirim ditanggung pembeli kecuali disepakati lain. Penjual wajib memberikan nomor resi pengiriman. Kerusakan atau kehilangan barang selama pengiriman menjadi tanggung jawab jasa kurir.`,
  },
  {
    id: 'larangan',
    title: '6. Larangan Penggunaan',
    content: `Pengguna dilarang keras:

• Memposting produk palsu, replika, atau barang ilegal.
• Melakukan penipuan, manipulasi harga, atau review palsu.
• Menggunakan akun orang lain atau membuat akun ganda.
• Menghubungi pengguna lain di luar Platform untuk menghindari sistem.
• Menyebarkan konten yang melanggar hukum, SARA, atau melecehkan pengguna lain.
• Mencoba meretas, memodifikasi, atau mengganggu sistem Platform.

Pelanggaran akan mengakibatkan penangguhan atau penghapusan akun permanen.`,
  },
  {
    id: 'sengketa',
    title: '7. Penyelesaian Sengketa',
    content: `Jika terjadi perselisihan antara penjual dan pembeli:

1. Ajukan sengketa melalui fitur Dispute pada detail pesanan dalam 3 hari setelah transaksi selesai atau barang diterima.
2. Sertakan bukti yang relevan seperti foto, screenshot chat, dan bukti pembayaran.
3. Tim VivaThrift akan melakukan mediasi dalam 1–3 hari kerja.
4. Keputusan tim VivaThrift bersifat final dan mengikat.

VivaThrift tidak menjamin pengembalian dana penuh dalam setiap kasus, namun akan berupaya menemukan solusi yang adil bagi semua pihak.`,
  },
  {
    id: 'privasi',
    title: '8. Privasi & Data',
    content: `Penggunaan data pribadimu diatur dalam Kebijakan Privasi VivaThrift yang merupakan bagian tidak terpisahkan dari S&K ini. Dengan menggunakan Platform, kamu menyetujui pengumpulan dan pemrosesan data sebagaimana dijelaskan dalam Kebijakan Privasi.`,
  },
  {
    id: 'tanggung-jawab',
    title: '9. Batasan Tanggung Jawab',
    content: `VivaThrift menyediakan Platform sebagaimana adanya tanpa jaminan apa pun terkait ketersediaan, akurasi, atau kesesuaian untuk tujuan tertentu.

Platform tidak bertanggung jawab atas:
• Kerugian yang timbul dari transaksi antara pengguna.
• Kerusakan, kehilangan barang, atau keterlambatan pengiriman.
• Gangguan layanan akibat force majeure atau masalah teknis di luar kendali kami.

Tanggung jawab maksimal VivaThrift kepada pengguna dibatasi pada nilai transaksi yang disengketakan.`,
  },
  {
    id: 'hukum',
    title: '10. Hukum yang Berlaku',
    content: `S&K ini diatur dan ditafsirkan berdasarkan hukum Republik Indonesia. Setiap sengketa yang tidak dapat diselesaikan secara musyawarah akan diselesaikan melalui pengadilan yang berwenang di Surabaya, Jawa Timur.`,
  },
]
</script>

<template>
  <div class="vt-info-page">
    <HelpCenterHero
      badge="📋 Dokumen Legal"
      title="Syarat &"
      highlight="Ketentuan"
      description="Harap baca dengan teliti sebelum menggunakan VivaThrift. Dengan mendaftar, kamu menyetujui seluruh ketentuan berikut."
      :meta="`Terakhir diperbarui: ${lastUpdated}`"
      variant="legal"
    />

    <section class="vt-content-section py-16">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div class="lg:grid lg:grid-cols-[260px_1fr] lg:gap-16">
          <aside v-reveal class="hidden lg:block">
            <HelpTocCard :sections="sections" />
          </aside>

          <div v-reveal class="flex flex-col gap-10">
            <div class="grid sm:grid-cols-3 gap-4">
              <div
                v-for="item in [
                  { icon: '📘', title: 'Aturan Jelas', desc: 'Hak dan kewajiban pengguna dijelaskan terbuka' },
                  { icon: '🤝', title: 'Transaksi Fair', desc: 'Marketplace memfasilitasi proses beli dan jual yang aman' },
                  { icon: '⚖️', title: 'Dispute Terkelola', desc: 'Ada jalur sengketa saat transaksi bermasalah' },
                ]"
                :key="item.title"
                class="vt-principle-card rounded-2xl p-5 text-center"
              >
                <div class="text-2xl mb-2">{{ item.icon }}</div>
                <p class="vt-principle-title font-semibold text-sm mb-1">{{ item.title }}</p>
                <p class="vt-principle-desc text-xs leading-snug">{{ item.desc }}</p>
              </div>
            </div>

            <HelpSectionCard
              v-for="section in sections"
              :id="section.id"
              :key="section.id"
              :title="section.title"
              :content="section.content"
            />

            <div class="vt-contact-note rounded-2xl p-8 text-center">
              <p class="vt-contact-title font-semibold mb-2">Butuh klarifikasi soal syarat penggunaan?</p>
              <p class="vt-contact-body text-sm mb-5">Hubungi tim VivaThrift jika ada ketentuan yang perlu dijelaskan lebih lanjut.</p>
              <NuxtLink
                to="/contact"
                class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold vt-contact-btn transition-all hover:-translate-y-0.5"
              >
                Hubungi Kami →
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
