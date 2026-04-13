<script setup lang="ts">
useSeoMeta({
  title: 'Contact Us | VivaThrift',
  description: 'Hubungi tim VivaThrift — marketplace preloved eksklusif mahasiswa ITS Surabaya.',
})

const { reveal } = useScrollReveal()
const { isDark } = useDarkMode()

const form = reactive({
  name: '',
  email: '',
  subject: '',
  message: '',
  website: '', // honeypot — must stay empty
})

const subjects = [
  'Pertanyaan Umum',
  'Masalah Akun',
  'Masalah Transaksi',
  'Laporan Penipuan',
  'Saran & Masukan',
  'Kerja Sama',
  'Lainnya',
]

const status = ref('idle') // idle | loading | success | error
const errorMessage = ref('')

async function handleSubmit() {
  status.value = 'loading'
  errorMessage.value = ''
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: { ...form },
    })
    status.value = 'success'
  }
  catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || 'Terjadi kesalahan. Silakan coba lagi.'
    status.value = 'error'
  }
}

function reset() {
  Object.assign(form, { name: '', email: '', subject: '', message: '', website: '' })
  errorMessage.value = ''
  status.value = 'idle'
}

const contacts = [
  {
    icon: '✉️',
    label: 'Email',
    value: 'admin@vivathrift.store',
    href: 'mailto:admin@vivathrift.store',
    note: 'Respons dalam 1–2 hari kerja',
  },
  {
    icon: '📍',
    label: 'Lokasi',
    value: 'ITS, Surabaya',
    href: null,
    note: 'Kampus ITS Sukolilo, Jawa Timur',
  },
  {
    icon: '🕐',
    label: 'Jam Operasional',
    value: 'Senin–Jumat',
    href: null,
    note: 'Pukul 08.00–17.00 WIB',
  },
]

const quickLinks = [
  {
    title: 'Pusat Bantuan & FAQ',
    desc: 'Cari jawaban cepat untuk akun, pembayaran, COD, dan keamanan transaksi.',
    to: '/faq',
    badge: 'Help Center',
  },
  {
    title: 'Syarat & Ketentuan',
    desc: 'Baca aturan penggunaan platform dan kewajiban setiap pengguna.',
    to: '/terms',
    badge: 'Legal',
  },
  {
    title: 'Kebijakan Privasi',
    desc: 'Pelajari bagaimana data pengguna dikumpulkan dan dilindungi.',
    to: '/privacy',
    badge: 'Privacy',
  },
]
</script>

