-- User settings for chat & notification preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_popup    BOOLEAN NOT NULL DEFAULT true,   -- show floating chat toast
  notif_product BOOLEAN NOT NULL DEFAULT true,   -- show product notification badge
  show_online   BOOLEAN NOT NULL DEFAULT true,   -- broadcast online presence
  read_receipts BOOLEAN NOT NULL DEFAULT true,   -- send & show read receipts
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select_own"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert_own"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
