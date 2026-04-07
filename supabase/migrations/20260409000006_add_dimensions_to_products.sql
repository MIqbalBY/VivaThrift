-- =============================================================================
-- Migration — Add packaging dimensions to products
-- VivaThrift · 2026-04-09
-- =============================================================================
-- Adds opsional kolom dimensi kemasan (cm):
--   products.length  — panjang kemasan (cm)
--   products.width   — lebar kemasan (cm)
--   products.height  — tinggi kemasan (cm)
--
-- Berat volumetrik Biteship: (p × l × t) / 6000
-- Kurir memakai max(weight_actual, weight_volumetric).
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS length INTEGER,
  ADD COLUMN IF NOT EXISTS width  INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER;

COMMENT ON COLUMN public.products.length IS 'Panjang kemasan dalam cm (opsional). Untuk berat volumetrik: (p×l×t)/6000.';
COMMENT ON COLUMN public.products.width  IS 'Lebar kemasan dalam cm (opsional).';
COMMENT ON COLUMN public.products.height IS 'Tinggi kemasan dalam cm (opsional).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'products' AND constraint_name = 'products_dimensions_valid'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT products_dimensions_valid CHECK (
      (length IS NULL OR (length >= 1 AND length <= 300)) AND
      (width  IS NULL OR (width  >= 1 AND width  <= 300)) AND
      (height IS NULL OR (height >= 1 AND height <= 300))
    );
  END IF;
END $$;
