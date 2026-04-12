# Chat Realtime Smoke Report Template

Gunakan template ini setelah menjalankan runbook smoke test realtime chat.

Referensi runbook:

- docs/runbooks/chat-realtime-smoke-test.md

## Informasi Umum

- Tanggal uji:
- Waktu mulai:
- Waktu selesai:
- Environment (local/staging/production):
- Commit hash frontend/backend yang diuji:
- Tester:
- Observer/reviewer:
- Chat ID target:
- Akun A (buyer):
- Akun B (seller):
- Akun C (non-participant, untuk access control):

## Hasil Verifikasi SQL Precheck

- Trigger `trg_messages_realtime_broadcast`: Pass/Fail
- Policy `realtime_chat_messages_select`: Pass/Fail
- Policy `realtime_chat_messages_insert`: Pass/Fail
- Catatan query (opsional):

## Ringkasan Hasil

- Total skenario: 5
- Pass:
- Fail:
- Keputusan akhir: Go / No-Go

## Detail Skenario

### Skenario 1 - New Message Realtime

- Status: Pass/Fail
- Evidence:
  - Timestamp kirim:
  - Timestamp terima:
  - Screenshot/log:
- Catatan:

### Skenario 2 - Edit Message Realtime

- Status: Pass/Fail
- Evidence:
  - Konten sebelum:
  - Konten sesudah:
  - Screenshot/log:
- Catatan:

### Skenario 3 - Delete Message Realtime

- Status: Pass/Fail
- Evidence:
  - Message ID:
  - Marker deleted terlihat: Ya/Tidak
  - Reply reference ikut update: Ya/Tidak
  - Screenshot/log:
- Catatan:

### Skenario 4 - Reconnect Behavior

- Status: Pass/Fail
- Evidence:
  - Durasi offline:
  - Pesan saat offline dari lawan chat:
  - Sinkron setelah reconnect: Ya/Tidak
  - Screenshot/log:
- Catatan:

### Skenario 5 - Access Control Private Channel

- Status: Pass/Fail
- Evidence:
  - Akun C menerima event room A-B: Ya/Tidak
  - Screenshot/log:
- Catatan:

## Defect Log

Isi bagian ini jika ada fail.

| ID | Skenario | Severity | Ringkasan | Dampak | Repro singkat | Bukti |
|---|---|---|---|---|---|---|
| BUG-001 | | Critical/High/Medium/Low | | | | |

## Risk Assessment

- Risiko tersisa 1:
- Risiko tersisa 2:
- Mitigasi yang direkomendasikan:

## Sign-Off

- QA tester: Nama / Tanggal
- Engineering owner: Nama / Tanggal
- Product owner: Nama / Tanggal
- Final decision: Go / No-Go
