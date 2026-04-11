# VivaThrift — Master TODO List

> **Last updated:** 11 April 2026
> **Tech Stack:** Nuxt 4.4.2 · Vue 3.5.32 · TypeScript 6.0.2 · Supabase · Xendit · Biteship · Vercel
> **Legend:** ✅ Done · 🔧 Partial · ❌ Not Started

---

## 1. 💰 Keuangan & Disbursement

> Business rules: `server/utils/domain-rules.ts` → `calculatePlatformFee()`
> Fee: Rp 1.000 (≤100k) · Rp 2.000 (≤500k) · 0.5% (>500k)

| # | Item | Status | Detail |
|---|------|--------|--------|
| 1.1 | **Platform fee auto-disbursement ke rekening admin** | ❌ | Fee sudah di-record di kolom `platform_fee` tabel orders, tapi **belum ada flow otomatis** yang mentransfer ke rekening admin **Bank Jago 1034 3858 8617** (a.n. Muhammad Iqbal Baiduri Yamani). Opsi: (a) Xendit Disbursement API batch harian, (b) manual withdrawal dari Xendit Balance. File terkait: `server/api/webhooks/xendit.post.ts` (490 baris, handle paid/expired/failed) |
| 1.2 | **Seller payout completion** | 🔧 | Utility `server/utils/xendit-disburse.ts` sudah ada dan dipakai oleh flow order/cron untuk mencairkan dana seller + fee admin. Yang masih perlu dibereskan: verifikasi readiness production, retry/reconciliation, dan audit data rekening seller |
| 1.3 | **Refund flow untuk dispute** | 🔧 | `server/api/disputes/[id].patch.ts` sudah bisa resolve dispute (`refund`, `partial`, `rejected`) dan kirim notifikasi. Yang belum ada: integrasi Xendit refund/disbursement reversal saat admin memilih refund |

---

## 2. 💳 Payment & Shipping — Production Readiness

| # | Item | Status | Detail |
|---|------|--------|--------|
| 2.1 | **Xendit production key verification** | 🔧 | URL sudah `api.xendit.co`. **Checklist:** (a) `XENDIT_KEY` di Vercel env = production key (bukan test `xnd_development_*`), (b) webhook callback URL = `https://vivathrift.vercel.app/api/webhooks/xendit`, (c) `XENDIT_CALLBACK_TOKEN` match, (d) IP whitelist jika ada |
| 2.2 | **Biteship production key verification** | 🔧 | URL sudah `api.biteship.com` di `server/utils/biteship.ts`. **Checklist:** (a) `BITESHIP_KEY` = production key, (b) webhook URL registered di Biteship dashboard, (c) origin/destination mapping valid format Biteship |
| 2.3 | **Biteship webhook handler** | 🔧 | `server/api/webhooks/biteship.post.ts` sudah ada, menerima update tracking, mendukung verifikasi auth webhook opsional via token/basic auth dari dashboard Biteship, bisa mendorong order `confirmed` menjadi `shipped` saat event kurir menunjukkan paket sudah masuk alur pengiriman, dan mengirim notifikasi exception shipping ke buyer, seller, serta admin/moderator dengan tipe admin khusus yang diarahkan ke dashboard admin. Yang masih belum lengkap: rollout credential webhook di production dan enrichment automasi operasional di status exception tertentu |
| 2.4 | **Cart-based checkout** | 🔧 | Frontend cart sudah ada, tetapi route backend `server/api/cart/` belum tersedia. Saat ini checkout masih efektif via offer flow (1 produk per transaksi), jadi multi-item cart checkout belum terhubung end-to-end |

---

## 3. ⚙️ Backend & Infrastruktur

> Server: `server/` — Nitro routes, 26 Supabase migrations, rate-limit middleware
> Cron: `vercel.json` → `/api/cron/cleanup` setiap 6 jam

