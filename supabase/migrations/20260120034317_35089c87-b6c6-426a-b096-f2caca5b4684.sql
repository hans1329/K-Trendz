-- Security fix: avoid SECURITY DEFINER view while still preventing 'Anonymous' participants
-- Approach:
-- 1) Use a SECURITY INVOKER view (security_invoker=on)
-- 2) Allow SELECT on ONLY non-sensitive columns via column-level GRANTs
-- 3) Keep wallet_address/fid/linked_user_id inaccessible from anon/authenticated

BEGIN;

-- Recreate as security invoker view (no RLS bypass)
DROP VIEW IF EXISTS public.external_wallet_users_public;

CREATE VIEW public.external_wallet_users_public
WITH (security_invoker=on) AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  source,
  created_at
FROM public.external_wallet_users;

-- Lock down base table privileges
REVOKE ALL ON TABLE public.external_wallet_users FROM PUBLIC;
REVOKE ALL ON TABLE public.external_wallet_users FROM anon;
REVOKE ALL ON TABLE public.external_wallet_users FROM authenticated;

-- Allow selecting ONLY non-sensitive columns (column-level privileges)
GRANT SELECT (id, username, display_name, avatar_url, source, created_at)
  ON TABLE public.external_wallet_users TO anon;
GRANT SELECT (id, username, display_name, avatar_url, source, created_at)
  ON TABLE public.external_wallet_users TO authenticated;

-- Allow selecting the view
GRANT SELECT ON public.external_wallet_users_public TO anon;
GRANT SELECT ON public.external_wallet_users_public TO authenticated;

COMMIT;