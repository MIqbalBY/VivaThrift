-- Disputes / refund requests table
create table if not exists public.disputes (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  buyer_id    uuid not null references public.users(id) on delete cascade,
  seller_id   uuid not null references public.users(id) on delete cascade,
  reason      text not null,                              -- buyer's description
  evidence_urls text[] default '{}',                      -- photo/video URLs as proof
  status      text not null default 'open'
              check (status in ('open','in_review','resolved_refund','resolved_partial','resolved_rejected','cancelled')),
  resolution_note text,                                   -- admin's resolution note
  refund_amount   numeric(12,2) default 0,                -- amount to refund (0 = no refund)
  resolved_by     uuid references public.users(id),       -- admin who resolved
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes
create index if not exists idx_disputes_order_id  on public.disputes(order_id);
create index if not exists idx_disputes_buyer_id  on public.disputes(buyer_id);
create index if not exists idx_disputes_seller_id on public.disputes(seller_id);
create index if not exists idx_disputes_status    on public.disputes(status);

-- RLS
alter table public.disputes enable row level security;

-- Buyers can view their own disputes
create policy "Buyers view own disputes"
  on public.disputes for select
  using (auth.uid() = buyer_id);

-- Sellers can view disputes on their orders
create policy "Sellers view order disputes"
  on public.disputes for select
  using (auth.uid() = seller_id);

-- Buyers can insert disputes on their own orders
create policy "Buyers create disputes"
  on public.disputes for insert
  with check (auth.uid() = buyer_id);

-- Admin full access (via supabaseAdmin service role, no RLS policy needed)

-- Update notifications type check to include dispute types
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'new_product','restock','out_of_stock',
    'order_paid','order_shipped','order_completed','meetup_started',
    'new_offer','offer_accepted','offer_rejected','offer_countered',
    'new_review','new_message',
    'dispute_opened','dispute_resolved'
  ));