| # | Item | Status | Detail |
|---|------|--------|--------|
| 3.1 | **Cron job: order/offer cleanup** | ✅ | `server/api/cron/cleanup.post.ts` sudah ada via Vercel Cron (setiap 6 jam). Handles: expire pending offers >24h, cancel unpaid orders >1h, auto-complete shipped orders >7 hari |
| 3.2 | **Rate limiting → Redis (production)** | 🔧 | `server/middleware/rate-limit.ts` sekarang sudah memakai abstraksi store dengan dukungan Upstash Redis REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) dan fallback aman ke in-memory store jika env belum diisi atau provider gagal. Fallback ke memory dan exceed pertama 429 juga sudah punya observability ringan via log/Sentry yang di-throttle, dan bila Upstash tersedia snapshot-nya ikut dipublikasikan ke admin dashboard sebagai global snapshot lintas instance. Yang masih perlu dituntaskan: isi env production dan validasi perilaku limit global lintas instance di deployment Vercel |
| 3.3 | **Reviews endpoint** | ✅ | `server/api/reviews/index.post.ts` sudah meng-handle auth buyer, status order `completed`, duplicate review prevention, dan insert review. Frontend `ReviewModal.vue` tinggal bergantung pada coverage test/integrasi |
| 3.4 | **Admin Supabase client security** | 🔧 | `server/utils/supabase-admin.ts` sudah memakai `SUPABASE_SECRET_KEY` dengan fallback kompatibilitas ke `SUPABASE_SERVICE_KEY`. Yang masih perlu dijaga: service role key production harus valid dan tidak pernah bocor ke client |
| 3.5 | **Docker setup** | ❌ | Belum ada `Dockerfile` / `docker-compose.yml`. Perlu untuk: local dev parity, self-hosting option, CI integration test environment |
| 3.6 | **Environment variables documentation** | ✅ | `.env.example` sudah tersedia dan README sudah merangkum env utama, termasuk penamaan baru `SUPABASE_SECRET_KEY`, `R2_*`, `VAPID_*`, `RESEND_API_KEY`, `XENDIT_*`, `BITESHIP_KEY`, kredensial auth webhook opsional Biteship, dan env Upstash Redis REST untuk rate limiting persisten |

---

## 4. 🛡️ Dispute & Resolution System

> State machine: `server/utils/state-machine.ts` → `disputed → resolved_refund | resolved_release`
> SLA: 14 hari (336 jam) auto-escalate
> Database: tabel `disputes` (id, order_id, reason, evidence_urls, status, refund_amount, resolution_note)

| # | Item | Status | Detail |
|---|------|--------|--------|
| 4.1 | **Dispute creation endpoint** | ✅ | `server/api/disputes/index.post.ts` sudah membuat dispute, memvalidasi buyer + status order, mencegah dispute aktif ganda, dan mengirim notifikasi best-effort ke seller |
| 4.2 | **Dispute resolution endpoint** | 🔧 | `server/api/disputes/[id].patch.ts` sudah mendukung cancel oleh buyer dan resolve oleh admin (`refund`, `partial`, `rejected`) plus notifikasi. Yang belum ada: eksekusi refund finansial ke Xendit saat resolution mengembalikan dana |
| 4.3 | **Evidence upload** | ❌ | `evidence_urls TEXT[]` ada di schema, tapi UI untuk upload bukti (foto/video) di `disputes.vue` belum ada. Bisa pakai existing `useR2Upload.ts` composable |
| 4.4 | **Dispute notification emails** | ❌ | Belum ada email ke admin/buyer/seller saat dispute dibuat, di-review, atau resolved. Template engine: `server/utils/email-templates.ts` + `send-email.ts` (Resend) |
| 4.5 | **Auto-escalation timer** | ❌ | SLA 14 hari ada di `ORDER_SLA_HOURS.disputed = 336`, tapi belum ada cron/trigger yang auto-escalate dispute jika timeout |

---

## 5. 📄 Halaman Informasi & Legal

> Footer: "Tentang" → `/about` ✅, "Bantuan" → `/faq` ✅, "Syarat & Ketentuan" → `/terms` ✅, "Privasi" → `/privacy` ✅, "Kontak" → `/contact` ✅

| # | Item | Status | Detail |
|---|------|--------|--------|
| 5.1 | **Terms & Conditions** (`/terms`) | ✅ | `app/pages/terms.vue` — 10 sections, `lang=ts`, SEO meta done |
| 5.2 | **Privacy Policy** (`/privacy`) | ✅ | `app/pages/privacy.vue` — 8 sections, `lang=ts`, SEO meta done |
| 5.3 | **FAQ / Help** (`/faq`) | ✅ | `app/pages/faq.vue` — 17 FAQ items, category filter, `lang=ts`, SEO meta done |
| 5.4 | **Contact Us** (`/contact`) | ✅ | `server/api/contact.post.ts` — validasi, honeypot, rate-limit 3req/5min, dual Resend email (team + auto-reply). `contact.vue` terhubung ke API, error banner, honeypot field |
| 5.5 | **How It Works** (`/how-it-works`) | ✅ | `app/pages/how-it-works.vue` — buy/sell step cards, features, categories, `lang=ts`, SEO meta done |
| 5.6 | **Shipping & Return Policy** (`/shipping-policy`) | ✅ | `app/pages/shipping-policy.vue` — shipping methods, return policy, return steps, `lang=ts`, SEO meta done |
| 5.7 | **Footer & Nav links update** | ✅ | `Footer.vue` updated (5 links), `MobileMenu.vue` updated (+ how-it-works/faq/contact), sitemap auto-discovered |

