# VivaThrift — Master TODO List

> **Last updated:** 11 Juli 2025
> **Tech Stack:** Nuxt 4.4.2 · Vue 3.5.32 · TypeScript 6.0.2 · Supabase · Xendit · Biteship · Vercel
> **Legend:** ✅ Done · 🔧 Partial · ❌ Not Started

---

## 1. 💰 Keuangan & Disbursement

> Business rules: `server/utils/domain-rules.ts` → `calculatePlatformFee()`
> Fee: Rp 1.000 (≤100k) · Rp 2.000 (≤500k) · 0.5% (>500k)

| # | Item | Status | Detail |
|---|------|--------|--------|
| 1.1 | **Platform fee auto-disbursement ke rekening admin** | ❌ | Fee sudah di-record di kolom `platform_fee` tabel orders, tapi **belum ada flow otomatis** yang mentransfer ke rekening admin **Bank Jago 1034 3858 8617** (a.n. Muhammad Iqbal Baiduri Yamani). Opsi: (a) Xendit Disbursement API batch harian, (b) manual withdrawal dari Xendit Balance. File terkait: `server/api/webhooks/xendit.post.ts` (490 baris, handle paid/expired/failed) |
| 1.2 | **Seller payout completion** | 🔧 | File `xendit-disburse.ts` ada tapi **incomplete** — logic payout ke seller setelah order `completed` belum selesai. Perlu: validasi bank account seller dari `profile/edit.vue` tab Rekening (kode bank, no rek, nama), lalu fire Xendit Disbursement |
| 1.3 | **Refund flow untuk dispute** | ❌ | `server/api/disputes/[id].patch.ts` masih **stub**. Saat admin resolve dispute dengan `resolved_refund`, belum ada Xendit refund API call. State machine sudah support transisi `disputed → resolved_refund` |

---

## 2. 💳 Payment & Shipping — Production Readiness

| # | Item | Status | Detail |
|---|------|--------|--------|
| 2.1 | **Xendit production key verification** | 🔧 | URL sudah `api.xendit.co`. **Checklist:** (a) `XENDIT_API_KEY` di Vercel env = production key (bukan test `xnd_development_*`), (b) webhook callback URL = `https://vivathrift.vercel.app/api/webhooks/xendit`, (c) webhook verification token match, (d) IP whitelist jika ada |
| 2.2 | **Biteship production key verification** | 🔧 | URL sudah `api.biteship.com` di `server/utils/biteship.ts`. **Checklist:** (a) `BITESHIP_API_KEY` = production key, (b) webhook URL registered di Biteship dashboard, (c) origin/destination mapping valid format Biteship |
| 2.3 | **Biteship webhook handler** | ❌ | Xendit webhook fully implemented (490 baris), tapi **Biteship webhook belum ada**. Perlu: `server/api/webhooks/biteship.post.ts` untuk handle tracking status updates (picked_up, in_transit, delivered). Order state: `shipped → completed` bisa auto-trigger dari sini |
| 2.4 | **Cart-based checkout** | 🔧 | Endpoint di `server/api/cart/` ada tapi **kosong / stub**. Saat ini checkout hanya via offer flow (1 produk per transaksi). Multi-item cart checkout belum diimplementasi |

---

## 3. ⚙️ Backend & Infrastruktur

> Server: `server/` — Nitro routes, 26 Supabase migrations, rate-limit middleware
> Cron: `vercel.json` → `/api/cron/cleanup` setiap 6 jam

