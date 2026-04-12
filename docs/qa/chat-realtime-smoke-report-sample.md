# Chat Realtime Smoke Report - Sample

Dokumen ini contoh laporan terisi untuk referensi tim QA.

Referensi:

- docs/runbooks/chat-realtime-smoke-test.md
- docs/qa/chat-realtime-smoke-report-template.md

## Informasi Umum

- Tanggal uji: 2026-04-13
- Waktu mulai: 09:10 WIB
- Waktu selesai: 09:42 WIB
- Environment (local/staging/production): staging
- Commit hash frontend/backend yang diuji: a183619
- Tester: Rina QA
- Observer/reviewer: Bayu Eng
- Chat ID target: 8f16ea7e-0be1-4b57-b988-96e61f4a9d95
- Akun A (buyer): `smoke.buyer@student.its.ac.id`
- Akun B (seller): `smoke.seller@student.its.ac.id`
- Akun C (non-participant, untuk access control): `smoke.viewer@student.its.ac.id`

## Hasil Verifikasi SQL Precheck

- Trigger `trg_messages_realtime_broadcast`: Pass
- Policy `realtime_chat_messages_select`: Pass
- Policy `realtime_chat_messages_insert`: Pass
- Catatan query (opsional): hasil sesuai migration 20260413000003

## Ringkasan Hasil

- Total skenario: 5
- Pass: 5
- Fail: 0
- Keputusan akhir: Go

## Detail Skenario

### Skenario 1 - New Message Realtime

- Status: Pass
- Evidence:
  - Timestamp kirim: 09:14:12
  - Timestamp terima: 09:14:12
  - Screenshot/log: `stg-chat-realtime-insert-pass.png`
- Catatan: tidak ditemukan duplikasi event.

### Skenario 2 - Edit Message Realtime

- Status: Pass
- Evidence:
  - Konten sebelum: smoke-insert-001
  - Konten sesudah: smoke-edit-001
  - Screenshot/log: `stg-chat-realtime-edit-pass.png`
- Catatan: badge edited muncul normal.

### Skenario 3 - Delete Message Realtime

- Status: Pass
- Evidence:
  - Message ID: b8dfd4f8-95f0-4f49-a66d-7df1439b7397
  - Marker deleted terlihat: Ya
  - Reply reference ikut update: Ya
  - Screenshot/log: `stg-chat-realtime-delete-pass.png`
- Catatan: preview reply ter-update dalam < 1 detik.

### Skenario 4 - Reconnect Behavior

- Status: Pass
- Evidence:
  - Durasi offline: 35 detik
  - Pesan saat offline dari lawan chat: smoke-reconnect-001
  - Sinkron setelah reconnect: Ya
  - Screenshot/log: `stg-chat-realtime-reconnect-pass.png`
- Catatan: channel auto-subscribe ulang setelah online.

### Skenario 5 - Access Control Private Channel

- Status: Pass
- Evidence:
  - Akun C menerima event room A-B: Tidak
  - Screenshot/log: `stg-chat-realtime-access-control-pass.png`
- Catatan: tidak ada stream message room lain ke akun C.

## Defect Log

Tidak ada defect pada sesi ini.

| ID | Skenario | Severity | Ringkasan | Dampak | Repro singkat | Bukti |
|---|---|---|---|---|---|---|
| - | - | - | - | - | - | - |

## Risk Assessment

- Risiko tersisa 1: potensi timeout network intermittent pada koneksi sangat tidak stabil.
- Risiko tersisa 2: perlu observasi lebih lama untuk traffic tinggi bersamaan.
- Mitigasi yang direkomendasikan: jalankan soak test 30 menit pada jam sibuk staging.

## Sign-Off

- QA tester: Rina QA / 2026-04-13
- Engineering owner: Bayu Eng / 2026-04-13
- Product owner: Nadia PO / 2026-04-13
- Final decision: Go
