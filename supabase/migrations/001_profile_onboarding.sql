-- ==========================================================================
-- Migration 001: profile onboarding fields + corrected new-user trigger
-- Run this in the Supabase SQL editor against your existing database.
-- It is idempotent — safe to re-run.
-- ==========================================================================

-- 1. Add missing profile columns ------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username   TEXT,
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarded  BOOLEAN NOT NULL DEFAULT false;

-- Allow username to be NULL until onboarding sets it (no-op if already nullable).
ALTER TABLE public.profiles
  ALTER COLUMN username DROP NOT NULL;

-- Enforce uniqueness for usernames (idempotent: only created if absent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END$$;

-- 2. Replace the new-user trigger ----------------------------------------------
-- The original used NEW.user_metadata which does NOT exist on auth.users
-- (the column is raw_user_meta_data). That bug caused the trigger to fail and
-- no profile row was ever created on Google sign-in.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name, avatar_url, onboarded)
  VALUES (
    NEW.id,
    NEW.email,
    NULL,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill profiles for any existing auth users that don't have one --------
INSERT INTO public.profiles (id, email, username, display_name, avatar_url, onboarded)
SELECT
  u.id,
  u.email,
  NULL,
  COALESCE(u.raw_user_meta_data->>'full_name',
           u.raw_user_meta_data->>'name',
           split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'avatar_url',
  false
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