| # | Item | Status | Detail |
|---|------|--------|--------|
| 3.1 | **Cron job: order/offer cleanup** | ✅ | `server/api/cron/cleanup.post.ts` sudah ada via Vercel Cron (setiap 6 jam). Handles: expire pending offers >24h, cancel unpaid orders >1h, auto-complete shipped orders >7 hari |
| 3.2 | **Rate limiting → Redis (production)** | 🔧 | `server/middleware/rate-limit.ts` pakai **in-memory Map** (auth: 8/min, upload: 10/min, default: 60/min). Ini **tidak persist across serverless instances** di Vercel. Perlu migrasi ke Upstash Redis atau Vercel KV untuk production |
| 3.3 | **Reviews endpoint** | 🔧 | `server/api/reviews/index.post.ts` masih **stub** — logic create review belum lengkap. Frontend `ReviewModal.vue` sudah ada |
| 3.4 | **Admin Supabase client security** | 🔧 | `server/utils/supabase-admin.ts` pakai module-level `createClient()` — env `SUPABASE_SERVICE_KEY` wajib ada. CI sudah pakai placeholder (commit `652aff5`), tapi di production harus service role key asli |
| 3.5 | **Docker setup** | ❌ | Belum ada `Dockerfile` / `docker-compose.yml`. Perlu untuk: local dev parity, self-hosting option, CI integration test environment |
| 3.6 | **Environment variables documentation** | ❌ | Env vars tersebar: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`, `XENDIT_API_KEY`, `XENDIT_WEBHOOK_TOKEN`, `BITESHIP_API_KEY`, `R2_*` (4 vars), `RESEND_API_KEY`. Belum ada `.env.example` atau docs yang lengkap |

---

## 4. 🛡️ Dispute & Resolution System

> State machine: `server/utils/state-machine.ts` → `disputed → resolved_refund | resolved_release`
> SLA: 14 hari (336 jam) auto-escalate
> Database: tabel `disputes` (id, order_id, reason, evidence_urls, status, refund_amount, resolution_note)

| # | Item | Status | Detail |
|---|------|--------|--------|
| 4.1 | **Dispute creation endpoint** | 🔧 | `server/api/disputes/index.post.ts` ada tapi **stub**. Validasi (orderId, reason min 10 chars) sudah ada, tapi insert logic belum complete |
| 4.2 | **Dispute resolution endpoint** | 🔧 | `server/api/disputes/[id].patch.ts` **stub**. Perlu: admin review evidence → approve refund / partial refund / reject → trigger Xendit refund jika `resolved_refund` |
| 4.3 | **Evidence upload** | ❌ | `evidence_urls TEXT[]` ada di schema, tapi UI untuk upload bukti (foto/video) di `disputes.vue` belum ada. Bisa pakai existing `useR2Upload.ts` composable |
| 4.4 | **Dispute notification emails** | ❌ | Belum ada email ke admin/buyer/seller saat dispute dibuat, di-review, atau resolved. Template engine: `server/utils/email-templates.ts` + `send-email.ts` (Resend) |
| 4.5 | **Auto-escalation timer** | ❌ | SLA 14 hari ada di `ORDER_SLA_HOURS.disputed = 336`, tapi belum ada cron/trigger yang auto-escalate dispute jika timeout |

---

## 5. 📄 Halaman Informasi & Legal

> Footer saat ini: "Tentang" → `/about` ✅, "Bantuan" → `#` ❌, "Syarat & Ketentuan" → `#` ❌

| # | Item | Status | Detail |
|---|------|--------|--------|
| 5.1 | **Terms & Conditions** (`/terms`) | ❌ | Halaman belum ada. Konten: hak & kewajiban buyer/seller, kebijakan refund, batasan tanggung jawab platform. Style referensi: Spotify T&C |
| 5.2 | **Privacy Policy** (`/privacy`) | ❌ | Halaman belum ada. Konten: data collection (email, NRP, fakultas, lokasi GPS), data sharing, cookies, hak pengguna. Style referensi: Remote.com |
| 5.3 | **FAQ / Help** (`/faq`) | ❌ | Halaman belum ada. Konten: cara jual, cara beli, cara nego, pengiriman, COD meetup flow, dispute, fee platform |
| 5.4 | **Contact Us** (`/contact`) | ❌ | Halaman belum ada. Konten: form kontak + link email/IG/WA tim. Integrasi: `send-email.ts` (Resend) |
| 5.5 | **How It Works** (`/how-it-works`) | ❌ | Halaman belum ada. Onboarding visual: (1) Daftar → (2) Upload/Browse → (3) Chat & Nego → (4) Bayar → (5) Kirim/COD → (6) Selesai. Bisa pakai SVG ilustrasi dari `public/img/illustrations/` |
| 5.6 | **Shipping & Return Policy** (`/shipping-policy`) | ❌ | Halaman belum ada. Konten: metode (COD di ITS + kurir Biteship), meetup locations (11 lokasi di `MEETUP_LOCATIONS`), SLA pengiriman, prosedur return/refund |
| 5.7 | **Footer & Nav links update** | ❌ | Setelah page dibuat: (a) Update `Footer.vue` — ganti `href="#"` dengan route asli, (b) Tambah link di `NavbarMobileMenu`, (c) Tambah di sitemap |

---

## 6. 🖥️ UI / UX / Responsivitas

> 26 halaman exist. Tailwind responsive classes digunakan, tapi belum full audit.
> Animasi: `app/assets/css/animations.css` (100+ baris keyframes) + `useScrollReveal.ts`

