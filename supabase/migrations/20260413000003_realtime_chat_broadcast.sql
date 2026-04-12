-- =============================================================================
-- Migration: Realtime chat broadcast (DB-driven)
-- VivaThrift · 2026-04-13
-- =============================================================================
-- Purpose:
--   1) Broadcast message INSERT/UPDATE/DELETE changes from DB trigger
--   2) Use private realtime topics per chat: chat:<chat_id>:messages
--   3) Enforce auth access with RLS on realtime.messages
-- =============================================================================

-- Realtime helper trigger function
create or replace function public.broadcast_chat_message_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_topic text;
begin
  v_chat_id := coalesce(new.chat_id, old.chat_id);

  if v_chat_id is null then
    return coalesce(new, old);
  end if;

  v_topic := 'chat:' || v_chat_id::text || ':messages';

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

-- Attach trigger to public.messages
DROP TRIGGER IF EXISTS trg_messages_realtime_broadcast ON public.messages;
create trigger trg_messages_realtime_broadcast
after insert or update or delete on public.messages
for each row execute function public.broadcast_chat_message_changes();

-- ---------------------------------------------------------------------------
-- RLS for private Realtime channels
-- Topic format: chat:<chat_id>:messages
-- User must be a chat participant (buyer/seller) to subscribe/send.
-- ---------------------------------------------------------------------------

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realtime_chat_messages_select ON realtime.messages;
DROP POLICY IF EXISTS realtime_chat_messages_insert ON realtime.messages;

CREATE POLICY realtime_chat_messages_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  split_part(topic, ':', 1) = 'chat'
  AND split_part(topic, ':', 3) = 'messages'
  AND EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE c.id::text = split_part(topic, ':', 2)
      AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
  )
);

CREATE POLICY realtime_chat_messages_insert
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  split_part(topic, ':', 1) = 'chat'
  AND split_part(topic, ':', 3) = 'messages'
  AND EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE c.id::text = split_part(topic, ':', 2)
      AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
  )
);
