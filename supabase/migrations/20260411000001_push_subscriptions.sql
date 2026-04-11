-- =============================================================================
-- Migration: Push notification subscriptions
-- VivaThrift · 2026-04-11
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,  -- full PushSubscription object from browser
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read/manage their own subscriptions
CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT
  USING (user_id = (select auth.uid()));

CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY push_subscriptions_delete ON public.push_subscriptions FOR DELETE
  USING (user_id = (select auth.uid()));

-- Server (service role) handles upsert — no UPDATE policy needed for users
