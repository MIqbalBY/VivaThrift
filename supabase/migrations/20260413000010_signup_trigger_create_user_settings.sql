-- =============================================================================
-- Migration: Ensure signup trigger seeds user_settings
-- VivaThrift · 2026-04-13
-- =============================================================================
-- Problem:
-- New users are inserted into public.users by handle_new_user(), but
-- user_settings is created lazily on first settings fetch.
--
-- Fix:
-- Extend handle_new_user() to also insert default row into public.user_settings
-- in the same trigger transaction.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name       text;
  v_username   text;
  v_nrp        text;
  v_email_pfx  text;
BEGIN
  -- Ambil prefix email (NRP) sebagai fallback jika metadata kosong
  v_email_pfx := split_part(NEW.email, '@', 1);

  v_name     := NULLIF(trim(NEW.raw_user_meta_data->>'name'), '');
  v_username := NULLIF(lower(trim(NEW.raw_user_meta_data->>'username')), '');
  v_nrp      := NULLIF(trim(NEW.raw_user_meta_data->>'nrp'), '');

  -- Fallback: gunakan prefix email jika metadata kosong
  v_name     := COALESCE(v_name, v_email_pfx);
  v_username := COALESCE(v_username, lower(replace(v_email_pfx, '.', '_')));
  v_nrp      := COALESCE(v_nrp, v_email_pfx);

  INSERT INTO public.users (id, email, name, username, nrp, faculty, department, gender)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_username,
    v_nrp,
    NULLIF(trim(NEW.raw_user_meta_data->>'faculty'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'department'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'gender'), '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
