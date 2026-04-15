# Biteship Shipping Incident Runbook

> Owner: Mikba
> Last updated: 15 April 2026
> Scope: Penanganan gangguan webhook, status kiriman, dan incident operasional Biteship di production.

## Tujuan

Runbook ini dipakai saat update pengiriman Biteship tidak masuk, status order tidak sinkron, atau incident shipping perlu ditindaklanjuti cepat.

## Kapan Runbook Ini Dipakai

Pakai runbook ini jika salah satu kondisi berikut terjadi:

- status kiriman tidak berubah walau kurir sudah update
- webhook Biteship sering gagal atau ditolak
- order shipping tidak pindah ke status shipped saat kurir mulai pickup atau antar
- status rejected, on_hold, cancelled, atau courier_not_found meningkat
- buyer, seller, atau admin tidak menerima notifikasi incident shipping

## Severity Sederhana

### Sev 1

Pakai status ini jika:

- semua webhook shipping gagal masuk
- banyak order aktif stuck dan tidak menerima update kurir
- incident pengiriman massal berdampak ke banyak buyer

### Sev 2

Pakai status ini jika:

- hanya sebagian order gagal update
- notifikasi incident tidak lengkap
- status tertentu tidak termapping dengan benar

## Checklist 5 Menit Pertama

1. Cek apakah issue ada di webhook auth, payload Biteship, atau mapping status order.
2. Cek log server dan issue monitoring untuk webhook shipping.
3. Cek deploy atau perubahan environment terbaru.
4. Cek dashboard Biteship apakah webhook URL production masih benar.
5. Catat waktu mulai insiden dan contoh order yang terdampak.

## Diagnosa Cepat

### A. Jika Webhook Ditolak 401

Kemungkinan:

- token webhook tidak cocok
- basic auth tidak cocok
- konfigurasi auth dashboard dan server beda

Yang dicek:

1. nilai token atau basic auth di environment production
2. konfigurasi webhook auth di dashboard Biteship
3. log warning webhook shipping terbaru

Mitigasi:

1. sinkronkan auth webhook
2. redeploy jika environment berubah
3. kirim ulang test payload yang aman

### B. Jika Order Tidak Update ke Shipped

Kemungkinan:

- event tidak didukung
- order tidak ketemu dari order id Biteship
- status kurir belum masuk daftar transisi shipped

Yang dicek:

1. event yang masuk, misalnya order.status atau order.waybill_id
2. nilai order id Biteship pada order terkait
3. status order saat ini di database

Mitigasi:

1. cocokkan order id Biteship dengan payload riil
2. cek mapping status kurir di handler shipping
3. replay webhook jika aman

### C. Jika Incident Shipping Tidak Memicu Notifikasi

Kemungkinan:

- status incident tidak termasuk daftar notifikasi
- insert notifikasi terfilter sebagai duplikat
- user admin atau seller target tidak terbaca

Yang dicek:

1. status kurir, misalnya rejected, on_hold, cancelled, atau courier_not_found
2. tabel notifikasi untuk buyer, seller, dan admin
3. dashboard admin untuk unread shipping incidents

Mitigasi:

1. cek mapping notifikasi di handler shipping
2. pastikan role admin atau moderator tersedia
3. cek kembali log webhook shipping sesudah replay

## Test Aman yang Boleh Dipakai

### Test Invalid Auth

Tujuan: memastikan proteksi webhook shipping aktif.

Ekspektasi:

- webhook Biteship ditolak dengan 401
- payload tidak diproses lebih lanjut

### Test Valid Payload Rejected Status

Tujuan: memastikan incident shipping masuk dan notifikasi terkirim.

Ekspektasi:

- webhook diproses normal
- status incident tercatat
- buyer, seller, dan admin menerima notifikasi sesuai rule

## Evidence yang Harus Disimpan

- salinan issue atau log monitoring dalam format Markdown atau screenshot
- timestamp insiden
- contoh order terdampak
- hasil test auth atau replay webhook
- commit atau deployment yang sedang live

## Kapan Insiden Dianggap Pulih

Insiden boleh dianggap selesai kalau:

- webhook shipping valid kembali diproses normal
- status order sinkron dengan status kurir
- notifikasi incident kembali terkirim sesuai rule
- tidak ada order baru yang macet dengan pola sama

## Catatan Verifikasi Saat Ini

- 15 Apr 2026: auth webhook Biteship tervalidasi, invalid auth ditolak dan payload valid diterima.
- 15 Apr 2026: mapping status normal dan incident lulus automated tests.
- 15 Apr 2026: notifikasi buyer, seller, dan admin untuk incident shipping tervalidasi di test handler.
