# Xendit Webhook Alerting Setup

> Owner: Mikba
> Last updated: 13 April 2026
> Scope: Mengaktifkan alert untuk webhook invoice dan disbursement Xendit di Sentry.

## Tujuan

Runbook ini dipakai agar kamu bisa tahu cepat kalau webhook Xendit gagal, ditolak, atau tiba-tiba error berulang.

## Prasyarat

- Project VivaThrift sudah terhubung ke Sentry.
- Environment `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, dan `SENTRY_AUTH_TOKEN` sudah aktif di production.
- Deploy terbaru sudah berisi structured webhook logging.

## Event yang Sudah Dikirim Aplikasi

Webhook sekarang mengirim warning dan error ke Sentry dengan tag berikut:

- `webhook=xendit-invoice`
- `webhook=xendit-disbursement`
- `requestId=<uuid>`
- `statusCode=<http status jika ada>`
- `action=<hasil proses jika ada>`

## Alert Minimum yang Harus Dibuat

### 1. Alert Error Webhook Invoice

Tujuan: kasih tahu kalau endpoint `/api/webhooks/xendit` error atau ditolak tidak normal.

Langkah:

1. Buka Sentry project VivaThrift.
2. Masuk ke `Alerts`.
3. Klik `Create Alert`.
4. Pilih `Issue Alert`.
5. Gunakan filter berikut:
   - `event.type:error`
   - `tags[webhook]:xendit-invoice`
6. Trigger condition:
   - `If the issue is seen more than 1 time in 5 minutes`
7. Action:
   - kirim ke email utama kamu
   - kalau ada integrasi Slack, kirim juga ke channel ops
8. Simpan dengan nama:
   - `Xendit Invoice Webhook Error`

### 2. Alert Error Webhook Disbursement

Tujuan: kasih tahu kalau endpoint `/api/webhooks/xendit-disbursement` error.

Langkah:

1. Buka `Alerts` di Sentry.
2. Klik `Create Alert`.
3. Pilih `Issue Alert`.
4. Gunakan filter berikut:
   - `event.type:error`
   - `tags[webhook]:xendit-disbursement`
5. Trigger condition:
   - `If the issue is seen more than 1 time in 5 minutes`
6. Action:
   - kirim ke email utama kamu
   - opsional kirim ke Slack
7. Simpan dengan nama:
   - `Xendit Disbursement Webhook Error`

### 3. Alert Lonjakan Warning Webhook

Tujuan: mendeteksi lonjakan invalid token, payload rusak, atau unknown attempt yang tiba-tiba sering.

Langkah:

1. Buka `Alerts`.
2. Klik `Create Alert`.
3. Pilih `Metric Alert` jika tersedia di paket Sentry kamu.
4. Query rekomendasi:
   - event count untuk tag `webhook:xendit-invoice OR webhook:xendit-disbursement`
   - level `warning` atau `error`
5. Threshold awal:
   - `> 3 events in 5 minutes`
6. Action:
   - kirim ke email utama kamu
7. Simpan dengan nama:
   - `Xendit Webhook Failure Burst`

Kalau `Metric Alert` tidak tersedia, pakai dua `Issue Alert` dulu. Itu sudah cukup untuk baseline production.

## Test Setelah Alert Dibuat

Setelah semua alert dibuat, lakukan verifikasi sederhana:

1. Kalau kamu ingin mengetes `Issue Alert` dengan filter `level = error`, jangan pakai test token salah lebih dulu.
2. Test token salah saat ini menghasilkan event level `warning`, bukan `error`.
3. Jadi untuk test token salah, cek dulu apakah event warning muncul di Sentry.
4. Jika kamu ingin email dari rule `level = error`, ubah sementara filter level menjadi `warning`, kirim test token salah, lalu kembalikan lagi ke `error` setelah notifikasi terbukti jalan.
5. Alternatifnya, pertahankan rule `error` apa adanya dan tunggu error produksi/staging nyata yang aman untuk dijadikan bahan verifikasi.

## Bukti yang Harus Disimpan

- Screenshot alert `Xendit Invoice Webhook Error`
- Screenshot alert `Xendit Disbursement Webhook Error`
- Screenshot alert burst warning jika tersedia
- Screenshot event Sentry hasil test `401`
- Catatan tanggal dan jam test

## Kapan Checklist Dianggap Selesai

Checklist `Alert error webhook dan lonjakan failure aktif` boleh dicentang kalau:

- dua alert error sudah dibuat
- minimal satu test alert berhasil terkirim atau minimal satu event warning webhook terbukti masuk ke Sentry dan rule sudah tervalidasi manual
- evidence screenshot sudah disimpan

## Catatan Praktis

- Jangan bikin threshold terlalu sensitif di awal. Mulai dari `> 1 error` atau `> 3 warning/error dalam 5 menit`.
- Kalau notifikasi terlalu sering, naikkan threshold jadi `> 5 events in 10 minutes`.
- Kalau email tidak masuk, cek spam dan pastikan action alert benar.
