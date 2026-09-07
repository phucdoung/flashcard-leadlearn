-- Migration Script 3: Backfill profiles for existing auth users

INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
SELECT
  id,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1)
  ) AS full_name,
  raw_user_meta_data->>'avatar_url' AS avatar_url,
  created_at,
  now()
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = now();
