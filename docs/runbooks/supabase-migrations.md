# Runbook: Supabase Migration dan Rollback

**Owner:** Tim VivaThrift  
**Last Updated:** 2026-04-11  
**Scope:** Perubahan schema database, policy RLS, function, trigger, dan sinkronisasi type `types/database.types.ts`

## Trigger

Gunakan runbook ini saat:

- Menambah atau mengubah tabel, kolom, index, constraint, view, trigger, atau function di Supabase
- Menambah atau mengubah policy RLS
- Menyiapkan migration sebelum deploy aplikasi ke production
- Perlu rollback schema yang baru saja dirilis

## Prinsip Operasional

- Semua perubahan schema harus masuk ke file migration di `supabase/migrations/`
- Hindari perubahan manual langsung di dashboard production kecuali untuk mitigasi incident yang benar-benar mendesak
- Utamakan migration additive: `CREATE`, `ADD COLUMN`, `CREATE INDEX`, `ALTER ... ENABLE` lebih aman daripada `DROP`
- Untuk perubahan destruktif, pecah jadi beberapa tahap agar rollback tetap realistis
- Setelah schema berubah, sinkronkan type TypeScript agar server route dan composable tetap konsisten

## Prasyarat

Pastikan sebelum mulai:

- [ ] Branch kerja sudah jelas dan perubahan schema memang diperlukan
- [ ] Perubahan sudah diuji di local atau staging terlebih dahulu
- [ ] Sudah tahu dampaknya ke route Nitro, composable, dan halaman admin atau checkout yang relevan
- [ ] Untuk migration berisiko tinggi, sudah ada rencana rollback yang tertulis
- [ ] Kredensial Supabase CLI sudah siap untuk environment tujuan

## Langkah Standar Membuat Migration

1. Tarik perubahan aplikasi terbaru.
2. Buat file migration baru dengan nama yang deskriptif.
3. Tulis SQL hanya di file migration, bukan mengandalkan klik manual di dashboard.
4. Jalankan migration di local.
5. Verifikasi schema, policy, dan query aplikasi.
6. Regenerate type database bila schema publik berubah.

Contoh pembuatan file migration:

```bash
supabase migration new add_dispute_resolution_fields
```

File baru akan muncul di `supabase/migrations/` dengan prefix timestamp.

## Validasi di Local

Gunakan local stack Supabase bila tersedia, lalu apply migration dan seed ulang environment local.

```bash
supabase db reset
```

Jika hanya perlu mengecek diff schema dari local development, gunakan pendekatan yang sesuai workflow tim dan pastikan SQL akhirnya tetap committed ke folder migration.

## Checklist Review Sebelum Push ke Production

- [ ] Nama migration jelas dan menggambarkan tujuan perubahan
- [ ] Tidak ada `DROP TABLE`, `DROP COLUMN`, atau `ALTER TYPE` berisiko tanpa rencana transisi
- [ ] Index baru sudah dipertimbangkan untuk query yang sering dipakai
- [ ] Policy RLS baru sudah diuji untuk role anon, authenticated, dan admin jika relevan
- [ ] Backfill data dijalankan secara aman bila kolom baru butuh nilai default
- [ ] Perubahan tidak mematahkan webhook, checkout, dispute, review, atau cron cleanup

## Deploy ke Supabase Production

Pastikan project production sudah di-link oleh Supabase CLI.

```bash
supabase db push --linked
```

Jika workflow tim memakai connection string terpisah, gunakan database URL yang sesuai dan jangan commit secret ke repo.

## Verifikasi Setelah Migration Production

Setelah migration berhasil:

- [ ] Cek tabel, kolom, index, atau policy baru di dashboard Supabase
- [ ] Uji endpoint yang paling terdampak dari perubahan schema
- [ ] Cek log error di Vercel dan Sentry dalam 10 sampai 15 menit pertama
- [ ] Pastikan cron atau webhook terkait tetap berjalan
- [ ] Regenerate type database jika belum dilakukan

Contoh sinkronisasi type:

```bash
supabase gen types typescript --linked --schema public > types/database.types.ts
```

Jika file type berubah, review diff-nya sebelum commit untuk memastikan tidak ada schema yang terlewat atau salah target schema.

## Strategi Rollback

Jangan mengandalkan rollback spontan di dashboard tanpa catatan SQL yang jelas.

Pilih salah satu strategi berikut sesuai tingkat risiko:

### Opsi A: Forward Fix

Gunakan jika masalah kecil dan bisa diperbaiki dengan migration lanjutan yang aman.

Contoh kasus:

- default value salah
- policy RLS terlalu ketat
- index kurang tepat

Langkah:

1. Buat migration baru untuk koreksi.
2. Review cepat dampaknya.
3. Push ulang ke production.

### Opsi B: Reverse Migration

Gunakan jika perubahan terbaru memang harus dibatalkan.

```bash
supabase migration new rollback_add_dispute_resolution_fields
```

Isi file rollback dengan SQL reversal yang aman, lalu deploy seperti migration biasa.

### Opsi C: Restore Backup

Gunakan hanya jika incident berdampak besar ke integritas data dan reversal SQL tidak cukup aman.

Sebelum restore backup:

- identifikasi rentang waktu dampak
- pastikan tim memahami konsekuensi kehilangan data terbaru
- koordinasikan rollback aplikasi jika schema lama tidak kompatibel dengan build baru

## Pola Aman untuk Perubahan Berisiko

Untuk perubahan besar, gunakan pola bertahap:

1. Tambah kolom atau tabel baru tanpa menghapus yang lama.
2. Deploy aplikasi yang menulis ke struktur lama dan baru jika perlu.
3. Backfill data secara terpisah.
4. Pindahkan pembacaan aplikasi ke struktur baru.
5. Hapus struktur lama hanya setelah observasi cukup.

Pola ini lebih aman untuk flow order, payout, dispute, review, dan chat.

## Verifikasi Minimal Setelah Rollback atau Forward Fix

- [ ] Login tetap normal
- [ ] Listing produk tetap bisa dibaca
- [ ] Checkout atau order flow yang relevan tidak error
- [ ] Query admin yang terdampak masih berjalan
- [ ] Tidak ada lonjakan error database di Sentry atau Vercel logs

## Referensi Terkait

- `supabase/migrations/`
- `types/database.types.ts`
- `docs/runbooks/deploy-vercel.md`
- `README.md`
