# VivaThrift — Master TODO List

> Last updated: 10 April 2026  
> Legend: ✅ Done · 🔧 Partial / Needs Fix · ❌ Not Started

---

## 🖥️ UI / UX / Responsivitas

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 1 | **Mobile/Tab Responsive** (semua halaman) | 🔧 | Navbar punya `showMobileMenu`, tapi banyak page (checkout, orders, disputes, dll) belum full audit responsif |
| 2 | **Hamburger Menu** (mobile/tab) | 🔧 | `NavbarMobileMenu` exist, tapi perlu QA: apakah link inside menu sudah lengkap, scroll-lock, swipe-dismiss |
| 3 | **Estetika, Animasi, Ilustrasi** (animejs.com) | ❌ | `animejs` belum di-install. Perlu: scroll reveal upgrade, page transitions, micro-interactions, ilustrasi SVG |

---

## 📄 Halaman Informasi & Legal

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 4 | **Help / FAQ Page** | ❌ | Belum ada `/faq` page sama sekali |
| 5 | **Terms & Conditions** | ❌ | Belum ada `/terms` page. Style referensi: Spotify |
| 6 | **Privacy Policy** | ❌ | Belum ada `/privacy` page. Style referensi: Remote.com |
| 7 | **Contact Us** | ❌ | Belum ada `/contact` page (form + info kontak) |
| 8 | **How It Works** | ❌ | Belum ada `/how-it-works` page (onboarding flow: beli, jual, kirim) |
| 9 | **Shipping & Return Policy** | ❌ | Belum ada `/shipping-policy` page |

---

## 🔗 Navigasi

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 10 | **Navigation links** ke halaman informasi | ❌ | Footer & Hamburger menu belum punya link ke: FAQ, T&C, Privacy, Contact, How It Works, Shipping Policy |

---

## 💰 Keuangan & Komisi

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 11 | **Komisi Platform → Rekening Jago** | 🔧 | `calculatePlatformFee()` sudah benar (1k/2k/0.5%). Disbursement ke **penjual** sudah ada lewat Xendit. Yang **BELUM**: platform fee yang dikumpulkan dari buyer perlu secara otomatis di-transfer / di-credit ke rekening admin **Bank Jago 1034 3858 8617** (a.n. Muhammad Iqbal Baiduri Yamani) — saat ini fee hanya di-record di kolom `platform_fee`, tidak ada disbursement ke rekening admin |

---

## 🧪 Testing

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 12 | **Unit Test** | ❌ | Nol file `.test.ts` / `.spec.ts`. Prioritas: `domain-rules.ts` (calculatePlatformFee, state machine), composables utama |
| 13 | **Integration Test** | ❌ | Nol integration test. Prioritas: checkout flow, webhook handler, order state transitions |

---

## ⚙️ Backend & Infrastruktur

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 14 | **Webhooks** | 🔧 | Hanya `xendit.post.ts` yang ada. Yang **BELUM**: Biteship status webhook (tracking update otomatis) |
| 15 | **Cron Jobs** | ❌ | Belum ada pg_cron / scheduled functions. Perlu: expire offers yg pending > X jam, cancel unpaid orders, cleanup expired sessions |
| 16 | **Docker** | ❌ | Belum ada `Dockerfile` / `docker-compose.yml` untuk self-host / local dev parity |

---

## 💳 Payment & Shipping Production

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 17 | **Xendit Production Ready** | 🔧 | URL sudah `api.xendit.co` (production endpoint). Perlu verifikasi: `XENDIT_API_KEY` env di Vercel sudah pakai **production key** (bukan test key), webhook secret sudah benar, callback URL sudah verified di Xendit Dashboard |
| 18 | **Biteship Production Ready** | 🔧 | URL sudah `api.biteship.com`. Perlu verifikasi: `BITESHIP_API_KEY` env sudah pakai **production key**, webhook URL sudah registered, origin/destination mapping sudah valid Biteship format |

