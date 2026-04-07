-- Migration: shift review granularity from order → order_item
-- Each order_item now gets its own review slot (1 review per order_item).

-- 1. Add the new FK column
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id);

-- 2. Backfill: link existing reviews to the matching order_item row
UPDATE reviews r
SET    order_item_id = (
         SELECT oi.id
         FROM   order_items oi
         WHERE  oi.order_id   = r.order_id
           AND  oi.product_id = r.product_id
         LIMIT  1
       );

-- 3. Safety check: abort if any review could not be linked
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM reviews WHERE order_item_id IS NULL) THEN
    RAISE EXCEPTION 'reviews_per_order_item migration: some rows have no matching order_item. Aborting.';
  END IF;
END $$;

-- 4. Enforce NOT NULL
ALTER TABLE reviews ALTER COLUMN order_item_id SET NOT NULL;

-- 5. Drop old per-order unique constraint
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_unique_per_order;

-- 6. New unique constraint: 1 review per order_item (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'reviews' AND constraint_name = 'reviews_unique_per_order_item'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_unique_per_order_item UNIQUE (order_item_id);
  END IF;
END $$;

-- 7. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_reviews_order_item_id ON reviews(order_item_id);
