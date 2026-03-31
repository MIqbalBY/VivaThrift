-- Add username column to users table (Instagram-style @username)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;

-- Unique constraint (case-insensitive) via unique index on lower(username)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON public.users (lower(username));
