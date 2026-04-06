-- Add reference_id column for linking notifications to chat rooms etc.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id text;
CREATE INDEX IF NOT EXISTS idx_notifications_reference_id
  ON notifications (reference_id) WHERE reference_id IS NOT NULL;

-- Expand the type check constraint to include offer & order notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'new_product', 'restock', 'out_of_stock',
    'new_offer', 'offer_accepted', 'offer_rejected',
    'order_confirmed', 'order_shipped', 'order_completed'
  ]));
