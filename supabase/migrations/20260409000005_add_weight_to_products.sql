-- =============================================================================
-- Migration — Add weight column to products
-- VivaThrift · 2026-04-09
-- =============================================================================
-- Adds:
--   products.weight  — berat produk dalam gram, default 500g
--                      Digunakan untuk kalkulasi ongkir Biteship.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 500;

COMMENT ON COLUMN public.products.weight IS 'Berat produk dalam gram. Default 500g. Digunakan untuk kalkulasi ongkir Biteship (volumetric billing: max(weight, p*l*t/6000)).';

-- CHECK: berat minimal 1 gram, maksimal 50kg (50.000 gram) — batas wajar untuk thrift
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products' AND constraint_name = 'products_weight_valid'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT products_weight_valid CHECK (weight >= 1 AND weight <= 50000);
  END IF;
END $$;
