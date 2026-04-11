# Contributing to VivaThrift

Terima kasih sudah berkontribusi ke VivaThrift.

Dokumen ini menjelaskan workflow minimum untuk setup lokal, naming branch, format commit, dan quality checks sebelum membuka pull request.

## Prasyarat

- Node.js 22 atau lebih baru
- pnpm 10 atau lebih baru
- Akses ke project Supabase yang aktif

## Setup Lokal

1. Install dependency:

   ```bash
   pnpm install
   ```

2. Salin environment contoh:

   ```bash
   copy .env.example .env
   ```

3. Isi minimal environment yang dibutuhkan untuk development:

   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_ENDPOINT`
   - `R2_PUBLIC_URL`

4. Jalankan aplikasi:

   ```bash
   pnpm dev
   ```

Secara default development server berjalan di `http://localhost:3004`.

## Struktur Kerja

- Source app berada di folder `app/` karena repo ini memakai `srcDir: app/`.
- Server routes dan server utilities berada di folder `server/`.
- Migration database berada di folder `supabase/migrations/`.
- Test unit berada di folder `tests/`.

## Naming Branch

Gunakan branch yang deskriptif dan mudah dipindai.

- `feature/nama-fitur`
- `fix/nama-perbaikan`
- `docs/nama-dokumen`
- `chore/nama-rutin`
- `refactor/nama-area`

Contoh:

- `feature/push-notifications`
- `fix/xendit-webhook-validation`
- `docs/contributing-guide`

## Format Commit

Gunakan gaya Conventional Commits agar histori lebih konsisten.

- `feat: tambah subscription push notification`
- `fix: validasi endpoint push unsubscribe`
- `docs: tambah panduan kontribusi`
- `refactor: rapikan helper help center`
- `test: tambah unit test state machine`
- `chore: update workflow ci`

## Quality Checks

Sebelum commit atau membuka pull request, jalankan minimal:

```bash
pnpm typecheck
pnpm test
```

Jika mengubah build behavior, server routes, atau dependency penting, jalankan juga:

```bash
pnpm build
```

## Panduan Perubahan

- Gunakan `SUPABASE_SECRET_KEY` untuk setup baru. Jangan menambah referensi baru ke `SUPABASE_SERVICE_KEY` kecuali fallback kompatibilitas memang dibutuhkan.
- Jangan commit secret, token, atau isi file `.env`.
- Jangan revert perubahan user yang tidak terkait task Anda.
- Pertahankan style yang sudah ada. Hindari refactor besar jika task hanya membutuhkan perubahan kecil.
- Tambahkan atau perbarui test jika behavior bisnis berubah.
- Perbarui dokumentasi bila setup, env, atau alur developer ikut berubah.

## Pull Request Checklist

Sebelum membuka PR, pastikan poin berikut terpenuhi:

- [ ] Perubahan fokus pada satu tujuan yang jelas
- [ ] `pnpm typecheck` lulus
- [ ] `pnpm test` lulus
- [ ] `pnpm build` dijalankan jika perubahan memengaruhi runtime atau konfigurasi build
- [ ] Dokumentasi ikut diperbarui jika relevan
- [ ] Tidak ada secret atau data sensitif yang ikut ter-commit
- [ ] Screenshot atau catatan verifikasi ditambahkan jika perubahan menyentuh UI

## CI

GitHub Actions akan menjalankan pipeline berikut pada `push` dan `pull_request` ke `main`:

- `pnpm test`
- `pnpm typecheck`
- `pnpm nuxt build`

Jangan anggap perubahan selesai sebelum lolos secara lokal dan di CI.