---

## 6. 🖥️ UI / UX / Responsivitas

> 26 halaman exist. Tailwind responsive classes digunakan, tapi belum full audit.
> Animasi: `app/assets/css/animations.css` (100+ baris keyframes) + `useScrollReveal.ts`

| # | Item | Status | Detail |
|---|------|--------|--------|
| 6.1 | **Mobile/Tablet responsive audit** | 🔧 | Navbar + index sudah responsive (`showMobileMenu`, grid cols responsive). **Belum audit:** checkout, orders, disputes, admin, profile/edit, chat. Breakpoints: `sm:640` `md:768` `lg:1024` |
| 6.2 | **Hamburger menu QA** | 🔧 | `NavbarMobileMenu.vue` exist. **Perlu QA:** (a) semua link lengkap (termasuk legal pages baru), (b) scroll-lock saat open, (c) swipe-to-dismiss, (d) animation enter/leave |
| 6.3 | **Animasi & Micro-interactions** | 🔧 | `animations.css` ada (scroll-reveal, fade, slide). `animejs.com` belum di-install — perlu keputusan: pakai CSS animations yang sudah ada atau upgrade ke anime.js. Prioritas: page transition, card hover, skeleton loading, toast animation |
| 6.4 | **Ilustrasi SVG** | 🔧 | Folder `public/img/illustrations/` sudah berisi aset untuk help center, empty state, empty cart, error, auth, order, dan onboarding. Yang masih perlu: audit pemakaian aset di seluruh halaman dan tambah ilustrasi khusus untuk flow yang belum punya visual |
| 6.5 | **Dark mode polish** | 🔧 | `useDarkMode.ts` composable ada + `useUserSettings.ts` persist. Perlu audit: semua page & component consistent dark/light, border colors, shadow opacity, image contrast |

---

## 7. 💬 Chat System Enhancements

> 6 composables: `useChatPresence`, `useChatSearch`, `useChatReadStatus`, `useChatMessages`, `useChatOffer`, `useChatRealtime`
> 5 components: ChatHeader, ChatInputArea, ChatMessageBubble, ChatOfferModal, ChatSearchBar
> ✅ Working: realtime messaging, presence, read receipts, offers, search, reply-to, edit/delete

| # | Item | Status | Detail |
|---|------|--------|--------|
| 7.1 | **Typing indicator** | ❌ | Belum ada "User sedang mengetik..." — bisa via Supabase Realtime broadcast channel (bukan DB insert) |
| 7.2 | **Message reactions / emoji picker** | ❌ | `useChatMessages.ts` punya note "reactions TBD". Perlu: emoji picker UI + `message_reactions` tabel/kolom |
| 7.3 | **Image/file sharing dalam chat** | ❌ | Saat ini chat hanya teks + offers. Perlu: upload gambar via `useR2Upload.ts` → tampilkan di `ChatMessageBubble.vue` |
| 7.4 | **Chat notification (sound + badge)** | 🔧 | `useNavChatBadge.ts` ada untuk nav badge count. Belum ada: notification sound, push notification, desktop notification |
| 7.5 | **Message forwarding** | ❌ | Forward pesan ke chat lain — low priority |
| 7.6 | **Chat archive/mute** | ❌ | Per-user hide sudah ada (WhatsApp-style, reappear on new message). Belum ada: permanent archive, mute notifications per chat |

---

## 8. 🏪 Admin Dashboard

> Middleware: `app/middleware/admin.ts` — restrict ke role `admin` / `moderator`
> API: `server/api/admin/` — disputes, stats, products (moderate), reports (resolve), users (ban)
> DB: migration `20260407000004_admin_infrastructure.sql` — RLS policies + audit tables

