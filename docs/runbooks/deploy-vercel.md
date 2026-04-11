# Runbook: Deploy dan Rollback Production di Vercel

**Owner:** Tim VivaThrift  
**Last Updated:** 2026-04-11  
**Scope:** Deploy aplikasi Nuxt 4 VivaThrift ke production melalui Vercel

## Trigger

Gunakan runbook ini saat:

- Merge perubahan ke `main`
- Perlu redeploy production setelah update environment variable
- Perlu rollback cepat karena regression di production

## Arsitektur Operasional Singkat

- Hosting aplikasi: Vercel
- App runtime: Nuxt 4 + Nitro
- Database dan auth: Supabase
- Media storage: Cloudflare R2 / CDN
- Payment: Xendit
- Shipping: Biteship
- Email: Resend
- Monitoring: Sentry
- Scheduled cleanup: Vercel Cron `/api/cron/cleanup`

## Prasyarat Sebelum Deploy

Pastikan semua poin berikut terpenuhi:

- [ ] Branch yang akan dirilis sudah direview
- [ ] CI hijau untuk `pnpm test`, `pnpm typecheck`, dan build
- [ ] Migration Supabase yang relevan sudah diuji di staging atau local
- [ ] Environment variable production di Vercel sudah lengkap
- [ ] Tidak ada incident aktif pada flow inti seperti auth, checkout, atau order

## Environment Variable Minimum

Minimal environment yang harus tersedia di Vercel production:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SECRET_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `R2_PUBLIC_URL`
- `SITE_URL`

Tambahkan juga jika fitur terkait aktif:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `RESEND_API_KEY`
- `XENDIT_KEY`
- `XENDIT_CALLBACK_TOKEN`
- `BITESHIP_KEY`
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

## Deploy Normal

### Opsi A: Deploy Standar via GitHub

1. Pastikan perubahan sudah ada di branch feature.
2. Buka pull request ke `main`.
3. Pastikan workflow CI selesai sukses.
4. Merge pull request.
5. Vercel akan otomatis membuat deployment production dari branch `main`.

### Opsi B: Redeploy dari Dashboard Vercel

Gunakan ini jika tidak ada perubahan kode tetapi perlu rebuild karena env berubah.

1. Buka project VivaThrift di dashboard Vercel.
2. Pilih deployment terbaru yang sehat atau deployment target.
3. Klik `Redeploy`.
4. Pantau build log sampai status sukses.

## Verifikasi Pasca Deploy

Lakukan verifikasi dalam 10 menit pertama setelah deploy:

- [ ] Homepage terbuka normal
- [ ] Halaman publik penting seperti `/about`, `/faq`, `/terms`, `/privacy`, dan `/contact` terbuka normal
- [ ] Login dan session Supabase berjalan normal
- [ ] Produk dan media tampil benar dari CDN atau R2
- [ ] Request ke `/api/push/vapid-public-key` tidak error
- [ ] Payment flow sandbox atau jalur checkout dasar tidak rusak
- [ ] Vercel Functions tidak menunjukkan lonjakan error
- [ ] Sentry tidak menunjukkan error runtime baru yang signifikan

## Cron yang Aktif

Di `vercel.json`, production saat ini menjalankan:

- `0 2 * * *` → `GET /api/cron/cleanup`

Pastikan endpoint cleanup tetap idempotent dan aman jika dipanggil ulang.

## Trigger Rollback

Lakukan rollback segera jika salah satu kondisi berikut terjadi:

- Error rate meningkat tajam setelah deploy
- Login, checkout, order, atau webhook inti gagal
- UI publik tidak dapat dibuka oleh user
- Ada indikasi data corruption atau status transaksi salah

## Prosedur Rollback

### Opsi A: Promote Deployment Lama di Vercel

Ini opsi tercepat.

1. Buka daftar deployment di dashboard Vercel.
2. Temukan deployment terakhir yang stabil.
3. Klik menu aksi deployment.
4. Pilih `Promote to Production`.
5. Verifikasi ulang flow inti setelah traffic berpindah.

### Opsi B: Revert Git

Gunakan jika perubahan bermasalah harus dibatalkan di histori repo.

```bash
git revert HEAD --no-edit
git push origin main
```

Vercel akan membangun ulang dari hasil revert tersebut.

## Jika Masalah Berasal dari Migration

Jangan langsung rollback tabel atau data secara impulsif.

1. Identifikasi migration yang menyebabkan masalah.
2. Nilai apakah cukup dengan rollback aplikasi saja.
3. Jika perlu rollback database, siapkan reverse migration yang aman.
4. Prioritaskan integritas data transaksi dan order.

## Checklist Penutupan Incident Setelah Rollback

- [ ] Flow inti kembali normal
- [ ] Error rate turun ke baseline
- [ ] Root cause sementara sudah dicatat
- [ ] Tim pengembang tahu perubahan mana yang menyebabkan masalah
- [ ] Follow-up fix dibuat sebagai issue atau task berikutnya

## Referensi Terkait

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/workflows/ci.yml`
- `vercel.json`
