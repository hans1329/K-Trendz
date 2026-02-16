-- Fix participant names showing as 'Anonymous'
-- Create a public, non-sensitive projection table for external wallet profiles
-- so we can keep strict RLS on external_wallet_users while still rendering usernames/avatars.

BEGIN;

-- 1) Public projection table (NO wallet_address, fid, linked_user_id)
CREATE TABLE IF NOT EXISTS public.external_wallet_profiles_public (
  id uuid PRIMARY KEY REFERENCES public.external_wallet_users(id) ON DELETE CASCADE,
  username text,
  display_name text,
  avatar_url text,
  source text NOT NULL DEFAULT 'external',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_wallet_profiles_public ENABLE ROW LEVEL SECURITY;

-- Public read is safe because table contains no sensitive identifiers
DROP POLICY IF EXISTS "Public can view external wallet profiles" ON public.external_wallet_profiles_public;
CREATE POLICY "Public can view external wallet profiles"
ON public.external_wallet_profiles_public
FOR SELECT
USING (true);

-- 2) Trigger function to sync projection table
CREATE OR REPLACE FUNCTION public.sync_external_wallet_profiles_public()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.external_wallet_profiles_public (
    id,
    username,
    display_name,
    avatar_url,
    source,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.username,
    NEW.display_name,
    NEW.avatar_url,
    COALESCE(NEW.source, 'external'),
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    source = EXCLUDED.source,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_external_wallet_profiles_public ON public.external_wallet_users;
CREATE TRIGGER sync_external_wallet_profiles_public
AFTER INSERT OR UPDATE OF username, display_name, avatar_url, source
ON public.external_wallet_users
FOR EACH ROW
EXECUTE FUNCTION public.sync_external_wallet_profiles_public();

-- 3) Backfill existing rows (so old Farcaster participants stop showing Anonymous)
INSERT INTO public.external_wallet_profiles_public (id, username, display_name, avatar_url, source, created_at, updated_at)
SELECT
  id,
  username,
  display_name,
  avatar_url,
  COALESCE(source, 'external') as source,
  COALESCE(created_at, now()) as created_at,
  COALESCE(updated_at, now()) as updated_at
FROM public.external_wallet_users
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  source = EXCLUDED.source,
  updated_at = EXCLUDED.updated_at;

-- 4) Repoint external_wallet_users_public view to the safe projection table
DROP VIEW IF EXISTS public.external_wallet_users_public;
CREATE VIEW public.external_wallet_users_public
WITH (security_invoker=on) AS
SELECT id, username, display_name, avatar_url, source, created_at
FROM public.external_wallet_profiles_public;

GRANT SELECT ON public.external_wallet_users_public TO anon, authenticated;

COMMIT;