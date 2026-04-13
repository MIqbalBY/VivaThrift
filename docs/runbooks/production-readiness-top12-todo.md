# Production Readiness TODO - Top 12 

> Last updated: 13 April 2026
> Scope: 12 prioritas kritis sebelum dianggap production-ready tanpa error blocker.
> Status legend: [ ] Not Started, [~] In Progress, [x] Done

## Akun Buyer Demo

Email: `50252101@student.its.ac.id`
Password: SmokeTest#2026!

## Akun Seller Demo 1

Email: `50252102@student.its.ac.id`
Password: SmokeTest#2026!

## Akun Seller Demo 2

Email: `50252103@student.its.ac.id`
Password: SmokeTest#2026!

## Cara Pakai

1. Isi Owner, Target Date, dan Evidence Link per item.
2. Tandai checklist teknis satu per satu.
3. Item dianggap selesai hanya jika semua sub-task selesai dan DoD terpenuhi.

## 1) Payment Production Config and Callback Integrity

- Priority: P0 (Revenue blocker)
- Owner: *Saya (Mikba)*
- Target Date: *20 April 2026*
- Status: [~]

### Checklist

- [ ] `XENDIT_KEY` production aktif di environment production.
- [x] Webhook URL di dashboard Xendit mengarah ke endpoint production yang benar.
- [x] `XENDIT_CALLBACK_TOKEN` di dashboard dan server identik.
- [x] Webhook invalid token ditolak (401), webhook valid diterima.
- [x] Idempotency webhook mencegah duplicate side effect.
- [ ] Skenario `paid`, `failed`, `expired` tervalidasi end-to-end.
- [x] Log webhook terstruktur tersedia untuk tracing event.
- [ ] Alert error webhook dan lonjakan failure aktif.
- [ ] Runbook insiden payment tersedia dan diuji.

### Evidence

- Dashboard config screenshot: *Set by user (13 Apr 2026)*
- Test report/recording: *13 Apr 2026 - invalid token test: invoice=401, disbursement=401; valid token test: invoice=200 (action=no_orders_found), disbursement=200 (action=unknown_attempt); automated tests passed for webhook auth, Xendit webhook handler, Xendit disbursement webhook handler, and webhook routes (30/30).*
- Incident runbook link: [Xendit webhook alerting setup](docs/runbooks/xendit-webhook-alerting-setup.md)

### Definition of Done

- Semua checklist selesai.
- Tidak ada bug blocker pada callback payment selama smoke test.

## 2) Shipping Production Config and Webhook Reliability

- Priority: P0
- Owner: *Saya (Mikba)*
- Target Date: *20 April 2026*
- Status: [ ]

### Checklist

- [ ] `BITESHIP_KEY` production aktif.
- [ ] Webhook Biteship terdaftar di dashboard production.
- [ ] Auth webhook (token/basic auth) dikonfigurasi dan tervalidasi.
- [ ] Mapping origin/destination valid untuk use case production.
- [ ] Status shipping normal dan exception diproses konsisten.
- [ ] Exception shipping memicu notifikasi buyer/seller/admin sesuai rule.
- [ ] Monitoring dan alert shipping incident aktif.

### Evidence

- Dashboard webhook screenshot: *TBD*
- Exception handling logs: *TBD*

### Definition of Done

- Update status kiriman masuk konsisten.
- Tidak ada event shipping critical yang hilang.

## 3) Checkout End-to-End Hardening

- Priority: P0
- Owner: *Saya (Mikba)*
- Target Date: *20 April 2026*
- Status: [ ]

### Checklist

- [ ] Alur cart checkout sukses dari invoice sampai order confirmed.
- [ ] Skenario failure (payment gagal/expired) mengembalikan state dengan aman.
- [ ] Retry webhook tidak menimbulkan duplicate order mutation.
- [ ] Idempotency key dipakai konsisten pada jalur kritis.
- [ ] Guard state transition mencegah status invalid.
- [ ] Error handling user-facing jelas dan actionable.

### Evidence

- End-to-end test matrix: *TBD*
- Replay event test result: *TBD*

### Definition of Done

- Semua jalur sukses dan gagal lolos tanpa data corruption.

## 4) Global Rate Limiting Across Instances

- Priority: P0
- Owner: *Saya (Mikba)*
- Target Date: *20 April 2026*
- Status: [ ]

### Checklist

- [ ] `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` terpasang di production.
- [ ] Fallback memory hanya dipakai saat emergency, bukan default production.
- [ ] Validasi limit global lintas instance Vercel lulus.
- [ ] Observability rate-limit (hit, reject, fallback) terdokumentasi.
- [ ] Alert saat fallback aktif berkepanjangan.

### Evidence

- Load test/output bukti lintas instance: *TBD*
- Observability snapshot: *TBD*

### Definition of Done

- Perilaku throttling konsisten di seluruh instance.

## 5) Secrets and Privileged Access Security

- Priority: P0
- Owner: *Saya (Mikba)*
- Target Date: *27 April 2026*
- Status: [ ]

### Checklist

- [ ] Secret role key dan payment/shipping secret tidak pernah terekspos client.
- [ ] Validasi env wajib saat startup (fail fast jika missing/invalid).
- [ ] Rotasi secret penting memiliki prosedur jelas.
- [ ] Audit akses untuk credential privileged tersedia.
- [ ] Secret scanning dan review konfigurasi deployment dilakukan.