---

## 📊 Analytics & Data

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 19 | **Chart Analytics — Seller** | 🔧 | `seller/analytics.get.ts` ada, tapi frontend chart belum lengkap (Chart.js / Recharts belum ada, hanya raw data) |
| 20 | **Chart Analytics — Buyer** | ❌ | Belum ada buyer analytics sama sekali (pengeluaran, riwayat beli, produk favorit) |

---

## 👥 Sosial

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 21 | **Following/Followers Detail List + Privacy Settings** | 🔧 | `followers.vue` dan `following.vue` ada, tapi perlu: paginasi list, avatar + username, privacy toggle (tampilkan/sembunyikan followers dari publik) |

---

## 🔍 SEO

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 22 | **SEO Sub-link / Dynamic Pages** | 🔧 | Sitemap `__sitemap__/urls.ts` ada. Perlu audit: meta OG per produk, canonical URL, structured data (Product schema JSON-LD), hreflang jika multi-bahasa |

---

## ⚡ Performance

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 23 | **Vercel Speed Insights** | ✅ | `@vercel/speed-insights@2.0.0` sudah installed & dikonfigurasi di `nuxt.config.ts` |

---

## 📱 Mobile App

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 24 | **APK / Upload Play Store** | ❌ | Belum ada (perlu Capacitor atau React Native wrapper). Termasuk: Play Store listing, screenshots, deskripsi |
| 25 | **Download App Page** | ❌ | Belum ada `/download` page dengan link APK + QR code |

---

## 🧹 Code Quality

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 26 | **Hapus Dead Code** | ❌ | Perlu audit menyeluruh: unused imports, commented-out code, orphaned composables/pages |
| 27 | **README.md Update** | ❌ | README perlu update: tech stack lengkap (Nuxt 4, Supabase, Xendit, Biteship, Vercel, animejs, dll), setup guide, env vars list, architecture overview |

---

## 👤 Konten & Aset

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 28 | **Foto Tim: Rava, Ichlas, Fathim** | ❌ | Foto untuk halaman `/about` atau profil tim belum ada |

---

## 📣 Marketing & Promosi

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 29 | **Konten Promosi — X (Twitter)** | ❌ | Thread/tweet launch belum disiapkan |
| 30 | **Konten Promosi — WAG (WhatsApp Group)** | ❌ | Teks broadcast WAG belum dibuat |
| 31 | **Konten Promosi — WA Story** | ❌ | Story template belum dibuat |
| 32 | **Konten Promosi — Instagram** | ❌ | Feed post + caption + hashtag belum disiapkan |

---

## 📋 Priority Order (Rekomendasi)

```text
SPRINT 1 — Core Blocking Issues
  1. Komisisi → Jago (revenue model)
  2. Xendit & Biteship production keys verified
  3. Biteship webhook handler
  4. Cron jobs (expire offer/order)

SPRINT 2 — Legal & Halaman Wajib
  5. Terms & Conditions
  6. Privacy Policy
  7. Shipping & Return Policy
  8. FAQ / Help
  9. Contact Us
  10. How It Works
  11. Navigation links ke semua halaman di atas

SPRINT 3 — Polish & Kualitas
  12. Mobile/Tab responsive audit menyeluruh
  13. Hamburger menu QA
  14. anime.js — animasi & ilustrasi
  15. SEO audit (JSON-LD, OG, sitemap)
  16. Dead code cleanup

SPRINT 4 — Features
  17. Chart analytics (seller + buyer)
  18. Following/Followers + privacy settings
  19. Unit test & integration test

SPRINT 5 — Infrastructure
  20. Docker
  21. APK / Play Store
  22. Download page

SPRINT 6 — Konten
  23. README.md update
  24. Foto Rava, Ichlas, Fathim
  25. Konten promosi (X, WAG, WA Story, IG)
```

---

> Total items: **32** · Done: **1** · Partial: **10** · Not Started: **21**