| # | Item | Status | Detail |
|---|------|--------|--------|
| 6.1 | **Mobile/Tablet responsive audit** | 🔧 | Navbar + index sudah responsive (`showMobileMenu`, grid cols responsive). **Belum audit:** checkout, orders, disputes, admin, profile/edit, chat. Breakpoints: `sm:640` `md:768` `lg:1024` |
| 6.2 | **Hamburger menu QA** | 🔧 | `NavbarMobileMenu.vue` exist. **Perlu QA:** (a) semua link lengkap (termasuk legal pages baru), (b) scroll-lock saat open, (c) swipe-to-dismiss, (d) animation enter/leave |
| 6.3 | **Animasi & Micro-interactions** | 🔧 | `animations.css` ada (scroll-reveal, fade, slide). `animejs` belum di-install — perlu keputusan: pakai CSS animations yang sudah ada atau upgrade ke anime.js. Prioritas: page transition, card hover, skeleton loading, toast animation |
| 6.4 | **Ilustrasi SVG** | ❌ | Folder `public/img/illustrations/` ada tapi perlu isi: empty state, error state, onboarding, how-it-works visuals. Bisa generate manual atau via AI prompt |
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
| 8.1 | **Dashboard metrics UI** | 🔧 | `admin/stats.get.ts` return data (total users, GMV, disputes, flagged products), tapi `pages/admin/index.vue` belum display chart/cards — hanya empty dashboard |
| 8.2 | **Product moderation queue** | 🔧 | `admin/products/index.get.ts` + `[id].patch.ts` API ada (ban/approve/flag). Frontend moderation UI belum ada |
| 8.3 | **User management UI** | 🔧 | `admin/users/index.get.ts` + `[id].patch.ts` API ada (search, ban/suspend). Frontend UI belum ada |
| 8.4 | **Report management UI** | 🔧 | `admin/reports/index.get.ts` + `[id].patch.ts` API ada. Frontend: `ReportModal.vue` bisa submit report, tapi admin side review UI belum ada |
| 8.5 | **Dispute resolution UI** | ❌ | Admin flow: lihat dispute → review evidence → approve/reject refund. API stub di `disputes/[id].patch.ts`. Frontend admin dispute panel belum ada |
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

> **Status: ZERO test files.** Tidak ada `.test.ts`, `.spec.ts`, vitest config, atau test script di `package.json`.

| # | Item | Status | Detail |
|---|------|--------|--------|
| 13.1 | **Setup Vitest** | ❌ | Install `vitest` + `@vue/test-utils` + `@nuxt/test-utils`. Buat `vitest.config.ts`. Tambah script `"test": "vitest"` di package.json |
| 13.2 | **Unit tests — Domain rules** | ❌ | **Prioritas #1:** Test `domain-rules.ts` — `calculatePlatformFee()` (3 tiers), `validateOfferPrice()` (boundary cases), `isProductAvailable()`, `isValidMeetupLocation()`, `generateMeetupOTP()` |
| 13.3 | **Unit tests — State machine** | ❌ | Test `state-machine.ts` — semua valid/invalid transitions untuk Order (10 states) dan Offer (8 states) |
| 13.4 | **Integration tests — Webhook** | ❌ | Test `webhooks/xendit.post.ts` — mock Xendit payload → verify order status update + email sent |
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
| 15.1 | **Offline page** | 🔧 | SW redirect ke `/offline` saat offline, tapi `pages/offline.vue` belum ada konten yang helpful (hanya placeholder). Perlu: tampilan friendly + retry button + cached product browsing |
| 15.2 | **Push notifications** | ❌ | Belum ada `Notification.requestPermission()` + push subscription. Bisa pakai Supabase Edge Functions + Web Push API |
| 15.3 | **App install banner** | ❌ | Belum ada custom install prompt UI. Browser auto-prompt sudah jalan karena manifest valid |
| 15.4 | **App update notification** | ❌ | SW `sw-register.client.ts` log registration tapi belum handle `updatefound` event → notify user "Update tersedia, reload?" |
| 15.5 | **APK / Play Store** | ❌ | Belum ada native wrapper (Capacitor / TWA). Termasuk: Play Store listing, screenshots, deskripsi |
| 15.6 | **Download App page** (`/download`) | ❌ | Halaman belum ada. Konten: link APK + QR code + PWA install instructions |

---

## 16. 🧹 Code Quality & Documentation

> TypeScript strict: `noUncheckedIndexedAccess: true`
> CI: GitHub Actions → typecheck + build (fixed, 5 commits)
> PKCE auth quirk: password recovery workaround via localStorage flag

| # | Item | Status | Detail |
|---|------|--------|--------|
| 16.1 | **Dead code cleanup** | ❌ | **Known stubs:** (a) Footer "Bantuan" → `#`, (b) Footer "Syarat" → `#`, (c) `server/api/cart/` endpoints empty, (d) `reviews/index.post.ts` stub, (e) `xendit-disburse.ts` incomplete, (f) `disputes/[id].patch.ts` stub |
| 16.2 | **`.env.example`** | ❌ | Buat file dengan semua required env vars + komentar. Minimal 10+ vars: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`, `XENDIT_API_KEY`, `XENDIT_WEBHOOK_TOKEN`, `BITESHIP_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `RESEND_API_KEY` |
| 16.3 | **README.md update** | 🔧 | README ada (deskripsi, feature table, tech stack, tim). **Perlu tambah:** setup guide (clone → pnpm install → env → `supabase start` → dev), architecture diagram, API overview, deployment guide |
| 16.4 | **OpenAPI spec** | ❌ | 60+ server endpoints belum ada OpenAPI 3.1 spec. Bisa generate dari route files atau manual |
| 16.5 | **Pre-commit hooks** | ❌ | Belum ada husky/lint-staged. Perlu: eslint + prettier + typecheck on commit |
| 16.6 | **CONTRIBUTING.md** | ❌ | Belum ada. Konten: setup guide, branch naming, commit convention, PR template |

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
