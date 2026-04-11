-- ============================================================================
-- Migration: Rewrite old Supabase Storage URLs → Cloudflare R2 custom domain
-- Context:   Media files migrated from Supabase Storage to R2 bucket
--            "vivathrift-media", served via https://cdn.vivathrift.store.
--            Database rows still contain old Supabase Storage URLs that 404.
--
-- Pattern replaced:
--   OLD  https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
--   NEW  https://cdn.vivathrift.store/<bucket>/<path>
--
-- Also normalises any URLs using the R2 dev domain to the custom domain:
--   OLD  https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev/<path>
--   NEW  https://cdn.vivathrift.store/<path>
-- ============================================================================

BEGIN;

-- ── 1. users.avatar_url ─────────────────────────────────────────────────────

-- Supabase Storage → R2 custom domain
UPDATE users
SET avatar_url = regexp_replace(
  avatar_url,
  '^https://[^/]+\.supabase\.co/storage/v1/object/public/',
  'https://cdn.vivathrift.store/'
)
WHERE avatar_url ~ '^https://[^/]+\.supabase\.co/storage/';

-- R2 dev domain → custom domain
UPDATE users
SET avatar_url = regexp_replace(
  avatar_url,
  '^https://pub-fd635ea6682d4ca4a516ca0f81bb25f8\.r2\.dev/',
  'https://cdn.vivathrift.store/'
)
WHERE avatar_url LIKE 'https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev/%';

-- ── 2. product_media.media_url ───────────────────────────────────────────────

UPDATE product_media
SET media_url = regexp_replace(
  media_url,
  '^https://[^/]+\.supabase\.co/storage/v1/object/public/',
  'https://cdn.vivathrift.store/'
)
WHERE media_url ~ '^https://[^/]+\.supabase\.co/storage/';

UPDATE product_media
SET media_url = regexp_replace(
  media_url,
  '^https://pub-fd635ea6682d4ca4a516ca0f81bb25f8\.r2\.dev/',
  'https://cdn.vivathrift.store/'
)
WHERE media_url LIKE 'https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev/%';

-- ── 3. product_media.thumbnail_url ───────────────────────────────────────────

UPDATE product_media
SET thumbnail_url = regexp_replace(
  thumbnail_url,
  '^https://[^/]+\.supabase\.co/storage/v1/object/public/',
  'https://cdn.vivathrift.store/'
)
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url ~ '^https://[^/]+\.supabase\.co/storage/';

UPDATE product_media
SET thumbnail_url = regexp_replace(
  thumbnail_url,
  '^https://pub-fd635ea6682d4ca4a516ca0f81bb25f8\.r2\.dev/',
  'https://cdn.vivathrift.store/'
)
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url LIKE 'https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev/%';

COMMIT;