<template>
  <div class="vt-info-page">
    <!-- ══════════════════════════════════════
         HERO
         ══════════════════════════════════════ -->
    <HelpCenterHero
      badge="💬 Hubungi Kami"
      title="Ada yang bisa"
      highlight="kami bantu?"
      description="Tim VivaThrift (PT Viva Niaga Digital) siap menjawab pertanyaanmu. Isi formulir di bawah atau langsung email kami untuk bantuan lebih lanjut."
      variant="contact"
    />

    <!-- ══════════════════════════════════════
         CONTACT INFO + FORM
         ══════════════════════════════════════ -->
    <section class="vt-main-section pt-24 pb-20">
      <div class="max-w-7xl mx-auto px-6 md:px-10">
        <div
          class="rounded-2xl px-5 py-4 mb-8 border"
          :class="isDark ? 'bg-sky-900/20 border-sky-700/40 text-sky-200' : 'bg-sky-50 border-sky-100 text-sky-800'"
        >
          <p class="text-[11px] font-semibold tracking-widest uppercase opacity-80 mb-1">Legal Entity</p>
          <p class="text-sm font-semibold">VivaThrift dikelola oleh PT Viva Niaga Digital.</p>
        </div>

        <div class="lg:grid lg:grid-cols-[340px_1fr] lg:gap-16">

          <!-- Left: contact info -->
          <div :ref="reveal" class="mb-12 lg:mb-0">
            <p class="text-xs font-semibold tracking-widest uppercase mb-2 vt-label-accent">Info Kontak</p>
            <h2 class="vt-heading text-2xl font-bold mb-6">Reach out ke kami</h2>

            <div class="flex flex-col gap-4 mb-10">
              <div
                v-for="c in contacts"
                :key="c.label"
                class="vt-contact-card rounded-2xl p-5 flex gap-4 items-start"
              >
                <div class="text-2xl flex-shrink-0">{{ c.icon }}</div>
                <div>
                  <p class="vt-contact-label text-xs font-semibold uppercase tracking-wider mb-0.5">{{ c.label }}</p>
                  <a
                    v-if="c.href"
                    :href="c.href"
                    class="vt-contact-value font-semibold text-sm hover:underline"
                  >{{ c.value }}</a>
                  <p v-else class="vt-contact-value font-semibold text-sm">{{ c.value }}</p>
                  <p class="vt-contact-note text-xs mt-0.5">{{ c.note }}</p>
                </div>
              </div>
            </div>

            <!-- Quick links -->
            <div class="vt-quicklinks rounded-2xl p-5">
              <p class="vt-ql-label text-xs font-semibold uppercase tracking-wider mb-3">Halaman Terkait</p>
              <div class="flex flex-col gap-2">
                <HelpQuickLinkCard
                  v-for="link in quickLinks"
                  :key="link.title"
                  :to="link.to"
                  :title="link.title"
                  :desc="link.desc"
                  :badge="link.badge"
                />
              </div>
            </div>
          </div>

          <!-- Right: form -->
          <div :ref="reveal">
            <div class="vt-form-card rounded-2xl p-8 md:p-10">

              <!-- Success state -->
              <div v-if="status === 'success'" class="text-center py-12">
                <div class="text-5xl mb-4">✅</div>
                <h3 class="vt-form-title text-xl font-bold mb-2">Pesan Terkirim!</h3>
                <p class="vt-form-sub text-sm mb-8">Terima kasih! Tim kami akan membalas dalam 1–2 hari kerja.</p>
                <button
                  class="vt-btn-secondary px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
                  @click="reset"
                >
                  Kirim Pesan Lain
                </button>
              </div>

              <!-- Form -->
              <form v-else @submit.prevent="handleSubmit" class="flex flex-col gap-5">
                <!-- Honeypot — do not remove -->
                <input v-model="form.website" type="text" name="website" tabindex="-1" aria-hidden="true" autocomplete="off" class="hidden" />

                <div>
                  <h3 class="vt-form-title text-xl font-bold mb-1">Kirim Pesan</h3>
                  <p class="vt-form-sub text-sm">Semua kolom wajib diisi.</p>
                </div>

                <div class="grid sm:grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="vt-label text-xs font-semibold">Nama Lengkap</label>
                    <input
                      v-model="form.name"
                      type="text"
                      required
                      placeholder="Nama kamu"
                      class="vt-input rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="vt-label text-xs font-semibold">Email ITS</label>
                    <input
                      v-model="form.email"
                      type="email"
                      required
                      placeholder="NRP@student.its.ac.id"
                      class="vt-input rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    />
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="vt-label text-xs font-semibold">Topik</label>
                  <select
                    v-model="form.subject"
                    required
                    class="vt-input rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  >
                    <option value="" disabled>Pilih topik...</option>
                    <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="vt-label text-xs font-semibold">Pesan</label>
                  <textarea
                    v-model="form.message"
                    required
                    rows="6"
                    placeholder="Ceritakan masalah atau pertanyaanmu di sini..."
                    class="vt-input rounded-xl px-4 py-3 text-sm outline-none transition-all resize-none"
                  ></textarea>
                </div>

                <div
                  v-if="status === 'error'"
                  class="rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                >
                  ⚠️ {{ errorMessage }}
                </div>

                <button
                  type="submit"
                  :disabled="status === 'loading'"
                  class="vt-btn-primary w-full py-3.5 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {{ status === 'loading' ? 'Mengirim...' : 'Kirim Pesan →' }}
                </button>
              </form>

            </div>
          </div>

        </div>
      </div>
    </section>

  </div>
</template>

