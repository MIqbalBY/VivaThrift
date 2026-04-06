-- Add postal_code column to addresses table for shipping rate calculation
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS postal_code varchar(10);
