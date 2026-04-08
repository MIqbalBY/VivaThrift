-- =============================================================================
-- Migration: User signup trigger
-- VivaThrift · 2026-04-09
-- =============================================================================
-- Problem: The users table has no INSERT policy for client role.
-- Comment in migration 003 said "Insert is handled by auth trigger (service role)"
-- but the trigger was never created, causing signUp to fail with RLS violation.
--
-- Fix: Create a SECURITY DEFINER trigger on auth.users that copies signup
-- metadata into public.users. This is the official Supabase approach.
-- The trigger runs as the trigger owner (postgres/service_role) so it bypasses RLS.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, username, nrp, faculty, department, gender)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'name')::text,
    lower((NEW.raw_user_meta_data->>'username')::text),
    (NEW.raw_user_meta_data->>'nrp')::text,
    (NEW.raw_user_meta_data->>'faculty')::text,
    (NEW.raw_user_meta_data->>'department')::text,
    (NEW.raw_user_meta_data->>'gender')::text
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
