-- ====================================================================
-- ADD PHONE AND SHOW_PHONE COLUMNS TO PUBLIC.PROFILES
-- ====================================================================

-- 1. Add optional phone column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Add public phone visibility toggle (default false / OFF)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT false;