| # | Item | Status | Detail |
|---|------|--------|--------|
| 8.1 | **Dashboard metrics UI** | 🔧 | `app/pages/admin/index.vue` sudah menampilkan overview cards untuk metrik utama, termasuk counter incident shipping unread untuk admin, alert ringkas jika ada incident operasional baru, dan daftar singkat incident shipping terbaru. Yang masih kurang: visualisasi chart yang lebih analitis dan insight historis, bukan hanya summary cards |
| 8.2 | **Product moderation queue** | 🔧 | UI moderation produk sudah ada di `app/pages/admin/index.vue` dengan search, tab status, dan aksi approve/reject/ban. Yang masih bisa ditingkatkan: filtering lebih kaya, bulk action, dan context moderation yang lebih lengkap |
| 8.3 | **User management UI** | 🔧 | UI manajemen user sudah ada di `app/pages/admin/index.vue` dengan search, badge role, ban, dan unban. Yang masih kurang: suspend granular, audit trail per aksi, dan filter yang lebih lengkap |
| 8.4 | **Report management UI** | 🔧 | Review UI laporan sudah ada di `app/pages/admin/index.vue` dan terhubung ke API resolve/dismiss. Yang masih bisa ditambah: attachment/context lebih kaya dan workflow moderasi yang lebih mendalam |
| 8.5 | **Dispute resolution UI** | 🔧 | Tab dispute admin sudah ada di `app/pages/admin/index.vue` dan bisa resolve `refund`, `partial`, atau `rejected`. Yang masih kurang: review evidence yang lebih lengkap, context order lebih detail, dan integrasi refund finansial end-to-end |
| 8.6 | **Audit log viewer** | ❌ | Audit table exist di DB (migration), tapi viewer UI belum ada. Perlu: tabel log dengan filter (who, what, when) |

---

## 9. 🛒 Product Features

> Pages: `create.vue` (upload + crop), `[id].vue` (detail), `edit/[id].vue` (edit)
> 10 components di `app/components/product/`
> Offer validation di `server/api/offers/index.post.ts` — min 50% listing price, self-purchase block

| # | Item | Status | Detail |
|---|------|--------|--------|
| 9.1 | **Product search improvement** | 🔧 | Saat ini pakai Supabase `.ilike()` / `.textSearch()`. Perlu: full-text search index (PostgreSQL `tsvector`), typo tolerance, category facets |
| 9.2 | **Product recommendations** | ❌ | Belum ada "Produk Serupa" atau "Sering Dibeli Bareng". Bisa mulai simple: same category + same faculty |
| 9.3 | **Recently viewed** | ✅ | `useRecentlyViewed.ts` composable sudah ada dan berfungsi |
| 9.4 | **Product expiration** | ❌ | Produk active selamanya. Perlu: auto-archive setelah 90 hari tidak update / tidak ada views. Bisa via cron |
| 9.5 | **Bulk upload (CSV)** | ❌ | Seller hanya bisa upload 1 produk per form. Belum ada CSV import untuk power sellers |

---

## 10. 👤 Profile & User System

> Pages: `profile/[id].vue` (public), `profile/edit.vue` (5 tabs: Profile, Address, Security, Notifications, Rekening)
> Composables: `useProfileEdit`, `useAvatarUpload`, `useAddressEdit`, `usePasswordChange`, `useMyRating`, `useUserSettings`

| # | Item | Status | Detail |
|---|------|--------|--------|
| 10.1 | **2FA (Two-Factor Auth)** | ❌ | Tab Security di profile/edit ada, tapi 2FA (TOTP/SMS) belum diimplementasi. Supabase Auth support MFA — perlu enable + UI |
| 10.2 | **Profile verification badges** | ❌ | Belum ada badge (verified email ✓, verified phone ✓, trusted seller ⭐). Data email/phone sudah ada di profile |
| 10.3 | **Seller response time metric** | ❌ | Rata-rata waktu seller respond offer belum dihitung. Data timestamp offer ada di DB |
| 10.4 | **Account deletion workflow** | ❌ | Belum ada flow hapus akun (GDPR-style). Perlu: soft-delete, data anonymization, confirmation email |

---

## 11. 👥 Sosial

> Pages: `followers.vue`, `following.vue` — follow/unfollow, avatar, NRP display

