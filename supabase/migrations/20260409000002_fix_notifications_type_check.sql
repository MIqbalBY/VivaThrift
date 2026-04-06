-- =============================================================================
-- Migration: Fix notifications_type_check — add 'order_paid' type
-- Root cause: notify_on_order_status_change() trigger uses 'order_paid' type
-- but the constraint only allowed 'order_confirmed'.
-- =============================================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'new_product', 'restock', 'out_of_stock',
    'new_offer', 'offer_accepted', 'offer_rejected',
    'order_confirmed', 'order_shipped', 'order_completed',
    'order_paid'
  ]));
