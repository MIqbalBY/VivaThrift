# Xendit Payment Incident Runbook

> Owner: Mikba
> Last updated: 15 April 2026
> Scope: Penanganan cepat insiden checkout, webhook invoice, dan webhook disbursement Xendit di production.

## Tujuan

Runbook ini dipakai saat ada gangguan pada alur pembayaran Xendit supaya kamu tahu langkah cek, mitigasi, dan bukti yang harus disimpan.

## Kapan Runbook Ini Dipakai

Pakai runbook ini jika salah satu kondisi berikut terjadi:

- checkout berhasil buat invoice tapi order tidak berubah status
- webhook Xendit tidak masuk atau sering gagal
- callback `401`, `400`, atau `500` meningkat tiba-tiba
- disbursement webhook tidak tercatat di Sentry
- seller payout tidak tersinkron dengan status order

## Severity Sederhana

### Sev 1

Pakai status ini jika:

- buyer tidak bisa bayar sama sekali
- semua order baru stuck di `pending_payment`
- callback Xendit gagal massal

### Sev 2

Pakai status ini jika:

- sebagian order gagal update
- alert warning/error naik tapi checkout belum lumpuh total
- issue hanya terjadi di disbursement atau payout

## Checklist 5 Menit Pertama

1. Cek apakah problem terjadi di invoice webhook, disbursement webhook, atau checkout route.
2. Cek Sentry issue terbaru dengan query:
   - `webhook:xendit-invoice`
   - `webhook:xendit-disbursement`
3. Cek apakah ada deploy atau env change terbaru.
4. Cek dashboard Xendit apakah callback token dan callback URL masih benar.
5. Catat jam insiden mulai.

## Diagnosa Cepat

### A. Jika Callback `401`

Kemungkinan:

- token dashboard dan server tidak sama
- request datang tanpa header `x-callback-token`

Yang dicek:

1. `XENDIT_CALLBACK_TOKEN` di Vercel production
2. callback token di dashboard Xendit
3. issue Sentry dengan pesan:
   - `[xendit-webhook] Invalid callback token.`
   - `[xendit-disbursement-webhook] Invalid callback token.`

Mitigasi:

1. sinkronkan token
2. redeploy jika env berubah
3. kirim test callback ulang

### B. Jika Callback `400`

Kemungkinan:

- payload tidak lengkap
- route menerima bentuk event yang tidak sesuai ekspektasi

Yang dicek:

1. issue Sentry dengan pesan:
   - `[xendit-webhook] Missing invoice id in payload.`
   - `[xendit-disbursement-webhook] Missing disbursement id in payload.`
2. payload contoh dari dashboard Xendit
3. apakah issue hanya satu kali atau berulang

Mitigasi:

1. cocokkan payload riil Xendit dengan handler yang sekarang
2. jika perlu, simpan contoh payload untuk patch handler

### C. Jika Callback `200` tapi Order Tidak Update

Kemungkinan:

- handler berjalan tapi tidak menemukan order
- invoice id tidak cocok dengan data order
- callback duplicate hanya menghasilkan `already_processed` atau `no_orders_found`

Yang dicek:

1. Sentry/console log action:
   - `no_orders_found`
   - `already_processed`
   - `payments_reconciled`
   - `confirmed`
2. data order di Supabase:
   - `xendit_invoice_id`
   - `status`
3. apakah invoice yang masuk memang invoice order itu

Mitigasi:

1. cek kecocokan `xendit_invoice_id`
2. cek callback datang setelah order berubah manual atau tidak
3. lakukan replay callback jika perlu dan aman

### D. Jika Disbursement Warning Tidak Masuk Sentry

Yang dicek:

1. deploy terbaru sudah aktif
2. `SENTRY_DSN` production valid
3. route disbursement terbaru sudah live
4. query Sentry:
   - `webhook:xendit-disbursement`

Mitigasi:

1. redeploy production
2. kirim test valid-token payload tanpa `id` untuk memicu warning aman

## Test Aman yang Boleh Dipakai

### Test Invalid Token

Tujuan: memastikan proteksi webhook aktif.

Ekspektasi:

- invoice webhook `401`
- disbursement webhook `401`

### Test Valid Token + Payload Missing ID

Tujuan: memastikan warning disbursement masuk Sentry tanpa memproses transaksi riil.

Ekspektasi:

- route disbursement `400`
- issue warning muncul dengan pesan missing disbursement id

## Evidence yang Harus Disimpan

- screenshot atau salinan issue Sentry dalam format Markdown
- screenshot alert rule yang aktif
- timestamp insiden
- status code hasil test
- commit atau deployment yang sedang live

## Kapan Insiden Dianggap Pulih

Insiden boleh dianggap selesai kalau:

- test webhook valid kembali normal
- issue baru berhenti muncul
- checkout baru bisa lanjut tanpa blocker
- tidak ada order baru yang stuck karena insiden yang sama

## Checklist Penutupan

- [x] akar masalah dicatat
- [x] bukti Sentry disimpan
- [x] jika ada env change, perubahan dicatat
- [x] jika ada code fix, commit dan deployment dicatat
- [x] TODO readiness diperbarui

## Catatan Penutupan Insiden

- Bukti Sentry sudah disimpan langsung di dokumen ini dalam format Markdown, jadi tidak bergantung pada screenshot terpisah.
- Tidak ada perubahan environment saat penanganan insiden ini, kecuali rencana penggantian Xendit key production saat cutover nanti.
- Bukti deployment live terlihat pada release Sentry yang tercatat di issue invoice dan disbursement.

## Catatan Pengujian Saat Ini

- 13 Apr 2026: invoice warning berhasil muncul di Sentry
- 13 Apr 2026: disbursement warning berhasil muncul di Sentry setelah fix flush + redeploy kedua
- 15 Apr 2026: validasi webhook payment lulus untuk jalur paid, failed, dan expired melalui automated suite lokal.
- 15 Apr 2026: callback invalid token tetap ditolak 401, payload tanpa invoice id tetap ditolak 400, dan payload valid tetap diproses normal.

## Incident Evidence: Xendit invoice invalid callback token

**Issue ID:** 111724458
**Project:** vivathrift
**Date:** 13/04/2026, 23:37:24

### Issue Summary

Xendit webhook failure: invalid callback token.

**What's wrong:** The **Xendit invoice webhook** failed due to an **invalid callback token**.
**Possible cause:** The **callback token** used by Xendit may have **expired or been revoked**.

### Tags

- **environment:** production
- **errorMessage:** Invalid callback token.
- **level:** warning
- **os:** Linux
- **os.name:** Linux
- **release:** e61d68ba400a47d55282fc1c5fb538075ce95f38
- **requestId:** 8c4a7af4-23fc-4d32-a1bf-b35519dba377
- **runtime:** node v22.22.0
- **runtime.name:** node
- **server_name:** 169.254.34.5
- **statusCode:** 401
- **webhook:** Xendit invoice

## Incident Evidence: Xendit disbursement missing payload id

**Issue ID:** 111726840
**Project:** vivathrift
**Date:** 13/04/2026, 23:50:14

### Tags

- **environment:** production
- **level:** warning
- **os:** Linux
- **os.name:** Linux
- **release:** a06535f18d74d171895091c1b6602637cd8732da
- **requestId:** 2de17492-9f6a-4efb-9acd-6fe81e8b6cef
- **runtime:** node v22.22.0
- **runtime.name:** node
- **server_name:** 169.254.7.169
- **status:** COMPLETED
- **statusCode:** 400
- **webhook:** Xendit disbursement
