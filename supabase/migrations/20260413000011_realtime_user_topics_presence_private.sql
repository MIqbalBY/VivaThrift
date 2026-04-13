-- =============================================================================
-- Migration: User-scoped Realtime topics + private presence auth
-- VivaThrift · 2026-04-13
-- =============================================================================
-- Purpose:
--   1) Broadcast message changes to user-scoped inbox topics:
--      user:<user_id>:inbox
--   2) Broadcast notification changes to user-scoped topics:
--      user:<user_id>:notifications
--   3) Allow private presence topic:
--      presence:global
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Messages -> user inbox topics
-- -----------------------------------------------------------------------------
create or replace function public.broadcast_user_inbox_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_buyer_id uuid;
  v_seller_id uuid;
  v_buyer_topic text;
  v_seller_topic text;
begin
  v_chat_id := coalesce(new.chat_id, old.chat_id);

  if v_chat_id is null then
    return coalesce(new, old);
  end if;

  select c.buyer_id, c.seller_id
    into v_buyer_id, v_seller_id
  from public.chats c
  where c.id = v_chat_id;

  if v_buyer_id is not null then
    v_buyer_topic := 'user:' || v_buyer_id::text || ':inbox';
    perform realtime.broadcast_changes(
      v_buyer_topic,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  end if;

  if v_seller_id is not null then
    v_seller_topic := 'user:' || v_seller_id::text || ':inbox';
    perform realtime.broadcast_changes(
      v_seller_topic,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  end if;

  return coalesce(new, old);
end;
$$;

DROP TRIGGER IF EXISTS trg_messages_user_inbox_broadcast ON public.messages;
create trigger trg_messages_user_inbox_broadcast
after insert or update or delete on public.messages
for each row execute function public.broadcast_user_inbox_changes();

-- -----------------------------------------------------------------------------
-- Notifications -> user notifications topic
-- -----------------------------------------------------------------------------
create or replace function public.broadcast_user_notification_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_topic text;
begin
  v_user_id := coalesce(new.user_id, old.user_id);

  if v_user_id is null then
    return coalesce(new, old);
  end if;

  v_topic := 'user:' || v_user_id::text || ':notifications';

  perform realtime.broadcast_changes(
    v_topic,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );

  return coalesce(new, old);
end;
$$;

DROP TRIGGER IF EXISTS trg_notifications_user_broadcast ON public.notifications;
create trigger trg_notifications_user_broadcast
after insert or update or delete on public.notifications
for each row execute function public.broadcast_user_notification_changes();

-- -----------------------------------------------------------------------------
-- Realtime Authorization policies for private user topics + private presence
-- -----------------------------------------------------------------------------
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realtime_user_topics_select ON realtime.messages;
DROP POLICY IF EXISTS realtime_user_topics_insert ON realtime.messages;
DROP POLICY IF EXISTS realtime_presence_global_select ON realtime.messages;
DROP POLICY IF EXISTS realtime_presence_global_insert ON realtime.messages;

CREATE POLICY realtime_user_topics_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  split_part(topic, ':', 1) = 'user'
  AND split_part(topic, ':', 2) = (select auth.uid())::text
  AND split_part(topic, ':', 3) IN ('inbox', 'notifications')
);

CREATE POLICY realtime_user_topics_insert
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  split_part(topic, ':', 1) = 'user'
  AND split_part(topic, ':', 2) = (select auth.uid())::text
  AND split_part(topic, ':', 3) IN ('inbox', 'notifications')
);

CREATE POLICY realtime_presence_global_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (topic = 'presence:global');

CREATE POLICY realtime_presence_global_insert
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (topic = 'presence:global');
