-- Migration: tambah kolom platform_fee ke tabel orders
-- Fee VivaThrift sekarang dibebankan ke pembeli (bukan dipotong dari penjual).
-- Kolom ini menyimpan nominal fee yang sudah ditambahkan ke total_amount.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS platform_fee INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.platform_fee IS
  'Biaya layanan VivaThrift yang dibebankan ke pembeli (sudah termasuk dalam total_amount). '
  'Tier: ≤100k → Rp1.000, 100k–500k → Rp2.000, >500k → 0,5% subtotal.';
