# QA Bundle Index

Halaman ini menjadi pintu masuk untuk dokumen QA operasional VivaThrift.

## Quick Start

1. Pilih area uji: chat realtime atau checkout/Xendit.
2. Jalankan runbook langkah demi langkah.
3. Isi template report setelah uji selesai.
4. Simpan bukti uji (screenshot/log) dan keputusan Go/No-Go.

## Chat Realtime

- Runbook smoke test:
  - [Chat Realtime Smoke Test](../runbooks/chat-realtime-smoke-test.md)
- Template report:
  - [Chat Realtime Smoke Report Template](./chat-realtime-smoke-report-template.md)
- Contoh report terisi:
  - [Chat Realtime Smoke Report Sample](./chat-realtime-smoke-report-sample.md)

## Checkout dan Xendit

- Test matrix:
  - [Checkout Xendit Test Matrix](./checkout-xendit-test-matrix.md)
- Smoke checklist split-cost:
  - [Split Cost Smoke Checklist](./split-cost-smoke-checklist.md)
- Runbook smoke step by step:
  - [Xendit Smoke Test Step by Step](../runbooks/xendit-smoke-test-step-by-step.md)
- Production checklist:
  - [Xendit Checkout Production Checklist](../runbooks/xendit-checkout-production-checklist.md)

## Deployment dan Migrasi

- [Deploy Vercel Runbook](../runbooks/deploy-vercel.md)
- [Supabase Migrations Runbook](../runbooks/supabase-migrations.md)

## Standar Bukti Uji

- Minimal 1 screenshot per skenario.
- Simpan timestamp aksi kirim/terima untuk kasus realtime.
- Simpan potongan error log bila ada kegagalan.
- Pastikan hasil akhir menyertakan keputusan Go/No-Go.

## Ownership

- QA menyiapkan dan menjalankan skenario.
- Engineering memvalidasi issue teknis.
- Product owner memberikan final sign-off untuk release.
