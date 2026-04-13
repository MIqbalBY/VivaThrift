<script setup lang="ts">
useSeoMeta({
  title: 'Privacy Policy | VivaThrift',
  description: 'Kebijakan privasi VivaThrift — bagaimana kami mengumpulkan, menggunakan, dan melindungi data pribadimu.',
})

const { reveal } = useScrollReveal()

const lastUpdated = '1 April 2025'

const sections = [
  {
    id: 'intro',
    title: '1. Pendahuluan',
    content: `VivaThrift ("kami", "Platform") yang dikelola oleh PT Viva Niaga Digital berkomitmen untuk melindungi privasi pengguna. Kebijakan Privasi ini menjelaskan jenis data yang kami kumpulkan, cara penggunaannya, serta hak-hakmu sebagai pengguna.

Dengan menggunakan Platform, kamu menyetujui pengumpulan dan penggunaan data sebagaimana dijelaskan dalam kebijakan ini. Kebijakan ini berlaku bagi seluruh pengguna terdaftar dan pengunjung Platform.`,
  },
  {
    id: 'data-dikumpulkan',
    title: '2. Data yang Kami Kumpulkan',
    content: `Kami mengumpulkan beberapa jenis data berikut:

Data Identitas
• Nama lengkap dan NRP mahasiswa
• Alamat email institusi (NRP@student.its.ac.id)
• Foto profil (opsional, diunggah pengguna)

Data Transaksi
• Riwayat pembelian dan penjualan
• Komunikasi chat antar pengguna
• Bukti pembayaran dan status pesanan

Data Teknis
• Alamat IP dan informasi browser
• Data cookie dan sesi
• Log akses dan penggunaan fitur`,
  },
  {
    id: 'penggunaan-data',
    title: '3. Cara Kami Menggunakan Data',
    content: `Data yang kami kumpulkan digunakan untuk:

• Verifikasi identitas dan kelayakan pengguna (eksklusif mahasiswa ITS).
• Memproses dan memfasilitasi transaksi antara pengguna.
• Mengirimkan notifikasi terkait pesanan, penawaran, dan aktivitas akun.
• Meningkatkan fitur dan performa Platform.
• Mencegah penipuan dan penyalahgunaan Platform.
• Mematuhi kewajiban hukum yang berlaku.

Kami tidak menggunakan data pribadimu untuk iklan pihak ketiga atau keperluan komersial di luar Platform.`,
  },
  {
    id: 'berbagi-data',
    title: '4. Berbagi Data dengan Pihak Ketiga',
    content: `Kami tidak menjual atau menyewakan data pribadimu. Data dapat dibagikan dalam kondisi terbatas berikut:

• Dengan pengguna lain (penjual/pembeli) sebatas informasi yang diperlukan untuk transaksi.
• Dengan penyedia layanan teknis (hosting, email) yang terikat perjanjian kerahasiaan.
• Kepada pihak berwenang jika diwajibkan oleh hukum atau perintah pengadilan.
• Dalam hal merger atau akuisisi Platform, dengan pemberitahuan terlebih dahulu.`,
  },
  {
    id: 'keamanan',
    title: '5. Keamanan Data',
    content: `Kami menerapkan langkah-langkah teknis dan organisasi yang wajar untuk melindungi datamu, termasuk:

• Enkripsi data saat transit (HTTPS/TLS).
• Akses data dibatasi hanya untuk personel yang berwenang.
• Pemantauan sistem secara berkala untuk mendeteksi ancaman keamanan.
• Penyimpanan password dalam format hash yang tidak dapat dibaca.

Meski demikian, tidak ada sistem yang 100% aman. Kami mendorongmu untuk menggunakan password yang kuat dan tidak membagikan kredensial akunmu.`,
  },
  {
    id: 'cookie',
    title: '6. Cookie dan Teknologi Pelacakan',
    content: `Platform menggunakan cookie dan teknologi serupa untuk:

• Menjaga sesi login agar kamu tidak perlu masuk berulang kali.
• Mengingat preferensi tampilan (misalnya mode gelap/terang).
• Menganalisis penggunaan Platform untuk peningkatan layanan.

Kamu dapat menonaktifkan cookie melalui pengaturan browser, namun beberapa fitur Platform mungkin tidak berfungsi optimal.`,
  },
  {
    id: 'retensi',
    title: '7. Retensi Data',
    content: `Kami menyimpan data pribadimu selama akun masih aktif atau selama diperlukan untuk tujuan yang dijelaskan dalam kebijakan ini.

Jika akunmu dihapus, data transaksi dan komunikasi dapat disimpan selama maksimal 3 tahun untuk keperluan hukum dan audit. Data yang tidak lagi diperlukan akan dihapus secara aman.`,
  },
  {
    id: 'hak-pengguna',
    title: '8. Hak-hak Pengguna',
    content: `Sebagai pengguna, kamu memiliki hak untuk:

• Mengakses data pribadi yang kami simpan tentangmu.
• Memperbarui atau mengoreksi data yang tidak akurat.
• Meminta penghapusan akun dan data pribadimu.
• Membatasi atau menolak pemrosesan data dalam kondisi tertentu.
• Mendapatkan salinan datamu dalam format yang dapat dibaca mesin (portabilitas data).

Untuk menggunakan hak-hakmu, hubungi kami melalui halaman Kontak.`,
  },
  {
    id: 'perubahan',
    title: '9. Perubahan Kebijakan',
    content: `Kami dapat memperbarui Kebijakan Privasi ini sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui email atau notifikasi dalam Platform minimal 7 hari sebelum berlaku.

Penggunaan berkelanjutan Platform setelah perubahan berlaku dianggap sebagai persetujuan terhadap kebijakan yang diperbarui.`,
  },
  {
    id: 'kontak',
    title: '10. Hubungi Kami',
    content: `Jika ada pertanyaan, kekhawatiran, atau permintaan terkait privasi datamu, silakan hubungi kami melalui:

• Halaman Kontak di website ini
• Email: admin@vivathrift.store
• Legal entity: PT Viva Niaga Digital
• Tim kami aktif pada hari kerja (Senin–Jumat) pukul 08.00–17.00 WIB`,
  },
]
</script>

