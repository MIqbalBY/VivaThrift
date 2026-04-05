-- WhatsApp-style per-user chat deletion
-- Each participant can independently hide a chat from their list.
-- The chat is NOT deleted from DB — just hidden from that user's view.
-- If a new message arrives after hiding, the chat reappears (messages after hidden_at).

-- 1. Add per-user hidden timestamps
ALTER TABLE "public"."chats"
  ADD COLUMN IF NOT EXISTS "buyer_hidden_at"  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "seller_hidden_at" timestamptz DEFAULT NULL;

-- 2. Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_chats_buyer_hidden
  ON "public"."chats" (buyer_id, buyer_hidden_at);
CREATE INDEX IF NOT EXISTS idx_chats_seller_hidden
  ON "public"."chats" (seller_id, seller_hidden_at);
