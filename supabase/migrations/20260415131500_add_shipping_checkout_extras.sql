alter table public.orders
  add column if not exists shipping_collection_type text,
  add column if not exists shipping_insurance_fee integer not null default 0,
  add column if not exists shipping_is_insured boolean not null default false;

comment on column public.orders.shipping_collection_type is 'Buyer-selected collection mode for courier fulfillment: pickup or drop_off.';
comment on column public.orders.shipping_insurance_fee is 'Optional extra insurance fee charged during shipping checkout.';
comment on column public.orders.shipping_is_insured is 'Whether the buyer opted into additional shipping insurance.';