<template>
  <div class="vt-info-page">
    <!-- ══════════════════════════════════════
         HERO
         ══════════════════════════════════════ -->
    <HelpCenterHero
      badge="🔒 Privasi & Data"
      title="Kebijakan"
      highlight="Privasi"
      description="Kami serius menjaga privasi dan keamanan data pribadimu. Pelajari bagaimana kami mengelola informasimu."
      :meta="`Terakhir diperbarui: ${lastUpdated}`"
      variant="legal"
    />

    <!-- ══════════════════════════════════════
         CONTENT
         ══════════════════════════════════════ -->
    <section class="vt-content-section py-16">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div class="lg:grid lg:grid-cols-[260px_1fr] lg:gap-16">

          <!-- Sticky ToC -->
          <aside :ref="reveal" class="hidden lg:block">
            <HelpTocCard :sections="sections" />
          </aside>

          <!-- Main content -->
          <div :ref="reveal" class="flex flex-col gap-10">
            <!-- Privacy principles highlight -->
            <div class="grid sm:grid-cols-3 gap-4">
              <div v-for="p in [
                { icon: '🔒', title: 'Data Aman', desc: 'Enkripsi end-to-end & akses terbatas' },
                { icon: '🚫', title: 'Tidak Dijual', desc: 'Data kamu tidak pernah dijual ke pihak ketiga' },
                { icon: '✅', title: 'Hakmu Terjamin', desc: 'Akses, koreksi & hapus data kapan saja' },
              ]" :key="p.title" class="vt-principle-card rounded-2xl p-5 text-center">
                <div class="text-2xl mb-2">{{ p.icon }}</div>
                <p class="vt-principle-title font-semibold text-sm mb-1">{{ p.title }}</p>
                <p class="vt-principle-desc text-xs leading-snug">{{ p.desc }}</p>
              </div>
            </div>

            <HelpSectionCard
              v-for="s in sections"
              :id="s.id"
              :key="s.id"
              :title="s.title"
              :content="s.content"
            />

            <div class="vt-contact-note rounded-2xl p-8 text-center">
              <p class="vt-contact-title font-semibold mb-2">Pertanyaan tentang privasimu?</p>
              <p class="vt-contact-body text-sm mb-5">Tim kami siap menjawab semua pertanyaan terkait privasi dan data.</p>
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