| # | Item | Status | Detail |
|---|------|--------|--------|
| 11.1 | **Followers/Following pagination** | 🔧 | List ada tapi belum pakai infinite scroll / pagination untuk user dengan banyak followers |
| 11.2 | **Privacy toggle** | ❌ | Belum bisa sembunyikan followers list dari publik. Perlu: kolom `is_followers_public` di profile + toggle di settings |
| 11.3 | **Activity feed** | ❌ | Belum ada feed "User X baru upload produk Y" atau "User X follow User Z" |
| 11.4 | **Follower count on profile** | ❌ | Halaman profile `[id].vue` belum menampilkan jumlah followers / following |

---

## 12. 🔍 SEO & Structured Data

> Sitemap: `server/api/__sitemap__/urls.ts` — dynamic untuk products + profiles
> Meta: `app.vue` global meta tags. Per-page `useSeoMeta()` belum konsisten
> Analytics: Vercel Analytics ✅ + Speed Insights ✅

| # | Item | Status | Detail |
|---|------|--------|--------|
| 12.1 | **JSON-LD structured data** | ❌ | Tidak ada `<script type="application/ld+json">` di page mana pun. Prioritas: (a) `Product` schema di `products/[id].vue`, (b) `Organization` di `app.vue`, (c) `BreadcrumbList` di semua page |
| 12.2 | **Per-page OG image** | 🔧 | Global OG tags ada. Product page perlu `og:image` = foto pertama produk, `og:title` = nama produk, `og:description` = deskripsi singkat |
| 12.3 | **Canonical URL** | 🔧 | Perlu audit: setiap page harus punya `<link rel="canonical">` yang benar, terutama product pages (slug-based vs ID-based) |
| 12.4 | **Breadcrumb navigation** | ❌ | Belum ada breadcrumb UI maupun `BreadcrumbList` schema |

---

## 13. 🧪 Testing

> **Status:** Vitest sudah aktif dengan 8 test file: `domain-rules`, `state-machine`, helper webhook Xendit, helper webhook Biteship, service webhook Xendit, service webhook Biteship, auth webhook, dan route webhook. Script test tersedia di `package.json`.

| # | Item | Status | Detail |
|---|------|--------|--------|
| 13.1 | **Setup Vitest** | ✅ | `vitest.config.ts` sudah ada dan script test sudah terpasang di `package.json` |
| 13.2 | **Unit tests — Domain rules** | ✅ | `tests/domain-rules.test.ts` sudah meng-cover fungsi domain inti |
| 13.3 | **Unit tests — State machine** | ✅ | `tests/state-machine.test.ts` sudah meng-cover transisi valid dan invalid utama |
| 13.4 | **Integration tests — Webhook** | ✅ | Coverage webhook sekarang mencakup helper murni, orchestration service dengan dependency mock, aturan autentikasi callback/token/basic auth, dan route-level wiring Nitro/H3 untuk Xendit dan Biteship. Masih mungkin ditambah nanti dengan test yang lebih dekat ke runtime penuh, tetapi gap regresi utama untuk webhook sudah tertutup |
| 13.5 | **Integration tests — Checkout flow** | ❌ | Test: create offer → accept → create invoice → payment → order confirmed → shipped → completed |
| 13.6 | **E2E tests — Playwright** | ❌ | Setup Playwright. Prioritas: login flow, product upload, offer → checkout, chat basic flow |

---

## 14. ⚡ Performance

| # | Item | Status | Detail |
|---|------|--------|--------|
| 14.1 | **Vercel Speed Insights** | ✅ | `@vercel/speed-insights@2.0.0` installed + configured |
| 14.2 | **Vercel Analytics** | ✅ | `@vercel/analytics` installed via `plugins/vercel-analytics.client.ts` |
| 14.3 | **Core Web Vitals audit** | ❌ | Belum ada Lighthouse CI di GitHub Actions. Perlu: LCP, CLS, INP baseline measurement |
| 14.4 | **Image optimization** | 🔧 | Produk pakai R2 upload (`useR2Upload.ts`). Belum ada: responsive `srcset`, WebP conversion, lazy loading audit |
| 14.5 | **Bundle analysis** | ❌ | Belum pernah run bundle analyzer. Perlu: `npx nuxi analyze` → identifikasi bloat |

---

## 15. 📱 PWA & Mobile

> Manifest: `public/manifest.webmanifest` (standalone, portrait, id lang, 4 icons)
> Service Worker: `public/sw.js` — network-first nav + stale-while-revalidate assets + offline fallback
> SW Registration: `app/plugins/sw-register.client.ts`

