# Chat Realtime Smoke Test

Runbook ini untuk verifikasi alur realtime chat setelah migrasi ke DB broadcast topic
`chat:<chat_id>:messages`.

## Tujuan

- Memastikan message baru muncul realtime di dua user tanpa refresh.
- Memastikan edit message tersinkron realtime.
- Memastikan delete message tersinkron realtime.
- Memastikan akses channel private hanya untuk peserta chat.

## Prasyarat

- Migration sudah ter-apply:
  - `20260413000003_realtime_chat_broadcast.sql`
- Environment app aktif dan mengarah ke Supabase project yang sama.
- Tersedia 2 akun aktif:
  - Akun A (buyer)
  - Akun B (seller)
- Sudah ada minimal 1 chat room A <-> B.

## Data Uji

- Chat room target: isi ID chat yang dipakai pengujian.
- Device/session:
  - Window 1 login Akun A
  - Window 2 login Akun B

## Skenario 1: New Message Realtime

1. Buka chat room yang sama di Window 1 dan Window 2.
2. Dari Akun A, kirim pesan teks: `smoke-insert-001`.
3. Amati Window 2.

Lulus jika:

- Pesan `smoke-insert-001` muncul di Window 2 tanpa refresh.
- Timestamp urut sesuai waktu kirim.
- Tidak ada pesan duplikat.

## Skenario 2: Edit Message Realtime

1. Di Window 1 (Akun A), edit pesan `smoke-insert-001` menjadi
   `smoke-edit-001`.
2. Amati Window 2.

Lulus jika:

- Konten pesan di Window 2 berubah menjadi `smoke-edit-001`.
- Tanda edited (jika ada di UI) ikut tampil.
- Tidak ada item chat baru akibat edit.

## Skenario 3: Delete Message Realtime

1. Di Window 1 (Akun A), lakukan delete for all pada pesan yang sama.
2. Amati Window 2.

Lulus jika:

- Pesan di Window 2 berubah ke state deleted.
- Konten tampil sebagai marker delete (`$$DELETED$$` atau ekuivalennya di UI).
- Reply reference yang menunjuk message itu ikut ter-update.

## Skenario 4: Reconnect Behavior

1. Putuskan koneksi internet sementara di Window 2.
2. Saat offline, kirim pesan baru dari Window 1: `smoke-reconnect-001`.
3. Aktifkan kembali koneksi internet di Window 2.

Lulus jika:

- Setelah reconnect, Window 2 kembali subscribe channel chat.
- Pesan `smoke-reconnect-001` tampil tanpa perlu reload halaman.

## Skenario 5: Access Control Private Channel

1. Login akun C yang bukan buyer/seller pada chat room target.
2. Coba akses URL room yang sama.

Lulus jika:

- Akun C tidak menerima stream realtime untuk room tersebut.
- Tidak ada kebocoran message event dari room A-B ke akun C.

## Cek Teknis Tambahan

- Cek log browser console pada kedua window:
  - Tidak ada error berulang `TIMED_OUT` atau `CHANNEL_ERROR`.
- Cek Supabase dashboard logs bila ada anomali subscribe.

## Form Hasil Uji

- Tanggal:
- Environment:
- Tester:
- Chat ID:
- Skenario 1: Pass/Fail
- Skenario 2: Pass/Fail
- Skenario 3: Pass/Fail
- Skenario 4: Pass/Fail
- Skenario 5: Pass/Fail
- Catatan error (jika ada):
- Keputusan: Go / No-Go

## Kriteria Sign-Off

Boleh sign-off realtime chat jika:

- Semua skenario 1-5 pass.
- Tidak ditemukan duplikasi event pesan.
- Tidak ada kebocoran akses channel private.
