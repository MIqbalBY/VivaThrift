<script setup>
useSeoMeta({
  title: 'Tentang Kami',
  description: 'Kisah, visi, dan tim di balik VivaThrift — marketplace preloved eksklusif mahasiswa ITS.',
})

const { reveal } = useScrollReveal()

const stats = [
  { value: '100%', label: 'Eksklusif mahasiswa ITS', icon: '🔒' },
  { value: '2', label: 'Fakultas bergabung', icon: '🏛️' },
  { value: '5', label: 'Pengembang aktif', icon: '👨‍💻' },
  { value: '1', label: 'Kampus, satu ekosistem', icon: '🌿' },
]

const team = [
  { name: 'Muhammad Ichlas Rifqi F.', nrp: '5023221003', dept: 'Teknik Biomedik', faculty: 'FTEIC', initials: 'IR', color: '#1e3a8a' },
  { name: 'Tiara Aryacitra Dhaneswari', nrp: '5023221053', dept: 'Teknik Biomedik', faculty: 'FTEIC', initials: 'TA', color: '#0369a1', photo: '/media/team-photo/Tiara.jpeg' },
  { name: 'Muhammad Iqbal Baiduri Yamani', nrp: '5026221103', dept: 'Sistem Informasi', faculty: 'FTEIC', initials: 'IB', color: '#1e3a8a', photo: '/media/team-photo/Iqbal.png' },
  { name: 'Ravarel Harsha Athalla', nrp: '5026221048', dept: 'Sistem Informasi', faculty: 'FTEIC', initials: 'RH', color: '#0369a1' },
  { name: 'Fathimah Humairoh', nrp: '5002221147', dept: 'Matematika', faculty: 'FSAD', initials: 'FH', color: '#15803d' },
]

const values = [
  {
    num: '01',
    emoji: '🛡️',
    title: '100% Eksklusif Anak ITS',
    desc: 'Bebas dari penipuan pihak luar. Akses VivaThrift dikunci ketat — hanya email institusi aktif berformat NRP@student.its.ac.id yang bisa mendaftar. Identitas setiap penjual dan pembeli terjamin valid.',
    accent: '#1e3a8a',
    bg: 'rgba(30,58,138,0.06)',
    border: 'rgba(30,58,138,0.14)',
  },
  {
    num: '02',
    emoji: '🤝',
    title: 'COD Kampus atau Kirim Kurir',
    desc: 'Mager keluar kosan di Keputih atau Gebang? Pilih kirim kurir. Mau sekalian nongkrong nunggu kelas? COD di Kantin Pusat ITS, Depan Rektorat ITS, atau Research Center ITS. Super fleksibel.',
    accent: '#0369a1',
    bg: 'rgba(3,105,161,0.06)',
    border: 'rgba(3,105,161,0.14)',
  },
  {
    num: '03',
    emoji: '🌱',
    title: 'Dompet Aman, Bumi Nyaman',
    desc: 'Barang preloved berkualitas dengan harga miring, lengkap fitur nego. Hemat di kantong sekaligus ikut andil mengurangi limbah barang di lingkungan kampus.',
    accent: '#15803d',
    bg: 'rgba(21,128,61,0.06)',
    border: 'rgba(21,128,61,0.14)',
  },
]

</script>

