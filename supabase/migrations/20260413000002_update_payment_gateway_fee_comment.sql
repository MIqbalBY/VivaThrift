-- Update column comment to match split-cost model.
-- payment_gateway_fee is stored for settlement/accounting, not always included in total_amount.

COMMENT ON COLUMN public.orders.payment_gateway_fee IS
  'Biaya payment gateway Xendit yang dicatat untuk perhitungan settlement/ledger seller (model split-cost), tidak selalu termasuk dalam total_amount pembeli.';
