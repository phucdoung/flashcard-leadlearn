-- ====================================================================
-- FIX TRIGGER & BACKFILL FULL_NAME FOR PUBLIC.PROFILES
-- ====================================================================

-- 1. Create or Replace Function for Automatic Profile Creation on User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  extracted_name TEXT;
BEGIN
  -- Extract full_name with strict fallback: metadata full_name -> metadata name -> email prefix
  extracted_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    extracted_name,
    NEW.raw_user_meta_data->>'avatar_url',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(
      NULLIF(trim(EXCLUDED.full_name), ''),
      NULLIF(trim(profiles.full_name), ''),
      split_part(NEW.email, '@', 1)
    ),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-attach Trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 2. BACKFILL SQL QUERY: FIX ALL EXISTING PROFILES WHERE FULL_NAME IS NULL
-- ====================================================================
UPDATE public.profiles p
SET
  full_name = COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  ),
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
AND (
  p.full_name IS NULL
  OR trim(p.full_name) = ''
);
