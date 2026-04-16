alter table if exists public.reports enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'reports_insert_own'
  ) then
    create policy reports_insert_own
      on public.reports
      for insert
      to authenticated
      with check (
        auth.uid() = reporter_id
        and num_nonnulls(reported_product_id, reported_user_id) = 1
        and char_length(trim(reason)) > 0
      );
  end if;
end
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'reports_select_own'
  ) then
    create policy reports_select_own
      on public.reports
      for select
      to authenticated
      using (auth.uid() = reporter_id);
  end if;
end
$$ language plpgsql;