| # | Item | Status | Detail |
|---|------|--------|--------|
| 15.1 | **Offline page** | 🔧 | `app/pages/offline.vue` sudah ada dengan pesan offline dan tombol retry. Yang masih kurang: konten yang lebih membantu, integrasi cached browsing, dan pengalaman fallback yang lebih kaya dari sekadar retry manual |
| 15.2 | **Push notifications** | 🔧 | Fondasi Web Push sudah ada: `usePushNotifications.ts`, service worker, endpoint subscribe/unsubscribe, dan endpoint `vapid-public-key`. Yang masih perlu: integrasi UI yang lebih menyeluruh, opt-in UX, dan validasi delivery end-to-end di production |
| 15.3 | **App install banner** | ❌ | Belum ada custom install prompt UI. Browser auto-prompt sudah jalan karena manifest valid |
| 15.4 | **App update notification** | ❌ | SW `sw-register.client.ts` log registration tapi belum handle `updatefound` event → notify user "Update tersedia, reload?" |
| 15.5 | **APK / Play Store** | ❌ | Belum ada native wrapper (Capacitor / TWA). Termasuk: Play Store listing, screenshots, deskripsi |
| 15.6 | **Download App page** (`/download`) | ❌ | Halaman belum ada. Konten: link APK + QR code + PWA install instructions |

---

## 16. 🧹 Code Quality & Documentation

> TypeScript strict: `noUncheckedIndexedAccess: true`
> CI: GitHub Actions → test + typecheck + build
> PKCE auth quirk: password recovery workaround via localStorage flag

