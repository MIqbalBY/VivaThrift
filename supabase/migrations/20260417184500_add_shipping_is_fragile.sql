alter table public.orders
  add column if not exists shipping_is_fragile boolean not null default false;

comment on column public.orders.shipping_is_fragile is 'Menandai paket fragile / pecah belah untuk label dan handling khusus.';
