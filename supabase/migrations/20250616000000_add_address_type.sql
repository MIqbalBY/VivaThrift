-- Add address_type column to distinguish shipping vs seller addresses
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS address_type text NOT NULL DEFAULT 'shipping';

-- Set existing rows to 'shipping'
UPDATE addresses SET address_type = 'shipping' WHERE address_type IS NULL OR address_type = '';

-- Add check constraint for valid address_type values
ALTER TABLE addresses ADD CONSTRAINT addresses_address_type_check CHECK (address_type IN ('shipping', 'seller'));

-- Add unique constraint: one address per type per user
ALTER TABLE addresses ADD CONSTRAINT addresses_user_type_unique UNIQUE (user_id, address_type);