### Evidence

- Security checklist: *TBD*
- Secret audit result: *TBD*

### Definition of Done

- Tidak ada kebocoran secret pada client bundle/log publik.

## 6) Dispute Flow Completeness

- Priority: P1
- Owner: *Saya (Mikba)*
- Target Date: *27 April 2026*
- Status: [ ]

### Checklist

- [ ] Evidence upload (foto/video) tersedia dan tervalidasi.
- [ ] Notifikasi dispute dikirim saat create, update, resolve.
- [ ] Auto-escalation dispute 14 hari aktif via cron/worker.
- [ ] Jalur refund/partial/rejected konsisten dengan state machine.
- [ ] Admin memiliki context dispute yang cukup untuk keputusan.

### Evidence

- Dispute timeline test report: *TBD*
- Notification delivery proof: *TBD*

### Definition of Done

- Tidak ada dispute aktif yang macet tanpa SLA handling.

## 7) Critical Test Coverage for Money Flows

- Priority: P1
- Owner: *Saya (Mikba)*
- Target Date: *27 April 2026*
- Status: [ ]

### Checklist

- [ ] Integration test checkout lifecycle lengkap.
- [ ] Integration test webhook payment/shipping lulus.
- [ ] Disbursement, retry, dan refund test lulus konsisten.
- [ ] CI wajib block merge jika test kritis gagal.
- [ ] Flaky test rate dipantau dan ditekan.

### Evidence

- CI run URL: *TBD*
- Coverage report: *TBD*

### Definition of Done

- Test suite kritis hijau stabil pada beberapa run berurutan.

## 8) E2E Smoke for Core User Journeys

- Priority: P1
- Owner: *Saya (Mikba)*
- Target Date: *27 April 2026*
- Status: [ ]

### Checklist

- [ ] E2E login flow.
- [ ] E2E product upload flow.
- [ ] E2E offer to checkout flow.
- [ ] E2E chat basic flow.
- [ ] Smoke tests dijalankan di pipeline release.

### Evidence

- Playwright report/video: *TBD*

### Definition of Done

- Core journey pengguna lulus tanpa blocker regression.

## 9) Monitoring and Alerting for Payment and Shipping Incidents

- Priority: P1
- Owner: *Saya (Mikba)*
- Target Date: *4 May 2026*
- Status: [ ]

### Checklist

- [ ] Dashboard operasional menampilkan KPI incident real-time.
- [ ] Alert untuk webhook failure, disbursement failure, dan timeout aktif.
- [ ] Terdapat threshold dan on-call routing yang jelas.
- [ ] Notifikasi alert tidak noisy (tuning threshold dilakukan).

### Evidence

- Dashboard link: *TBD*
- Alert policy screenshot: *TBD*

### Definition of Done

- Incident critical terdeteksi cepat dan bisa ditindaklanjuti.

## 10) Admin Action Auditability

- Priority: P1
- Owner: *Saya (Mikba)*
- Target Date: *4 May 2026*
- Status: [ ]

### Checklist

- [ ] Audit log viewer tersedia untuk admin/moderator.
- [ ] Log mencatat actor, action, target, timestamp, result.
- [ ] Filter audit (who, what, when) tersedia.
- [ ] Aksi sensitif (ban, resolve dispute, moderation) terekam lengkap.

### Evidence

- UI screenshot audit viewer: *TBD*
- Sample audit trail: *TBD*

### Definition of Done

- Semua aksi admin sensitif dapat ditelusuri end-to-end.

## 11) Product Search Reliability Baseline

- Priority: P2
- Owner: *Saya (Mikba)*
- Target Date: *4 May 2026*
- Status: [ ]

### Checklist

- [ ] Full-text search baseline diaktifkan.
- [ ] Relevansi hasil minimum tervalidasi pada query umum.
- [ ] Waktu respons search berada di target performa.
- [ ] Error/fallback search ditangani dengan baik.

### Evidence

- Search benchmark: *TBD*
- Relevancy test sheet: *TBD*

### Definition of Done

- Search stabil, relevan, dan tidak menghambat conversion utama.

## 12) Pre-commit and Quality Gate Enforcement

- Priority: P2
- Owner: *Saya (Mikba)*
- Target Date: *4 May 2026*
- Status: [ ]

### Checklist

- [ ] Pre-commit menjalankan lint, typecheck, dan test minimal.
- [ ] CI gate memblok merge jika quality checks gagal.
- [ ] Rules lint-staged optimal untuk file yang berubah.
- [ ] Dokumentasi contributor mencerminkan quality gate aktual.

### Evidence

- Sample failed gate log: *TBD*
- Updated contribution guideline: *TBD*

### Definition of Done

- Perubahan kode tidak bisa masuk main tanpa melewati quality gate.

## Global Exit Criteria (Go/No-Go)

- [ ] Semua item P0 selesai 100%.
- [ ] Item P1 tidak memiliki blocker terbuka.
- [ ] Tidak ada incident kritis unresolved pada payment dan shipping.
- [ ] CI release branch stabil.
- [ ] Runbook operasional utama tersedia dan mudah dijalankan.

## Catatan Eksekusi Mingguan

- Week 1 focus: Item 1-4
- Week 2 focus: Item 5-8
- Week 3 focus: Item 9-12 dan hardening akhir