| # | Item | Status | Detail |
|---|------|--------|--------|
| 16.1 | **Dead code cleanup** | ❌ | **Sisa target nyata:** (a) flow cart belum punya route backend `server/api/cart/`, ~~(b) `reviews/index.post.ts` stub~~ ✅ implemented, ~~(c) `xendit-disburse.ts` incomplete~~ ✅ utility sudah dipakai di order/cron flow, ~~(d) `disputes/[id].patch.ts` stub~~ ✅ implemented, ~~(e) Footer "Bantuan" / "Syarat" placeholder~~ ✅ fixed, ~~(f) `contact.vue` handleSubmit stub~~ ✅ fixed |
| 16.2 | **`.env.example`** | ✅ | File tersedia dan sudah memakai penamaan env terbaru: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SECRET_KEY`, `R2_*`, `SENTRY_*`, `VAPID_*`, `RESEND_API_KEY`, `XENDIT_*`, `BITESHIP_KEY`, `BITESHIP_WEBHOOK_*`, `UPSTASH_REDIS_REST_*`, `SITE_URL` |
| 16.3 | **README.md update** | ✅ | README sekarang mencakup setup lokal, architecture overview + Mermaid diagram, ringkasan API domain, dan deployment guide Vercel |
| 16.4 | **OpenAPI spec** | 🔧 | Fondasi awal tersedia di `docs/api/openapi-public.yaml` untuk `contact` dan `push`. Endpoint lain masih belum terdokumentasi |
| 16.5 | **Pre-commit hooks** | ❌ | Belum ada husky/lint-staged. Perlu: eslint + prettier + typecheck on commit |
| 16.6 | **CONTRIBUTING.md** | ✅ | `CONTRIBUTING.md` ditambahkan: setup lokal, naming branch, Conventional Commits, quality checks, dan PR checklist |

---

## 17. 📊 Analytics & Data

| # | Item | Status | Detail |
|---|------|--------|--------|
| 17.1 | **Seller analytics chart UI** | 🔧 | `server/api/seller/analytics.get.ts` return: total orders, revenue, avg rating, top products, monthly revenue. Frontend chart belum ada (Chart.js / ApexCharts belum installed) |
| 17.2 | **Buyer analytics** | ❌ | Belum ada endpoint maupun UI: total pengeluaran, riwayat belanja, kategori favorit, monthly spending |
| 17.3 | **GA4 / product analytics** | ❌ | Hanya Vercel Analytics (page views). Belum ada: event tracking (view_item, add_to_cart, purchase), conversion funnel, cohort analysis |

---

## 18. 👤 Konten & Aset

| # | Item | Status | Detail |
|---|------|--------|--------|
| 18.1 | **Foto tim: Rava, Ichlas, Fathim** | ❌ | Foto untuk halaman `/about` belum tersedia |

---

## 19. 📣 Marketing & Promosi

| # | Item | Status | Detail |
|---|------|--------|--------|
| 19.1 | **Konten promosi — X (Twitter)** | ❌ | Thread/tweet launch belum disiapkan |
| 19.2 | **Konten promosi — WAG** | ❌ | Teks broadcast WhatsApp Group belum dibuat |
| 19.3 | **Konten promosi — WA Story** | ❌ | Story template belum dibuat |
| 19.4 | **Konten promosi — Instagram** | ❌ | Feed post + caption + hashtag belum disiapkan |

---

## 📋 Sprint Plan (Rekomendasi Prioritas)

### SPRINT 1 — Revenue & Production Blocking (1-2 minggu)

```text
1.1  Platform fee disbursement ke Bank Jago
1.2  Seller payout completion (xendit-disburse.ts)
2.1  Xendit production key verification
2.2  Biteship production key verification
2.3  Biteship webhook handler
3.2  Rate limiting → Upstash Redis
```

### SPRINT 2 — Legal & Halaman Wajib (1 minggu)

```text
5.1  Terms & Conditions (/terms)
5.2  Privacy Policy (/privacy)
5.3  FAQ / Help (/faq)
5.4  Contact Us (/contact)
5.5  How It Works (/how-it-works)
5.6  Shipping & Return Policy (/shipping-policy)
5.7  Footer & Nav links update
```

### SPRINT 3 — Core Features Completion (1-2 minggu)

```text
4.1  Dispute creation endpoint
4.2  Dispute resolution endpoint + refund flow
4.3  Evidence upload
3.3  Reviews endpoint completion
8.1  Admin dashboard metrics UI
8.2  Product moderation queue UI
8.5  Dispute resolution admin UI
```

### SPRINT 4 — Quality & Testing (1 minggu)

```text
13.1 Setup Vitest
13.2 Unit tests — domain-rules.ts
13.3 Unit tests — state-machine.ts
13.4 Integration tests — webhook
16.1 Dead code cleanup
16.2 .env.example
16.5 Pre-commit hooks
```

### SPRINT 5 — Polish & UX (1 minggu)

```text
6.1  Mobile/Tablet responsive audit
6.2  Hamburger menu QA
6.3  Animasi & micro-interactions
6.5  Dark mode polish
12.1 JSON-LD structured data
12.2 Per-page OG image
14.3 Core Web Vitals audit
```

### SPRINT 6 — Enhanced Features (ongoing)

```text
7.1  Chat typing indicator
7.3  Image sharing dalam chat
9.1  Product search improvement
10.1 2FA
11.2 Social privacy toggle
17.1 Seller analytics chart UI
17.2 Buyer analytics
```

### SPRINT 7 — Mobile & Marketing (post-launch)

```text
15.2 Push notifications
15.5 APK / Play Store
15.6 Download page
19.* Konten promosi (X, WAG, WA Story, IG)
18.1 Foto tim
```

---

## Status Summary

| Kategori | ✅ Done | 🔧 Partial | ❌ Not Started | Total |
|----------|---------|------------|----------------|-------|
| Keuangan | 0 | 1 | 2 | 3 |
| Payment/Shipping | 0 | 3 | 1 | 4 |
| Backend/Infra | 1 | 3 | 2 | 6 |
| Disputes | 0 | 2 | 3 | 5 |
| Legal Pages | 0 | 0 | 7 | 7 |
| UI/UX | 0 | 3 | 2 | 5 |
| Chat | 0 | 1 | 5 | 6 |
| Admin | 0 | 4 | 2 | 6 |
| Products | 1 | 1 | 3 | 5 |
| Profile/User | 0 | 0 | 4 | 4 |
| Sosial | 0 | 1 | 3 | 4 |
| SEO | 0 | 2 | 2 | 4 |
| Testing | 0 | 0 | 6 | 6 |
| Performance | 2 | 1 | 2 | 5 |
| PWA/Mobile | 0 | 1 | 5 | 6 |
| Code Quality | 0 | 1 | 5 | 6 |
| Analytics | 0 | 1 | 2 | 3 |
| Konten | 0 | 0 | 1 | 1 |
| Marketing | 0 | 0 | 4 | 4 |
| **TOTAL** | **4** | **25** | **65** | **94** |
