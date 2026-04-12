-- Migration: tambah kolom payment_gateway_fee ke tabel orders
-- Kolom ini menyimpan biaya payment gateway (Xendit) yang dibebankan ke pembeli.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_gateway_fee INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.payment_gateway_fee IS
  'Biaya payment gateway Xendit yang dibebankan ke pembeli (sudah termasuk dalam total_amount).';