<template>
  <div class="vt-info-page">

    <!-- ══════════════════════════════════════
         1. HERO + STATS BAND (one gradient)
         ══════════════════════════════════════ -->
    <HelpCenterHero
      badge="✨ Tentang VivaThrift"
      title="Dari Mahasiswa ITS,"
      highlight="Untuk Mahasiswa ITS."
      description="Titik temu barang preloved dan kebutuhan ngampus paling aman, paling relevan, dan paling dekat dengan ritme hidup mahasiswa ITS."
      variant="support"
    >
      <template #footer>
        <div class="mt-7 flex flex-wrap gap-2 justify-center lg:justify-start">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 backdrop-blur-sm border border-white/15 text-white/90">🛍️ Preloved Berkualitas</span>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 backdrop-blur-sm border border-white/15 text-white/90">♻️ Ekonomi Sirkular</span>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 backdrop-blur-sm border border-white/15 text-white/90">🔐 Khusus Mahasiswa ITS</span>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/10 backdrop-blur-sm border border-white/15 text-white/90">💸 Harga Mahasiswa</span>
        </div>
      </template>
    </HelpCenterHero>

    <section class="vt-stats-band relative" :ref="reveal">
      <div class="max-w-7xl mx-auto px-6 md:px-10 -mt-5 md:-mt-7 relative z-10">
        <div class="vt-stats-shell grid grid-cols-2 md:grid-cols-4 rounded-[2rem] overflow-hidden">
          <div
            v-for="(s, i) in stats"
            :key="s.label"
            class="vt-stat-item flex flex-col justify-center gap-2 py-12 px-8"
          >
            <span class="text-3xl mb-1" aria-hidden="true">{{ s.icon }}</span>
            <span class="font-heading text-5xl md:text-6xl font-bold tracking-tight leading-none vt-stat-value">{{ s.value }}</span>
            <span class="text-xs leading-snug uppercase tracking-wider mt-1 vt-stat-label">{{ s.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════
         3. CERITA KAMI
         ══════════════════════════════════════ -->
    <section class="vt-story w-full py-24 px-6 md:px-10" :ref="reveal">
      <div class="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-start">
        <!-- Left: label + H2 (sticky on desktop) -->
        <div class="flex flex-col gap-5 md:sticky md:top-28">
          <span class="text-xs font-semibold tracking-widest uppercase vt-label-accent">Cerita Kami</span>
          <h2 class="font-heading text-4xl md:text-5xl font-bold leading-tight vt-story-heading">
            Mengapa<br><span class="vt-brand-text font-himpun">VivaThrift</span><br>Ada?
          </h2>
          <img src="/img/illustrations/team-spirit.svg" alt="" width="192" height="192" loading="lazy" class="w-48 h-auto opacity-70 mt-4 hidden md:block" aria-hidden="true" />
        </div>

        <!-- Right: paragraphs -->
        <div class="flex flex-col gap-6">
          <div class="flex gap-3 items-start">
            <span class="text-2xl shrink-0 mt-0.5" aria-hidden="true">🔄</span>
            <p class="text-base leading-relaxed text-gray-600 dark:text-slate-200">
              Setiap pergantian semester, siklus ini selalu berulang: <strong class="font-bold vt-story-bold">maba</strong> sibuk berburu buku SKPB dan alat praktikum yang lumayan menguras kantong, sementara <strong class="font-bold vt-story-bold">mahasiswa tingkat akhir</strong> kebingungan <em>decluttering</em> barang di kosan sebelum lulus.
            </p>
          </div>
          <div class="flex gap-3 items-start">
            <span class="text-2xl shrink-0 mt-0.5" aria-hidden="true">💡</span>
            <p class="text-base leading-relaxed text-gray-600 dark:text-slate-200">
              Daripada dibuang atau berdebu di lemari, kenapa tidak diwariskan ke sesama yang membutuhkan? <span class="vt-brand-text font-himpun">VivaThrift</span> hadir untuk menjembatani hal tersebut — membangun ekosistem ekonomi sirkular lokal kampus yang <strong class="font-bold vt-story-bold">eksklusif, aman, dan ramah di kantong mahasiswa.</strong>
            </p>
          </div>
          <p class="text-sm italic text-gray-600 dark:text-slate-200 mt-2 pl-4 border-l-2 border-sky-500/40">
            ✍️ — Tim <span class="vt-brand-text font-himpun">VivaThrift</span>, ITS 2026
          </p>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════════
         4. KENAPA VIVATHRIFT
         ══════════════════════════════════════ -->
    <section class="vt-values w-full py-24 px-6 md:px-10" :ref="reveal">
      <div class="max-w-7xl mx-auto">

        <!-- Header -->
        <div class="flex flex-col gap-3 mb-16">
          <span class="text-xs font-semibold tracking-widest uppercase vt-label-accent">⭐ Keunggulan Platform</span>
          <h2 class="font-heading text-4xl md:text-5xl font-bold leading-tight vt-values-heading">
            Kenapa Pilih<br><span class="vt-brand-text font-himpun">VivaThrift</span>?
          </h2>
        </div>

        <!-- Value rows -->
        <div
          v-for="v in values"
          :key="v.num"
          class="vt-value-row grid md:grid-cols-[80px_1fr_2fr] gap-6 md:gap-12 py-10 border-t vt-divider items-start"
        >
          <div class="flex flex-col items-start gap-1.5">
            <span class="text-3xl leading-none" aria-hidden="true">{{ v.emoji }}</span>
            <span class="font-heading text-5xl font-bold select-none leading-none vt-value-num" :style="`color: ${v.accent}; opacity: 0.55;`">{{ v.num }}</span>
          </div>
          <h3 class="font-bold text-xl leading-snug vt-value-title pt-1">{{ v.title }}</h3>
          <p class="text-sm leading-relaxed text-gray-600 dark:text-slate-200 pt-1">{{ v.desc }}</p>
        </div>
        <div class="border-t vt-divider"></div>

      </div>
    </section>

    <!-- ══════════════════════════════════════
         5. TIM PENGEMBANG
         ══════════════════════════════════════ -->
    <div class="vt-lower-wrapper relative">

      <!-- Dot grid spanning full lower wrapper (shows through team section fade into CTA) -->
      <svg class="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="opacity: 0.20;">
        <defs>
          <pattern id="lower-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="white"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lower-dots)"/>
      </svg>

    <section class="vt-team-section w-full pt-24 pb-48 px-6 md:px-10">
      <div class="max-w-7xl mx-auto flex flex-col gap-14">

        <!-- Header -->
        <div class="flex flex-col gap-3">
          <span class="text-xs font-semibold tracking-widest uppercase vt-label-accent">👥 Tim Kami</span>
          <h2 class="font-heading text-4xl md:text-5xl font-bold leading-tight vt-team-heading">
            Di Balik Layar<br><span class="vt-brand-text font-himpun">VivaThrift</span>
          </h2>
          <p class="text-sm text-gray-600 dark:text-slate-200 max-w-md leading-relaxed mt-1">
            Kolaborasi lima mahasiswa lintas departemen dari FTEIC dan FSAD ITS (Project Mata Kuliah Kewirausahaan Berbasis Teknologi 28 - Kelompok 1).
          </p>
        </div>

        <!-- Flex-wrap grid: 3 per row, bottom 2 auto-centered -->
        <div class="flex flex-wrap justify-center gap-5">
          <div
            v-for="member in team"
            :key="member.nrp"
            class="vt-member-card group flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 w-full sm:w-[calc(33.33%_-_14px)]"
          >
            <!-- Portrait avatar area — 1:1 square -->
            <div class="relative overflow-hidden aspect-square"
                 :style="`background: linear-gradient(160deg, ${member.color} 0%, #060d1a 100%);`">
              <img v-if="member.photo" :src="member.photo" :alt="member.name" width="300" height="300" loading="lazy" class="absolute inset-0 w-full h-full object-cover object-top" />
              <span v-else class="absolute inset-0 flex items-center justify-center font-heading text-8xl font-bold select-none"
                    style="color: rgba(255,255,255,0.20);">{{ member.initials }}</span>
              <div class="absolute bottom-0 left-0 w-full h-0.5" :style="`background: ${member.color}; opacity: 0.8;`"></div>
            </div>
            <!-- Info -->
            <div class="flex flex-col gap-1.5 p-4 vt-member-info">
              <p class="font-bold text-xs tracking-widest uppercase leading-snug vt-member-name">{{ member.name }}</p>
              <p class="font-mono text-xs text-gray-600 dark:text-slate-200">{{ member.nrp }}</p>
              <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <!-- Faculty pill: yellow=FTEIC, green=FSAD -->
                <span
                  class="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full"
                  :class="member.faculty === 'FTEIC' ? 'vt-pill-fteic' : 'vt-pill-fsad'"
                >{{ member.faculty }}</span>
                <!-- Dept pill: per-department color -->
                <span
                  class="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  :class="{
                    'vt-pill-biomedik': member.dept === 'Teknik Biomedik',
                    'vt-pill-sinfo': member.dept === 'Sistem Informasi',
                    'vt-pill-matematika': member.dept === 'Matematika',
                  }"
                >{{ member.dept }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- ══════════════════════════════════════
         6. CTA BAND
         ══════════════════════════════════════ -->
    <section class="vt-cta relative overflow-hidden py-28 px-6 md:px-16">
      <!-- Floating deco -->
      <span class="absolute top-10 left-10 text-5xl opacity-10 rotate-12 hidden md:block select-none pointer-events-none" aria-hidden="true">📦</span>
      <span class="absolute top-14 right-16 text-4xl opacity-10 -rotate-6 hidden md:block select-none pointer-events-none" aria-hidden="true">🛍️</span>
      <span class="absolute bottom-10 left-[18%] text-3xl opacity-10 rotate-6 hidden md:block select-none pointer-events-none" aria-hidden="true">♻️</span>
      <span class="absolute bottom-14 right-[18%] text-4xl opacity-10 -rotate-12 hidden md:block select-none pointer-events-none" aria-hidden="true">💸</span>

      <div class="relative z-10 max-w-2xl mx-auto flex flex-col items-center text-center gap-7">
        <span class="vt-hero-pill inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase">
          🚀 Mulai Sekarang
        </span>
        <h2 class="font-heading text-4xl md:text-5xl font-bold text-white leading-tight">
          Kosan Udah Penuh? 📦<br>Atau Lagi Cari Buku Murah? 🔍
        </h2>
        <p class="vt-cta-sub text-base leading-relaxed max-w-md">
          Jangan cuma dibaca, yuk mulai eksplorasi atau upload barang nganggurmu sekarang!
        </p>
        <div class="flex gap-3 flex-wrap justify-center mt-2">
          <NuxtLink
            to="/"
            class="vt-cta-primary px-8 py-3 rounded-full font-bold text-white hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200"
          >
            Mulai Jelajah
          </NuxtLink>
          <NuxtLink
            to="/products/create"
            class="vt-cta-outline-btn px-8 py-3 rounded-full font-bold border transition-all duration-200 hover:-translate-y-0.5"
          >
            Jual Barang
          </NuxtLink>
        </div>
      </div>
    </section>
    </div><!-- /vt-lower-wrapper -->

  </div>
</template>

<style scoped>
.vt-stats-band {
  background: transparent;
}
.dark .vt-stats-band {
  background: transparent;
}
.vt-stats-shell {
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96));
  border: 1px solid rgba(15,23,42,0.08);
  box-shadow: 0 28px 64px rgba(15,23,42,0.08);
}
.dark .vt-stats-shell {
  background: linear-gradient(180deg, rgba(15,23,42,0.96), rgba(8,17,31,0.98));
  border-color: rgba(148,163,184,0.12);
  box-shadow: 0 28px 64px rgba(0,0,0,0.24);
}
.vt-stat-item {
  border-right: none;
}
.vt-stat-item:last-child {
  border-right: none;
}
@media (max-width: 767px) {
  .vt-stat-item:nth-child(even) {
    border-right: none;
  }
  .vt-stat-item:nth-child(-n+2) {
    border-bottom: none;
  }
}

/* ── Story section ── */
.vt-story {
  background: #ffffff;
}
.dark .vt-story {
  background: #0f172a;
}
.vt-story-heading {
  color: #0f172a;
}
.dark .vt-story-heading {
  color: #f1f5f9;
}

/* ── Values section ── */
.vt-values {
  background: #f8fafc;
}
.dark .vt-values {
  background: #0d1829;
}
.vt-values-heading {
  color: #0f172a;
}
.dark .vt-values-heading {
  color: #f1f5f9;
}
.vt-value-title {
  color: #0f172a;
}
.dark .vt-value-title {
  color: #f1f5f9;
}
/* ── Team section: fades white → transparent (reveals wrapper CTA gradient) ── */
.vt-team-section {
  position: relative;
  z-index: 1;
  background: linear-gradient(to bottom, #ffffff 0%, #ffffff 60%, rgba(255, 255, 255, 0) 100%);
}
.dark .vt-team-section {
  position: relative;
  z-index: 1;
  background: linear-gradient(to bottom, #0f172a 0%, #0f172a 60%, rgba(15, 23, 42, 0) 100%);
}
.vt-team-heading {
  color: #0f172a;
}
.dark .vt-team-heading {
  color: #f1f5f9;
}

/* ── VivaThrift brand text ── */
.vt-brand-text {
  background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.dark .vt-brand-text {
  background: linear-gradient(to right, #38bdf8, #7dd3fc, #bae6fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.vt-member-card {
  background: #f1f5f9;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.dark .vt-member-card {
  background: #0d1829;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.dark .vt-member-card:hover {
  border-color: rgba(56, 189, 248, 0.25);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.vt-member-name {
  color: #0f172a;
}
.dark .vt-member-name {
  color: #f1f5f9;
}
.vt-member-info {
  background: transparent;
}
/* ── Faculty pills ── */
.vt-pill-fteic {
  background: rgba(202, 138, 4, 0.12);
  border: 1px solid rgba(202, 138, 4, 0.30);
  color: #92400e;
}
.dark .vt-pill-fteic {
  background: rgba(250, 204, 21, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.28);
  color: #fde68a;
}
.vt-pill-fsad {
  background: rgba(21, 128, 61, 0.10);
  border: 1px solid rgba(21, 128, 61, 0.25);
  color: #14532d;
}
.dark .vt-pill-fsad {
  background: rgba(34, 197, 94, 0.10);
  border: 1px solid rgba(34, 197, 94, 0.25);
  color: #86efac;
}

/* ── Dept pills ── */
.vt-pill-biomedik {
  background: rgba(29, 78, 216, 0.08);
  border: 1px solid rgba(29, 78, 216, 0.20);
  color: #1d4ed8;
}
.dark .vt-pill-biomedik {
  background: rgba(96, 165, 250, 0.10);
  border: 1px solid rgba(96, 165, 250, 0.25);
  color: #93c5fd;
}
.vt-pill-sinfo {
  background: rgba(194, 65, 12, 0.08);
  border: 1px solid rgba(194, 65, 12, 0.20);
  color: #c2410c;
}
.dark .vt-pill-sinfo {
  background: rgba(251, 146, 60, 0.10);
  border: 1px solid rgba(251, 146, 60, 0.25);
  color: #fdba74;
}
.vt-pill-matematika {
  background: rgba(22, 163, 74, 0.08);
  border: 1px solid rgba(22, 163, 74, 0.20);
  color: #16a34a;
}
.dark .vt-pill-matematika {
  background: rgba(74, 222, 128, 0.10);
  border: 1px solid rgba(74, 222, 128, 0.25);
  color: #86efac;
}

/* ── Hero eyebrow pill ── */
.vt-hero-pill {
  background: rgba(22, 45, 110, 0.18);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(30, 58, 138, 0.45);
  color: white;
}
.dark .vt-hero-pill {
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.28);
  color: #38bdf8;
}

/* ── Stats value & label (dark on light sky-blue, white on dark) ── */
.vt-stat-value {
  color: #0f172a;
}
.dark .vt-stat-value {
  color: #ffffff;
}
.vt-stat-label {
  color: rgba(15, 23, 42, 0.72);
}
.dark .vt-stat-label {
  color: rgba(255, 255, 255, 0.65);
}

/* ── Lower wrapper: shares CTA gradient as base ── */
.vt-lower-wrapper {
  background: linear-gradient(160deg, #075985 0%, #0369a1 50%, #0ea5e9 100%);
}
.dark .vt-lower-wrapper {
  background: linear-gradient(160deg, #0a1220 0%, #0d1829 100%);
}

/* ── CTA inherits gradient from wrapper ── */
.vt-cta {
  background: transparent;
}
.dark .vt-cta {
  background: transparent;
}

/* ── CTA text & outline button ── */
.vt-cta-sub {
  color: rgba(255, 255, 255, 0.80);
}
.dark .vt-cta-sub {
  color: #94a3b8;
}

/* ── Member card hover (light mode) ── */
.vt-member-card:hover {
  border-color: rgba(3, 105, 161, 0.30);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.10);
}

/* ── Story bold accent ── */
.vt-story-bold { color: #1e3a8a; }
.dark .vt-story-bold { color: #38bdf8; }

/* ── CTA primary button ── */
.vt-cta-primary {
  background: linear-gradient(to right, #162d6e, #1e3a8a, #1e40af);
  box-shadow: 0 4px 20px rgba(30, 58, 138, 0.40);
}
.dark .vt-cta-primary {
  background: linear-gradient(to right, #0284c7, #0ea5e9, #38bdf8);
  box-shadow: 0 4px 20px rgba(56, 189, 248, 0.30);
}



</style>
